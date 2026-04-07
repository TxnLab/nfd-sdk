import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import { Address } from 'algosdk'

import { ALGORAND_ZERO_ADDRESS } from '../constants'
import { parseTransactionError } from '../utils/error-parser'
import { strToUint8Array, concatUint8Arrays } from '../utils/internal/bytes'

import { BaseModule } from './base'

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
      this._nfd = await this.client.resolve(this._nameOrAppId, { view: 'full' })
    }
    return this._nfd
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

    // If address to link is not the default signer (owner), add a signer for it
    if (signer.addr !== addressToLink) {
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

    // Get current v.caAlgo.0.as box value/size
    let curCaAlgo: Uint8Array
    try {
      curCaAlgo = await nfdInstanceClient.appClient.getBoxValue('v.caAlgo.0.as')
    } catch {
      curCaAlgo = new Uint8Array()
    }

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
    this._nfd = null
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
    this._nfd = null
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
    this._nfd = null
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
    this._nfd = null
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
    this._nfd = null
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
   * @param years - Number of years to renew for (1-20, default 1)
   * @returns The updated NFD
   * @throws If the renewal fails
   */
  public async renew(years: number = 1): Promise<Nfd> {
    const signer = this.requireSigner()
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
          staticFee: AlgoAmount.MicroAlgos(5000),
        })
        .send({ populateAppCallResources: true })
    } catch (error) {
      throw new Error(`Failed to renew NFD: ${parseTransactionError(error)}`)
    }

    // Refresh the NFD data
    this._nfd = null
    return this.getNfd()
  }

  /**
   * List the NFD for sale on the marketplace
   * @param price - The sale price in microAlgos
   * @param options - Optional sale configuration
   * @returns The updated NFD
   * @throws If the listing fails
   */
  public async listForSale(
    price: bigint | number,
    options: ListForSaleOptions = {},
  ): Promise<Nfd> {
    const signer = this.requireSigner()
    const nfd = await this.getNfd()

    if (signer.addr.toString() !== nfd.owner) {
      throw new Error('Only the owner can list this NFD for sale')
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
            sellAmount: BigInt(price),
            reservedFor,
          },
          staticFee: AlgoAmount.MicroAlgos(3000),
        })
        .send({ populateAppCallResources: true })
    } catch (error) {
      throw new Error(
        `Failed to list NFD for sale: ${parseTransactionError(error)}`,
      )
    }

    // Refresh the NFD data
    this._nfd = null
    return this.getNfd()
  }

  /**
   * Cancel the sale listing for the NFD
   * @returns The updated NFD
   * @throws If the cancellation fails
   */
  public async cancelSale(): Promise<Nfd> {
    const signer = this.requireSigner()
    const nfd = await this.getNfd()

    if (signer.addr.toString() !== nfd.owner) {
      throw new Error('Only the owner can cancel the sale of this NFD')
    }

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
          staticFee: AlgoAmount.MicroAlgos(3000),
        })
        .send({ populateAppCallResources: true })
    } catch (error) {
      throw new Error(
        `Failed to cancel sale: ${parseTransactionError(error)}`,
      )
    }

    // Refresh the NFD data
    this._nfd = null
    return this.getNfd()
  }

  /**
   * Lock or unlock segment minting for the NFD
   * @param lock - Whether to lock (true) or unlock (false) segment minting
   * @param usdPrice - The price in USD cents for minting segments (e.g., 300 = $3.00). Set to 0 if locking.
   * @returns The updated NFD
   * @throws If the operation fails
   */
  public async lockSegment(
    lock: boolean,
    usdPrice: number = 0,
  ): Promise<Nfd> {
    const signer = this.requireSigner()
    const nfd = await this.getNfd()

    if (signer.addr.toString() !== nfd.owner) {
      throw new Error('Only the owner can lock/unlock segments for this NFD')
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
            usdPrice: BigInt(usdPrice),
          },
          staticFee: AlgoAmount.MicroAlgos(3000),
        })
        .send({ populateAppCallResources: true })
    } catch (error) {
      throw new Error(
        `Failed to ${lock ? 'lock' : 'unlock'} segments: ${parseTransactionError(error)}`,
      )
    }

    // Refresh the NFD data
    this._nfd = null
    return this.getNfd()
  }

  /**
   * Lock or unlock vault opt-ins for the NFD
   * @param lock - Whether to lock (true) or unlock (false) vault opt-ins.
   *   When locked, only the owner can opt the vault into assets.
   *   When unlocked, anyone can opt the vault into assets.
   * @returns The updated NFD
   * @throws If the operation fails
   */
  public async lockVault(lock: boolean): Promise<Nfd> {
    const signer = this.requireSigner()
    const nfd = await this.getNfd()

    if (signer.addr.toString() !== nfd.owner) {
      throw new Error('Only the owner can lock/unlock the vault for this NFD')
    }

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
          staticFee: AlgoAmount.MicroAlgos(3000),
        })
        .send({ populateAppCallResources: true })
    } catch (error) {
      throw new Error(
        `Failed to ${lock ? 'lock' : 'unlock'} vault: ${parseTransactionError(error)}`,
      )
    }

    // Refresh the NFD data
    this._nfd = null
    return this.getNfd()
  }

  /**
   * Opt the NFD vault into assets and optionally transfer them
   * @param assets - Array of ASA IDs to opt into (use 0 for ALGO)
   * @param options - Options for the vault operation
   * @returns The updated NFD
   * @throws If the operation fails
   */
  public async sendToVault(
    assets: number[],
    options: SendToVaultOptions = {},
  ): Promise<Nfd> {
    const signer = this.requireSigner()
    const nfd = await this.getNfd()

    if (!nfd.appID) {
      throw new Error('NFD has no application ID')
    }
    const nfdAppId = BigInt(nfd.appID)
    const nfdInstanceClient = this.getInstanceClient(nfdAppId, signer.addr)

    // Calculate fees based on number of assets
    const feePerAsset = 1000n
    const baseFee = 3000n
    const totalFee = baseFee + feePerAsset * BigInt(assets.length)

    try {
      const group = nfdInstanceClient.newGroup()

      // Opt the vault into the assets
      group.vaultOptIn({
        args: { assets: assets.map(BigInt) },
        staticFee: AlgoAmount.MicroAlgos(totalFee),
      })

      // If not opt-in only, add asset transfer transactions
      if (!options.optInOnly && assets.length > 0) {
        const vaultAddress = nfd.nfdAccount
        if (!vaultAddress) {
          throw new Error('NFD has no vault account')
        }

        for (const assetId of assets) {
          if (assetId === 0) {
            // ALGO transfer
            const paymentTxn =
              await this.algorand.createTransaction.payment({
                sender: signer.addr,
                receiver: vaultAddress,
                amount: AlgoAmount.MicroAlgos(options.amount ?? 0n),
                note: options.note,
              })
            group.addTransaction(paymentTxn)
          } else {
            // ASA transfer
            const assetTxn =
              await this.algorand.createTransaction.assetTransfer({
                sender: signer.addr,
                receiver: vaultAddress,
                assetId: BigInt(assetId),
                amount: options.amount ?? 0n,
                note: options.note,
              })
            group.addTransaction(assetTxn)
          }
        }
      }

      await group.send({ populateAppCallResources: true })
    } catch (error) {
      throw new Error(
        `Failed to send to vault: ${parseTransactionError(error)}`,
      )
    }

    // Refresh the NFD data
    this._nfd = null
    return this.getNfd()
  }

  /**
   * Send assets from the NFD vault to a receiver
   * @param assets - Array of ASA IDs to send from the vault
   * @param receiver - The receiving Algorand address or NFD name
   * @param options - Options for the vault operation
   * @returns The updated NFD
   * @throws If the operation fails
   */
  public async sendFromVault(
    assets: number[],
    receiver: string,
    options: SendFromVaultOptions = {},
  ): Promise<Nfd> {
    const signer = this.requireSigner()
    const nfd = await this.getNfd()

    if (signer.addr.toString() !== nfd.owner) {
      throw new Error('Only the owner can send from the vault')
    }

    if (!nfd.appID) {
      throw new Error('NFD has no application ID')
    }
    if (assets.length === 0) {
      throw new Error('At least one asset must be specified')
    }

    const nfdAppId = BigInt(nfd.appID)
    const nfdInstanceClient = this.getInstanceClient(nfdAppId, signer.addr)

    const primaryAsset = BigInt(assets[0])
    const otherAssets = assets.slice(1).map(BigInt)

    // Calculate fees based on number of assets
    const feePerAsset = 1000n
    const baseFee = 3000n
    const totalFee = baseFee + feePerAsset * BigInt(assets.length)

    try {
      await nfdInstanceClient
        .newGroup()
        .vaultSend({
          args: {
            amount: options.amount ?? 0n,
            receiver,
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
    this._nfd = null
    return this.getNfd()
  }
}
