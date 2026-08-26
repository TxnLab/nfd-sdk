import { Address, encodeUint64, getApplicationAddress } from 'algosdk'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { NfdRegistryId } from '../../src/constants'
import { NfdInstanceClient } from '../../src/contracts/NFDInstanceClient'
import { NfdRegistryClient } from '../../src/contracts/NFDRegistryClient'
import { LookupModule } from '../../src/modules/lookup'

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

const stringEntry = (s: string): AppState[string] =>
  bytesEntry(new TextEncoder().encode(s), s)
const uintEntry = (n: number | bigint): AppState[string] =>
  bytesEntry(encodeUint64(n))
const addressEntry = (a: string): AppState[string] =>
  bytesEntry(Address.fromString(a).publicKey)

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

/** Fake shaped like the typed NfdInstanceClient used by getInstanceClient */
function makeInstanceFake() {
  return {
    appAddress: getApplicationAddress(NFD_APP_ID),
    appClient: {
      getGlobalState: vi.fn().mockResolvedValue(makeGlobalState()),
    },
  }
}

/**
 * Fake algod. Boxes are read in one `include=values` request, so the fake
 * returns names and values together.
 */
function makeAlgodFake(boxes: Array<{ name: Uint8Array; value: Uint8Array }>) {
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

/** Fake shaped like the typed NfdRegistryClient used by getRegistryClient */
function makeRegistryFake() {
  return {
    appClient: {
      getBoxValue: vi.fn(),
    },
  }
}

interface MockSetup {
  lookup: LookupModule
  registryFake: ReturnType<typeof makeRegistryFake>
  instanceFake: ReturnType<typeof makeInstanceFake>
  algodFake: ReturnType<typeof makeAlgodFake>
  getTypedAppClientById: ReturnType<typeof vi.fn>
}

function setup(
  boxes: Array<{ name: Uint8Array; value: Uint8Array }> = [],
): MockSetup {
  const registryFake = makeRegistryFake()
  const instanceFake = makeInstanceFake()
  const algodFake = makeAlgodFake(boxes)

  // Dispatch by the typed-client class arg
  const getTypedAppClientById = vi.fn((ClientClass: unknown) => {
    if (ClientClass === NfdRegistryClient) return registryFake
    if (ClientClass === NfdInstanceClient) return instanceFake
    throw new Error('Unexpected typed client class')
  })

  const mockClient = {
    algorand: { client: { getTypedAppClientById, algod: algodFake } },
    registryId: BigInt(NfdRegistryId.MAINNET),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lookup = new LookupModule(mockClient as any)
  return {
    lookup,
    registryFake,
    instanceFake,
    algodFake,
    getTypedAppClientById,
  }
}

/** Registry name box: ASA ID (bytes 0-7) + app ID (bytes 8-15) */
const nameBox = new Uint8Array([
  ...encodeUint64(ASA_ID),
  ...encodeUint64(NFD_APP_ID),
])

describe('LookupModule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('resolve by name', () => {
    it('resolves a name to its app ID via the registry then builds the record', async () => {
      const { lookup, registryFake, instanceFake, algodFake } = setup()
      registryFake.appClient.getBoxValue.mockResolvedValue(nameBox)

      const nfd = await lookup.resolve(NFD_NAME)

      // Name → app ID lookup went through the registry box
      expect(registryFake.appClient.getBoxValue).toHaveBeenCalledTimes(1)
      // Record built from the instance fixtures
      expect(nfd.name).toBe(NFD_NAME)
      expect(nfd.appID).toBe(Number(NFD_APP_ID))
      expect(nfd.asaID).toBe(Number(ASA_ID))
      expect(nfd.owner).toBe(OWNER)
      expect(nfd.nfdAccount).toBe(APP_ADDRESS)
      // Instance state/boxes were read for the resolved app ID, the boxes in
      // a single request
      expect(instanceFake.appClient.getGlobalState).toHaveBeenCalledTimes(1)
      expect(algodFake.getApplicationBoxes).toHaveBeenCalledTimes(1)
      expect(algodFake.getApplicationBoxes).toHaveBeenCalledWith(NFD_APP_ID)
    })
  })

  describe('resolve by app ID (parseAppId short-circuit)', () => {
    it('resolves a numeric string without a registry lookup', async () => {
      const { lookup, registryFake } = setup()

      const nfd = await lookup.resolve('123')

      // App ID comes straight from the parsed input, not a registry lookup
      expect(nfd.appID).toBe(123)
      expect(registryFake.appClient.getBoxValue).not.toHaveBeenCalled()
    })

    it('resolves a bigint app ID without a registry lookup', async () => {
      const { lookup, registryFake } = setup()

      const nfd = await lookup.resolve(123n)

      expect(nfd.appID).toBe(123)
      expect(registryFake.appClient.getBoxValue).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('rejects an invalid NFD name', async () => {
      const { lookup, registryFake } = setup()

      await expect(lookup.resolve('not-an-nfd')).rejects.toThrow(
        /Invalid NFD name/,
      )
      expect(registryFake.appClient.getBoxValue).not.toHaveBeenCalled()
    })

    it('rejects when the name is not found (registry box 404)', async () => {
      const { lookup, registryFake } = setup()
      registryFake.appClient.getBoxValue.mockRejectedValue(
        new Error('box not found (404)'),
      )

      await expect(lookup.resolve(NFD_NAME)).rejects.toThrow(/NFD not found/)
    })

    it('rejects when the registry box read yields no bytes', async () => {
      const { lookup, registryFake } = setup()
      registryFake.appClient.getBoxValue.mockResolvedValue(undefined)

      await expect(lookup.resolve(NFD_NAME)).rejects.toThrow(/NFD not found/)
    })

    it('re-throws non-404 errors from the registry box read', async () => {
      const { lookup, registryFake } = setup()
      registryFake.appClient.getBoxValue.mockRejectedValue(
        new Error('network failure'),
      )

      await expect(lookup.resolve(NFD_NAME)).rejects.toThrow(/network failure/)
    })
  })

  describe('view propagation', () => {
    it('passes the view option through to record building', async () => {
      const { lookup, registryFake } = setup()
      registryFake.appClient.getBoxValue.mockResolvedValue(nameBox)

      const nfd = await lookup.resolve(NFD_NAME, { view: 'tiny' })

      expect(nfd.appID).toBe(Number(NFD_APP_ID))
      expect(nfd.name).toBe(NFD_NAME)
    })
  })
})
