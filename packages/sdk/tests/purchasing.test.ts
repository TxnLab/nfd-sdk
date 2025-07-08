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

// Mock Algorand client
const mockAlgorand = {
  createTransaction: {
    payment: vi.fn().mockResolvedValue({ id: 'mock-txn' }),
  },
  setSigner: vi.fn(),
} as any

// Mock NFD instance client
const mockInstanceClient = {
  appAddress: 'mock-app-address',
  newGroup: vi.fn().mockReturnValue({
    purchase: vi.fn().mockReturnValue({
      send: vi.fn().mockResolvedValue({}),
    }),
  }),
} as any

// Mock the dependencies
vi.mock('algosdk', () => ({
  isValidAddress: vi.fn((addr: string) => addr.length === 58),
  Address: {
    fromString: vi.fn((addr: string) => ({
      toString: () => addr,
      publicKey: new Uint8Array(32),
    })),
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
  let mockSigner: any

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
    vi.spyOn(purchasing as any, 'getInstanceClient').mockReturnValue(
      mockInstanceClient,
    )
  })

  describe('getPurchaseQuote', () => {
    it('should return a valid quote for a reserved NFD', async () => {
      const quote = await purchasing.getPurchaseQuote('reserved.algo', {
        buyer: BUYER_ADDRESS,
      })

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
      const quote = await purchasing.getPurchaseQuote('forsale.algo', {
        buyer: BUYER_ADDRESS,
      })

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
      const quote = await purchasing.getPurchaseQuote('reserved.algo', {
        buyer: OTHER_ADDRESS,
      })

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
      const quote = await purchasing.getPurchaseQuote('owned.algo', {
        buyer: BUYER_ADDRESS,
      })

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
      const quote = await purchasing.getPurchaseQuote('forsale-reserved.algo', {
        buyer: BUYER_ADDRESS,
      })

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
        purchasing.getPurchaseQuote('reserved.algo', {
          buyer: 'invalid-address',
        }),
      ).rejects.toThrow('Invalid buyer: invalid-address')
    })
  })

  describe('claim', () => {
    it('should successfully claim a reserved NFD', async () => {
      const result = await purchasing.claim('reserved.algo', {
        claimer: BUYER_ADDRESS,
      })

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
      const otherSigner = {
        addr: { toString: () => OTHER_ADDRESS },
        signer: vi.fn(),
      }
      client.setSigner(OTHER_ADDRESS, otherSigner.signer)
      const purchasing2 = new PurchasingModule(client)
      vi.spyOn(purchasing2 as any, 'getInstanceClient').mockReturnValue(
        mockInstanceClient,
      )

      await expect(
        purchasing2.claim('reserved.algo', {
          claimer: OTHER_ADDRESS,
        }),
      ).rejects.toThrow(
        'NFD is reserved for ZZAF5ARA4MEC5PVDOP64JM5O5MQST63Q2KOY2FLYFLXXD3PFSNJJBYAFZM, but buyer is CCAF5ARA4MEC5PVDOP64JM5O5MQST63Q2KOY2FLYFLXXD3PFSNJJBYAFZM',
      )
    })

    it('should throw error if signer does not match claimer', async () => {
      await expect(
        purchasing.claim('reserved.algo', {
          claimer: OTHER_ADDRESS,
        }),
      ).rejects.toThrow(
        `Signer address (${BUYER_ADDRESS}) does not match claimer address (${OTHER_ADDRESS})`,
      )
    })

    it('should successfully claim an NFD that is for sale but reserved for claimer', async () => {
      const result = await purchasing.claim('forsale-reserved.algo', {
        claimer: BUYER_ADDRESS,
      })

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
      await expect(
        purchasing.claim('forsale.algo', {
          claimer: BUYER_ADDRESS,
        }),
      ).rejects.toThrow('Cannot claim NFD: forsale.algo (state: forSale)')
    })
  })

  describe('buy', () => {
    it('should successfully buy an NFD for sale', async () => {
      const result = await purchasing.buy('forsale.algo', {
        buyer: BUYER_ADDRESS,
      })

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

    it('should respect maxPayment limit', async () => {
      await expect(
        purchasing.buy('forsale.algo', {
          buyer: BUYER_ADDRESS,
          maxPayment: 500000, // 0.5 ALGO, less than the 1 ALGO price
        }),
      ).rejects.toThrow(
        'NFD price (1000000 microAlgos) exceeds maximum payment (500000 microAlgos)',
      )
    })

    it('should throw error if buyer is not authorized', async () => {
      // Set up a different signer for this test
      const otherSigner = {
        addr: { toString: () => OTHER_ADDRESS },
        signer: vi.fn(),
      }
      client.setSigner(OTHER_ADDRESS, otherSigner.signer)
      const purchasing2 = new PurchasingModule(client)
      vi.spyOn(purchasing2 as any, 'getInstanceClient').mockReturnValue(
        mockInstanceClient,
      )

      await expect(
        purchasing2.buy('forsale-reserved.algo', {
          buyer: OTHER_ADDRESS,
        }),
      ).rejects.toThrow(
        'NFD is reserved for ZZAF5ARA4MEC5PVDOP64JM5O5MQST63Q2KOY2FLYFLXXD3PFSNJJBYAFZM, but buyer is CCAF5ARA4MEC5PVDOP64JM5O5MQST63Q2KOY2FLYFLXXD3PFSNJJBYAFZM',
      )
    })

    it('should throw error for NFD that cannot be bought', async () => {
      await expect(
        purchasing.buy('owned.algo', {
          buyer: BUYER_ADDRESS,
        }),
      ).rejects.toThrow('NFD is not available for purchase (state: owned)')
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
    it('should throw error for invalid claimer address', async () => {
      await expect(
        purchasing.claim('reserved.algo', {
          claimer: 'invalid',
        }),
      ).rejects.toThrow('Invalid claimer: invalid')
    })

    it('should throw error for invalid buyer address', async () => {
      await expect(
        purchasing.buy('forsale.algo', {
          buyer: 'invalid',
        }),
      ).rejects.toThrow('Invalid buyer: invalid')
    })
  })
})
