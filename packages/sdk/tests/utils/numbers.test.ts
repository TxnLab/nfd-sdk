import { describe, it, expect } from 'vitest'

import { toAmount } from '../../src/utils/internal/numbers'

describe('toAmount', () => {
  it('passes bigints through unchanged', () => {
    expect(toAmount(500n, 'Amount')).toBe(500n)
    expect(toAmount(0n, 'Amount')).toBe(0n)
  })

  it('widens whole numbers to bigint', () => {
    expect(toAmount(500, 'Amount')).toBe(500n)
    expect(toAmount(0, 'Amount')).toBe(0n)
  })

  it.each([NaN, Infinity, -Infinity])('rejects %s', (value) => {
    expect(() => toAmount(value, 'Sale price')).toThrow(
      `Sale price must be a finite number, got ${value}`,
    )
  })

  it('rejects a fractional number', () => {
    expect(() => toAmount(1.5, 'Sale price')).toThrow(
      'Sale price must be a whole number, got 1.5',
    )
  })

  it('rejects a number too large to represent exactly', () => {
    // 2 ** 53 is the first integer a double cannot distinguish from its
    // neighbour, so converting it would silently change the amount
    expect(() => toAmount(2 ** 53, 'Offer amount')).toThrow(
      /Offer amount exceeds the safe integer range/,
    )
  })

  it.each([-1, -1n])('rejects the negative value %s', (value) => {
    expect(() => toAmount(value, 'Transfer amount')).toThrow(
      'Transfer amount must not be negative, got -1',
    )
  })

  it('names the parameter in the message', () => {
    expect(() => toAmount(1.5, 'Segment price')).toThrow(/^Segment price /)
  })
})
