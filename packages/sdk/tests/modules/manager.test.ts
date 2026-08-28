import { describe, it, expect, vi, beforeEach } from 'vitest'

import { NfdClient } from '../../src/client'
import { ALGORAND_ZERO_ADDRESS } from '../../src/constants'
import { LookupModule } from '../../src/modules/lookup'
import { NfdManager } from '../../src/modules/manager'

import type { Nfd } from '../../src/types'

// Valid Algorand addresses for testing
const OWNER_ADDRESS =
  'ZZAF5ARA4MEC5PVDOP64JM5O5MQST63Q2KOY2FLYFLXXD3PFSNJJBYAFZM'
const OTHER_ADDRESS =
  'CCAF5ARA4MEC5PVDOP64JM5O5MQST63Q2KOY2FLYFLXXD3PFSNJJBYAFZM'
const VAULT_ADDRESS =
  'BBAF5ARA4MEC5PVDOP64JM5O5MQST63Q2KOY2FLYFLXXD3PFSNJJBYAFZM'

const mockOwnedNfd: Nfd = {
  name: 'test.algo',
  appID: 12345,
  state: 'owned',
  owner: OWNER_ADDRESS,
  nfdAccount: VAULT_ADDRESS,
}

const mockForSaleNfd: Nfd = {
  ...mockOwnedNfd,
  state: 'forSale',
  sellAmount: 10000000,
}

// What the registry reports, mirroring the shape of the Constraints struct
const mockConstraints = {
  segmentPlatformCostInUsd: 200n,
  segmentPlatformCostInAlgo: 1000000n,
  maxYearsAllowed: 20n,
  treasuryAddress: OTHER_ADDRESS,
  expiredAuctionDuration: 86400n,
  expiredStartingPrice: 10000000n,
  maxMintCarryCost: 0n,
}

// Mock types
interface MockSigner {
  addr: { toString: () => string }
  signer: ReturnType<typeof vi.fn>
}

interface MockInstanceClient {
  appAddress: string
  appId: bigint
  newGroup: ReturnType<typeof vi.fn>
  appClient: { getBoxValue: ReturnType<typeof vi.fn> }
}

// Mock send result factory
const mockSend = () => vi.fn().mockResolvedValue({})

// Mock Algorand client
const mockAlgorand = {
  createTransaction: {
    payment: vi.fn().mockResolvedValue({ id: 'mock-payment-txn' }),
    assetTransfer: vi.fn().mockResolvedValue({ id: 'mock-asset-txn' }),
  },
  setSigner: vi.fn(),
}

// Build a mock instance client with configurable method chains
function createMockInstanceClient(): MockInstanceClient {
  const groupMock = {
    getRenewPrice: vi.fn().mockReturnValue({
      simulate: vi.fn().mockResolvedValue({
        returns: [5000000n],
      }),
    }),
    renew: vi.fn().mockReturnValue({
      send: mockSend(),
    }),
    offerForSale: vi.fn().mockReturnValue({
      send: mockSend(),
    }),
    cancelSale: vi.fn().mockReturnValue({
      send: mockSend(),
    }),
    segmentLock: vi.fn().mockReturnValue({
      send: mockSend(),
    }),
    vaultOptInLock: vi.fn().mockReturnValue({
      send: mockSend(),
    }),
    vaultOptIn: vi.fn().mockReturnThis(),
    vaultSend: vi.fn().mockReturnValue({
      send: mockSend(),
    }),
    getFieldUpdateCost: vi.fn().mockReturnValue({
      simulate: vi.fn().mockResolvedValue({ returns: [1000n] }),
    }),
    updateFields: vi.fn().mockReturnThis(),
    addTransaction: vi.fn().mockReturnThis(),
    send: mockSend(),
  }
  return {
    appAddress: 'mock-app-address',
    appId: 12345n,
    newGroup: vi.fn().mockReturnValue(groupMock),
    // Present so a stray per-box read would be visible rather than throwing
    appClient: { getBoxValue: vi.fn() },
  }
}

// Build a mock registry client for the address-linking flow
function createMockRegistryClient() {
  return {
    appAddress: 'mock-registry-address',
    newGroup: vi.fn().mockReturnValue({
      costToAddToAddress: vi.fn().mockReturnValue({
        simulate: vi.fn().mockResolvedValue({ returns: [0n] }),
      }),
    }),
    createTransaction: {
      linkNfdAddress: vi
        .fn()
        .mockResolvedValue({ transactions: [{ id: 'mock-link-txn' }] }),
    },
  }
}

let mockInstanceClient: MockInstanceClient
let mockRegistryClient: ReturnType<typeof createMockRegistryClient>

// Mock the dependencies
vi.mock('algosdk', () => ({
  isValidAddress: vi.fn((addr: string) => addr.length === 58),
  Address: {
    fromString: vi.fn((addr: string) => {
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

vi.mock('../../src/utils/error-parser', () => ({
  parseTransactionError: vi.fn((error) => error.message || 'Unknown error'),
}))

describe('NfdManager', () => {
  let client: NfdClient
  let manager: NfdManager
  let mockSigner: MockSigner

  beforeEach(() => {
    vi.clearAllMocks()

    mockInstanceClient = createMockInstanceClient()
    mockRegistryClient = createMockRegistryClient()

    mockSigner = {
      addr: { toString: () => OWNER_ADDRESS },
      signer: vi.fn(),
    }

    client = new NfdClient()
    client.setSigner(OWNER_ADDRESS, mockSigner.signer)
    manager = new NfdManager(client, 'test.algo')

    // Mock the resolve the manager uses to return the owned NFD and its boxes
    vi.spyOn(LookupModule.prototype, 'resolveWithBoxes').mockResolvedValue({
      nfd: mockOwnedNfd,
      boxes: [],
    })

    // Mock getInstanceClient
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(manager as any, 'getInstanceClient').mockReturnValue(
      mockInstanceClient,
    )

    // Registry constraints bound the renewal term and the segment price
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(manager as any, 'getConstraints').mockResolvedValue(
      mockConstraints,
    )
  })

  describe('getRenewalPrice', () => {
    it('should return the renewal price', async () => {
      const price = await manager.getRenewalPrice()

      expect(price).toBe(5000000n)
      expect(mockInstanceClient.newGroup).toHaveBeenCalled()
      expect(mockInstanceClient.newGroup().getRenewPrice).toHaveBeenCalled()
    })

    it('should throw if NFD has no appID', async () => {
      vi.spyOn(
        LookupModule.prototype,
        'resolveWithBoxes',
      ).mockResolvedValueOnce({
        nfd: { ...mockOwnedNfd, appID: undefined },
        boxes: [],
      })
      // Reset cached NFD
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(manager as any)._nfd = null

      await expect(manager.getRenewalPrice()).rejects.toThrow(
        'NFD has no application ID',
      )
    })

    it('should throw if no price returned', async () => {
      mockInstanceClient.newGroup.mockReturnValueOnce({
        getRenewPrice: vi.fn().mockReturnValue({
          simulate: vi.fn().mockResolvedValue({ returns: [undefined] }),
        }),
      })

      await expect(manager.getRenewalPrice()).rejects.toThrow(
        'No price returned',
      )
    })
  })

  describe('renew', () => {
    it('should renew the NFD for the specified number of years', async () => {
      const result = await manager.renew(2)

      // Should calculate total price: 5000000 * 2 = 10000000
      expect(mockAlgorand.createTransaction.payment).toHaveBeenCalledWith({
        sender: expect.anything(),
        receiver: 'mock-app-address',
        amount: expect.objectContaining({
          amountInMicroAlgo: 10000000n,
        }),
      })

      expect(mockInstanceClient.newGroup().renew).toHaveBeenCalledWith({
        args: { payment: { id: 'mock-payment-txn' } },
        staticFee: expect.objectContaining({
          amountInMicroAlgo: 5000n,
        }),
      })

      expect(result).toEqual(mockOwnedNfd)
    })

    it('should default to 1 year', async () => {
      await manager.renew()

      expect(mockAlgorand.createTransaction.payment).toHaveBeenCalledWith({
        sender: expect.anything(),
        receiver: 'mock-app-address',
        amount: expect.objectContaining({
          amountInMicroAlgo: 5000000n,
        }),
      })
    })

    it('should throw if NFD has no appID', async () => {
      vi.spyOn(
        LookupModule.prototype,
        'resolveWithBoxes',
      ).mockResolvedValueOnce({
        nfd: { ...mockOwnedNfd, appID: undefined },
        boxes: [],
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(manager as any)._nfd = null

      await expect(manager.renew()).rejects.toThrow('NFD has no application ID')
    })

    it.each([0, 1.5, -1])(
      'should reject %s years before paying anything',
      async (years) => {
        await expect(manager.renew(years)).rejects.toThrow(
          'Renewal years must be a whole number of at least 1',
        )

        expect(mockAlgorand.createTransaction.payment).not.toHaveBeenCalled()
      },
    )

    it('should reject more years than the registry allows', async () => {
      await expect(manager.renew(21)).rejects.toThrow(
        'Renewal years must be at most 20',
      )

      expect(mockAlgorand.createTransaction.payment).not.toHaveBeenCalled()
    })

    it('should take the maximum from the registry, not a fixed 20', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(manager as any, 'getConstraints').mockResolvedValue({
        ...mockConstraints,
        maxYearsAllowed: 5n,
      })

      await expect(manager.renew(6)).rejects.toThrow(
        'Renewal years must be at most 5',
      )
    })
  })

  describe('listForSale', () => {
    it('should list the NFD for sale with default reservedFor', async () => {
      const result = await manager.listForSale(10000000n)

      expect(mockInstanceClient.newGroup().offerForSale).toHaveBeenCalledWith({
        args: {
          sellAmount: 10000000n,
          reservedFor: ALGORAND_ZERO_ADDRESS,
        },
        staticFee: expect.objectContaining({
          amountInMicroAlgo: 3000n,
        }),
      })

      expect(result).toEqual(mockOwnedNfd)
    })

    it('should use provided reservedFor address', async () => {
      await manager.listForSale(10000000n, { reservedFor: OTHER_ADDRESS })

      expect(mockInstanceClient.newGroup().offerForSale).toHaveBeenCalledWith({
        args: {
          sellAmount: 10000000n,
          reservedFor: OTHER_ADDRESS,
        },
        staticFee: expect.objectContaining({
          amountInMicroAlgo: 3000n,
        }),
      })
    })

    it('should throw if not the owner', async () => {
      const otherSigner: MockSigner = {
        addr: { toString: () => OTHER_ADDRESS },
        signer: vi.fn(),
      }
      client.setSigner(OTHER_ADDRESS, otherSigner.signer)
      const manager2 = new NfdManager(client, 'test.algo')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(manager2 as any, 'getInstanceClient').mockReturnValue(
        mockInstanceClient,
      )

      await expect(manager2.listForSale(10000000n)).rejects.toThrow(
        'Only the owner can list this NFD for sale',
      )
    })

    it('should refuse to list an NFD that still has properties', async () => {
      // offerForSale asserts the NFD has no boxes left
      vi.spyOn(LookupModule.prototype, 'resolveWithBoxes').mockResolvedValue({
        nfd: mockOwnedNfd,
        boxes: [{ name: 'u.url', value: new Uint8Array([1]) }],
      })

      await expect(manager.listForSale(10000000n)).rejects.toThrow(
        'An NFD can only be sold once its properties are cleared, but 1 remain',
      )

      expect(mockInstanceClient.newGroup().offerForSale).not.toHaveBeenCalled()
    })

    it('should refuse to list an expired NFD', async () => {
      vi.spyOn(LookupModule.prototype, 'resolveWithBoxes').mockResolvedValue({
        nfd: { ...mockOwnedNfd, expired: true },
        boxes: [],
      })

      await expect(manager.listForSale(10000000n)).rejects.toThrow(
        'Cannot list an expired NFD for sale',
      )
    })

    it('should refuse to list an NFD that is still minting', async () => {
      vi.spyOn(LookupModule.prototype, 'resolveWithBoxes').mockResolvedValue({
        nfd: { ...mockOwnedNfd, state: 'minting' },
        boxes: [],
      })

      await expect(manager.listForSale(10000000n)).rejects.toThrow(
        'Cannot list this NFD for sale while the NFD is still minting',
      )
    })
  })

  describe('price validation', () => {
    it('should reject a fractional sale price', async () => {
      await expect(manager.listForSale(1.5)).rejects.toThrow(
        'Sale price must be a whole number, got 1.5',
      )

      expect(mockInstanceClient.newGroup().offerForSale).not.toHaveBeenCalled()
    })

    it('should reject a negative sale price', async () => {
      await expect(manager.listForSale(-1)).rejects.toThrow(
        'Sale price must not be negative, got -1',
      )
    })

    it('should reject a fractional segment price', async () => {
      await expect(manager.lockSegment(false, 3.5)).rejects.toThrow(
        'Segment price must be a whole number, got 3.5',
      )
    })
  })

  describe('cancelSale', () => {
    it('should cancel the sale listing', async () => {
      vi.spyOn(LookupModule.prototype, 'resolveWithBoxes').mockResolvedValue({
        nfd: mockForSaleNfd,
        boxes: [],
      })

      const result = await manager.cancelSale()

      expect(mockInstanceClient.newGroup().cancelSale).toHaveBeenCalledWith({
        args: {},
        staticFee: expect.objectContaining({
          amountInMicroAlgo: 3000n,
        }),
      })

      expect(result).toEqual(mockForSaleNfd)
    })

    it('should throw if the NFD is not listed for sale', async () => {
      await expect(manager.cancelSale()).rejects.toThrow(
        'NFD is not listed for sale',
      )

      expect(mockInstanceClient.newGroup().cancelSale).not.toHaveBeenCalled()
    })

    it('should throw if the listed NFD has expired', async () => {
      vi.spyOn(LookupModule.prototype, 'resolveWithBoxes').mockResolvedValue({
        nfd: { ...mockForSaleNfd, expired: true },
        boxes: [],
      })

      await expect(manager.cancelSale()).rejects.toThrow(
        'Cannot cancel the sale of an expired NFD',
      )
    })

    it('should throw if the NFD is still minting', async () => {
      vi.spyOn(LookupModule.prototype, 'resolveWithBoxes').mockResolvedValue({
        nfd: { ...mockForSaleNfd, state: 'minting' },
        boxes: [],
      })

      await expect(manager.cancelSale()).rejects.toThrow(
        'Cannot cancel the sale of this NFD while the NFD is still minting',
      )
    })

    it('should throw if not the owner', async () => {
      const otherSigner: MockSigner = {
        addr: { toString: () => OTHER_ADDRESS },
        signer: vi.fn(),
      }
      client.setSigner(OTHER_ADDRESS, otherSigner.signer)
      const manager2 = new NfdManager(client, 'test.algo')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(manager2 as any, 'getInstanceClient').mockReturnValue(
        mockInstanceClient,
      )

      await expect(manager2.cancelSale()).rejects.toThrow(
        'Only the owner can cancel the sale of this NFD',
      )
    })
  })

  describe('lockSegment', () => {
    it('should lock segment minting', async () => {
      await manager.lockSegment(true, 300)

      expect(mockInstanceClient.newGroup().segmentLock).toHaveBeenCalledWith({
        args: {
          lock: true,
          usdPrice: 300n,
        },
        staticFee: expect.objectContaining({
          amountInMicroAlgo: 3000n,
        }),
      })
    })

    it('should unlock segment minting', async () => {
      await manager.lockSegment(false, 300)

      expect(mockInstanceClient.newGroup().segmentLock).toHaveBeenCalledWith({
        args: {
          lock: false,
          usdPrice: 300n,
        },
        staticFee: expect.objectContaining({
          amountInMicroAlgo: 3000n,
        }),
      })
    })

    it('should reject an unlock price below the registry minimum', async () => {
      // The default price of 0 is only valid when locking
      await expect(manager.lockSegment(false)).rejects.toThrow(
        'Segment price must be at least 200 USD cents when unlocking segment minting, got 0',
      )

      expect(mockInstanceClient.newGroup().segmentLock).not.toHaveBeenCalled()
    })

    it('should not require a price when locking', async () => {
      await manager.lockSegment(true)

      expect(mockInstanceClient.newGroup().segmentLock).toHaveBeenCalledWith(
        expect.objectContaining({ args: { lock: true, usdPrice: 0n } }),
      )
    })

    it('should throw if the NFD is listed for sale', async () => {
      vi.spyOn(LookupModule.prototype, 'resolveWithBoxes').mockResolvedValue({
        nfd: mockForSaleNfd,
        boxes: [],
      })

      await expect(manager.lockSegment(true)).rejects.toThrow(
        'Cannot lock/unlock segments for this NFD while the NFD is listed for sale',
      )
    })

    it('should throw if not the owner', async () => {
      const otherSigner: MockSigner = {
        addr: { toString: () => OTHER_ADDRESS },
        signer: vi.fn(),
      }
      client.setSigner(OTHER_ADDRESS, otherSigner.signer)
      const manager2 = new NfdManager(client, 'test.algo')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(manager2 as any, 'getInstanceClient').mockReturnValue(
        mockInstanceClient,
      )

      await expect(manager2.lockSegment(true)).rejects.toThrow(
        'Only the owner can lock/unlock segments for this NFD',
      )
    })
  })

  describe('lockVault', () => {
    it('should lock vault opt-ins', async () => {
      await manager.lockVault(true)

      expect(mockInstanceClient.newGroup().vaultOptInLock).toHaveBeenCalledWith(
        {
          args: { lock: true },
          staticFee: expect.objectContaining({
            amountInMicroAlgo: 3000n,
          }),
        },
      )
    })

    it('should unlock vault opt-ins', async () => {
      await manager.lockVault(false)

      expect(mockInstanceClient.newGroup().vaultOptInLock).toHaveBeenCalledWith(
        {
          args: { lock: false },
          staticFee: expect.objectContaining({
            amountInMicroAlgo: 3000n,
          }),
        },
      )
    })

    it('should throw if not the owner', async () => {
      const otherSigner: MockSigner = {
        addr: { toString: () => OTHER_ADDRESS },
        signer: vi.fn(),
      }
      client.setSigner(OTHER_ADDRESS, otherSigner.signer)
      const manager2 = new NfdManager(client, 'test.algo')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(manager2 as any, 'getInstanceClient').mockReturnValue(
        mockInstanceClient,
      )

      await expect(manager2.lockVault(true)).rejects.toThrow(
        'Only the owner can lock/unlock the vault for this NFD',
      )
    })

    it('should throw if the NFD is listed for sale', async () => {
      vi.spyOn(LookupModule.prototype, 'resolveWithBoxes').mockResolvedValue({
        nfd: mockForSaleNfd,
        boxes: [],
      })

      await expect(manager.lockVault(true)).rejects.toThrow(
        'Cannot lock/unlock the vault for this NFD while the NFD is listed for sale',
      )

      expect(
        mockInstanceClient.newGroup().vaultOptInLock,
      ).not.toHaveBeenCalled()
    })
  })

  describe('sendToVault', () => {
    it('should opt the vault into assets (opt-in only)', async () => {
      await manager.sendToVault([100, 200], { optInOnly: true })

      expect(mockInstanceClient.newGroup().vaultOptIn).toHaveBeenCalledWith({
        args: { assets: [100n, 200n] },
        staticFee: expect.objectContaining({
          amountInMicroAlgo: 5000n, // 3000 + 1000 * 2
        }),
      })

      // The MBR payment is the only payment: 0.1 ALGO per asset, no transfer
      expect(mockAlgorand.createTransaction.payment).toHaveBeenCalledTimes(1)
      expect(mockAlgorand.createTransaction.payment).toHaveBeenCalledWith({
        sender: expect.anything(),
        receiver: VAULT_ADDRESS,
        amount: expect.objectContaining({ amountInMicroAlgo: 200000n }),
      })
      expect(
        mockAlgorand.createTransaction.assetTransfer,
      ).not.toHaveBeenCalled()
    })

    it('should place the MBR payment directly before the opt-in', async () => {
      // vaultOptIn asserts it is not first in the group and that the
      // transaction immediately before it pays the vault's MBR
      const group = mockInstanceClient.newGroup()
      await manager.sendToVault([42], { amount: 500n })

      const [mbrCall, transferCall] =
        group.addTransaction.mock.invocationCallOrder
      const [optInCall] = group.vaultOptIn.mock.invocationCallOrder

      expect(mbrCall).toBeLessThan(optInCall)
      expect(optInCall).toBeLessThan(transferCall)
    })

    it('should transfer ALGO (asset 0) without a vault opt-in', async () => {
      await manager.sendToVault([0], { amount: 1000000n })

      // ALGO needs no opt-in, so the contract is never asked to make one and
      // no MBR is owed — the only payment is the transfer itself
      expect(mockInstanceClient.newGroup().vaultOptIn).not.toHaveBeenCalled()
      expect(mockAlgorand.createTransaction.payment).toHaveBeenCalledTimes(1)
      expect(mockAlgorand.createTransaction.payment).toHaveBeenCalledWith({
        sender: expect.anything(),
        receiver: VAULT_ADDRESS,
        amount: expect.objectContaining({
          amountInMicroAlgo: 1000000n,
        }),
        note: undefined,
      })
    })

    it('should exclude ALGO from the opt-in list, its fee and its MBR', async () => {
      await manager.sendToVault([0, 42], { optInOnly: true })

      expect(mockInstanceClient.newGroup().vaultOptIn).toHaveBeenCalledWith({
        args: { assets: [42n] },
        staticFee: expect.objectContaining({
          amountInMicroAlgo: 4000n, // 3000 + 1000 * 1, not 1000 * 2
        }),
      })

      expect(mockAlgorand.createTransaction.payment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: expect.objectContaining({ amountInMicroAlgo: 100000n }),
        }),
      )
    })

    it('should reject an amount sent with more than one asset', async () => {
      await expect(
        manager.sendToVault([100, 200], { amount: 500n }),
      ).rejects.toThrow('An amount can only be sent with a single asset')

      expect(mockInstanceClient.newGroup().vaultOptIn).not.toHaveBeenCalled()
    })

    it('should not emit a zero-amount transfer when no amount is given', async () => {
      await manager.sendToVault([42])

      expect(mockInstanceClient.newGroup().vaultOptIn).toHaveBeenCalled()
      expect(
        mockAlgorand.createTransaction.assetTransfer,
      ).not.toHaveBeenCalled()
    })

    it('should throw if no assets are specified', async () => {
      await expect(manager.sendToVault([])).rejects.toThrow(
        'At least one asset must be specified',
      )
    })

    it('should throw when ALGO is given with nothing to send', async () => {
      await expect(manager.sendToVault([0])).rejects.toThrow(
        'ALGO (asset 0) needs no opt-in, so sending it requires an amount',
      )
    })

    it('should opt in and transfer ASA', async () => {
      await manager.sendToVault([42], { amount: 500n, note: 'test' })

      expect(mockInstanceClient.newGroup().vaultOptIn).toHaveBeenCalled()
      expect(mockAlgorand.createTransaction.assetTransfer).toHaveBeenCalledWith(
        {
          sender: expect.anything(),
          receiver: VAULT_ADDRESS,
          assetId: 42n,
          amount: 500n,
          note: 'test',
        },
      )
    })

    it('should throw if the NFD is listed for sale', async () => {
      // vaultOptIn is gated on notForSaleOrExpired()
      vi.spyOn(LookupModule.prototype, 'resolveWithBoxes').mockResolvedValue({
        nfd: mockForSaleNfd,
        boxes: [],
      })

      await expect(
        manager.sendToVault([42], { optInOnly: true }),
      ).rejects.toThrow(
        'Cannot send to the vault while the NFD is listed for sale',
      )

      expect(mockAlgorand.createTransaction.payment).not.toHaveBeenCalled()
    })

    it('should throw if the NFD has expired', async () => {
      vi.spyOn(LookupModule.prototype, 'resolveWithBoxes').mockResolvedValue({
        nfd: { ...mockOwnedNfd, expired: true },
        boxes: [],
      })

      await expect(
        manager.sendToVault([42], { optInOnly: true }),
      ).rejects.toThrow('Cannot send to the vault because the NFD has expired')
    })

    it('should throw if NFD has no vault account', async () => {
      vi.spyOn(
        LookupModule.prototype,
        'resolveWithBoxes',
      ).mockResolvedValueOnce({
        nfd: { ...mockOwnedNfd, nfdAccount: undefined },
        boxes: [],
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(manager as any)._nfd = null

      await expect(
        manager.sendToVault([100], { amount: 100n }),
      ).rejects.toThrow('NFD has no vault account')
    })
  })

  describe('sendFromVault', () => {
    it('should send assets from the vault', async () => {
      await manager.sendFromVault([100], OTHER_ADDRESS, { amount: 500n })

      expect(mockInstanceClient.newGroup().vaultSend).toHaveBeenCalledWith({
        args: {
          amount: 500n,
          receiver: OTHER_ADDRESS,
          note: '',
          asset: 100n,
          otherAssets: [],
        },
        staticFee: expect.objectContaining({
          amountInMicroAlgo: 4000n, // 3000 + 1000 * 1
        }),
      })
    })

    it('should split multiple assets into primary and others', async () => {
      await manager.sendFromVault([100, 200, 300], OTHER_ADDRESS)

      expect(mockInstanceClient.newGroup().vaultSend).toHaveBeenCalledWith({
        args: {
          amount: 0n,
          receiver: OTHER_ADDRESS,
          note: '',
          asset: 100n,
          otherAssets: [200n, 300n],
        },
        staticFee: expect.objectContaining({
          amountInMicroAlgo: 6000n, // 3000 + 1000 * 3
        }),
      })
    })

    it('should throw if not the owner', async () => {
      const otherSigner: MockSigner = {
        addr: { toString: () => OTHER_ADDRESS },
        signer: vi.fn(),
      }
      client.setSigner(OTHER_ADDRESS, otherSigner.signer)
      const manager2 = new NfdManager(client, 'test.algo')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(manager2 as any, 'getInstanceClient').mockReturnValue(
        mockInstanceClient,
      )

      await expect(
        manager2.sendFromVault([100], OWNER_ADDRESS),
      ).rejects.toThrow('Only the owner can send from the vault')
    })

    it('should throw if no assets specified', async () => {
      await expect(manager.sendFromVault([], OTHER_ADDRESS)).rejects.toThrow(
        'At least one asset must be specified',
      )
    })

    it('should reject an amount sent with more than one asset', async () => {
      // vaultSend asserts otherAssets is empty whenever amount is non-zero
      await expect(
        manager.sendFromVault([100, 200], OTHER_ADDRESS, { amount: 500n }),
      ).rejects.toThrow('An amount can only be sent with a single asset')

      expect(mockInstanceClient.newGroup().vaultSend).not.toHaveBeenCalled()
    })

    it('should reject ALGO alongside other assets', async () => {
      await expect(
        manager.sendFromVault([0, 100], OTHER_ADDRESS),
      ).rejects.toThrow('ALGO (asset 0) must be sent from the vault on its own')
    })

    it('should reject ALGO without an amount', async () => {
      // The contract has no close-out path for ALGO, so it asserts amount > 0
      await expect(manager.sendFromVault([0], OTHER_ADDRESS)).rejects.toThrow(
        'Sending ALGO (asset 0) from the vault requires an amount',
      )
    })

    it("should reject sending the NFD's own ASA to anyone but the owner", async () => {
      vi.spyOn(LookupModule.prototype, 'resolveWithBoxes').mockResolvedValue({
        nfd: { ...mockOwnedNfd, asaID: 777 },
        boxes: [],
      })

      await expect(manager.sendFromVault([777], OTHER_ADDRESS)).rejects.toThrow(
        "The NFD's own ASA (777) can only be sent",
      )

      expect(mockInstanceClient.newGroup().vaultSend).not.toHaveBeenCalled()
    })

    it("should allow the NFD's own ASA to go to the owner", async () => {
      vi.spyOn(LookupModule.prototype, 'resolveWithBoxes').mockResolvedValue({
        nfd: { ...mockOwnedNfd, asaID: 777 },
        boxes: [],
      })

      await manager.sendFromVault([777], OWNER_ADDRESS)

      expect(mockInstanceClient.newGroup().vaultSend).toHaveBeenCalled()
    })

    it('should throw if the NFD is listed for sale', async () => {
      vi.spyOn(LookupModule.prototype, 'resolveWithBoxes').mockResolvedValue({
        nfd: mockForSaleNfd,
        boxes: [],
      })

      await expect(
        manager.sendFromVault([100], OTHER_ADDRESS, { amount: 1n }),
      ).rejects.toThrow(
        'Cannot send from the vault while the NFD is listed for sale',
      )
    })

    it('should throw if the NFD has expired', async () => {
      vi.spyOn(LookupModule.prototype, 'resolveWithBoxes').mockResolvedValue({
        nfd: { ...mockOwnedNfd, expired: true },
        boxes: [],
      })

      await expect(
        manager.sendFromVault([100], OTHER_ADDRESS, { amount: 1n }),
      ).rejects.toThrow(
        'Cannot send from the vault because the NFD has expired',
      )
    })

    it('should include note when provided', async () => {
      await manager.sendFromVault([100], OTHER_ADDRESS, {
        amount: 100n,
        note: 'payment',
      })

      expect(mockInstanceClient.newGroup().vaultSend).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({
            note: 'payment',
          }),
        }),
      )
    })

    describe('receiver resolution', () => {
      // vaultSend's receiver argument is an ABI address, so a name has to be
      // resolved to one before the call
      const receiverNfd: Nfd = {
        name: 'receiver.algo',
        appID: 999,
        state: 'owned',
        owner: OTHER_ADDRESS,
        depositAccount: OTHER_ADDRESS,
        nfdAccount: VAULT_ADDRESS,
      }

      it('passes a plain address straight through without resolving', async () => {
        const resolve = vi.spyOn(client, 'resolve')

        await manager.sendFromVault([100], OTHER_ADDRESS)

        expect(resolve).not.toHaveBeenCalled()
        expect(mockInstanceClient.newGroup().vaultSend).toHaveBeenCalledWith(
          expect.objectContaining({
            args: expect.objectContaining({ receiver: OTHER_ADDRESS }),
          }),
        )
      })

      it('resolves an NFD name to its deposit account by default', async () => {
        vi.spyOn(client, 'resolve').mockResolvedValue(receiverNfd)

        await manager.sendFromVault([100], 'receiver.algo')

        expect(mockInstanceClient.newGroup().vaultSend).toHaveBeenCalledWith(
          expect.objectContaining({
            args: expect.objectContaining({ receiver: OTHER_ADDRESS }),
          }),
        )
      })

      it("resolves an NFD name to its vault for receiverType 'nfdVault'", async () => {
        vi.spyOn(client, 'resolve').mockResolvedValue(receiverNfd)

        await manager.sendFromVault([100], 'receiver.algo', {
          receiverType: 'nfdVault',
        })

        expect(mockInstanceClient.newGroup().vaultSend).toHaveBeenCalledWith(
          expect.objectContaining({
            args: expect.objectContaining({ receiver: VAULT_ADDRESS }),
          }),
        )
      })

      it('rejects a receiver that is neither an address nor an NFD name', async () => {
        await expect(
          manager.sendFromVault([100], 'not-an-address'),
        ).rejects.toThrow(
          'Receiver must be an Algorand address or an NFD name, got not-an-address',
        )

        expect(mockInstanceClient.newGroup().vaultSend).not.toHaveBeenCalled()
      })

      it("rejects receiverType 'nfdVault' given a plain address", async () => {
        await expect(
          manager.sendFromVault([100], OTHER_ADDRESS, {
            receiverType: 'nfdVault',
          }),
        ).rejects.toThrow("receiverType 'nfdVault' needs an NFD name")

        expect(mockInstanceClient.newGroup().vaultSend).not.toHaveBeenCalled()
      })

      it('falls back to the owner when the NFD has no deposit account', async () => {
        vi.spyOn(client, 'resolve').mockResolvedValue({
          ...receiverNfd,
          depositAccount: undefined,
        })

        await manager.sendFromVault([100], 'receiver.algo')

        expect(mockInstanceClient.newGroup().vaultSend).toHaveBeenCalledWith(
          expect.objectContaining({
            args: expect.objectContaining({ receiver: OTHER_ADDRESS }),
          }),
        )
      })
    })
  })

  describe('linkAddress', () => {
    /** Seed the manager's cache with a v.caAlgo.0.as box of the given value */
    function seedCaAlgoBox(value: Uint8Array) {
      vi.spyOn(LookupModule.prototype, 'resolveWithBoxes').mockResolvedValue({
        nfd: mockOwnedNfd,
        boxes: [{ name: 'v.caAlgo.0.as', value }],
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(manager as any)._nfd = null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(manager as any, 'getRegistryClient').mockReturnValue(
        mockRegistryClient,
      )
    }

    /** The eventual field values passed to the update-cost simulate */
    function eventualFields(): Uint8Array[] {
      return mockInstanceClient.newGroup().getFieldUpdateCost.mock.calls[0][0]
        .args.fieldAndVals
    }

    it('sizes the update from the already-resolved caAlgo box', async () => {
      // One populated 32-byte slot followed by an empty (zero filled) one
      const curCaAlgo = new Uint8Array(64)
      curCaAlgo.fill(7, 0, 32)
      seedCaAlgoBox(curCaAlgo)

      await manager.linkAddress(OTHER_ADDRESS)

      // The box came from the resolve, so it is not read a second time
      expect(mockInstanceClient.appClient.getBoxValue).not.toHaveBeenCalled()

      // Existing 64 bytes plus the newly linked 32-byte public key
      expect(eventualFields()[3]).toHaveLength(96)
    })

    it('keeps empty address slots, which count toward the update cost', async () => {
      const curCaAlgo = new Uint8Array(64)
      curCaAlgo.fill(7, 0, 32)
      seedCaAlgoBox(curCaAlgo)

      await manager.linkAddress(OTHER_ADDRESS)

      // Bytes 32-63 are the zero filled slot and must survive intact
      const combined = eventualFields()[3]
      expect(Array.from(combined.slice(32, 64))).toEqual(Array(32).fill(0))
      expect(Array.from(combined.slice(0, 32))).toEqual(Array(32).fill(7))
    })

    it('handles an NFD with no caAlgo box', async () => {
      vi.spyOn(LookupModule.prototype, 'resolveWithBoxes').mockResolvedValue({
        nfd: mockOwnedNfd,
        boxes: [],
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(manager as any)._nfd = null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(manager as any, 'getRegistryClient').mockReturnValue(
        mockRegistryClient,
      )

      await manager.linkAddress(OTHER_ADDRESS)

      // Just the newly linked public key
      expect(eventualFields()[3]).toHaveLength(32)
    })

    it('rejects a caller that is not the owner', async () => {
      vi.spyOn(LookupModule.prototype, 'resolveWithBoxes').mockResolvedValue({
        nfd: { ...mockOwnedNfd, owner: OTHER_ADDRESS },
        boxes: [],
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(manager as any)._nfd = null

      await expect(manager.linkAddress(OTHER_ADDRESS)).rejects.toThrow(
        'Only the owner can link addresses to this NFD',
      )
    })
  })
})
