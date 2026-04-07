// Export core client
export { NfdClient, type NfdClientConfig } from './client'

// Export core constants
export { NfdRegistryId } from './constants'

// Export core/API types
export type {
  ListForSaleOptions,
  Nfd,
  NfdImageResult,
  ResolveOptions,
  ReverseLookupOptions,
  SearchOptions,
  SearchResponse,
  SendFromVaultOptions,
  SendToVaultOptions,
  SuggestOptions,
  VerifyConfirmResult,
  VerifyField,
  VerifyRequestResult,
} from './types'

// Export API client
export { NfdApiClient } from './api-client'

// Export modules
export { NfdManager } from './modules/manager'
export { PurchasingModule } from './modules/purchasing'

// Export module types
export type {
  NfdMintQuoteParams,
  NfdMintQuote,
  NfdMintParams,
} from './modules/minting'

export type { NfdPurchaseQuote } from './modules/purchasing'

// Export NFD utility functions
export {
  isValidName,
  isSegmentName,
  extractParentName,
  getNfdBasename,
  isSegmentMintingUnlocked,
  canMintSegment,
} from './utils/nfd'

// Export IPFS utility functions
export { checkIpfsAvailability, isIpfsUrl } from './utils/ipfs'

// Export error handling utilities
export { parseTransactionError, withErrorParsing } from './utils/error-parser'
