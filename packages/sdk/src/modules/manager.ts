import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import { Address, type Transaction } from 'algosdk'

import {
  ALGORAND_ZERO_ADDRESS,
  APP_CALL_STATIC_FEE,
  RENEW_STATIC_FEE,
  VAULT_FEE_PER_ASSET,
  VAULT_OPT_IN_MBR,
} from '../constants'
import { parseTransactionError } from '../utils/error-parser'
import { strToUint8Array, concatUint8Arrays } from '../utils/internal/bytes'
import { toAmount } from '../utils/internal/numbers'
import { isValidName } from '../utils/nfd'

import { BaseModule } from './base'
import { LookupModule } from './lookup'

import type { AppBox } from './base'
import type { NfdClient } from '../client'
import type {
  Nfd,
  ListForSaleOptions,
  SendToVaultOptions,
  SendFromVaultOptions,
} from '../types'

/**
 * Manager for operations on a specific NFD
 */
export class NfdManager extends BaseModule {
  private _nfd: Nfd | null = null
  private _boxes: AppBox[] | null = null
  private readonly _nameOrAppId: string | number | bigint

  constructor(client: NfdClient, nameOrAppId: string | number | bigint) {
    super(client)
    this._nameOrAppId = nameOrAppId
  }

  /**
   * Get the NFD instance
   * @returns The NFD instance
   * @throws If the NFD cannot be resolved
   */
  private async getNfd(): Promise<Nfd> {
    if (!this._nfd) {
      // Keep the boxes from the same read so operations that need a raw box
      // value do not have to fetch it again
      const { nfd, boxes } = await new LookupModule(
        this.client,
      ).resolveWithBoxes(this._nameOrAppId, { view: 'full' })
      this._nfd = nfd
      this._boxes = boxes
    }
    return this._nfd
  }

  /**
   * Get the raw value of a box read during the last `getNfd()`
   * @param name - The box name
   * @returns The box value, or an empty array if the NFD has no such box
   */
  private getResolvedBoxValue(name: string): Uint8Array {
    return (
      this._boxes?.find((box) => box.name === name)?.value ?? new Uint8Array()
    )
  }

  /**
   * Drop the cached NFD so the next `getNfd()` re-reads it from chain. Clears
   * the cached boxes too, so they can never pair with a newer NFD.
   */
  private invalidate(): void {
    this._nfd = null
    this._boxes = null
  }

  /**
   * Assert the NFD is neither listed for sale nor expired
   *
   * The instance contract gates most owner-driven writes behind
   * `notForSaleOrExpired()`, so a live listing or a lapsed expiration blocks
   * them until the owner cancels the sale or renews. Checking here turns an
   * opaque `assert` failure into an error that names the cause and the cure.
   *
   * @param nfd - The resolved NFD
   * @param action - What the caller was trying to do, for the message
   * @throws If the NFD is for sale or expired
   */
  private assertNotForSaleOrExpired(nfd: Nfd, action: string): void {
    if (nfd.expired) {
      throw new Error(
        `Cannot ${action} because the NFD has expired. Call renew() first.`,
      )
    }
    if (nfd.sellAmount) {
      throw new Error(
        `Cannot ${action} while the NFD is listed for sale. Call cancelSale() first.`,
      )
    }
  }

  /**
   * Assert the NFD is not mid-mint
   *
   * @param nfd - The resolved NFD
   * @param action - What the caller was trying to do, for the message
   * @throws If the NFD is still minting
   */
  private assertNotMinting(nfd: Nfd, action: string): void {
    if (nfd.state === 'minting') {
      throw new Error(`Cannot ${action} while the NFD is still minting`)
    }
  }

  /**
   * Split fields and values if any values exceed the byte limit
   * @param fieldsAndValues - Array of alternating field names and values
   * @returns Array of field names and values, potentially split into chunks
   * @private
   */
  private splitFields(fieldsAndValues: string[]): string[] {
    const result: string[] = []

    for (let i = 0; i < fieldsAndValues.length; i += 2) {
      const field = fieldsAndValues[i]
      const value = fieldsAndValues[i + 1]

      // If value is small enough, add it directly
      if (value.length <= 128) {
        result.push(field, value)
        continue
      }

      // Split large values into chunks
      const chunks = Math.ceil(value.length / 128)
      for (let j = 0; j < chunks; j++) {
        const start = j * 128
        const end = Math.min(start + 128, value.length)
        const chunk = value.substring(start, end)
        const chunkField = `${field}.${j + 1}`
        result.push(chunkField, chunk)
      }

      // Add a count field
      result.push(`${field}.count`, chunks.toString())
    }

    return result
  }

  /**
   * Link an Algorand address to the NFD
   * @param address - The Algorand address to link
   * @returns The updated NFD
   * @throws If the address cannot be linked
   */
  public async linkAddress(address: string | Address): Promise<Nfd> {
    const signer = this.requireSigner()
    const nfd = await this.getNfd()

    // Ensure the default signer is the owner
    if (signer.addr.toString() !== nfd.owner) {
      throw new Error('Only the owner can link addresses to this NFD')
    }

    // Get the Address to link
    const addressToLink =
      typeof address === 'string' ? Address.fromString(address) : address

    // If address to link is not the default signer (owner), add a signer for it.
    // Compare the encoded addresses: two Address instances for the same account
    // are never reference-equal.
    if (signer.addr.toString() !== addressToLink.toString()) {
      this.algorand.setSigner(addressToLink, signer.signer)
    }

    // Get the NFD instance client
    if (!nfd.appID) {
      throw new Error('NFD has no application ID')
    }
    const nfdAppId = BigInt(nfd.appID)
    const nfdInstanceClient = this.getInstanceClient(nfdAppId, signer.addr)

    // Prepare the fields to update
    const fieldsToUpdate: Uint8Array[] = [
      strToUint8Array('u.cav.algo.a'),
      addressToLink.publicKey,
    ]

    // Current v.caAlgo.0.as box value/size, already read by getNfd() above.
    // The raw bytes are needed rather than nfd.caAlgo because empty (zero
    // filled) address slots count toward the size the update is costed against.
    const curCaAlgo = this.getResolvedBoxValue('v.caAlgo.0.as')

    // Calculate the eventual fields after the update
    const eventualFields: Uint8Array[] = [
      fieldsToUpdate[0],
      fieldsToUpdate[1],
      strToUint8Array('v.caAlgo.0.as'),
      concatUint8Arrays(curCaAlgo, addressToLink.publicKey),
    ]

    // Get the cost of the update
    const updateCostResult = await nfdInstanceClient
      .newGroup()
      .getFieldUpdateCost({ args: { fieldAndVals: eventualFields } })
      .simulate({ skipSignatures: true, allowUnnamedResources: true })

    const updateCost = updateCostResult.returns[0] || 0n

    // Create a transaction group for the update
    const nfdNewGroup = nfdInstanceClient.newGroup()

    // Add payment transaction for the update cost
    const updatePaymentTxn = await this.algorand.createTransaction.payment({
      sender: signer.addr,
      receiver: nfdInstanceClient.appAddress,
      amount: AlgoAmount.MicroAlgos(updateCost),
    })

    nfdNewGroup.addTransaction(updatePaymentTxn)
    nfdNewGroup.updateFields({ args: { fieldAndVals: fieldsToUpdate } })

    // Get the registry client
    const registryClient = this.getRegistryClient(signer.addr)

    // Get the cost to add to registry
    const regMbrCostResult = await registryClient
      .newGroup()
      .costToAddToAddress({ args: { lookupAddress: addressToLink.toString() } })
      .simulate({ skipSignatures: true, allowUnnamedResources: true })

    const regMbrCost = regMbrCostResult.returns[0] || 0n

    // Add payment transaction if needed
    if (regMbrCost > 0n) {
      const regPaymentTxn = await this.algorand.createTransaction.payment({
        sender: signer.addr,
        receiver: registryClient.appAddress,
        amount: AlgoAmount.MicroAlgos(regMbrCost),
      })

      nfdNewGroup.addTransaction(regPaymentTxn)
    }

    // Create the link transaction
    const linkRegAddress =
      await registryClient.createTransaction.linkNfdAddress({
        args: {
          nfdName: nfd.name,
          nfdAppId: nfdInstanceClient.appId,
          addrToVerify: addressToLink.toString(),
        },
        sender: addressToLink,
        staticFee: AlgoAmount.MicroAlgos(3000),
      })

    try {
      // Send the transaction group
      await nfdNewGroup
        .addTransaction(linkRegAddress.transactions[0])
        .send({ populateAppCallResources: true })
    } catch (error) {
      throw new Error(`Failed to link address: ${parseTransactionError(error)}`)
    }

    // Refresh the NFD data
    this.invalidate()
    return this.getNfd()
  }

  /**
   * Unlink an Algorand address from the NFD
   * @param address - The Algorand address to unlink
   * @returns The updated NFD
   * @throws If the address cannot be unlinked
   */
  public async unlinkAddress(address: string | Address): Promise<Nfd> {
    const signer = this.requireSigner()
    const nfd = await this.getNfd()

    // Ensure the default signer is the owner
    if (signer.addr.toString() !== nfd.owner) {
      throw new Error('Only the owner can unlink addresses from this NFD')
    }

    // Get the Address to unlink
    const addressToUnlink =
      typeof address === 'string' ? Address.fromString(address) : address

    // Get the NFD instance client
    if (!nfd.appID) {
      throw new Error('NFD has no application ID')
    }
    const nfdAppId = BigInt(nfd.appID)
    const nfdInstanceClient = this.getInstanceClient(nfdAppId, signer.addr)

    // Get the registry client
    const registryClient = this.getRegistryClient(signer.addr)

    try {
      // Create and execute the unlink transaction
      await registryClient
        .newGroup()
        .unlinkNfdAddress({
          args: {
            nfdName: nfd.name,
            nfdAppId: nfdInstanceClient.appId,
            addrToUnlink: addressToUnlink.toString(),
          },
          staticFee: AlgoAmount.MicroAlgos(5000),
        })
        .send({ populateAppCallResources: true })
    } catch (error) {
      throw new Error(
        `Failed to unlink address: ${parseTransactionError(error)}`,
      )
    }

    // Refresh the NFD data
    this.invalidate()
    return this.getNfd()
  }

  /**
   * Set user-defined metadata for the NFD
   * @param metadata - Object containing metadata key-value pairs to set
   * @returns The updated NFD
   * @throws If the metadata cannot be set
   */
  public async setMetadata(metadata: Record<string, string>): Promise<Nfd> {
    const signer = this.requireSigner()
    const nfd = await this.getNfd()

    // Ensure the default signer is the owner
    if (signer.addr.toString() !== nfd.owner) {
      throw new Error('Only the owner can set metadata for this NFD')
    }

    // Get the NFD instance client
    if (!nfd.appID) {
      throw new Error('NFD has no application ID')
    }
    const nfdAppId = BigInt(nfd.appID)
    const nfdInstanceClient = this.getInstanceClient(nfdAppId, signer.addr)

    // Convert metadata object to array of fields and values
    const fieldsAndValues: string[] = []
    for (const [key, value] of Object.entries(metadata)) {
      fieldsAndValues.push(`u.${key}`, value)
    }

    // Split fields if any values exceed the byte limit
    const fieldsToUpdate = this.splitFields(fieldsAndValues)

    // Calculate update cost for all fields
    let updateCost = 0n
    const newGroup = nfdInstanceClient.newGroup()

    // Get cost for each field update
    for (let i = 0; i < fieldsToUpdate.length; i += 2) {
      newGroup.getFieldUpdateCost({
        args: {
          fieldAndVals: [
            strToUint8Array(fieldsToUpdate[i]),
            strToUint8Array(fieldsToUpdate[i + 1]),
          ],
        },
        note: i.toString(),
      })
    }

    // Simulate to get costs
    const simReturn = await newGroup.simulate({
      skipSignatures: true,
      allowUnnamedResources: true,
    })

    const simResult = simReturn.returns

    // Sum up all costs
    for (let i = 0; i < fieldsToUpdate.length / 2; i += 1) {
      if (simResult[i]) {
        updateCost += BigInt(simResult[i])
      }
    }

    // Create a transaction group for the update
    const updateGroup = nfdInstanceClient.newGroup()

    // Add payment transaction for the update cost
    const updatePaymentTxn = await this.algorand.createTransaction.payment({
      sender: signer.addr.toString(),
      receiver: nfdInstanceClient.appAddress,
      amount: AlgoAmount.MicroAlgos(updateCost),
    })

    updateGroup.addTransaction(updatePaymentTxn)

    // Add each field update
    for (let i = 0; i < fieldsToUpdate.length; i += 2) {
      updateGroup.updateFields({
        args: {
          fieldAndVals: [
            strToUint8Array(fieldsToUpdate[i]),
            strToUint8Array(fieldsToUpdate[i + 1]),
          ],
        },
      })
    }

    try {
      // Execute the transaction
      await updateGroup.send({ populateAppCallResources: true })
    } catch (error) {
      throw new Error(`Failed to set metadata: ${parseTransactionError(error)}`)
    }

    // Refresh the NFD data
    this.invalidate()
    return this.getNfd()
  }

  /**
   * Set a specific address as the primary address for the NFD
   * @param address - The Algorand address to set as primary
   * @returns The updated NFD
   * @throws If the address cannot be set as primary
   */
  public async setPrimaryAddress(address: string | Address): Promise<Nfd> {
    const signer = this.requireSigner()
    const nfd = await this.getNfd()

    // Ensure the default signer is the owner
    if (signer.addr.toString() !== nfd.owner) {
      throw new Error('Only the owner can set the primary address for this NFD')
    }

    // Get the Address to set as primary
    const addressToSet =
      typeof address === 'string' ? Address.fromString(address) : address

    // Get the NFD instance client
    if (!nfd.appID) {
      throw new Error('NFD has no application ID')
    }
    const nfdAppId = BigInt(nfd.appID)
    const nfdInstanceClient = this.getInstanceClient(nfdAppId, signer.addr)

    // The only supported field for now is 'v.caAlgo.0.as'
    const fieldName = 'v.caAlgo.0.as'

    try {
      // Create and execute the setPrimaryAddress transaction
      await nfdInstanceClient
        .newGroup()
        .setPrimaryAddress({
          args: {
            fieldName,
            address: addressToSet.toString(),
          },
          staticFee: AlgoAmount.MicroAlgos(3000),
        })
        .send({ populateAppCallResources: true })
    } catch (error) {
      throw new Error(
        `Failed to set primary address: ${parseTransactionError(error)}`,
      )
    }

    // Refresh the NFD data
    this.invalidate()
    return this.getNfd()
  }

  /**
   * Set this NFD as the primary NFD for a specific address
   * @param address - The Algorand address to set this NFD as primary for
   * @returns The updated NFD
   * @throws If the NFD cannot be set as primary for the address
   */
  public async setPrimaryNfd(address: string | Address): Promise<Nfd> {
    const signer = this.requireSigner()
    const nfd = await this.getNfd()

    // Get the Address to set this NFD as primary for
    const targetAddress =
      typeof address === 'string' ? Address.fromString(address) : address

    // Get the NFD app ID
    if (!nfd.appID) {
      throw new Error('NFD has no application ID')
    }
    const nfdAppId = BigInt(nfd.appID)

    // Get the registry client
    const registryClient = this.getRegistryClient(signer.addr)

    try {
      await registryClient
        .newGroup()
        .setAddressPrimaryNfd({
          sender: targetAddress,
          args: {
            nfdName: nfd.name,
            nfdAppId,
            addrBeingModified: targetAddress.toString(),
          },
          staticFee: AlgoAmount.MicroAlgos(3000),
        })
        .send({ populateAppCallResources: true })
    } catch (error) {
      throw new Error(
        `Failed to set primary NFD: ${parseTransactionError(error)}`,
      )
    }

    // Refresh the NFD data
    this.invalidate()
    return this.getNfd()
  }

  /**
   * Get the renewal price for the NFD (per year, in microAlgos)
   * @returns The renewal price per year in microAlgos
   * @throws If the price cannot be retrieved
   */
  public async getRenewalPrice(): Promise<bigint> {
    const nfd = await this.getNfd()

    if (!nfd.appID) {
      throw new Error('NFD has no application ID')
    }
    const nfdAppId = BigInt(nfd.appID)
    const nfdInstanceClient = this.getInstanceClient(nfdAppId)

    try {
      const result = await nfdInstanceClient
        .newGroup()
        .getRenewPrice()
        .simulate({ skipSignatures: true, allowUnnamedResources: true })

      const price = result.returns[0]
      if (price === undefined) {
        throw new Error('No price returned')
      }

      return BigInt(price)
    } catch (error) {
      throw new Error(
        `Failed to get renewal price: ${parseTransactionError(error)}`,
      )
    }
  }

  /**
   * Renew the NFD
   *
   * The contract derives the new expiration from the amount paid, capped by
   * the registry's `maxYearsAllowed`, so the upper bound is read from the
   * registry rather than assumed.
   *
   * @param years - Number of whole years to renew for (default 1)
   * @returns The updated NFD
   * @throws If `years` is not a whole number of at least 1, exceeds the
   *   registry's maximum, or the renewal fails
   */
  public async renew(years: number = 1): Promise<Nfd> {
    const signer = this.requireSigner()

    if (!Number.isInteger(years) || years < 1) {
      throw new Error(
        `Renewal years must be a whole number of at least 1, got ${years}`,
      )
    }

    const { maxYearsAllowed } = await this.getConstraints()
    if (BigInt(years) > maxYearsAllowed) {
      throw new Error(
        `Renewal years must be at most ${maxYearsAllowed}, got ${years}`,
      )
    }

    const nfd = await this.getNfd()

    if (!nfd.appID) {
      throw new Error('NFD has no application ID')
    }
    const nfdAppId = BigInt(nfd.appID)
    const nfdInstanceClient = this.getInstanceClient(nfdAppId, signer.addr)

    // Get the renewal price per year
    const pricePerYear = await this.getRenewalPrice()
    const totalPrice = pricePerYear * BigInt(years)

    // Create the payment transaction
    const paymentTxn = await this.algorand.createTransaction.payment({
      sender: signer.addr,
      receiver: nfdInstanceClient.appAddress,
      amount: AlgoAmount.MicroAlgos(totalPrice),
    })

    try {
      await nfdInstanceClient
        .newGroup()
        .renew({
          args: { payment: paymentTxn },
          staticFee: AlgoAmount.MicroAlgos(RENEW_STATIC_FEE),
        })
        .send({ populateAppCallResources: true })
    } catch (error) {
      throw new Error(`Failed to renew NFD: ${parseTransactionError(error)}`)
    }

    // Refresh the NFD data
    this.invalidate()
    return this.getNfd()
  }

  /**
   * List the NFD for sale on the marketplace
   *
   * The contract refuses to sell an NFD that still has properties, so every
   * user-defined and verified field has to be cleared first. Calling this on
   * an NFD already listed re-prices it.
   *
   * @param price - The sale price in microAlgos
   * @param options - Optional sale configuration
   * @returns The updated NFD
   * @throws If the NFD is expired, still minting, or still has properties, or
   *   if the listing fails
   */
  public async listForSale(
    price: bigint | number,
    options: ListForSaleOptions = {},
  ): Promise<Nfd> {
    const signer = this.requireSigner()
    const sellAmount = toAmount(price, 'Sale price')
    const nfd = await this.getNfd()

    if (signer.addr.toString() !== nfd.owner) {
      throw new Error('Only the owner can list this NFD for sale')
    }

    if (nfd.expired) {
      throw new Error(
        'Cannot list an expired NFD for sale. Call renew() first.',
      )
    }
    this.assertNotMinting(nfd, 'list this NFD for sale')

    // offerForSale asserts the NFD has no boxes left. getNfd() already read
    // them, so the count is free here.
    const boxCount = this._boxes?.length ?? 0
    if (boxCount > 0) {
      throw new Error(
        `An NFD can only be sold once its properties are cleared, but ${boxCount} remain. Clear the user-defined and verified fields first.`,
      )
    }

    if (!nfd.appID) {
      throw new Error('NFD has no application ID')
    }
    const nfdAppId = BigInt(nfd.appID)
    const nfdInstanceClient = this.getInstanceClient(nfdAppId, signer.addr)

    const reservedFor = options.reservedFor ?? ALGORAND_ZERO_ADDRESS

    try {
      await nfdInstanceClient
        .newGroup()
        .offerForSale({
          args: {
            sellAmount,
            reservedFor,
          },
          staticFee: AlgoAmount.MicroAlgos(APP_CALL_STATIC_FEE),
        })
        .send({ populateAppCallResources: true })
    } catch (error) {
      throw new Error(
        `Failed to list NFD for sale: ${parseTransactionError(error)}`,
      )
    }

    // Refresh the NFD data
    this.invalidate()
    return this.getNfd()
  }

  /**
   * Cancel the sale listing for the NFD
   * @returns The updated NFD
   * @throws If the NFD is not listed for sale, is expired or still minting, or
   *   the cancellation fails
   */
  public async cancelSale(): Promise<Nfd> {
    const signer = this.requireSigner()
    const nfd = await this.getNfd()

    if (signer.addr.toString() !== nfd.owner) {
      throw new Error('Only the owner can cancel the sale of this NFD')
    }

    if (!nfd.sellAmount) {
      throw new Error('NFD is not listed for sale')
    }

    if (nfd.expired) {
      throw new Error(
        'Cannot cancel the sale of an expired NFD. Call renew() first.',
      )
    }
    this.assertNotMinting(nfd, 'cancel the sale of this NFD')

    if (!nfd.appID) {
      throw new Error('NFD has no application ID')
    }
    const nfdAppId = BigInt(nfd.appID)
    const nfdInstanceClient = this.getInstanceClient(nfdAppId, signer.addr)

    try {
      await nfdInstanceClient
        .newGroup()
        .cancelSale({
          args: {},
          staticFee: AlgoAmount.MicroAlgos(APP_CALL_STATIC_FEE),
        })
        .send({ populateAppCallResources: true })
    } catch (error) {
      throw new Error(`Failed to cancel sale: ${parseTransactionError(error)}`)
    }

    // Refresh the NFD data
    this.invalidate()
    return this.getNfd()
  }

  /**
   * Lock or unlock segment minting for the NFD
   *
   * Unlocking sets the price anyone may mint a segment at, and the contract
   * requires it to be at least the registry's `segmentPlatformCostInUsd`, so
   * the default of 0 is only valid when locking.
   *
   * @param lock - Whether to lock (true) or unlock (false) segment minting
   * @param usdPrice - The price in USD cents for minting segments (e.g., 300 = $3.00). Set to 0 if locking.
   * @returns The updated NFD
   * @throws If unlocking below the registry minimum, if the NFD is for sale or
   *   expired, or if the operation fails
   */
  public async lockSegment(lock: boolean, usdPrice: number = 0): Promise<Nfd> {
    const signer = this.requireSigner()
    const segmentPrice = toAmount(usdPrice, 'Segment price')
    const nfd = await this.getNfd()

    if (signer.addr.toString() !== nfd.owner) {
      throw new Error('Only the owner can lock/unlock segments for this NFD')
    }

    this.assertNotForSaleOrExpired(nfd, 'lock/unlock segments for this NFD')

    if (!lock) {
      const { segmentPlatformCostInUsd } = await this.getConstraints()
      if (segmentPrice < segmentPlatformCostInUsd) {
        throw new Error(
          `Segment price must be at least ${segmentPlatformCostInUsd} USD cents when unlocking segment minting, got ${segmentPrice}`,
        )
      }
    }

    if (!nfd.appID) {
      throw new Error('NFD has no application ID')
    }
    const nfdAppId = BigInt(nfd.appID)
    const nfdInstanceClient = this.getInstanceClient(nfdAppId, signer.addr)

    try {
      await nfdInstanceClient
        .newGroup()
        .segmentLock({
          args: {
            lock,
            usdPrice: segmentPrice,
          },
          staticFee: AlgoAmount.MicroAlgos(APP_CALL_STATIC_FEE),
        })
        .send({ populateAppCallResources: true })
    } catch (error) {
      throw new Error(
        `Failed to ${lock ? 'lock' : 'unlock'} segments: ${parseTransactionError(error)}`,
      )
    }

    // Refresh the NFD data
    this.invalidate()
    return this.getNfd()
  }

  /**
   * Lock or unlock vault opt-ins for the NFD
   * @param lock - Whether to lock (true) or unlock (false) vault opt-ins.
   *   When locked, only the owner can opt the vault into assets.
   *   When unlocked, anyone can opt the vault into assets.
   * @returns The updated NFD
   * @throws If the NFD is for sale or expired, or the operation fails
   */
  public async lockVault(lock: boolean): Promise<Nfd> {
    const signer = this.requireSigner()
    const nfd = await this.getNfd()

    if (signer.addr.toString() !== nfd.owner) {
      throw new Error('Only the owner can lock/unlock the vault for this NFD')
    }

    this.assertNotForSaleOrExpired(nfd, 'lock/unlock the vault for this NFD')

    if (!nfd.appID) {
      throw new Error('NFD has no application ID')
    }
    const nfdAppId = BigInt(nfd.appID)
    const nfdInstanceClient = this.getInstanceClient(nfdAppId, signer.addr)

    try {
      await nfdInstanceClient
        .newGroup()
        .vaultOptInLock({
          args: { lock },
          staticFee: AlgoAmount.MicroAlgos(APP_CALL_STATIC_FEE),
        })
        .send({ populateAppCallResources: true })
    } catch (error) {
      throw new Error(
        `Failed to ${lock ? 'lock' : 'unlock'} vault: ${parseTransactionError(error)}`,
      )
    }

    // Refresh the NFD data
    this.invalidate()
    return this.getNfd()
  }

  /**
   * Opt the NFD vault into assets, and optionally transfer one of them
   *
   * `options.amount` sends that many base units of the asset to the vault in
   * the same group. Since the amount applies to one asset, it can only be
   * given alongside a single asset — call this once per asset to send several.
   *
   * The vault's minimum balance rises by {@link VAULT_OPT_IN_MBR} per asset,
   * and the contract requires the caller to fund it in the same group. That
   * payment is charged for every asset passed, whether or not the vault is
   * already opted into it, so filter out assets the vault already holds.
   *
   * @param assets - ASA IDs to opt the vault into. `0` (ALGO) needs no opt-in
   *   and is only meaningful together with `amount`.
   * @param options - Options for the vault operation
   * @returns The updated NFD
   * @throws If `assets` is empty, if `amount` is given with more than one
   *   asset, if the NFD is for sale or expired, or if the operation fails
   */
  public async sendToVault(
    assets: number[],
    options: SendToVaultOptions = {},
  ): Promise<Nfd> {
    const signer = this.requireSigner()

    if (assets.length === 0) {
      throw new Error('At least one asset must be specified')
    }

    const sendsAsset = !options.optInOnly && options.amount !== undefined
    if (sendsAsset && assets.length > 1) {
      throw new Error(
        'An amount can only be sent with a single asset. Call sendToVault once per asset, or omit amount to opt the vault in without transferring.',
      )
    }

    const amount =
      options.optInOnly || options.amount === undefined
        ? 0n
        : toAmount(options.amount, 'Transfer amount')

    // ALGO needs no opt-in, so it never goes into the vaultOptIn call
    const assetsToOptIn = assets.filter((assetId) => assetId !== 0)

    if (assetsToOptIn.length === 0 && !sendsAsset) {
      throw new Error(
        'Nothing to do: ALGO (asset 0) needs no opt-in, so sending it requires an amount.',
      )
    }

    const nfd = await this.getNfd()

    this.assertNotForSaleOrExpired(nfd, 'send to the vault')

    if (!nfd.appID) {
      throw new Error('NFD has no application ID')
    }

    // Both the MBR payment and the transfer are paid to the vault account
    const vaultAddress = nfd.nfdAccount
    if (!vaultAddress) {
      throw new Error('NFD has no vault account')
    }

    const nfdAppId = BigInt(nfd.appID)
    const nfdInstanceClient = this.getInstanceClient(nfdAppId, signer.addr)

    // Build the payments up front so a failure to construct one is not
    // reported as though the transaction itself had failed

    // vaultOptIn verifies the transaction immediately before it pays the
    // vault's added minimum balance, and rejects being first in the group
    let mbrTxn: Transaction | undefined
    if (assetsToOptIn.length > 0) {
      mbrTxn = await this.algorand.createTransaction.payment({
        sender: signer.addr,
        receiver: vaultAddress,
        amount: AlgoAmount.MicroAlgos(
          VAULT_OPT_IN_MBR * BigInt(assetsToOptIn.length),
        ),
      })
    }

    let transferTxn: Transaction | undefined
    if (sendsAsset) {
      const assetId = assets[0]
      transferTxn =
        assetId === 0
          ? await this.algorand.createTransaction.payment({
              sender: signer.addr,
              receiver: vaultAddress,
              amount: AlgoAmount.MicroAlgos(amount),
              note: options.note,
            })
          : await this.algorand.createTransaction.assetTransfer({
              sender: signer.addr,
              receiver: vaultAddress,
              assetId: BigInt(assetId),
              amount,
              note: options.note,
            })
    }

    // One inner transaction per asset the contract opts into
    const totalFee =
      APP_CALL_STATIC_FEE + VAULT_FEE_PER_ASSET * BigInt(assetsToOptIn.length)

    try {
      const group = nfdInstanceClient.newGroup()

      // Order matters: the MBR payment has to sit directly before the opt-in
      if (mbrTxn) {
        group.addTransaction(mbrTxn)
        group.vaultOptIn({
          args: { assets: assetsToOptIn.map(BigInt) },
          staticFee: AlgoAmount.MicroAlgos(totalFee),
        })
      }

      if (transferTxn) {
        group.addTransaction(transferTxn)
      }

      await group.send({ populateAppCallResources: true })
    } catch (error) {
      throw new Error(
        `Failed to send to vault: ${parseTransactionError(error)}`,
      )
    }

    // Refresh the NFD data
    this.invalidate()
    return this.getNfd()
  }

  /**
   * Resolve a vault receiver to an Algorand address
   *
   * `vaultSend`'s receiver argument is an ABI `address`, so an NFD name has to
   * be resolved to one first. `receiverType` picks which of the receiving
   * NFD's accounts to send to.
   *
   * @param receiver - An Algorand address, or an NFD name to resolve
   * @param receiverType - Which account of a receiving NFD to send to:
   *   its deposit account (`'account'`) or its vault (`'nfdVault'`)
   * @returns The receiving Algorand address
   * @throws If the receiver is neither a valid address nor a resolvable NFD
   *   name, or `'nfdVault'` is used with a plain address
   */
  private async resolveVaultReceiver(
    receiver: string,
    receiverType: 'account' | 'nfdVault' = 'account',
  ): Promise<string> {
    if (!isValidName(receiver)) {
      if (receiverType === 'nfdVault') {
        throw new Error(
          `receiverType 'nfdVault' needs an NFD name as the receiver, got the address ${receiver}`,
        )
      }

      // Reject a malformed address here rather than letting ABI encoding fail
      // inside the send, where it reads as a transaction failure
      try {
        Address.fromString(receiver)
      } catch {
        throw new Error(
          `Receiver must be an Algorand address or an NFD name, got ${receiver}`,
        )
      }

      return receiver
    }

    const receiverNfd = await this.client.resolve(receiver, { view: 'tiny' })

    if (receiverType === 'nfdVault') {
      if (!receiverNfd.nfdAccount) {
        throw new Error(`NFD ${receiver} has no vault account`)
      }
      return receiverNfd.nfdAccount
    }

    const depositAccount = receiverNfd.depositAccount ?? receiverNfd.owner
    if (!depositAccount) {
      throw new Error(`NFD ${receiver} has no deposit account`)
    }
    return depositAccount
  }

  /**
   * Send assets from the NFD vault to a receiver
   *
   * `options.amount` applies to a single asset. Passing several assets means
   * "send the full balance of each", which the contract only accepts with no
   * amount — it closes the vault out of every asset in the list.
   *
   * @param assets - ASA IDs to send from the vault, or `[0]` to send ALGO
   * @param receiver - The receiving Algorand address, or an NFD name to
   *   resolve to one
   * @param options - Options for the vault operation
   * @returns The updated NFD
   * @throws If `assets` is empty, if `amount` is given with more than one
   *   asset, if ALGO is combined with other assets or sent without an amount,
   *   if the NFD is for sale or expired, if the receiver cannot be resolved,
   *   or if the operation fails
   */
  public async sendFromVault(
    assets: number[],
    receiver: string,
    options: SendFromVaultOptions = {},
  ): Promise<Nfd> {
    const signer = this.requireSigner()

    if (assets.length === 0) {
      throw new Error('At least one asset must be specified')
    }

    const amount =
      options.amount === undefined
        ? 0n
        : toAmount(options.amount, 'Transfer amount')

    // vaultSend applies the amount to a single asset; with more than one it
    // closes out each in full, which the contract requires amount 0 for
    if (amount !== 0n && assets.length > 1) {
      throw new Error(
        'An amount can only be sent with a single asset. Call sendFromVault once per asset, or omit amount to send the full balance of each.',
      )
    }

    // ALGO has no close-out path in the contract: it is sent by explicit
    // amount, on its own
    if (assets.includes(0)) {
      if (assets.length > 1) {
        throw new Error(
          'ALGO (asset 0) must be sent from the vault on its own, not alongside other assets',
        )
      }
      if (amount === 0n) {
        throw new Error(
          'Sending ALGO (asset 0) from the vault requires an amount',
        )
      }
    }

    const nfd = await this.getNfd()

    if (signer.addr.toString() !== nfd.owner) {
      throw new Error('Only the owner can send from the vault')
    }

    this.assertNotForSaleOrExpired(nfd, 'send from the vault')

    if (!nfd.appID) {
      throw new Error('NFD has no application ID')
    }

    const receiverAddress = await this.resolveVaultReceiver(
      receiver,
      options.receiverType,
    )

    // The contract claws its own ASA back rather than transferring it, and
    // only ever to the owner
    if (
      nfd.asaID &&
      assets.includes(nfd.asaID) &&
      receiverAddress !== nfd.owner
    ) {
      throw new Error(
        `The NFD's own ASA (${nfd.asaID}) can only be sent from the vault to the owner`,
      )
    }

    const nfdAppId = BigInt(nfd.appID)
    const nfdInstanceClient = this.getInstanceClient(nfdAppId, signer.addr)

    const primaryAsset = BigInt(assets[0])
    const otherAssets = assets.slice(1).map(BigInt)

    // One inner transaction per asset the contract sends
    const totalFee =
      APP_CALL_STATIC_FEE + VAULT_FEE_PER_ASSET * BigInt(assets.length)

    try {
      await nfdInstanceClient
        .newGroup()
        .vaultSend({
          args: {
            amount,
            receiver: receiverAddress,
            note: options.note ?? '',
            asset: primaryAsset,
            otherAssets,
          },
          staticFee: AlgoAmount.MicroAlgos(totalFee),
        })
        .send({ populateAppCallResources: true })
    } catch (error) {
      throw new Error(
        `Failed to send from vault: ${parseTransactionError(error)}`,
      )
    }

    // Refresh the NFD data
    this.invalidate()
    return this.getNfd()
  }
}
