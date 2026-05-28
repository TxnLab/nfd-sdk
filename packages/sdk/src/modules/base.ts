import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account'
import { Address } from 'algosdk'

import { DefaultSender, NfdRegistryId } from '../constants'
import { NfdInstanceClient } from '../contracts/NFDInstanceClient'
import { NfdRegistryClient } from '../contracts/NFDRegistryClient'
import {
  decodeAppIdFromNameBox,
  getNameBoxName,
} from '../utils/internal/registry-box'

import type { NfdClient } from '../client'
import type { Constraints } from '../contracts/NFDRegistryClient'

/**
 * Base module class that all other modules will extend
 */
export abstract class BaseModule {
  protected readonly client: NfdClient
  protected readonly algorand: AlgorandClient
  protected readonly registryId: bigint
  private readonly _defaultSender: string

  constructor(client: NfdClient) {
    this.client = client
    this.algorand = client.algorand
    this.registryId = client.registryId

    // Determine the default sender based on the registry ID
    this._defaultSender =
      this.registryId === BigInt(NfdRegistryId.TESTNET)
        ? DefaultSender.TESTNET
        : DefaultSender.MAINNET
  }

  /**
   * Get the current signer
   * @returns The current signer or null if not set
   */
  protected getSigner(): TransactionSignerAccount | null {
    return this.client.signer
  }

  /**
   * Ensure a signer is set before proceeding
   * @returns The current signer
   * @throws If no signer is set
   */
  protected requireSigner(): TransactionSignerAccount {
    const signer = this.getSigner()
    if (!signer) {
      throw new Error('Signer required. Call setSigner() first.')
    }
    return signer
  }

  /**
   * Get a registry client
   * @param defaultSender - Optional default sender address
   * @returns The NFD registry client
   */
  protected getRegistryClient(
    defaultSender: string | Address = this._defaultSender,
  ): NfdRegistryClient {
    return this.algorand.client.getTypedAppClientById(NfdRegistryClient, {
      appId: this.registryId,
      defaultSender,
    })
  }

  /**
   * Get an NFD instance client
   * @param nfdAppId - The NFD's application ID
   * @param defaultSender - Optional default sender address
   * @returns The NFD instance client
   */
  protected getInstanceClient(
    nfdAppId: bigint,
    defaultSender: string | Address = this._defaultSender,
  ): NfdInstanceClient {
    return this.algorand.client.getTypedAppClientById(NfdInstanceClient, {
      appId: nfdAppId,
      defaultSender,
    })
  }

  /**
   * Get the box name for an NFD in the registry
   * @param nfdName - The NFD name to get the box name for
   * @returns The box name as a Uint8Array
   */
  protected getRegistryBoxNameForNFD(nfdName: string): Promise<Uint8Array> {
    return getNameBoxName(nfdName)
  }

  /**
   * Get an NFD's application ID from its name
   * @param name - The NFD name
   * @returns The NFD's application ID or null if not found
   */
  protected async getAppIdFromName(name: string): Promise<bigint | null> {
    const registryClient = this.getRegistryClient()
    const boxName = await this.getRegistryBoxNameForNFD(name)
    try {
      const appIdBytes = await registryClient.appClient.getBoxValue(boxName)
      if (!appIdBytes) {
        return null
      }
      // Take the second 8 bytes for the app ID (bytes 8-15)
      return decodeAppIdFromNameBox(appIdBytes)
    } catch (error) {
      // Check if error is a 404 response
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      // Re-throw other errors
      throw error
    }
  }

  /**
   * Get the protocol constraints from the NFD registry
   * @returns The protocol constraints
   * @throws If an error occurs while fetching the constraints
   */
  protected async getConstraints(): Promise<Constraints> {
    const registryClient = this.getRegistryClient()

    try {
      const result = await registryClient.newGroup().getConstraints().simulate({
        skipSignatures: true,
        allowUnnamedResources: true,
      })

      if (!result.returns) {
        throw new Error('No data returned')
      }

      const constraints = result.returns[0]
      if (!constraints) {
        throw new Error('No constraints returned')
      }

      return constraints
    } catch (error) {
      throw new Error(
        `Failed to get protocol constraints: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}
