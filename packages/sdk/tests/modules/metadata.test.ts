import { describe, it, expect, vi, beforeEach } from 'vitest'

import { DEFAULT_AVATAR_DATA_URI } from '../../src/assets'
import { MetadataModule } from '../../src/modules/metadata'
import * as ipfsUtils from '../../src/utils/ipfs'

import type { Nfd } from '../../src/types'

// Mock the IPFS utilities
vi.mock('../../src/utils/ipfs', () => ({
  checkIpfsAvailability: vi.fn(),
  isIpfsUrl: vi.fn(),
}))

interface MockNfdClient {
  resolve: ReturnType<typeof vi.fn>
}

describe('MetadataModule', () => {
  let metadataModule: MetadataModule
  let mockClient: MockNfdClient
  let mockCheckIpfsAvailability: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Setup mock client
    mockClient = {
      resolve: vi.fn(),
    }

    // Setup mock IPFS function
    mockCheckIpfsAvailability = vi.mocked(ipfsUtils.checkIpfsAvailability)
    mockCheckIpfsAvailability.mockResolvedValue(
      'https://resolved-url.com/image.jpg',
    )

    // Create metadata module with mock client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadataModule = new MetadataModule(mockClient as any)
  })

  describe('isNfdObject', () => {
    it('should return true for valid NFD objects', () => {
      const nfd = { name: 'test.algo', properties: {} } satisfies Partial<Nfd>
      expect(metadataModule.isNfdObject(nfd)).toBe(true)
    })

    it('should return false for string inputs', () => {
      expect(metadataModule.isNfdObject('test.algo')).toBe(false)
    })

    it('should return false for number inputs', () => {
      expect(metadataModule.isNfdObject(123456)).toBe(false)
    })

    it('should return false for bigint inputs', () => {
      expect(metadataModule.isNfdObject(BigInt(123456))).toBe(false)
    })

    it('should return false for null', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(metadataModule.isNfdObject(null as any)).toBe(false)
    })

    it('should return false for objects without properties', () => {
      const obj = { name: 'test' }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(metadataModule.isNfdObject(obj as any)).toBe(false)
    })
  })

  describe('getAvatarImage with name/appId (slow path)', () => {
    it('should resolve NFD and return verified avatar image', async () => {
      const mockNfd = {
        name: 'test.algo',
        properties: {
          verified: {
            avatar: 'ipfs://QmHash123',
            avatarasaid: '12345',
          },
        },
      } satisfies Partial<Nfd>

      mockClient.resolve.mockResolvedValue(mockNfd)

      const result = await metadataModule.getAvatarImage('test.algo')

      expect(mockClient.resolve).toHaveBeenCalledWith('test.algo', {
        view: 'full',
      })
      expect(mockCheckIpfsAvailability).toHaveBeenCalledWith('ipfs://QmHash123')
      expect(result).toEqual({
        raw: 'ipfs://QmHash123',
        url: 'https://resolved-url.com/image.jpg',
        verified: true,
        asaId: 12345,
      })
    })

    it('should return user-defined avatar when no verified avatar exists', async () => {
      const mockNfd = {
        name: 'test.algo',
        properties: {
          userDefined: {
            avatar: 'https://example.com/avatar.jpg',
          },
        },
      } satisfies Partial<Nfd>

      mockClient.resolve.mockResolvedValue(mockNfd)

      const result = await metadataModule.getAvatarImage('test.algo')

      expect(result).toEqual({
        raw: 'https://example.com/avatar.jpg',
        url: 'https://resolved-url.com/image.jpg',
        verified: false,
        asaId: null,
      })
    })

    it('should return fallback avatar when no image exists', async () => {
      const mockNfd = {
        name: 'test.algo',
        properties: {},
      } satisfies Partial<Nfd>

      mockClient.resolve.mockResolvedValue(mockNfd)

      const result = await metadataModule.getAvatarImage('test.algo')

      expect(result).toEqual({
        raw: null,
        url: DEFAULT_AVATAR_DATA_URI,
        verified: false,
        asaId: null,
        isFallback: true,
      })
    })

    it('should work with numeric app IDs', async () => {
      const mockNfd = {
        name: 'test.algo',
        properties: {
          verified: {
            avatar: 'ipfs://QmHash456',
          },
        },
      } satisfies Partial<Nfd>

      mockClient.resolve.mockResolvedValue(mockNfd)

      await metadataModule.getAvatarImage(123456)

      expect(mockClient.resolve).toHaveBeenCalledWith(123456, { view: 'full' })
    })

    it('should work with bigint app IDs', async () => {
      const mockNfd = {
        name: 'test.algo',
        properties: {},
      } satisfies Partial<Nfd>

      mockClient.resolve.mockResolvedValue(mockNfd)

      await metadataModule.getAvatarImage(BigInt(123456))

      expect(mockClient.resolve).toHaveBeenCalledWith(BigInt(123456), {
        view: 'full',
      })
    })
  })

  describe('getAvatarImage with NFD object (fast path)', () => {
    it('should parse verified avatar from NFD object directly', async () => {
      const mockNfd = {
        name: 'test.algo',
        properties: {
          verified: {
            avatar: 'ipfs://QmHash789',
            avatarasaid: '67890',
          },
        },
      } satisfies Partial<Nfd>

      const result = await metadataModule.getAvatarImage(mockNfd)

      expect(mockClient.resolve).not.toHaveBeenCalled()
      expect(result).toEqual({
        raw: 'ipfs://QmHash789',
        url: 'https://resolved-url.com/image.jpg',
        verified: true,
        asaId: 67890,
      })
    })

    it('should handle NFD object without properties', async () => {
      const mockNfd = {
        name: 'test.algo',
        properties: undefined, // Explicitly set to undefined to match the error
      } satisfies Partial<Nfd>

      const result = await metadataModule.getAvatarImage(mockNfd)

      expect(result).toEqual({
        raw: null,
        url: DEFAULT_AVATAR_DATA_URI,
        verified: false,
        asaId: null,
        isFallback: true,
      })
    })
  })

  describe('getBannerImage with name/appId (slow path)', () => {
    it('should resolve NFD and return verified banner image', async () => {
      const mockNfd = {
        name: 'test.algo',
        properties: {
          verified: {
            banner: 'ipfs://QmBannerHash',
            bannerasaid: '54321',
          },
        },
      } satisfies Partial<Nfd>

      mockClient.resolve.mockResolvedValue(mockNfd)

      const result = await metadataModule.getBannerImage('test.algo')

      expect(result).toEqual({
        raw: 'ipfs://QmBannerHash',
        url: 'https://resolved-url.com/image.jpg',
        verified: true,
        asaId: 54321,
      })
    })

    it('should return user-defined banner when no verified banner exists', async () => {
      const mockNfd = {
        name: 'test.algo',
        properties: {
          userDefined: {
            banner: 'https://example.com/banner.jpg',
          },
        },
      } satisfies Partial<Nfd>

      mockClient.resolve.mockResolvedValue(mockNfd)

      const result = await metadataModule.getBannerImage('test.algo')

      expect(result).toEqual({
        raw: 'https://example.com/banner.jpg',
        url: 'https://resolved-url.com/image.jpg',
        verified: false,
        asaId: null,
      })
    })

    it('should return null URL for banner when no image exists (no fallback)', async () => {
      const mockNfd = {
        name: 'test.algo',
        properties: {},
      } satisfies Partial<Nfd>

      mockClient.resolve.mockResolvedValue(mockNfd)

      const result = await metadataModule.getBannerImage('test.algo')

      expect(result).toEqual({
        raw: null,
        url: null,
        verified: false,
        asaId: null,
      })
    })
  })

  describe('getBannerImage with NFD object (fast path)', () => {
    it('should parse verified banner from NFD object directly', async () => {
      const mockNfd = {
        name: 'test.algo',
        properties: {
          verified: {
            banner: 'ipfs://QmBannerHash2',
            bannerasaid: '98765',
          },
        },
      } satisfies Partial<Nfd>

      const result = await metadataModule.getBannerImage(mockNfd)

      expect(mockClient.resolve).not.toHaveBeenCalled()
      expect(result).toEqual({
        raw: 'ipfs://QmBannerHash2',
        url: 'https://resolved-url.com/image.jpg',
        verified: true,
        asaId: 98765,
      })
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle ASA ID as string and convert to number', async () => {
      const mockNfd = {
        name: 'test.algo',
        properties: {
          verified: {
            avatar: 'ipfs://QmHash',
            avatarasaid: '12345',
          },
        },
      } satisfies Partial<Nfd>

      const result = await metadataModule.getAvatarImage(mockNfd)

      expect(result.asaId).toBe(12345)
      expect(typeof result.asaId).toBe('number')
    })

    it('should handle missing ASA ID gracefully', async () => {
      const mockNfd = {
        name: 'test.algo',
        properties: {
          verified: {
            avatar: 'ipfs://QmHash',
            // avatarasaid is missing
          },
        },
      } satisfies Partial<Nfd>

      const result = await metadataModule.getAvatarImage(mockNfd)

      expect(result.asaId).toBe(null)
    })

    it('should prioritize verified images over user-defined', async () => {
      const mockNfd = {
        name: 'test.algo',
        properties: {
          verified: {
            avatar: 'ipfs://verified-avatar',
          },
          userDefined: {
            avatar: 'https://user-avatar.jpg',
          },
        },
      } satisfies Partial<Nfd>

      const result = await metadataModule.getAvatarImage(mockNfd)

      expect(result.raw).toBe('ipfs://verified-avatar')
      expect(result.verified).toBe(true)
    })

    it('should handle IPFS resolution errors gracefully', async () => {
      mockCheckIpfsAvailability.mockRejectedValue(new Error('IPFS error'))

      const mockNfd = {
        name: 'test.algo',
        properties: {
          verified: {
            avatar: 'ipfs://QmHash',
          },
        },
      } satisfies Partial<Nfd>

      // Should propagate the error
      await expect(metadataModule.getAvatarImage(mockNfd)).rejects.toThrow(
        'IPFS error',
      )
    })
  })
})
