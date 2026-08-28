import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account'
import { Address } from 'algosdk'

import { DefaultSender, NfdRegistryId } from '../constants'
import { NfdInstanceClient } from '../contracts/NFDInstanceClient'
import { NfdRegistryClient } from '../contracts/NFDRegistryClient'
import { getAllBoxes } from '../utils/internal/boxes'
import {
  decodeAppIdFromNameBox,
  getNameBoxName,
} from '../utils/internal/registry-box'
import { isValidName } from '../utils/nfd'

import type { NfdClient } from '../client'
import type { Constraints } from '../contracts/NFDRegistryClient'
import type { AppBox } from '../utils/internal/boxes'

export type { AppBox } from '../utils/internal/boxes'

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
   * Get every box for an application, with values included
   *
   * Uses the `include=values` query parameter so that names and values arrive
   * together, which takes one request per page rather than one request per box.
   * Pages after the first are pinned to the round the first page was read at, so
   * a multi-page read is consistent.
   *
   * @param appId - The application ID to read boxes from
   * @returns Every box for the application
   * @throws If the node returns boxes without values, or does not advance the
   * pagination cursor
   */
  protected getAllBoxes(appId: bigint): Promise<AppBox[]> {
    return getAllBoxes(this.algorand.client.algod, appId)
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
   * Parse a name or app ID input into a bigint app ID
   *
   * Resolving a name costs one registry box read; a numeric input costs
   * nothing. Callers that only need the app ID should use this rather than a
   * full `resolve()`, which additionally reads global state and every box.
   *
   * @param nameOrAppId - The NFD name or application ID to parse
   * @returns The NFD's application ID as a bigint
   * @throws If the input is an invalid NFD name or the NFD does not exist
   */
  protected async parseAppId(
    nameOrAppId: string | number | bigint,
  ): Promise<bigint> {
    // If it's already a number or bigint, just return it
    if (typeof nameOrAppId !== 'string') {
      return BigInt(nameOrAppId)
    }

    // A wholly numeric string is an app ID. The test has to be the whole
    // string: NFD names may be all digits, and `parseInt('123.algo')` reads
    // that as app ID 123 — a valid app that is never the NFD asked for.
    if (/^\d+$/.test(nameOrAppId)) {
      return BigInt(nameOrAppId)
    }

    // Validate and lookup NFD name
    if (!isValidName(nameOrAppId)) {
      throw new Error(
        `Invalid NFD name: ${nameOrAppId}. Name must be in the format 'name.algo' or 'segment.name.algo'`,
      )
    }

    const appId = await this.getAppIdFromName(nameOrAppId)
    if (appId === null) {
      throw new Error(`NFD not found: ${nameOrAppId}`)
    }

    return appId
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
