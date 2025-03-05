import { AppState } from '@algorandfoundation/algokit-utils/types/app'
import { describe, it, expect, vi } from 'vitest'

import {
  parseString,
  parseUint64,
  parseAddress,
} from '../../src/utils/internal/state'

// Mock the algosdk decodeUint64 function
vi.mock('algosdk', () => ({
  decodeUint64: vi.fn((_value) => BigInt(123)),
  Address: class {
    constructor(public readonly bytes: Uint8Array) {}
    toString() {
      return 'MOCK_ADDRESS'
    }
    static fromString(_addr: string) {
      return {
        toString: () => 'MOCK_ADDRESS',
      }
    }
  },
}))

// Define a type that matches the structure we need for testing
type MockAppStateEntry = {
  value?: bigint | string
  valueRaw?: Uint8Array
  valueBase64?: string
  keyRaw?: Uint8Array
  keyBase64?: string
}

type MockAppState = Record<string, MockAppStateEntry>

// Cast the mock state to AppState only once
const asAppState = (state: MockAppState): AppState =>
  state as unknown as AppState

describe('State Utility Functions', () => {
  describe('parseString', () => {
    it('should return empty string when key is not found', () => {
      const state = asAppState({})
      expect(parseString('nonexistent', state)).toBe('')
    })

    it('should return empty string when value is undefined', () => {
      const state = asAppState({
        key: { value: undefined },
      })
      expect(parseString('key', state)).toBe('')
    })

    it('should return string value when key exists', () => {
      const state = asAppState({
        key: { value: 'test' },
      })
      expect(parseString('key', state)).toBe('test')
    })

    it('should convert non-string values to string', () => {
      const state = asAppState({
        key: { value: 123n },
      })
      expect(parseString('key', state)).toBe('123')
    })
  })

  describe('parseUint64', () => {
    it('should return 0 when key is not found', () => {
      const state = asAppState({})
      expect(parseUint64('nonexistent', state)).toBe(0)
    })

    it('should return 0 when valueRaw is not present', () => {
      const state = asAppState({
        key: { value: '123' },
      })
      expect(parseUint64('key', state)).toBe(0)
    })

    it('should decode uint64 when valueRaw is present', () => {
      const state = asAppState({
        key: { valueRaw: new Uint8Array([1, 2, 3, 4]) },
      })
      expect(parseUint64('key', state)).toBe(123) // Using mocked decodeUint64
    })
  })

  describe('parseAddress', () => {
    it('should return empty string when key is not found', () => {
      const state = asAppState({})
      expect(parseAddress('nonexistent', state)).toBe('')
    })

    it('should parse address from valueRaw when it has 32 bytes', () => {
      const valueRaw = new Uint8Array(32).fill(1)
      const state = asAppState({
        key: { valueRaw },
      })
      expect(parseAddress('key', state)).toBe('MOCK_ADDRESS')
    })

    it('should parse address from value when valueRaw is not 32 bytes', () => {
      const state = asAppState({
        key: { value: 'SOME_ADDRESS' },
      })
      expect(parseAddress('key', state)).toBe('MOCK_ADDRESS')
    })

    it('should return empty string when address parsing fails', () => {
      // Create a scenario that would cause an error
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const state = asAppState({
        key: { value: undefined },
      })

      expect(parseAddress('key', state)).toBe('')
      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })
  })
})
