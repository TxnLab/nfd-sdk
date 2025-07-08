import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { TransactionSigner } from 'algosdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NfdClient } from '../src/client'
import { NfdRegistryId } from '../src/constants'

// Valid Algorand address for testing
const VALID_ADDRESS =
  'ZZAF5ARA4MEC5PVDOP64JM5O5MQST63Q2KOY2FLYFLXXD3PFSNJJBYAFZM'

// Mock the dependencies
vi.mock('algosdk', () => {
  return {
    Address: {
      fromString: vi.fn(() => ({
        toString: () => VALID_ADDRESS,
      })),
    },
    TransactionSigner: vi.fn(),
  }
})

vi.mock('@algorandfoundation/algokit-utils', () => ({
  AlgorandClient: {
    mainNet: vi.fn(() => ({
      setSigner: vi.fn(),
    })),
    testNet: vi.fn(() => ({
      setSigner: vi.fn(),
    })),
  },
}))

vi.mock('../src/api-client', () => ({
  NfdApiClient: vi.fn().mockImplementation(() => ({
    // Mock API client methods as needed
  })),
}))

vi.mock('../src/modules/lookup', () => ({
  LookupModule: vi.fn().mockImplementation(() => ({
    resolve: vi.fn().mockResolvedValue({ name: 'test.algo' }),
  })),
}))

vi.mock('../src/modules/minting', () => ({
  MintingModule: vi.fn().mockImplementation(() => ({
    getMintQuote: vi.fn().mockResolvedValue({ price: 100 }),
    mint: vi.fn().mockResolvedValue({ name: 'test.algo' }),
  })),
}))

vi.mock('../src/modules/purchasing', () => ({
  PurchasingModule: vi.fn().mockImplementation(() => ({
    getPurchaseQuote: vi.fn().mockResolvedValue({
      nfdName: 'test.algo',
      buyer: VALID_ADDRESS,
      canClaim: true,
      canBuy: false,
      price: BigInt(0),
      reservedFor: VALID_ADDRESS,
      sellAmount: BigInt(1000000),
      state: 'reserved' as const,
      authorized: true,
      authorizationError: undefined,
    }),
    claim: vi.fn().mockResolvedValue({
      name: 'test.algo',
      appID: 12345,
      state: 'owned' as const,
      owner: VALID_ADDRESS,
    }),
    buy: vi.fn().mockResolvedValue({
      name: 'test.algo',
      appID: 12345,
      state: 'owned' as const,
      owner: VALID_ADDRESS,
    }),
  })),
}))

describe('NfdClient', () => {
  let client: NfdClient
  let mockSigner: TransactionSigner

  beforeEach(() => {
    vi.clearAllMocks()
    client = new NfdClient()
    mockSigner = vi.fn()
  })

  describe('constructor', () => {
    it('should create a client with default values', () => {
      expect(client).toBeInstanceOf(NfdClient)
      expect(client.registryId).toBe(BigInt(NfdRegistryId.MAINNET))
      expect(AlgorandClient.mainNet).toHaveBeenCalled()
    })

    it('should create a client with custom values', () => {
      const customClient = new NfdClient({
        registryId: 123,
        algorand: {} as AlgorandClient,
      })
      expect(customClient.registryId).toBe(BigInt(123))
    })
  })

  describe('static factory methods', () => {
    it('should create a MainNet client', () => {
      const mainNetClient = NfdClient.mainNet()
      expect(mainNetClient).toBeInstanceOf(NfdClient)
      expect(AlgorandClient.mainNet).toHaveBeenCalled()
      expect(mainNetClient.registryId).toBe(BigInt(NfdRegistryId.MAINNET))
    })

    it('should create a TestNet client', () => {
      const testNetClient = NfdClient.testNet()
      expect(testNetClient).toBeInstanceOf(NfdClient)
      expect(AlgorandClient.testNet).toHaveBeenCalled()
      expect(testNetClient.registryId).toBe(BigInt(NfdRegistryId.TESTNET))
    })
  })

  describe('setSigner', () => {
    it('should set the signer and return the client for chaining', () => {
      const result = client.setSigner(VALID_ADDRESS, mockSigner)
      expect(result).toBe(client)
      expect(client.signer).not.toBeNull()
    })
  })

  describe('resolve', () => {
    it('should call the lookup module resolve method', async () => {
      const result = await client.resolve('test.algo')
      expect(result).toEqual({ name: 'test.algo' })
    })
  })

  describe('getMintQuote', () => {
    it('should call the minting module getMintQuote method', async () => {
      const result = await client.getMintQuote('test.algo', {
        buyer: VALID_ADDRESS,
        years: 1,
      })
      expect(result).toEqual({ price: 100 })
    })
  })

  describe('mint', () => {
    it('should call the minting module mint method and reset signer', async () => {
      // Set a signer first
      client.setSigner(VALID_ADDRESS, mockSigner)
      expect(client.signer).not.toBeNull()

      // Call mint
      const result = await client.mint('test.algo', {
        buyer: VALID_ADDRESS,
        years: 1,
      })

      // Check result and that signer was reset
      expect(result).toEqual({ name: 'test.algo' })
      expect(client.signer).toBeNull()
    })
  })

  describe('Purchasing methods', () => {
    beforeEach(() => {
      client.setSigner(VALID_ADDRESS, mockSigner)
    })

    it('should delegate getPurchaseQuote to purchasing module', async () => {
      const result = await client.getPurchaseQuote('test.algo')

      expect(result).toEqual({
        nfdName: 'test.algo',
        buyer: VALID_ADDRESS,
        canClaim: true,
        canBuy: false,
        price: BigInt(0),
        reservedFor: VALID_ADDRESS,
        sellAmount: BigInt(1000000),
        state: 'reserved',
        authorized: true,
        authorizationError: undefined,
      })
    })

    it('should delegate claim to purchasing module and reset signer', async () => {
      const result = await client.claim('test.algo')

      expect(result).toEqual({
        name: 'test.algo',
        appID: 12345,
        state: 'owned',
        owner: VALID_ADDRESS,
      })
      expect(client.signer).toBeNull() // Should reset signer after operation
    })

    it('should delegate buy to purchasing module and reset signer', async () => {
      const result = await client.buy('test.algo')

      expect(result).toEqual({
        name: 'test.algo',
        appID: 12345,
        state: 'owned',
        owner: VALID_ADDRESS,
      })
      expect(client.signer).toBeNull() // Should reset signer after operation
    })

    it('should throw error if signer not set for getPurchaseQuote', async () => {
      const clientWithoutSigner = NfdClient.testNet()

      await expect(
        clientWithoutSigner.getPurchaseQuote('test.algo'),
      ).rejects.toThrow('Signer must be set before getting purchase quote')
    })

    it('should throw error if signer not set for claim', async () => {
      const clientWithoutSigner = NfdClient.testNet()

      await expect(clientWithoutSigner.claim('test.algo')).rejects.toThrow(
        'Signer must be set before claiming NFD',
      )
    })

    it('should throw error if signer not set for buy', async () => {
      const clientWithoutSigner = NfdClient.testNet()

      await expect(clientWithoutSigner.buy('test.algo')).rejects.toThrow(
        'Signer must be set before buying NFD',
      )
    })
  })
})
