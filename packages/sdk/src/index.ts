export { NfdClient, type NfdClientConfig } from './client'
export { NfdRegistryId } from './constants'

// Export module types
export type {
  NfdMintQuoteParams,
  NfdMintQuote,
  NfdMintParams,
} from './modules/minting'

// Export core types
export type {
  Nfd,
  ResolveOptions,
  ReverseLookupOptions,
  SearchOptions,
} from './types'

// Export utility functions
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
