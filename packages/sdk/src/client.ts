import { resolveFromApi, reverseLookupFromApi, searchFromApi } from './api'

import type {
  Nfd,
  ResolveOptions,
  ReverseLookupOptions,
  SearchOptions,
} from './types'
import type { Algodv2, Indexer } from 'algosdk'

/**
 * Configuration options for the NFD client
 */
export interface NfdClientConfig {
  /**
   * Algod client instance
   */
  algod: Algodv2

  /**
   * Optional indexer client instance
   */
  indexer?: Indexer
}

/**
 * Client for interacting with NFDs (Non-Fungible Domains) through both the API and smart contracts
 */
export class NfdClient {
  private readonly algod: Algodv2
  private readonly indexer?: Indexer

  constructor(config: NfdClientConfig) {
    this.algod = config.algod
    this.indexer = config.indexer
  }

  /**
   * Resolve an NFD by name or application ID
   * @param nameOrId - Name of an NFD (e.g., 'alice.algo') or its application ID
   * @param options - Optional parameters for the resolution
   * @returns The NFD record if found
   * @throws If the NFD is not found or another error occurs
   */
  async resolve(nameOrId: string, options: ResolveOptions = {}): Promise<Nfd> {
    return resolveFromApi(nameOrId, options)
  }

  /**
   * Get NFD records by addresses (reverse lookup)
   * @param addresses - One or more addresses (algo or otherwise) to look up, maximum of 20
   * @param options - Optional parameters for the lookup
   * @returns A record of addresses to their NFD records
   * @throws If an error occurs during the lookup
   */
  async reverseLookup(
    addresses: string[],
    options: ReverseLookupOptions = {},
  ): Promise<Record<string, Nfd>> {
    return reverseLookupFromApi(addresses, options)
  }

  /**
   * Search for NFDs using various filters and criteria
   * @param options - Optional parameters for the search
   * @returns An object containing the NFD records and total count
   * @throws If an error occurs during the search
   */
  async search(
    options: SearchOptions = {},
  ): Promise<{ nfds: Nfd[]; total: number }> {
    return searchFromApi(options)
  }

  /**
   * Check if a string is a valid application ID
   * @internal
   */
  private isAppId(value: string): boolean {
    return /^\d+$/.test(value)
  }
}
