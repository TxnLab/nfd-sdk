import { client } from './api/client.gen'
import { nfdGetLookup, nfdGetNfd, nfdSearchV2 } from './api/sdk.gen'

import type { NfdRecord } from './api/types.gen'
import type { SearchOptions } from './types'

/**
 * Internal function to resolve an NFD by name or application ID using the API
 * @internal
 */
export async function resolveFromApi(
  nameOrId: string,
  options: {
    view?: 'tiny' | 'brief' | 'full'
    poll?: boolean
    nocache?: boolean
  } = {},
): Promise<NfdRecord> {
  const response = await nfdGetNfd({
    client,
    query: {
      view: options.view,
      poll: options.poll,
      nocache: options.nocache,
    },
    path: {
      nameOrID: nameOrId,
    },
    throwOnError: true,
  })

  return response.data as NfdRecord
}

/**
 * Internal function to perform reverse lookup of NFDs by addresses using the API
 * @internal
 */
export async function reverseLookupFromApi(
  addresses: string[],
  options: {
    view?: 'tiny' | 'thumbnail' | 'brief' | 'full'
    allowUnverified?: boolean
  } = {},
): Promise<Record<string, NfdRecord>> {
  const response = await nfdGetLookup({
    client,
    query: {
      address: addresses,
      view: options.view,
      allowUnverified: options.allowUnverified,
    },
    throwOnError: true,
  })

  return response.data as Record<string, NfdRecord>
}

/**
 * Internal function to search for NFDs using the API
 * @internal
 */
export async function searchFromApi(
  options: SearchOptions = {},
): Promise<{ nfds: NfdRecord[]; total: number }> {
  const response = await nfdSearchV2({
    client,
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
