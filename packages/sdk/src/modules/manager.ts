import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'

import { parseTransactionError } from '../utils/error-parser'
import { strToUint8Array, concatUint8Arrays } from '../utils/internal/bytes'

import { BaseModule } from './base'

import type { NfdClient } from '../client'
import type { Nfd } from '../types'

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
  public async linkAddress(address: string): Promise<Nfd> {
    this.requireSigner()
    const nfd = await this.getNfd()

    // Ensure the caller is the owner
    const signer = this.getSigner()
    if (!signer || signer.addr.toString() !== nfd.owner) {
      throw new Error('Only the owner can link addresses to this NFD')
    }

    // Get the NFD instance client
    if (!nfd.appID) {
      throw new Error('NFD has no application ID')
    }
    const nfdAppId = BigInt(nfd.appID)
    const nfdInstanceClient = this.getInstanceClient(
      nfdAppId,
      signer.addr.toString(),
    )

    // Prepare the fields to update
    const fieldsToUpdate: Uint8Array[] = [
      strToUint8Array('u.cav.algo.a'),
      signer.addr.publicKey,
    ]

    // Get current box value/size in NFD
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
      concatUint8Arrays(curCaAlgo, signer.addr.publicKey),
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
      sender: signer.addr.toString(),
      receiver: nfdInstanceClient.appAddress,
      amount: AlgoAmount.MicroAlgos(updateCost),
    })

    nfdNewGroup.addTransaction(updatePaymentTxn)
    nfdNewGroup.updateFields({ args: { fieldAndVals: fieldsToUpdate } })

    // Get the registry client
    const registryClient = this.getRegistryClient(signer.addr.toString())

    // Get the cost to add to registry
    const regMbrCostResult = await registryClient
      .newGroup()
      .costToAddToAddress({ args: { lookupAddress: address } })
      .simulate({ skipSignatures: true, allowUnnamedResources: true })

    const regMbrCost = regMbrCostResult.returns[0] || 0n

    // Add payment transaction if needed
    if (regMbrCost > 0n) {
      const regPaymentTxn = await this.algorand.createTransaction.payment({
        sender: signer.addr.toString(),
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
          addrToVerify: address,
        },
        sender: signer.addr,
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
  public async unlinkAddress(address: string): Promise<Nfd> {
    this.requireSigner()
    const nfd = await this.getNfd()

    // Ensure the caller is the owner
    const signer = this.getSigner()
    if (!signer || signer.addr.toString() !== nfd.owner) {
      throw new Error('Only the owner can unlink addresses from this NFD')
    }

    // Get the NFD instance client
    if (!nfd.appID) {
      throw new Error('NFD has no application ID')
    }
    const nfdAppId = BigInt(nfd.appID)
    const nfdInstanceClient = this.getInstanceClient(
      nfdAppId,
      signer.addr.toString(),
    )

    // Get the registry client
    const registryClient = this.getRegistryClient(signer.addr.toString())

    try {
      // Create and execute the unlink transaction
      await registryClient
        .newGroup()
        .unlinkNfdAddress({
          args: {
            nfdName: nfd.name,
            nfdAppId: nfdInstanceClient.appId,
            addrToUnlink: address,
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
    this.requireSigner()
    const nfd = await this.getNfd()

    // Ensure the caller is the owner
    const signer = this.getSigner()
    if (!signer || signer.addr.toString() !== nfd.owner) {
      throw new Error('Only the owner can set metadata for this NFD')
    }

    // Get the NFD instance client
    if (!nfd.appID) {
      throw new Error('NFD has no application ID')
    }
    const nfdAppId = BigInt(nfd.appID)
    const nfdInstanceClient = this.getInstanceClient(
      nfdAppId,
      signer.addr.toString(),
    )

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
}
