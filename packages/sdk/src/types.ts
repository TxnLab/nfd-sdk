import type { NfdRecord, NfdSearchV2Response } from './api/types.gen'

/**
 * Configuration options for resolving an NFD
 */
export interface ResolveOptions {
  /**
   * View of data to return
   * @default 'brief'
   */
  view?: 'tiny' | 'brief' | 'full'

  /**
   * Use if polling waiting for state change - causes notFound to return as 204 instead of 404
   * @default false
   */
  poll?: boolean

  /**
   * Set to true to return a never-cached result
   * @default false
   */
  nocache?: boolean
}

/**
 * Configuration options for reverse lookup
 */
export interface ReverseLookupOptions {
  /**
   * View of data to return
   * @default 'tiny'
   */
  view?: 'tiny' | 'thumbnail' | 'brief' | 'full'

  /**
   * Whether to allow unverified addresses to match
   * @default false
   */
  allowUnverified?: boolean
}

/**
 * Configuration options for searching NFDs
 */
export interface SearchOptions {
  /**
   * Name or partial match of NFD name to filter on
   */
  name?: string

  /**
   * Filter by NFD category
   */
  category?: Array<'curated' | 'premium' | 'common'>

  /**
   * Filter by sale type
   */
  saleType?: Array<'auction' | 'buyItNow'>

  /**
   * Filter by NFD state
   */
  state?: Array<'reserved' | 'forSale' | 'owned' | 'expired'>

  /**
   * The parent NFD Application ID to find. Used for fetching segments of an NFD
   */
  parentAppId?: number

  /**
   * Filter by NFD length
   */
  length?: Array<
    | '1_letters'
    | '2_letters'
    | '3_letters'
    | '4_letters'
    | '5_letters'
    | '6_letters'
    | '7_letters'
    | '8_letters'
    | '9_letters'
    | '10+_letters'
  >

  /**
   * Filter by NFD traits
   */
  traits?: Array<'emoji' | 'pristine' | 'segment'>

  /**
   * Filter by NFD owner address
   */
  owner?: string

  /**
   * Filter by NFD reserved for address
   */
  reservedFor?: string

  /**
   * Should NFDs reserved for an account be excluded
   * @default false
   */
  excludeUserReserved?: boolean

  /**
   * The start of an NFD name, fetching multiple NFDs that have that prefix
   */
  prefix?: string

  /**
   * Part of an NFD name, fetching multiple NFDs that have that substring (minimum 3 characters)
   */
  substring?: string

  /**
   * Verified property name to search on - specify value with verifiedValue
   */
  verifiedProperty?:
    | 'blueskydid'
    | 'discord'
    | 'telegram'
    | 'twitter'
    | 'github'
    | 'email'
    | 'domain'
    | 'nostrpubkey'

  /**
   * Value to find in the verifiedProperty field specified with the verifiedProperty parameter
   */
  verifiedValue?: string

  /**
   * Whether to explicitly filter on segments being locked or unlocked
   */
  segmentLocked?: boolean

  /**
   * Whether to explicitly filter on NFD roots or segments
   */
  segmentRoot?: boolean

  /**
   * Minimum price of NFD in microAlgos
   */
  minPrice?: number

  /**
   * Maximum price of NFD in microAlgos
   */
  maxPrice?: number

  /**
   * Minimum price of NFD Segment in USD (cents)
   */
  minPriceUsd?: number

  /**
   * Maximum price of NFD Segment in USD (cents)
   */
  maxPriceUsd?: number

  /**
   * Fetch NFDs that changed after the specified timestamp
   */
  changedAfter?: string

  /**
   * Return only NFDs with an expiration time at or before the specified timestamp
   */
  expiresBefore?: string

  /**
   * Limit the number of results returned
   * @default 100
   * @maximum 200
   */
  limit?: number

  /**
   * Starting document offset in large list
   * @default 0
   */
  offset?: number

  /**
   * Sort order for results
   * @default 'createdDesc'
   */
  sort?:
    | 'createdDesc'
    | 'timeChangedDesc'
    | 'soldDesc'
    | 'priceAsc'
    | 'priceDesc'
    | 'highestSaleDesc'
    | 'saleTypeAsc'
    | 'nameAsc'
    | 'expiresAsc'
    | 'expiresDesc'

  /**
   * View of data to return
   * @default 'brief'
   */
  view?: 'tiny' | 'thumbnail' | 'brief' | 'full'
}

/**
 * Search response
 */
export type SearchResponse = Omit<NfdSearchV2Response, 'match-check'> & {
  nfds: Nfd[]
}

/**
 * NFD record containing domain information and properties
 */
export type Nfd = NfdRecord
