/**
 * Error parser utility for Algorand transaction errors
 * Provides user-friendly error messages for common Algorand transaction errors
 */

/**
 * Common error patterns and their user-friendly messages
 */
const ERROR_PATTERNS: Record<string, string> = {
  'fee too small':
    'Transaction fee is too small. This usually happens when the transaction requires more resources than expected.',
  'account .* balance .* below min':
    'Insufficient balance: The account does not have enough ALGO to cover the minimum balance requirement.',
  overspend:
    'Insufficient balance: The account does not have enough ALGO to complete this transaction.',
  'txn dead: round .* outside of':
    'Transaction sent outside valid round range. This usually happens when a transaction takes too long to be confirmed.',
  'logic eval error':
    'Smart contract execution failed. The transaction could not be processed by the smart contract.',
  'transaction rejected by ApprovalProgram':
    'Transaction rejected by the smart contract.',
}

/**
 * Parse an error message and return a user-friendly version
 * @param error - The error object or string to parse
 * @returns A user-friendly error message
 */
export function parseTransactionError(error: unknown): string {
  // Convert error to string
  const errorMessage = error instanceof Error ? error.message : String(error)

  // Process specific error patterns
  // Insufficient balance error with details
  const insufficientBalancePattern =
    /account (\w+) balance (\d+) below min (\d+) \((\d+) assets\)/
  let match = errorMessage.match(insufficientBalancePattern)
  if (match) {
    const account = match[1]
    const balance = parseInt(match[2]) / 1_000_000 // Convert microAlgos to Algos
    const min = parseInt(match[3]) / 1_000_000
    const assets = match[4]
    return `Insufficient balance: Account ${account} has ${balance} ALGO which is below the minimum ${min} ALGO required (${assets} assets)`
  }

  // Overspend error with details
  const overspendPattern =
    /account (\w+), data.*MicroAlgos:\{Raw:(\d+)\}[^}]*\}[^}]*\}[^}]*\}[^}]*\}[^}]*\}[^}]*\}, tried to spend \{(\d+)\}/s
  match = errorMessage.match(overspendPattern)
  if (match) {
    const account = match[1]
    const balance = parseInt(match[2]) / 1_000_000
    const triedToSpend = parseInt(match[3]) / 1_000_000
    return `Insufficient balance: Account ${account} has ${balance} ALGO available but attempted to spend ${triedToSpend} ALGO`
  }

  // Transaction sent outside range error
  const outsideRangePattern = /txn dead: round (\d+) outside of (\d+)--(\d+)/
  match = errorMessage.match(outsideRangePattern)
  if (match) {
    const round = match[1]
    const rangeStart = match[2]
    const rangeEnd = match[3]
    return `Transaction sent outside valid round range: round ${round} outside of ${rangeStart}–${rangeEnd}`
  }

  // Smart contract logic eval error
  const smartContractErrorPattern = /transaction (\w+): logic eval error: (.+)/
  match = errorMessage.match(smartContractErrorPattern)
  if (match) {
    const txnId = match[1]
    const details = match[2]
    return `Smart contract logic eval error: ${details}. Transaction: ${txnId}`
  }

  // Transaction rejected by smart contract error
  const rejectedByContractPattern =
    /transaction (\w+): transaction rejected by ApprovalProgram/
  match = errorMessage.match(rejectedByContractPattern)
  if (match) {
    const txnId = match[1]
    return `Transaction rejected by smart contract. Transaction: ${txnId}`
  }

  // Check for general patterns if no specific regex matched
  for (const [pattern, friendlyMessage] of Object.entries(ERROR_PATTERNS)) {
    if (
      errorMessage.toLowerCase().includes(pattern.toLowerCase()) ||
      new RegExp(pattern, 'i').test(errorMessage)
    ) {
      return friendlyMessage
    }
  }

  // If no specific pattern is found, return a cleaned-up version of the original error
  // Remove the long stack trace and object dumps that often appear in Algorand errors
  const cleanedError = errorMessage
    .replace(/\[.*?\]/g, '') // Remove array contents in square brackets
    .replace(/\{.*?\}/g, '') // Remove object contents in curly braces
    .replace(/transactions\..*?{/g, '{') // Remove transaction object references
    .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
    .trim()

  // If the cleaned error is still very long, truncate it
  if (cleanedError.length > 150) {
    return cleanedError.substring(0, 150) + '...'
  }

  return cleanedError
}

/**
 * Wrap a function with error parsing
 * @param fn - The function to wrap
 * @returns A wrapped function that parses errors
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withErrorParsing<T extends (...args: any[]) => Promise<any>>(
  fn: T,
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  return async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    try {
      return await fn(...args)
    } catch (error) {
      throw new Error(parseTransactionError(error))
    }
  }
}
