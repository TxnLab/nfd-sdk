import { client } from './api/client.gen'
import { nfdGetLookup, nfdGetNfd, nfdSearchV2 } from './api/sdk.gen'
import { NfdApiBaseUrl, NfdRegistryId } from './constants'

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
   */
  public async reverseLookup(
    addresses: string[],
    options: {
      view?: 'tiny' | 'thumbnail' | 'brief' | 'full'
      allowUnverified?: boolean
    } = {},
  ): Promise<Record<string, Nfd>> {
    const response = await nfdGetLookup({
      client: this._client,
      query: {
        address: addresses,
        view: options.view,
        allowUnverified: options.allowUnverified,
      },
      throwOnError: true,
    })

    return response.data as Record<string, Nfd>
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
