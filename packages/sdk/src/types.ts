import type {
  NfdRecord,
  NfdSearchV2Response,
  VerifyConfirmResponseBody,
  VerifyRequestResponseBody,
} from './api/types.gen'

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

  /**
   * Set to true to return a never-cached result
   * @default false
   */
  nocache?: boolean
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

  /**
   * Set to true to return a never-cached result
   * @default false
   */
  nocache?: boolean
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

/**
 * Result of resolving an NFD's avatar or banner image
 */
export interface NfdImageResult {
  /** The raw value stored on-chain */
  raw: string | null
  /** A valid https:// URL (converted from ipfs:// if needed). For avatars, always provided (includes fallback). For banners, may be null. */
  url: string | null
  /** Whether the image is verified (stored in verified properties) */
  verified: boolean
  /** If verified, the ASA ID of the NFT image */
  asaId: number | null
  /** Whether this result uses a fallback default image (only for avatars) */
  isFallback?: boolean
}

/**
 * Configuration options for suggesting NFD names
 */
export interface SuggestOptions {
  /**
   * The buyer's Algorand address (required for eligibility filtering)
   */
  buyer: string

  /**
   * Limit the number of results returned
   * @default 20
   * @maximum 40
   */
  limit?: number

  /**
   * View of data to return
   * @default 'brief'
   */
  view?: 'brief' | 'full'
}

/**
 * Options for listing an NFD for sale
 */
export interface ListForSaleOptions {
  /**
   * Reserve the sale for a specific address
   */
  reservedFor?: string
}

/**
 * Options for sending assets to a vault
 */
export interface SendToVaultOptions {
  /**
   * Whether to only opt the vault into the asset(s) without transferring
   * @default false
   */
  optInOnly?: boolean

  /**
   * Amount to send, in base units of the asset. The amount applies to one
   * asset, so it can only be given alongside a single asset — call
   * `sendToVault` once per asset to send several. Omit it to opt the vault
   * into the assets without transferring anything.
   */
  amount?: bigint

  /**
   * Optional note to include in the transaction
   */
  note?: string
}

/**
 * Options for sending assets from a vault
 */
export interface SendFromVaultOptions {
  /**
   * Amount to send, in base units of the asset. The amount applies to one
   * asset, so it can only be given alongside a single asset — passing several
   * assets sends the full balance of each and closes the vault out of them.
   * Required when sending ALGO (asset 0), which has no close-out path.
   * @default 0n
   */
  amount?: bigint

  /**
   * Optional note to include in the transaction
   */
  note?: string

  /**
   * Which account to send to when `receiver` is an NFD name: the NFD's
   * deposit account, or its vault. Ignored when `receiver` is already an
   * Algorand address, and an error to combine `'nfdVault'` with one.
   * @default 'account'
   */
  receiverType?: 'account' | 'nfdVault'
}

/**
 * Field types that can be verified on an NFD
 */
export type VerifyField =
  | 'blueskydid'
  | 'twitter'
  | 'github'
  | 'domain'
  | 'email'
  | 'avatar'
  | 'banner'

/**
 * Result of starting a verification request
 */
export type VerifyRequestResult = VerifyRequestResponseBody

/**
 * Result of confirming a verification
 */
export type VerifyConfirmResult = VerifyConfirmResponseBody
