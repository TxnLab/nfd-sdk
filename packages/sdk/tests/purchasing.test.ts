import { describe, it, expect, vi, beforeEach } from 'vitest'

import { NfdClient } from '../src/client'
import { PurchasingModule } from '../src/modules/purchasing'

import type { Nfd } from '../src/types'

// Valid Algorand addresses for testing
const BUYER_ADDRESS =
  'ZZAF5ARA4MEC5PVDOP64JM5O5MQST63Q2KOY2FLYFLXXD3PFSNJJBYAFZM'
const SELLER_ADDRESS =
  'BBAF5ARA4MEC5PVDOP64JM5O5MQST63Q2KOY2FLYFLXXD3PFSNJJBYAFZM'
const OTHER_ADDRESS =
  'CCAF5ARA4MEC5PVDOP64JM5O5MQST63Q2KOY2FLYFLXXD3PFSNJJBYAFZM'

// Mock NFD data for different scenarios
const mockReservedNfd: Nfd = {
  name: 'reserved.algo',
  appID: 123,
  state: 'reserved',
  reservedFor: BUYER_ADDRESS,
  owner: 'some-nfd-account',
  sellAmount: 500000, // 0.5 ALGO
  properties: {
    internal: {
      mintingKickoffAmount: '100000', // 0.1 ALGO
    },
  },
}

const mockForSaleNfd: Nfd = {
  name: 'forsale.algo',
  appID: 456,
  state: 'forSale',
  sellAmount: 1000000, // 1 ALGO
  owner: SELLER_ADDRESS,
}

const mockForSaleReservedNfd: Nfd = {
  name: 'forsale-reserved.algo',
  appID: 789,
  state: 'forSale',
  sellAmount: 2000000, // 2 ALGO
  reservedFor: BUYER_ADDRESS,
  owner: SELLER_ADDRESS,
  properties: {
    internal: {
      mintingKickoffAmount: '500000', // 0.5 ALGO
    },
  },
}

const mockOwnedNfd: Nfd = {
  name: 'owned.algo',
  appID: 321,
  state: 'owned',
  owner: OTHER_ADDRESS,
}

// Mock types
interface MockAlgorand {
  createTransaction: {
    payment: ReturnType<typeof vi.fn>
  }
  setSigner: ReturnType<typeof vi.fn>
}

interface MockInstanceClient {
  appAddress: string
  newGroup: ReturnType<typeof vi.fn>
}

interface MockSigner {
  addr: { toString: () => string }
  signer: ReturnType<typeof vi.fn>
}

// Mock Algorand client
const mockAlgorand: MockAlgorand = {
  createTransaction: {
    payment: vi.fn().mockResolvedValue({ id: 'mock-txn' }),
  },
  setSigner: vi.fn(),
}

// Mock NFD instance client
const mockInstanceClient: MockInstanceClient = {
  appAddress: 'mock-app-address',
  newGroup: vi.fn().mockReturnValue({
    purchase: vi.fn().mockReturnValue({
      send: vi.fn().mockResolvedValue({}),
    }),
  }),
}

// Mock the dependencies
vi.mock('algosdk', () => ({
  isValidAddress: vi.fn((addr: string) => addr.length === 58),
  Address: {
    fromString: vi.fn((addr: string) => {
      // Throw error for invalid addresses (less than 58 characters)
      if (addr.length !== 58) {
        throw new Error('Invalid address')
      }
      return {
        toString: () => addr,
        publicKey: new Uint8Array(32),
      }
    }),
  },
}))

vi.mock('@algorandfoundation/algokit-utils', () => ({
  AlgorandClient: {
    mainNet: vi.fn(() => mockAlgorand),
  },
  AlgoAmount: {
    MicroAlgos: vi.fn((amount) => ({
      amountInMicroAlgo: typeof amount === 'bigint' ? amount : BigInt(amount),
      microAlgos: typeof amount === 'bigint' ? amount : BigInt(amount),
    })),
  },
}))

vi.mock('../src/utils/error-parser', () => ({
  parseTransactionError: vi.fn((error) => error.message || 'Unknown error'),
}))

describe('PurchasingModule', () => {
  let client: NfdClient
  let purchasing: PurchasingModule
  let mockSigner: MockSigner

  beforeEach(() => {
    vi.clearAllMocks()

    // Create mock signer
    mockSigner = {
      addr: { toString: () => BUYER_ADDRESS },
      signer: vi.fn(),
    }

    // Create client and purchasing module
    client = new NfdClient()
    client.setSigner(BUYER_ADDRESS, mockSigner.signer)
    purchasing = new PurchasingModule(client)

    // Mock client methods
    vi.spyOn(client, 'resolve').mockImplementation(async (nameOrAppId) => {
      if (nameOrAppId === 'reserved.algo' || nameOrAppId === 123) {
        return mockReservedNfd
      }
      if (nameOrAppId === 'forsale.algo' || nameOrAppId === 456) {
        return mockForSaleNfd
      }
      if (nameOrAppId === 'forsale-reserved.algo' || nameOrAppId === 789) {
        return mockForSaleReservedNfd
      }
      if (nameOrAppId === 'owned.algo' || nameOrAppId === 321) {
        return mockOwnedNfd
      }
      throw new Error('NFD not found')
    })

    // Mock getInstanceClient method
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(purchasing as any, 'getInstanceClient').mockReturnValue(
      mockInstanceClient,
    )
  })

  describe('getPurchaseQuote', () => {
    it('should return a valid quote for a reserved NFD', async () => {
      const quote = await purchasing.getPurchaseQuote(
        'reserved.algo',
        BUYER_ADDRESS,
      )

      expect(quote).toEqual({
        nfdName: 'reserved.algo',
        buyer: BUYER_ADDRESS,
        canClaim: true,
        canBuy: false,
        price: BigInt(400000), // sellAmount (500000) - mintingKickoffAmount (100000)
        reservedFor: BUYER_ADDRESS,
        sellAmount: BigInt(500000),
        state: 'reserved',
        authorized: true,
        authorizationError: undefined,
      })
    })

    it('should return a valid quote for an NFD for sale', async () => {
      const quote = await purchasing.getPurchaseQuote(
        'forsale.algo',
        BUYER_ADDRESS,
      )

      expect(quote).toEqual({
        nfdName: 'forsale.algo',
        buyer: BUYER_ADDRESS,
        canClaim: false,
        canBuy: true,
        price: BigInt(1000000),
        reservedFor: undefined,
        sellAmount: BigInt(1000000),
        state: 'forSale',
        authorized: true,
        authorizationError: undefined,
      })
    })

    it('should return unauthorized for NFD reserved for someone else', async () => {
      const quote = await purchasing.getPurchaseQuote(
        'reserved.algo',
        OTHER_ADDRESS,
      )

      expect(quote).toEqual({
        nfdName: 'reserved.algo',
        buyer: OTHER_ADDRESS,
        canClaim: false,
        canBuy: false,
        price: BigInt(0), // No price calculated since not authorized
        reservedFor: BUYER_ADDRESS,
        sellAmount: BigInt(500000),
        state: 'reserved',
        authorized: false,
        authorizationError: `NFD is reserved for ${BUYER_ADDRESS}, but buyer is ${OTHER_ADDRESS}`,
      })
    })

    it('should return unauthorized for owned NFD', async () => {
      const quote = await purchasing.getPurchaseQuote(
        'owned.algo',
        BUYER_ADDRESS,
      )

      expect(quote).toEqual({
        nfdName: 'owned.algo',
        buyer: BUYER_ADDRESS,
        canClaim: false,
        canBuy: false,
        price: BigInt(0),
        reservedFor: undefined,
        sellAmount: undefined,
        state: 'owned',
        authorized: false,
        authorizationError: 'NFD is not available for purchase (state: owned)',
      })
    })

    it('should return a valid quote for an NFD for sale but reserved for buyer', async () => {
      const quote = await purchasing.getPurchaseQuote(
        'forsale-reserved.algo',
        BUYER_ADDRESS,
      )

      expect(quote).toEqual({
        nfdName: 'forsale-reserved.algo',
        buyer: BUYER_ADDRESS,
        canClaim: true, // Should be claimable since it's reserved for the buyer
        canBuy: false, // Cannot buy since it's reserved
        price: BigInt(1500000), // sellAmount (2000000) - mintingKickoffAmount (500000)
        reservedFor: BUYER_ADDRESS,
        sellAmount: BigInt(2000000),
        state: 'forSale',
        authorized: true,
        authorizationError: undefined,
      })
    })

    it('should throw error for invalid buyer address', async () => {
      await expect(
        purchasing.getPurchaseQuote('reserved.algo', 'invalid-address'),
      ).rejects.toThrow('Invalid buyer: invalid-address')
    })
  })

  describe('claim', () => {
    it('should successfully claim a reserved NFD', async () => {
      const result = await purchasing.claim('reserved.algo')

      expect(mockAlgorand.createTransaction.payment).toHaveBeenCalledWith({
        sender: BUYER_ADDRESS,
        receiver: 'mock-app-address',
        amount: expect.objectContaining({
          amountInMicroAlgo: BigInt(400000), // sellAmount (500000) - mintingKickoffAmount (100000)
        }),
      })

      expect(mockInstanceClient.newGroup).toHaveBeenCalled()
      expect(mockInstanceClient.newGroup().purchase).toHaveBeenCalledWith({
        args: { payment: { id: 'mock-txn' } },
        staticFee: expect.objectContaining({
          amountInMicroAlgo: BigInt(4000),
        }),
      })
      expect(
        mockInstanceClient.newGroup().purchase().send,
      ).toHaveBeenCalledWith({
        populateAppCallResources: true,
      })

      expect(result).toEqual(mockReservedNfd)
    })

    it('should throw error if claimer is not authorized', async () => {
      // Set up a different signer for this test
      const otherSigner: MockSigner = {
        addr: { toString: () => OTHER_ADDRESS },
        signer: vi.fn(),
      }
      client.setSigner(OTHER_ADDRESS, otherSigner.signer)
      const purchasing2 = new PurchasingModule(client)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(purchasing2 as any, 'getInstanceClient').mockReturnValue(
        mockInstanceClient,
      )

      await expect(purchasing2.claim('reserved.algo')).rejects.toThrow(
        'NFD is reserved for ZZAF5ARA4MEC5PVDOP64JM5O5MQST63Q2KOY2FLYFLXXD3PFSNJJBYAFZM, but buyer is CCAF5ARA4MEC5PVDOP64JM5O5MQST63Q2KOY2FLYFLXXD3PFSNJJBYAFZM',
      )
    })

    it('should successfully claim an NFD that is for sale but reserved for claimer', async () => {
      const result = await purchasing.claim('forsale-reserved.algo')

      expect(mockAlgorand.createTransaction.payment).toHaveBeenCalledWith({
        sender: BUYER_ADDRESS,
        receiver: 'mock-app-address',
        amount: expect.objectContaining({
          amountInMicroAlgo: BigInt(1500000), // sellAmount (2000000) - mintingKickoffAmount (500000)
        }),
      })

      expect(result).toEqual(mockForSaleReservedNfd)
    })

    it('should throw error for NFD that cannot be claimed', async () => {
      await expect(purchasing.claim('forsale.algo')).rejects.toThrow(
        'Cannot claim NFD: forsale.algo (state: forSale)',
      )
    })
  })

  describe('buy', () => {
    it('should successfully buy an NFD for sale', async () => {
      const result = await purchasing.buy('forsale.algo')

      expect(mockAlgorand.createTransaction.payment).toHaveBeenCalledWith({
        sender: BUYER_ADDRESS,
        receiver: 'mock-app-address',
        amount: expect.objectContaining({
          amountInMicroAlgo: BigInt(1000000),
        }),
      })

      expect(mockInstanceClient.newGroup).toHaveBeenCalled()
      expect(mockInstanceClient.newGroup().purchase).toHaveBeenCalledWith({
        args: { payment: { id: 'mock-txn' } },
        staticFee: expect.objectContaining({
          amountInMicroAlgo: BigInt(4000),
        }),
      })
      expect(
        mockInstanceClient.newGroup().purchase().send,
      ).toHaveBeenCalledWith({
        populateAppCallResources: true,
      })

      expect(result).toEqual(mockForSaleNfd)
    })

    it('should throw error if buyer is not authorized', async () => {
      // Set up a different signer for this test
      const otherSigner: MockSigner = {
        addr: { toString: () => OTHER_ADDRESS },
        signer: vi.fn(),
      }
      client.setSigner(OTHER_ADDRESS, otherSigner.signer)
      const purchasing2 = new PurchasingModule(client)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(purchasing2 as any, 'getInstanceClient').mockReturnValue(
        mockInstanceClient,
      )

      await expect(purchasing2.buy('forsale-reserved.algo')).rejects.toThrow(
        'NFD is reserved for ZZAF5ARA4MEC5PVDOP64JM5O5MQST63Q2KOY2FLYFLXXD3PFSNJJBYAFZM, but buyer is CCAF5ARA4MEC5PVDOP64JM5O5MQST63Q2KOY2FLYFLXXD3PFSNJJBYAFZM',
      )
    })

    it('should throw error for NFD that cannot be bought', async () => {
      await expect(purchasing.buy('owned.algo')).rejects.toThrow(
        'NFD is not available for purchase (state: owned)',
      )
    })
  })

  describe('canClaim', () => {
    it('should return true for claimable NFD', async () => {
      const result = await purchasing.canClaim('reserved.algo', BUYER_ADDRESS)
      expect(result).toBe(true)
    })

    it('should return false for non-claimable NFD', async () => {
      const result = await purchasing.canClaim('forsale.algo', BUYER_ADDRESS)
      expect(result).toBe(false)
    })

    it('should return false on error', async () => {
      const result = await purchasing.canClaim(
        'nonexistent.algo',
        BUYER_ADDRESS,
      )
      expect(result).toBe(false)
    })
  })

  describe('canBuy', () => {
    it('should return true for buyable NFD', async () => {
      const result = await purchasing.canBuy('forsale.algo', BUYER_ADDRESS)
      expect(result).toBe(true)
    })

    it('should return false for non-buyable NFD', async () => {
      const result = await purchasing.canBuy('owned.algo', BUYER_ADDRESS)
      expect(result).toBe(false)
    })

    it('should return false on error', async () => {
      const result = await purchasing.canBuy('nonexistent.algo', BUYER_ADDRESS)
      expect(result).toBe(false)
    })
  })

  describe('address validation', () => {
    it('should throw error for invalid buyer address in getPurchaseQuote', async () => {
      await expect(
        purchasing.getPurchaseQuote('reserved.algo', 'invalid'),
      ).rejects.toThrow('Invalid buyer: invalid')
    })

    it('should throw error for invalid buyer address in buy', async () => {
      // Mock the signer to return an invalid address when toString() is called
      const mockInvalidSigner: MockSigner = {
        addr: { toString: () => 'invalid' },
        signer: vi.fn(),
      }

      // Create a new client with a valid signer first
      const clientWithValidSigner = new NfdClient()
      clientWithValidSigner.setSigner(BUYER_ADDRESS, mockSigner.signer)

      // Now override the signer property to use our invalid signer
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(clientWithValidSigner as any)._signer = mockInvalidSigner

      const purchasing2 = new PurchasingModule(clientWithValidSigner)

      // Ensure proper mocking for the new instance
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(purchasing2 as any, 'getInstanceClient').mockReturnValue(
        mockInstanceClient,
      )

      await expect(purchasing2.buy('forsale.algo')).rejects.toThrow(
        'Invalid buyer: invalid',
      )
    })
  })
})
