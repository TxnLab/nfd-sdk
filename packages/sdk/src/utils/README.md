# NFD SDK Utilities

## Error Parser

The error parser utility provides user-friendly error messages for common Algorand transaction errors. It helps developers and users understand what went wrong when a transaction fails, without having to decipher the complex error messages returned by the Algorand blockchain.

### Usage

```typescript
import { parseTransactionError, withErrorParsing } from '@txnlab/nfd-sdk'

// Basic usage
try {
  // Some operation that might throw an error
  await nfd.setSigner(addr, signer).manage(nfdName).linkAddress(address)
} catch (error) {
  // Parse the error to get a user-friendly message
  const friendlyError = parseTransactionError(error)
  console.error(friendlyError)
}

// Using the wrapper function
const safeFunction = withErrorParsing(async () => {
  // Some operation that might throw an error
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
