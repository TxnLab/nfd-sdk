import { client, nfdGetLookup, nfdGetNfd, nfdSearchV2 } from '@txnlab/nfd-fetch'
import { NfdApiBaseUrl, NfdRegistryId } from './constants'
import { chunkArray } from './utils/internal/array'

import type {
  Nfd,
  SearchOptions,
  SearchResponse,
  ReverseLookupOptions,
  ResolveOptions,
} from './types'

/**
 * Client for interacting with the NFD API
 * This class wraps the auto-generated API client to provide a more convenient interface
 */
export class NfdApiClient {
  private readonly _client = client

  /**
   * Create a new NfdApiClient instance
   * @param registryId - The registry ID to determine which network to use
   */
  constructor(registryId?: number | bigint) {
    // Set the base URL based on the registry ID
    if (registryId !== undefined) {
      const baseUrl =
        BigInt(registryId) === BigInt(NfdRegistryId.TESTNET)
          ? NfdApiBaseUrl.TESTNET
          : NfdApiBaseUrl.MAINNET

      this.setBaseUrl(baseUrl)
    }
  }

  /**
   * Create a new NfdApiClient instance configured for MainNet
   * @returns A new NfdApiClient instance
   */
  public static mainNet(): NfdApiClient {
    const apiClient = new NfdApiClient()
    apiClient.setBaseUrl(NfdApiBaseUrl.MAINNET)
    return apiClient
  }

  /**
   * Create a new NfdApiClient instance configured for TestNet
   * @returns A new NfdApiClient instance
   */
  public static testNet(): NfdApiClient {
    const apiClient = new NfdApiClient()
    apiClient.setBaseUrl(NfdApiBaseUrl.TESTNET)
    return apiClient
  }

  /**
   * Get the raw generated API client
   * @returns The raw API client
   */
  public get client(): typeof client {
    return this._client
  }

  /**
   * Set the base URL for the API client
   * @param baseUrl - The base URL to use for API requests
   */
  public setBaseUrl(baseUrl: string): void {
    this._client.setConfig({
      baseUrl,
    })
  }

  /**
   * Resolve an NFD by name or application ID using the API
   */
  public async resolve(
    nameOrId: string,
    options: ResolveOptions = {},
  ): Promise<Nfd> {
    // Add cache parameter if needed
    const params = this._getCacheParam(options.nocache)

    const response = await nfdGetNfd({
      client: this._client,
      query: {
        view: options.view,
        poll: options.poll,
        ...params,
      },
      path: {
        nameOrID: nameOrId,
      },
      throwOnError: true,
    })

    return response.data as Nfd
  }

  /**
   * Perform a reverse lookup to find NFDs associated with Algorand addresses
   * @param addresses - Array of Algorand addresses to look up
   * @param options - Options for the lookup
   * @returns Record mapping addresses to their associated NFDs
   * @remarks
   * This method returns a record where each key is an Algorand address and the value is the NFD associated with that address.
   * If an address is not associated with any NFDs, the value will be an empty object.
   */
  public async reverseLookup(
    addresses: string[],
    options: ReverseLookupOptions = {},
  ): Promise<Record<string, Nfd>> {
    // Filter out empty addresses
    const validAddresses = addresses.filter((addr) => addr.trim() !== '')
    if (validAddresses.length === 0) {
      return {}
    }

    // Split addresses into chunks of 20 (API limit)
    const addressChunks = chunkArray(validAddresses, 20)

    try {
      // Add cache parameter if needed
      const params = this._getCacheParam(options.nocache)

      // Make parallel requests for each chunk
      const responses = await Promise.all(
        addressChunks.map((chunk) =>
          nfdGetLookup({
            client: this._client,
            query: {
              address: chunk,
              view: options.view,
              allowUnverified: options.allowUnverified,
              ...params,
            },
            throwOnError: false, // Handle errors per chunk
          }).catch((error) => {
            // Return empty result for this chunk if 404 (not found)
            if (error.response?.status === 404) {
              return { data: {} }
            }
            // Re-throw other errors
            throw error
          }),
        ),
      )

      // Merge all responses
      const mergedResults: Record<string, Nfd> = {}

      for (const response of responses) {
        if (response.data) {
          Object.entries(response.data).forEach(([address, nfd]) => {
            mergedResults[address] = nfd as Nfd
          })
        }
      }

      return mergedResults
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      throw new Error(`Error performing reverse lookup: ${errorMessage}`)
    }
  }

  /**
   * Search for NFDs using the API
   */
  public async search(options: SearchOptions = {}): Promise<SearchResponse> {
    // Add cache parameter if needed
    const params = this._getCacheParam(options.nocache)

    const response = await nfdSearchV2({
      client: this._client,
      query: {
        name: options.name,
        category: options.category,
        saleType: options.saleType,
        state: options.state,
        parentAppID: options.parentAppId,
        length: options.length,
        traits: options.traits,
        owner: options.owner,
        reservedFor: options.reservedFor,
        excludeUserReserved: options.excludeUserReserved,
        prefix: options.prefix,
        substring: options.substring,
        vproperty: options.verifiedProperty,
        vvalue: options.verifiedValue,
        segmentLocked: options.segmentLocked,
        segmentRoot: options.segmentRoot,
        minPrice: options.minPrice,
        maxPrice: options.maxPrice,
        minPriceUsd: options.minPriceUsd,
        maxPriceUsd: options.maxPriceUsd,
        changedAfter: options.changedAfter,
        expiresBefore: options.expiresBefore,
        limit: options.limit,
        offset: options.offset,
        sort: options.sort,
        view: options.view,
        ...params,
      },
      throwOnError: true,
    })

    return {
      ...response.data,
      nfds: response.data.nfds.map((nfd) => nfd as Nfd),
    }
  }

  /**
   * Internal method for cache parameter
   * @private
   */
  private _getCacheParam(flag?: boolean): Record<string, number | undefined> {
    if (!flag) {
      return {}
    }

    const now = new Date()
    const minutes = now.getMinutes()
    const seconds = now.getSeconds()
    const value = Math.floor(((minutes * 60 + seconds) % 120) / 4)
    return { _cb: value }
  }
}
