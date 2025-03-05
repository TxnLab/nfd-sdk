// Export core client
export { NfdClient, type NfdClientConfig } from './client'

// Export core constants
export { NfdRegistryId } from './constants'

// Export core/API types
export type {
  Nfd,
  ResolveOptions,
  ReverseLookupOptions,
  SearchOptions,
  SearchResponse,
} from './types'

// Export API client
export { NfdApiClient } from './api-client'

// Export modules
export { NfdManager } from './modules/manager'

// Export module types
export type {
  NfdMintQuoteParams,
  NfdMintQuote,
  NfdMintParams,
} from './modules/minting'

// Export NFD utility functions
export {
  isValidName,
  isSegmentName,
  extractParentName,
  getNfdBasename,
  isSegmentMintingUnlocked,
  canMintSegment,
} from './utils/nfd'

// Export error handling utilities
export { parseTransactionError, withErrorParsing } from './utils/error-parser'
