import { describe, it, expect, vi, beforeEach } from 'vitest'

import { NfdClient } from '../../src/client'
import { ALGORAND_ZERO_ADDRESS } from '../../src/constants'
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

// Mock types
interface MockSigner {
  addr: { toString: () => string }
  signer: ReturnType<typeof vi.fn>
}

interface MockInstanceClient {
  appAddress: string
  newGroup: ReturnType<typeof vi.fn>
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
    addTransaction: vi.fn().mockReturnThis(),
    send: mockSend(),
  }
  return {
    appAddress: 'mock-app-address',
    newGroup: vi.fn().mockReturnValue(groupMock),
  }
}

let mockInstanceClient: MockInstanceClient

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

    mockSigner = {
      addr: { toString: () => OWNER_ADDRESS },
      signer: vi.fn(),
    }

    client = new NfdClient()
    client.setSigner(OWNER_ADDRESS, mockSigner.signer)
    manager = new NfdManager(client, 'test.algo')

    // Mock client.resolve to return the owned NFD
    vi.spyOn(client, 'resolve').mockResolvedValue(mockOwnedNfd)

    // Mock getInstanceClient
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(manager as any, 'getInstanceClient').mockReturnValue(
      mockInstanceClient,
    )
  })

  describe('getRenewalPrice', () => {
    it('should return the renewal price', async () => {
      const price = await manager.getRenewalPrice()

      expect(price).toBe(5000000n)
      expect(mockInstanceClient.newGroup).toHaveBeenCalled()
      expect(
        mockInstanceClient.newGroup().getRenewPrice,
      ).toHaveBeenCalled()
    })

    it('should throw if NFD has no appID', async () => {
      vi.spyOn(client, 'resolve').mockResolvedValueOnce({
        ...mockOwnedNfd,
        appID: undefined,
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
      vi.spyOn(client, 'resolve').mockResolvedValueOnce({
        ...mockOwnedNfd,
        appID: undefined,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(manager as any)._nfd = null

      await expect(manager.renew()).rejects.toThrow(
        'NFD has no application ID',
      )
    })
  })

  describe('listForSale', () => {
    it('should list the NFD for sale with default reservedFor', async () => {
      const result = await manager.listForSale(10000000n)

      expect(
        mockInstanceClient.newGroup().offerForSale,
      ).toHaveBeenCalledWith({
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

      expect(
        mockInstanceClient.newGroup().offerForSale,
      ).toHaveBeenCalledWith({
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
  })

  describe('cancelSale', () => {
    it('should cancel the sale listing', async () => {
      const result = await manager.cancelSale()

      expect(
        mockInstanceClient.newGroup().cancelSale,
      ).toHaveBeenCalledWith({
        args: {},
        staticFee: expect.objectContaining({
          amountInMicroAlgo: 3000n,
        }),
      })

      expect(result).toEqual(mockOwnedNfd)
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

      expect(
        mockInstanceClient.newGroup().segmentLock,
      ).toHaveBeenCalledWith({
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
      await manager.lockSegment(false)

      expect(
        mockInstanceClient.newGroup().segmentLock,
      ).toHaveBeenCalledWith({
        args: {
          lock: false,
          usdPrice: 0n,
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

      await expect(manager2.lockSegment(true)).rejects.toThrow(
        'Only the owner can lock/unlock segments for this NFD',
      )
    })
  })

  describe('lockVault', () => {
    it('should lock vault opt-ins', async () => {
      await manager.lockVault(true)

      expect(
        mockInstanceClient.newGroup().vaultOptInLock,
      ).toHaveBeenCalledWith({
        args: { lock: true },
        staticFee: expect.objectContaining({
          amountInMicroAlgo: 3000n,
        }),
      })
    })

    it('should unlock vault opt-ins', async () => {
      await manager.lockVault(false)

      expect(
        mockInstanceClient.newGroup().vaultOptInLock,
      ).toHaveBeenCalledWith({
        args: { lock: false },
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

      await expect(manager2.lockVault(true)).rejects.toThrow(
        'Only the owner can lock/unlock the vault for this NFD',
      )
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

      // Should not create transfer transactions
      expect(mockAlgorand.createTransaction.payment).not.toHaveBeenCalled()
      expect(
        mockAlgorand.createTransaction.assetTransfer,
      ).not.toHaveBeenCalled()
    })

    it('should opt in and transfer ALGO (asset 0)', async () => {
      await manager.sendToVault([0], { amount: 1000000n })

      expect(mockInstanceClient.newGroup().vaultOptIn).toHaveBeenCalled()
      expect(mockAlgorand.createTransaction.payment).toHaveBeenCalledWith({
        sender: expect.anything(),
        receiver: VAULT_ADDRESS,
        amount: expect.objectContaining({
          amountInMicroAlgo: 1000000n,
        }),
        note: undefined,
      })
    })

    it('should opt in and transfer ASA', async () => {
      await manager.sendToVault([42], { amount: 500n, note: 'test' })

      expect(mockInstanceClient.newGroup().vaultOptIn).toHaveBeenCalled()
      expect(
        mockAlgorand.createTransaction.assetTransfer,
      ).toHaveBeenCalledWith({
        sender: expect.anything(),
        receiver: VAULT_ADDRESS,
        assetId: 42n,
        amount: 500n,
        note: 'test',
      })
    })

    it('should throw if NFD has no vault account', async () => {
      vi.spyOn(client, 'resolve').mockResolvedValueOnce({
        ...mockOwnedNfd,
        nfdAccount: undefined,
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
      await expect(
        manager.sendFromVault([], OTHER_ADDRESS),
      ).rejects.toThrow('At least one asset must be specified')
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
  })
})
