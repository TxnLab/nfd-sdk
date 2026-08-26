import { Address, encodeUint64, getApplicationAddress } from 'algosdk'
import { describe, it, expect } from 'vitest'

import { buildNfdRecord } from '../../src/utils/internal/nfd-record'

import type { AppBox } from '../../src/utils/internal/boxes'
import type { AppState } from '@algorandfoundation/algokit-utils/types/app'

const APP_ID = 763844423n
const APP_ADDRESS = getApplicationAddress(APP_ID).toString()
const OWNER = 'ZZAF5ARA4MEC5PVDOP64JM5O5MQST63Q2KOY2FLYFLXXD3PFSNJJBYAFZM'
const ADDR_B = 'RSV2YCHXA7MWGFTX3WYI7TVGAS5W5XH5M7ZQVXPPRQ7DNTNW36OW2TRR6I'

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s)

function bytesEntry(valueRaw: Uint8Array, value = ''): AppState[string] {
  return {
    value,
    valueRaw,
    valueBase64: '',
    keyRaw: new Uint8Array(),
    keyBase64: '',
  }
}
const stringEntry = (s: string): AppState[string] => bytesEntry(utf8(s), s)
const uintEntry = (n: number | bigint): AppState[string] =>
  bytesEntry(encodeUint64(n))
const addressEntry = (a: string): AppState[string] =>
  bytesEntry(Address.fromString(a).publicKey)

interface StateOverrides {
  owner?: string
  sellamt?: number | bigint
  minting?: string
  reservedOwner?: string
  expirationTime?: number | bigint
}

function makeState(overrides: StateOverrides = {}): AppState {
  const state: AppState = {
    'i.name': stringEntry('example.algo'),
    'i.owner.a': addressEntry(overrides.owner ?? OWNER),
    'i.seller.a': addressEntry(OWNER),
    'i.asaid': uintEntry(123),
    'i.ver': stringEntry('3.0'),
    'i.contractLocked': stringEntry('0'),
    'i.category': stringEntry('common'),
    'i.saleType': stringEntry(''),
    'i.highestSoldAmt': uintEntry(0),
    'i.timeCreated': uintEntry(1700000000),
    'i.timeChanged': uintEntry(1700000000),
    'i.timePurchased': uintEntry(1700000000),
    'i.sellamt': uintEntry(overrides.sellamt ?? 0),
    'i.minting': stringEntry(overrides.minting ?? ''),
    'i.expirationTime': uintEntry(overrides.expirationTime ?? 0),
  }
  if (overrides.reservedOwner) {
    state['i.reservedOwner.a'] = addressEntry(overrides.reservedOwner)
  }
  return state
}

/** Boxes arrive from algod with names and values together */
function boxesFrom(values: Record<string, Uint8Array>): AppBox[] {
  return Object.entries(values).map(([name, value]) => ({ name, value }))
}

describe('buildNfdRecord', () => {
  describe('box parsing (full view)', () => {
    it('parses verified caAlgo, user-defined, unverified and split fields', async () => {
      const values: Record<string, Uint8Array> = {
        // One real 32-byte public key + one zero key (which must be skipped)
        'v.caAlgo.0.as': new Uint8Array([
          ...Address.fromString(OWNER).publicKey,
          ...new Uint8Array(32),
        ]),
        'u.url': utf8('https://example.com'),
        'u.caalgo': utf8(`${OWNER},${ADDR_B}`),
        'u.bio_00': utf8('Hello, '),
        'u.bio_01': utf8('world'),
      }

      const nfd = await buildNfdRecord({
        appId: APP_ID,
        appAddress: APP_ADDRESS,
        globalState: makeState(),
        boxes: boxesFrom(values),
        view: 'full',
      })

      expect(nfd.caAlgo).toEqual([OWNER])
      expect(nfd.properties?.verified?.caAlgo).toBe(OWNER)
      expect(nfd.properties?.userDefined?.url).toBe('https://example.com')
      expect(nfd.properties?.userDefined?.caalgo).toBe(`${OWNER},${ADDR_B}`)
      expect(nfd.unverifiedCaAlgo).toEqual([OWNER, ADDR_B])
      // Split field reassembled in order
      expect(nfd.properties?.userDefined?.bio).toBe('Hello, world')
    })
  })

  describe('split fields', () => {
    it('reassembles chunks in index order regardless of arrival order', () => {
      const nfd = buildNfdRecord({
        appId: APP_ID,
        appAddress: APP_ADDRESS,
        globalState: makeState(),
        boxes: [
          { name: 'u.bio_01', value: utf8(' world') },
          { name: 'u.bio_00', value: utf8('hello') },
          { name: 'u.bio_02', value: utf8('!') },
        ],
        view: 'full',
      })

      expect(nfd.properties?.userDefined?.bio).toBe('hello world!')
    })

    it('skips gaps left by a missing chunk', () => {
      const nfd = buildNfdRecord({
        appId: APP_ID,
        appAddress: APP_ADDRESS,
        globalState: makeState(),
        boxes: [
          { name: 'u.bio_00', value: utf8('hello') },
          // no _01
          { name: 'u.bio_02', value: utf8('!') },
        ],
        view: 'full',
      })

      expect(nfd.properties?.userDefined?.bio).toBe('hello!')
    })
  })

  describe('verified caAlgo parsing', () => {
    it('skips zero-filled address slots', () => {
      const value = new Uint8Array(96)
      value.set(Address.fromString(OWNER).publicKey, 0)
      // bytes 32-63 stay zero — an empty slot
      value.set(Address.fromString(ADDR_B).publicKey, 64)

      const nfd = buildNfdRecord({
        appId: APP_ID,
        appAddress: APP_ADDRESS,
        globalState: makeState(),
        boxes: [{ name: 'v.caAlgo.0.as', value }],
        view: 'full',
      })

      expect(nfd.caAlgo).toEqual([OWNER, ADDR_B])
      expect(nfd.properties?.verified?.caAlgo).toBe(`${OWNER},${ADDR_B}`)
    })
  })

  describe('view filtering', () => {
    it('tiny view includes caAlgo/url but excludes other user fields', async () => {
      const values: Record<string, Uint8Array> = {
        'v.caAlgo.0.as': Address.fromString(OWNER).publicKey,
        'u.url': utf8('https://example.com'),
        'u.bio': utf8('should be excluded'),
      }

      const nfd = await buildNfdRecord({
        appId: APP_ID,
        appAddress: APP_ADDRESS,
        globalState: makeState(),
        boxes: boxesFrom(values),
        view: 'tiny',
      })

      expect(nfd.properties?.userDefined?.url).toBe('https://example.com')
      expect(nfd.caAlgo).toEqual([OWNER])
      expect(nfd.properties?.userDefined?.bio).toBeUndefined()
    })
  })

  describe('state determination', () => {
    const cases: Array<[string, StateOverrides, string]> = [
      ['owned', { owner: OWNER }, 'owned'],
      ['forSale', { owner: OWNER, sellamt: 1_000_000 }, 'forSale'],
      ['minting', { owner: OWNER, minting: '1' }, 'minting'],
      ['reserved', { owner: APP_ADDRESS, reservedOwner: OWNER }, 'reserved'],
      ['available', { owner: APP_ADDRESS }, 'available'],
      ['expired', { owner: OWNER, expirationTime: 1_000_000 }, 'expired'],
    ]

    it.each(cases)('resolves %s state', async (_label, overrides, expected) => {
      const nfd = await buildNfdRecord({
        appId: APP_ID,
        appAddress: APP_ADDRESS,
        globalState: makeState(overrides),
        boxes: [],
      })
      expect(nfd.state).toBe(expected)
    })

    it('flags expired records and omits depositAccount unless owned', async () => {
      const nfd = await buildNfdRecord({
        appId: APP_ID,
        appAddress: APP_ADDRESS,
        globalState: makeState({ owner: OWNER, expirationTime: 1_000_000 }),
        boxes: [],
      })
      expect(nfd.expired).toBe(true)
      expect(nfd.depositAccount).toBeUndefined()
    })
  })

  describe('core fields', () => {
    it('maps app ID, ASA ID, owner and account', async () => {
      const nfd = await buildNfdRecord({
        appId: APP_ID,
        appAddress: APP_ADDRESS,
        globalState: makeState({ owner: OWNER }),
        boxes: [],
      })
      expect(nfd.name).toBe('example.algo')
      expect(nfd.appID).toBe(Number(APP_ID))
      expect(nfd.asaID).toBe(123)
      expect(nfd.owner).toBe(OWNER)
      expect(nfd.nfdAccount).toBe(APP_ADDRESS)
      // 'owned' records expose a deposit account
      expect(nfd.depositAccount).toBe(OWNER)
    })
  })
})
