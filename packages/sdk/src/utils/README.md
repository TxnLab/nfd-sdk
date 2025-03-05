# NFD SDK Utilities

The NFD SDK provides utility functions to help developers work with NFDs and handle errors when interacting with the Algorand blockchain.

## Importing Utilities

All public utility functions can be imported directly from the main package:

```typescript
import {
  // NFD utilities
  isValidName,
  isSegmentName,
  extractParentName,
  getNfdBasename,
  isSegmentMintingUnlocked,
  canMintSegment,

  // Error handling utilities
  parseTransactionError,
  withErrorParsing,
} from '@txnlab/nfd-sdk'
```

## NFD Utilities

### `isValidName(name: string): boolean`

Checks if a string is a valid NFD name according to the naming rules.

```typescript
import { isValidName } from '@txnlab/nfd-sdk'

// Check if a name is valid
const isValid = isValidName('alice.algo')
// Returns true
```

### `isSegmentName(name: string): boolean`

Determines if a name is a segment NFD. A segment is a child NFD that is created under a parent NFD (e.g., 'sub.alice.algo' is a segment of 'alice.algo'). Segments are sovereign NFDs with all functionality once minted.

```typescript
import { isSegmentName } from '@txnlab/nfd-sdk'

// Check if a name is a segment
const isSegment = isSegmentName('sub.alice.algo')
// Returns true
```

### `extractParentName(segmentName: string): string`

Extracts the parent name from a segment name.

```typescript
import { extractParentName } from '@txnlab/nfd-sdk'

// Get the parent name
const parentName = extractParentName('sub.alice.algo')
// Returns 'alice.algo'
```

### `getNfdBasename(name: string): string`

Gets the base name of an NFD (without the .algo extension).

```typescript
import { getNfdBasename } from '@txnlab/nfd-sdk'

// Get the base name
const baseName = getNfdBasename('alice.algo')
// Returns 'alice'
```

### `isSegmentMintingUnlocked(nfd: Nfd | null): boolean`

Checks if segment minting is unlocked for a parent/root NFD. This determines whether anyone besides the owner can mint segments under this NFD. Note that the owner of the parent NFD always has permission to mint segments regardless of this setting.

```typescript
import { isSegmentMintingUnlocked } from '@txnlab/nfd-sdk'

// Check if segment minting is unlocked for a parent NFD
const isUnlocked = isSegmentMintingUnlocked(parentNfd)
```

### `canMintSegment(nfd: Nfd | null, callerAddress: string): boolean`

Checks if the caller is authorized to mint a segment for the given parent NFD.

```typescript
import { canMintSegment } from '@txnlab/nfd-sdk'

// Check if the caller can mint a segment
const canMint = canMintSegment(parentNfd, userAddress)
```

## Error Handling Utilities

### `parseTransactionError(error: unknown): string`

Parses an error message and returns a user-friendly version.

```typescript
import { parseTransactionError } from '@txnlab/nfd-sdk'

// Parse an error to get a user-friendly message
try {
  await nfd.setSigner(addr, signer).manage(nfdName).linkAddress(address)
} catch (error) {
  const friendlyError = parseTransactionError(error)
  console.error(friendlyError)
}
```

### `withErrorParsing<T>(fn: () => Promise<T>): Promise<T>`

A wrapper function that automatically parses errors thrown by the wrapped function.

```typescript
import { withErrorParsing } from '@txnlab/nfd-sdk'

const safeFunction = withErrorParsing(async () => {
  return await nfd.setSigner(addr, signer).manage(nfdName).linkAddress(address)
})

try {
  await safeFunction()
} catch (error) {
  // Error is already parsed
  console.error(error.message)
}
```

### Supported Error Types

The error parser can handle a variety of common Algorand transaction errors, including:

- Fee too small
- Insufficient balance (with detailed information about available and required funds)
- Transaction sent outside valid round range
- Smart contract logic evaluation errors
- Transaction rejected by smart contract
- And more

For errors that don't match any known pattern, the parser will clean up the error message by removing excessive technical details and truncating it if it's too long.

### Adding Custom Error Patterns

You can extend the error parser with your own custom error patterns by creating a wrapper around the `parseTransactionError` function:

```typescript
import { parseTransactionError } from '@txnlab/nfd-sdk'

const CUSTOM_ERROR_PATTERNS: Record<string, string> = {
  'my custom error pattern': 'My user-friendly error message',
  // Add more patterns as needed
}

function myCustomErrorParser(error: unknown): string {
  const errorMessage = error instanceof Error ? error.message : String(error)

  // Check for custom error patterns first
  for (const [pattern, friendlyMessage] of Object.entries(
    CUSTOM_ERROR_PATTERNS,
  )) {
    if (errorMessage.toLowerCase().includes(pattern.toLowerCase())) {
      return friendlyMessage
    }
  }

  // Fall back to the built-in error parser
  return parseTransactionError(error)
}
```
