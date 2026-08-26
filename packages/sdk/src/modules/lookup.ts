import { getAllBoxes } from '../utils/internal/boxes'
import { buildNfdRecord } from '../utils/internal/nfd-record'
import { isValidName } from '../utils/nfd'

import { BaseModule } from './base'

import type { Nfd } from '../types'
import type { AppBox } from '../utils/internal/boxes'

/**
 * Options for resolving an NFD
 */
export interface ResolveOptions {
  /**
   * The view type to use for the response
   * - 'tiny': Only include internal, caAlgo, and url properties
   * - 'brief': Include internal, caAlgo, url, avatar, and reservedFor properties
   * - 'full': Include all properties
   */
  view?: 'tiny' | 'brief' | 'full'
}

/**
 * An NFD resolved from chain, together with the boxes it was built from
 */
export interface ResolveResult {
  /** The resolved NFD record */
  nfd: Nfd
  /** Every box on the NFD instance app, regardless of the view used */
  boxes: AppBox[]
}

/**
 * Module for NFD lookup and resolution operations
 */
export class LookupModule extends BaseModule {
  /**
   * Parse a name or app ID input into a bigint app ID
   * @param nameOrAppId - The NFD name or application ID to parse
   * @returns The NFD's application ID as a bigint
   * @throws If the input is an invalid NFD name or the NFD does not exist
   */
  private async parseAppId(
    nameOrAppId: string | number | bigint,
  ): Promise<bigint> {
    // If it's already a number or bigint, just return it
    if (typeof nameOrAppId !== 'string') {
      return BigInt(nameOrAppId)
    }

    // Try to parse as a number first
    const parsedNumber = parseInt(nameOrAppId)
    if (!isNaN(parsedNumber)) {
      return BigInt(parsedNumber)
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
   * Resolve an NFD by name or application ID by reading directly from the blockchain
   * @param nameOrAppId - The NFD name or application ID to resolve
   * @param options - Optional parameters
   * @returns The NFD record
   * @throws If the NFD name is invalid or not found
   */
  public async resolve(
    nameOrAppId: string | number | bigint,
    options: ResolveOptions = {},
  ): Promise<Nfd> {
    const { nfd } = await this.resolveWithBoxes(nameOrAppId, options)
    return nfd
  }

  /**
   * Resolve an NFD and also return the boxes it was built from
   *
   * Callers that need a raw box value (rather than the parsed property) can
   * take it from the returned boxes instead of issuing a second read.
   *
   * @param nameOrAppId - The NFD name or application ID to resolve
   * @param options - Optional parameters
   * @returns The NFD record and every box on its instance app
   * @throws If the NFD name is invalid or not found
   */
  public async resolveWithBoxes(
    nameOrAppId: string | number | bigint,
    options: ResolveOptions = {},
  ): Promise<ResolveResult> {
    // Get the NFD app ID
    const nfdAppId = await this.parseAppId(nameOrAppId)

    // Get the NFD instance client
    const instanceClient = this.getInstanceClient(nfdAppId)

    // Get the global state and every box (names and values together) in order
    // to read all properties. The view only decides which boxes are parsed,
    // not how many requests are made.
    const [globalState, boxes] = await Promise.all([
      instanceClient.appClient.getGlobalState(),
      getAllBoxes(this.algorand.client.algod, nfdAppId),
    ])

    const nfd = buildNfdRecord({
      appId: nfdAppId,
      appAddress: instanceClient.appAddress.toString(),
      globalState,
      boxes,
      view: options.view,
    })

    return { nfd, boxes }
  }
}
