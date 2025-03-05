import { Address, decodeUint64 } from 'algosdk'

import type { AppState } from '@algorandfoundation/algokit-utils/types/app'

/**
 * Parse a string value from global state, returning empty string if not found
 * @param key - The key to parse
 * @param state - The application state
 * @returns The parsed string value
 */
export function parseString(key: string, state: AppState): string {
  if (!state[key]) return ''
  return state[key].value?.toString() ?? ''
}

/**
 * Parse a uint64 value from global state, returning 0 if not found
 * @param key - The key to parse
 * @param state - The application state
 * @returns The parsed number value
 */
export function parseUint64(key: string, state: AppState): number {
  if (!state[key]) return 0
  const value = state[key]
  // Only process if it has valueRaw (string variant of AppState)
  if ('valueRaw' in value) {
    return Number(decodeUint64(value.valueRaw, 'bigint'))
  }
  return 0
}

/**
 * Parse an Algorand address from global state, returning empty string if not found
 * @param key - The key to parse
 * @param state - The application state
 * @returns The parsed address as a string
 */
export function parseAddress(key: string, state: AppState): string {
  if (!state[key]) return ''

  try {
    const value = state[key]
    // For raw 32-byte public keys (string variant with valueRaw)
    if ('valueRaw' in value && value.valueRaw.length === 32) {
      return new Address(value.valueRaw).toString()
    }

    // For regular address strings
    return Address.fromString(value.value.toString()).toString()
  } catch (error) {
    console.error(`Failed to parse address for key ${key}:`, error)
    return ''
  }
}
