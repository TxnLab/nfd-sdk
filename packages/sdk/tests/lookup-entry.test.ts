import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { Address, encodeUint64, getApplicationAddress } from 'algosdk'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { NfdRegistryId } from '../src/constants'
import { NfdResolver } from '../src/lookup-entry'

import type { AppState } from '@algorandfoundation/algokit-utils/types/app'

const OWNER = 'ZZAF5ARA4MEC5PVDOP64JM5O5MQST63Q2KOY2FLYFLXXD3PFSNJJBYAFZM'
const NFD_NAME = 'example.algo'
const NFD_APP_ID = 999n
const ASA_ID = 123n
const APP_ADDRESS = getApplicationAddress(NFD_APP_ID).toString()

/** Build an AppState bytes-variant entry (value + valueRaw) */
function bytesEntry(valueRaw: Uint8Array, value = ''): AppState[string] {
  return {
    value,
    valueRaw,
    valueBase64: '',
    keyRaw: new Uint8Array(),
    keyBase64: '',
  }
}

function stringEntry(str: string): AppState[string] {
  return bytesEntry(new TextEncoder().encode(str), str)
}

function uintEntry(n: number | bigint): AppState[string] {
  return bytesEntry(encodeUint64(n))
}

function addressEntry(address: string): AppState[string] {
  return bytesEntry(Address.fromString(address).publicKey)
}

function makeGlobalState(): AppState {
  return {
    'i.name': stringEntry(NFD_NAME),
    'i.owner.a': addressEntry(OWNER),
    'i.seller.a': addressEntry(OWNER),
    'i.asaid': uintEntry(ASA_ID),
    'i.expirationTime': uintEntry(0),
    'i.sellamt': uintEntry(0),
    'i.minting': stringEntry(''),
    'i.segmentCount': uintEntry(0),
    'i.ver': stringEntry('3.0'),
    'i.contractLocked': stringEntry('0'),
    'i.category': stringEntry('common'),
    'i.saleType': stringEntry(''),
    'i.highestSoldAmt': uintEntry(0),
    'i.timeCreated': uintEntry(1700000000),
    'i.timeChanged': uintEntry(1700000000),
    'i.timePurchased': uintEntry(1700000000),
  }
}

/** A fake generic AppClient for an NFD instance */
function makeInstanceStub() {
  return {
    appAddress: getApplicationAddress(NFD_APP_ID),
    getGlobalState: vi.fn().mockResolvedValue(makeGlobalState()),
  }
}

/**
 * Fake algod. Boxes are read in one `include=values` request, so the fake
 * returns names and values together.
 */
function makeAlgodStub(
  boxes: Array<{ name: Uint8Array; value: Uint8Array }> = [],
) {
  const getApplicationBoxes = vi.fn(() => {
    const request = {
      include: vi.fn(() => request),
      next: vi.fn(() => request),
      round: vi.fn(() => request),
      do: vi.fn().mockResolvedValue({ boxes, round: 1000 }),
    }
    return request
  })
  return { getApplicationBoxes }
}

interface MockSetup {
  resolver: NfdResolver
  registryStub: { getBoxValue: ReturnType<typeof vi.fn> }
  getAppClientById: ReturnType<typeof vi.fn>
}

function setup(registryId: number | bigint = NfdRegistryId.MAINNET): MockSetup {
  const registryStub = { getBoxValue: vi.fn() }
  const instanceStub = makeInstanceStub()

  const getAppClientById = vi.fn(({ appId }: { appId: bigint }) =>
    appId === BigInt(registryId) ? registryStub : instanceStub,
  )

  const mockAlgorand = {
    client: { getAppClientById, algod: makeAlgodStub() },
  } as unknown as AlgorandClient

  const resolver = new NfdResolver({ algorand: mockAlgorand, registryId })
  return { resolver, registryStub, getAppClientById }
}

describe('NfdResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('resolve', () => {
    it('resolves an NFD by name into a full record', async () => {
      const { resolver, registryStub } = setup()
      // Registry name box: ASA ID (bytes 0-7) + app ID (bytes 8-15)
      const nameBox = new Uint8Array([
        ...encodeUint64(ASA_ID),
        ...encodeUint64(NFD_APP_ID),
      ])
      registryStub.getBoxValue.mockResolvedValue(nameBox)

      const nfd = await resolver.resolve(NFD_NAME)

      expect(nfd.name).toBe(NFD_NAME)
      expect(nfd.appID).toBe(Number(NFD_APP_ID))
      expect(nfd.asaID).toBe(Number(ASA_ID))
      expect(nfd.owner).toBe(OWNER)
      expect(nfd.nfdAccount).toBe(APP_ADDRESS)
      expect(nfd.properties?.internal?.name).toBe(NFD_NAME)
    })

    it('resolves directly by app ID without a registry name lookup', async () => {
      const { resolver, registryStub } = setup()

      const nfd = await resolver.resolve(NFD_APP_ID)

      expect(nfd.appID).toBe(Number(NFD_APP_ID))
      // No name → app ID lookup should have been needed
      expect(registryStub.getBoxValue).not.toHaveBeenCalled()
    })

    it('throws for an invalid NFD name', async () => {
      const { resolver } = setup()
      await expect(resolver.resolve('not-an-nfd')).rejects.toThrow(
        /Invalid NFD name/,
      )
    })
  })

  describe('resolveAddress', () => {
    it('returns the primary NFD for an address with linked NFDs', async () => {
      const { resolver, registryStub } = setup()
      // Reverse-index box: concatenated 8-byte app IDs, primary first
      registryStub.getBoxValue.mockResolvedValue(encodeUint64(NFD_APP_ID))

      const nfd = await resolver.resolveAddress(OWNER)

      expect(nfd).not.toBeNull()
      expect(nfd?.appID).toBe(Number(NFD_APP_ID))
    })

    it('returns null when the address has no linked NFD (404)', async () => {
      const { resolver, registryStub } = setup()
      registryStub.getBoxValue.mockRejectedValue(
        new Error('box not found (404)'),
      )

      const nfd = await resolver.resolveAddress(OWNER)
      expect(nfd).toBeNull()
    })

    it('skips zero entries in the reverse-index box', async () => {
      const { resolver, registryStub } = setup()
      const box = new Uint8Array([
        ...encodeUint64(0),
        ...encodeUint64(NFD_APP_ID),
      ])
      registryStub.getBoxValue.mockResolvedValue(box)

      const nfd = await resolver.resolveAddress(OWNER)
      expect(nfd?.appID).toBe(Number(NFD_APP_ID))
    })
  })

  describe('resolveAddresses', () => {
    it('maps each address with a linked NFD to its primary record', async () => {
      const { resolver, registryStub } = setup()
      registryStub.getBoxValue.mockResolvedValue(encodeUint64(NFD_APP_ID))

      const result = await resolver.resolveAddresses([OWNER])
      expect(result[OWNER]?.appID).toBe(Number(NFD_APP_ID))
    })
  })

  describe('static factories', () => {
    it('testNet() uses the TestNet registry ID', async () => {
      const registryStub = { getBoxValue: vi.fn() }
      const getAppClientById = vi.fn(() => registryStub)
      const mockAlgorand = {
        client: { getAppClientById },
      } as unknown as AlgorandClient
      vi.spyOn(AlgorandClient, 'testNet').mockReturnValue(mockAlgorand)

      const resolver = NfdResolver.testNet()
      // Missing box → null, but the registry read still happens
      registryStub.getBoxValue.mockRejectedValue(new Error('404'))
      await resolver.resolveAddress(OWNER)

      expect(getAppClientById).toHaveBeenCalledWith(
        expect.objectContaining({ appId: BigInt(NfdRegistryId.TESTNET) }),
      )
    })
  })
})
