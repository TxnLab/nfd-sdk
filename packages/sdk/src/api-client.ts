import { client } from './api/client.gen'
import { nfdGetLookup, nfdGetNfd, nfdSearchV2 } from './api/sdk.gen'
import { NfdApiBaseUrl, NfdRegistryId } from './constants'
import { chunkArray } from './utils/internal/array'

import type { Nfd, SearchOptions, SearchResponse } from './types'

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
   * Set the base URL for the API
   * @param baseUrl - The base URL to use
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
    options: {
      view?: 'tiny' | 'brief' | 'full'
      poll?: boolean
    } = {},
  ): Promise<Nfd> {
    const response = await nfdGetNfd({
      client: this._client,
      query: {
        view: options.view,
        poll: options.poll,
      },
      path: {
        nameOrID: nameOrId,
      },
      throwOnError: true,
    })

    return response.data as Nfd
  }

  /**
   * Perform reverse lookup of NFDs by addresses using the API
   *
   * This method finds NFDs associated with the provided wallet addresses.
   * It automatically handles chunking for large batches of addresses (API limit is 20 per request),
   * prioritizes verified NFDs over unverified ones, and properly merges results.
   *
   * @param addresses - Array of wallet addresses to look up
   * @param options - Options for the lookup
   * @returns A record mapping addresses to their associated NFDs
   */
  public async reverseLookup(
    addresses: string[],
    options: {
      view?: 'tiny' | 'thumbnail' | 'brief' | 'full'
      allowUnverified?: boolean
    } = {},
  ): Promise<Record<string, Nfd>> {
    // Filter out empty addresses
    const validAddresses = addresses.filter((addr) => addr.trim() !== '')
    if (validAddresses.length === 0) {
      return {}
    }

    // Split addresses into chunks of 20 (API limit)
    const addressChunks = chunkArray(validAddresses, 20)

    try {
      // Make parallel requests for each chunk
      const responses = await Promise.all(
        addressChunks.map((chunk) =>
          nfdGetLookup({
            client: this._client,
            query: {
              address: chunk,
              view: options.view,
              allowUnverified: options.allowUnverified,
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
          Object.entries(response.data).forEach(([address, nfds]) => {
            // Handle both array and single NFD responses
            const nfdArray = Array.isArray(nfds) ? nfds : [nfds]

            if (nfdArray.length > 0) {
              // If allowUnverified is true, prioritize verified NFDs over unverified ones
              if (options.allowUnverified) {
                // Find the first verified NFD (with caAlgo property)
                const verifiedNfd = nfdArray.find(
                  (nfd) => nfd.caAlgo?.length > 0,
                )

                if (verifiedNfd) {
                  mergedResults[address] = verifiedNfd
                } else {
                  // If no verified NFD, use the first one (which might be unverified)
                  mergedResults[address] = nfdArray[0]
                }
              } else {
                // If allowUnverified is false, just use the first NFD
                // (API should only return verified NFDs in this case)
                mergedResults[address] = nfdArray[0]
              }
            }
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
      },
      throwOnError: true,
    })

    return response.data
  }
}
