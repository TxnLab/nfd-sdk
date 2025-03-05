import { describe, it, expect } from 'vitest'

import {
  determineNfdState,
  generateMetaTags,
} from '../../src/utils/internal/nfd'
import {
  isSegmentMintingUnlocked,
  canMintSegment,
  isValidName,
  isSegmentName,
  extractParentName,
  getNfdBasename,
} from '../../src/utils/nfd'

// Create a minimal mock of the Nfd type for testing
interface MockNfd {
  name: string
  owner?: string
  properties?: {
    internal?: {
      segmentLocked?: string
    }
  }
}

describe('NFD Utility Functions', () => {
  describe('isSegmentMintingUnlocked', () => {
    it('should return false for null NFD', () => {
      expect(isSegmentMintingUnlocked(null)).toBe(false)
    })

    it('should return false when segmentLocked property is missing', () => {
      const nfd = { properties: { internal: {} } } as MockNfd
      expect(isSegmentMintingUnlocked(nfd)).toBe(false)
    })

    it('should return false when segmentLocked is not "0"', () => {
      const nfd = {
        properties: { internal: { segmentLocked: '1' } },
      } as MockNfd
      expect(isSegmentMintingUnlocked(nfd)).toBe(false)
    })

    it('should return true when segmentLocked is "0"', () => {
      const nfd = {
        properties: { internal: { segmentLocked: '0' } },
      } as MockNfd
      expect(isSegmentMintingUnlocked(nfd)).toBe(true)
    })
  })

  describe('canMintSegment', () => {
    it('should return false for null NFD', () => {
      expect(canMintSegment(null, 'ADDR123')).toBe(false)
    })

    it('should return true if segment minting is unlocked, regardless of caller', () => {
      const nfd = {
        properties: { internal: { segmentLocked: '0' } },
        owner: 'OWNER123',
      } as MockNfd
      expect(canMintSegment(nfd, 'DIFFERENT_ADDR')).toBe(true)
    })

    it('should return true if caller is the owner and segment minting is locked', () => {
      const nfd = {
        properties: { internal: { segmentLocked: '1' } },
        owner: 'OWNER123',
      } as MockNfd
      expect(canMintSegment(nfd, 'OWNER123')).toBe(true)
    })

    it('should return false if caller is not the owner and segment minting is locked', () => {
      const nfd = {
        properties: { internal: { segmentLocked: '1' } },
        owner: 'OWNER123',
      } as MockNfd
      expect(canMintSegment(nfd, 'DIFFERENT_ADDR')).toBe(false)
    })
  })

  describe('isValidName', () => {
    it('should return true for valid root NFD names', () => {
      expect(isValidName('test.algo')).toBe(true)
      expect(isValidName('a.algo')).toBe(true)
      expect(isValidName('123.algo')).toBe(true)
      expect(isValidName('test123.algo')).toBe(true)
    })

    it('should return true for valid segment NFD names', () => {
      expect(isValidName('sub.test.algo')).toBe(true)
      expect(isValidName('a.b.algo')).toBe(true)
      expect(isValidName('123.456.algo')).toBe(true)
    })

    it('should return false for invalid NFD names', () => {
      expect(isValidName('test')).toBe(false)
      expect(isValidName('.algo')).toBe(false)
      expect(isValidName('test.')).toBe(false)
      expect(isValidName('test.com')).toBe(false)
      expect(isValidName('TEST.algo')).toBe(false) // uppercase not allowed
      expect(isValidName('test-123.algo')).toBe(false) // special chars not allowed
      expect(isValidName('sub.sub.test.algo')).toBe(false) // too many segments
    })

    it('should enforce character limits', () => {
      const validLongName = 'a'.repeat(27) + '.algo'
      const invalidLongName = 'a'.repeat(28) + '.algo'
      expect(isValidName(validLongName)).toBe(true)
      expect(isValidName(invalidLongName)).toBe(false)
    })
  })

  describe('isSegmentName', () => {
    it('should return true for valid segment NFD names', () => {
      expect(isSegmentName('sub.test.algo')).toBe(true)
      expect(isSegmentName('a.b.algo')).toBe(true)
      expect(isSegmentName('123.456.algo')).toBe(true)
    })

    it('should return false for root NFD names', () => {
      expect(isSegmentName('test.algo')).toBe(false)
      expect(isSegmentName('a.algo')).toBe(false)
    })

    it('should return false for invalid segment names', () => {
      expect(isSegmentName('sub.sub.test.algo')).toBe(false) // too many segments
      expect(isSegmentName('SUB.test.algo')).toBe(false) // uppercase not allowed
      expect(isSegmentName('sub-test.algo')).toBe(false) // special chars not allowed
    })
  })

  describe('extractParentName', () => {
    it('should extract parent name from valid segment name', () => {
      expect(extractParentName('sub.test.algo')).toBe('test.algo')
      expect(extractParentName('a.b.algo')).toBe('b.algo')
    })

    it('should throw error for invalid segment names', () => {
      expect(() => extractParentName('test.algo')).toThrow(
        'Invalid segment name',
      )
      expect(() => extractParentName('invalid')).toThrow('Invalid segment name')
    })
  })

  describe('getNfdBasename', () => {
    it('should return basename for root NFDs', () => {
      expect(getNfdBasename('test.algo')).toBe('test')
      expect(getNfdBasename('abc123.algo')).toBe('abc123')
    })

    it('should return basename for segment NFDs', () => {
      expect(getNfdBasename('sub.test.algo')).toBe('test')
      expect(getNfdBasename('a.b.algo')).toBe('b')
    })

    it('should return original string for invalid NFD names', () => {
      expect(getNfdBasename('invalid')).toBe('invalid')
      expect(getNfdBasename('test.com')).toBe('test.com')
    })
  })

  describe('determineNfdState', () => {
    it('should return "expired" when expired is true, regardless of other conditions', () => {
      const params = {
        expired: true,
        owner: 'OWNER',
        nfdAccount: 'NFD_ACCOUNT',
        reservedFor: 'RESERVED',
        sellAmount: 100,
        isMinting: true,
      }
      expect(determineNfdState(params)).toBe('expired')
    })

    it('should return "reserved" when reserved for someone and owned by NFD account', () => {
      const params = {
        expired: false,
        owner: 'NFD_ACCOUNT',
        nfdAccount: 'NFD_ACCOUNT',
        reservedFor: 'RESERVED_FOR',
        sellAmount: 0,
        isMinting: false,
      }
      expect(determineNfdState(params)).toBe('reserved')
    })

    it('should return "forSale" when sell amount is non-zero', () => {
      const params = {
        expired: false,
        owner: 'OWNER',
        nfdAccount: 'NFD_ACCOUNT',
        sellAmount: 100,
        isMinting: false,
      }
      expect(determineNfdState(params)).toBe('forSale')
    })

    it('should return "minting" when isMinting is true', () => {
      const params = {
        expired: false,
        owner: 'OWNER',
        nfdAccount: 'NFD_ACCOUNT',
        sellAmount: 0,
        isMinting: true,
      }
      expect(determineNfdState(params)).toBe('minting')
    })

    it('should return "owned" when owned by someone other than NFD account', () => {
      const params = {
        expired: false,
        owner: 'OWNER',
        nfdAccount: 'NFD_ACCOUNT',
        sellAmount: 0,
        isMinting: false,
      }
      expect(determineNfdState(params)).toBe('owned')
    })

    it('should return "available" when owned by NFD account and not reserved', () => {
      const params = {
        expired: false,
        owner: 'NFD_ACCOUNT',
        nfdAccount: 'NFD_ACCOUNT',
        sellAmount: 0,
        isMinting: false,
      }
      expect(determineNfdState(params)).toBe('available')
    })
  })

  describe('generateMetaTags', () => {
    it('should generate character count tag for short names', () => {
      expect(generateMetaTags('test.algo', 0)).toContain('4_letters')
      expect(generateMetaTags('a.algo', 0)).toContain('1_letters')
    })

    it('should generate "10+_letters" tag for long names', () => {
      expect(generateMetaTags('abcdefghijk.algo', 0)).toContain('10+_letters')
    })

    it('should add "pristine" tag for root NFDs with no segments', () => {
      expect(generateMetaTags('test.algo', 0)).toContain('pristine')
    })

    it('should not add "pristine" tag for root NFDs with segments', () => {
      const tags = generateMetaTags('test.algo', 1)
      expect(tags).not.toContain('pristine')
    })

    it('should add "segment" tag for segment NFDs', () => {
      expect(generateMetaTags('sub.test.algo', 0)).toContain('segment')
    })

    it('should return empty array for invalid NFD names', () => {
      expect(generateMetaTags('invalid', 0)).toEqual([])
    })
  })
})
