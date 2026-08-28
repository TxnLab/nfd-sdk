/**
 * Coerce an amount to a bigint, rejecting values the contract cannot accept
 *
 * `BigInt(1.5)` throws a bare `RangeError: The number 1.5 cannot be converted
 * to a BigInt because it is not an integer`, which says nothing about which
 * argument was wrong. Every public method taking a `bigint | number` amount
 * goes through here so the caller gets the parameter name instead.
 *
 * @param value - The value to coerce
 * @param label - The parameter name to use in error messages
 * @returns The value as a bigint
 * @throws If the value is not a non-negative, finite whole number
 */
export function toAmount(value: bigint | number, label: string): bigint {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`${label} must be a finite number, got ${value}`)
    }
    if (!Number.isInteger(value)) {
      throw new Error(`${label} must be a whole number, got ${value}`)
    }
    if (!Number.isSafeInteger(value)) {
      throw new Error(
        `${label} exceeds the safe integer range and would lose precision, got ${value}. Pass a bigint instead.`,
      )
    }
  }

  const amount = BigInt(value)
  if (amount < 0n) {
    throw new Error(`${label} must not be negative, got ${amount}`)
  }

  return amount
}
