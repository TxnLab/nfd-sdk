import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { isIpfsUrl, checkIpfsAvailability } from '../../src/utils/ipfs'

// Mock fetch
const mockFetch = vi.fn()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.fetch = mockFetch as any

describe('IPFS Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('isIpfsUrl', () => {
    it('should return true for valid IPFS URLs', () => {
      expect(isIpfsUrl('ipfs://QmHash123')).toBe(true)
      expect(
        isIpfsUrl(
          'ipfs://bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku',
        ),
      ).toBe(true)
    })

    it('should return false for non-IPFS URLs', () => {
      expect(isIpfsUrl('https://example.com')).toBe(false)
      expect(isIpfsUrl('http://example.com')).toBe(false)
      expect(isIpfsUrl('ftp://example.com')).toBe(false)
      expect(isIpfsUrl('file:///path')).toBe(false)
    })

    it('should return false for invalid inputs', () => {
      expect(isIpfsUrl('')).toBe(false)
      expect(isIpfsUrl('ipfs://')).toBe(true) // This is actually a valid start
      expect(isIpfsUrl('ipfs')).toBe(false)
      expect(isIpfsUrl('not-a-url')).toBe(false)
    })

    it('should return false for null or undefined', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(isIpfsUrl(null as any)).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(isIpfsUrl(undefined as any)).toBe(false)
    })
  })

  describe('checkIpfsAvailability', () => {
    it('should return images.nf.domains URL when NFD cache succeeds', async () => {
      const originalUrl = 'ipfs://QmHash123'
      const expectedUrl = 'https://images.nf.domains/ipfs/QmHash123'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'image/jpeg']]),
      })

      const result = await checkIpfsAvailability(originalUrl)

      expect(mockFetch).toHaveBeenCalledWith(expectedUrl, { method: 'HEAD' })
      expect(result).toBe(expectedUrl)
    })

    it('should fallback to IPFS gateway when NFD cache fails', async () => {
      const originalUrl = 'ipfs://QmHash123'
      const nfdUrl = 'https://images.nf.domains/ipfs/QmHash123'
      const fallbackUrl = 'https://ipfs.algonode.dev/ipfs/QmHash123'

      // First call (NFD cache) fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      // Second call (IPFS gateway) succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'image/png']]),
      })

      const result = await checkIpfsAvailability(originalUrl)

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenNthCalledWith(1, nfdUrl, { method: 'HEAD' })
      expect(mockFetch).toHaveBeenNthCalledWith(2, fallbackUrl, {
        method: 'HEAD',
      })
      expect(result).toBe(fallbackUrl)
    })

    it('should return HTTP/HTTPS URLs directly without checking', async () => {
      const httpUrl = 'https://example.com/image.jpg'

      const result = await checkIpfsAvailability(httpUrl)

      expect(mockFetch).not.toHaveBeenCalled()
      expect(result).toBe(httpUrl)
    })

    it('should fallback to gateway URL when both checks fail', async () => {
      const originalUrl = 'ipfs://QmHash123'
      const fallbackUrl = 'https://ipfs.algonode.dev/ipfs/QmHash123'

      // Both calls fail
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      })

      const result = await checkIpfsAvailability(originalUrl)

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result).toBe(fallbackUrl)
    })

    it('should handle network errors and return fallback', async () => {
      const originalUrl = 'ipfs://QmHash123'
      const fallbackUrl = 'https://ipfs.algonode.dev/ipfs/QmHash123'

      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await checkIpfsAvailability(originalUrl)

      expect(result).toBe(fallbackUrl)
    })

    it('should try gateway when NFD responds with non-image content', async () => {
      const originalUrl = 'ipfs://QmHash123'
      const nfdUrl = 'https://images.nf.domains/ipfs/QmHash123'
      const fallbackUrl = 'https://ipfs.algonode.dev/ipfs/QmHash123'

      // NFD returns 200 OK but with non-image content
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'text/plain']]),
      })

      // Gateway succeeds with image
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'image/jpeg']]),
      })

      const result = await checkIpfsAvailability(originalUrl)

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenNthCalledWith(1, nfdUrl, { method: 'HEAD' })
      expect(mockFetch).toHaveBeenNthCalledWith(2, fallbackUrl, {
        method: 'HEAD',
      })
      expect(result).toBe(fallbackUrl)
    })

    it('should handle JSON metadata with HTTP image URL', async () => {
      const originalUrl = 'ipfs://QmMetadataHash'
      const httpImageUrl = 'https://example.com/image.jpg'
      const nfdUrl = 'https://images.nf.domains/ipfs/QmMetadataHash'
      const fallbackUrl = 'https://ipfs.algonode.dev/ipfs/QmMetadataHash'

      // NFD cache fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      // Gateway returns JSON
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
      })

      // GET request for JSON content
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            image: httpImageUrl,
            name: 'Test NFT',
          }),
      })

      // HTTP image URL check succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'image/jpeg']]),
      })

      const result = await checkIpfsAvailability(originalUrl)

      expect(mockFetch).toHaveBeenCalledTimes(4)
      expect(mockFetch).toHaveBeenNthCalledWith(1, nfdUrl, { method: 'HEAD' })
      expect(mockFetch).toHaveBeenNthCalledWith(2, fallbackUrl, {
        method: 'HEAD',
      })
      expect(mockFetch).toHaveBeenNthCalledWith(3, fallbackUrl)
      expect(mockFetch).toHaveBeenNthCalledWith(4, httpImageUrl, {
        method: 'HEAD',
      })
      expect(result).toBe(httpImageUrl)
    })

    it('should accept various image content types', async () => {
      const originalUrl = 'ipfs://QmHash123'
      const imageTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
      ]

      for (const contentType of imageTypes) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: new Map([['content-type', contentType]]),
        })

        const result = await checkIpfsAvailability(originalUrl)
        expect(result).toBe('https://images.nf.domains/ipfs/QmHash123')

        vi.clearAllMocks()
      }
    })

    it('should handle JSON metadata and try to extract image URL', async () => {
      const originalUrl = 'ipfs://QmMetadataHash'
      const imageUrl = 'ipfs://QmImageHash'

      // NFD cache fails, gateway returns JSON
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
      })

      // GET request for JSON content
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            image: imageUrl,
            name: 'Test NFT',
          }),
      })

      // Check if extracted image URL is valid
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'image/jpeg']]),
      })

      const result = await checkIpfsAvailability(originalUrl)

      expect(mockFetch).toHaveBeenCalledTimes(4)
      expect(result).toBe('https://ipfs.algonode.dev/ipfs/QmImageHash')
    })

    it('should fallback when JSON processing fails', async () => {
      const originalUrl = 'ipfs://QmMetadataHash'
      const fallbackUrl = 'https://ipfs.algonode.dev/ipfs/QmMetadataHash'

      // NFD cache fails, gateway returns JSON
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
      })

      // GET request returns malformed JSON
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      })

      const result = await checkIpfsAvailability(originalUrl)

      expect(result).toBe(fallbackUrl)
    })
  })
})
