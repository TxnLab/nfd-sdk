import { Address, encodeUint64 } from 'algosdk'
import { describe, it, expect } from 'vitest'

import {
  decodeAppIdFromNameBox,
  getAddressBoxName,
  getNameBoxName,
} from '../../src/utils/internal/registry-box'

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex')

const ADDRESS = 'ZZAF5ARA4MEC5PVDOP64JM5O5MQST63Q2KOY2FLYFLXXD3PFSNJJBYAFZM'

// Known-good SHA-256 vectors. These lock in the box-addressing scheme so the
// native Web Crypto implementation can't silently diverge from the registry
// contract's `sha256("name/" + name)` / `sha256("addr/algo/" + pubkey)` keys.
const NAME_VECTOR = {
  name: 'nfdomains.algo',
  hash: 'd5f31caf1df4a68b8b1de6680d40d8e95c3c59355f644ab77e30de1fb1be60c6',
}
const ADDRESS_BOX_HASH =
  'a34e3f9eddcec0c4d8aa9332cd521be94027af9b17bfbfbad8aada132ec16d95'

describe('registry-box', () => {
  describe('getNameBoxName', () => {
    it('produces the SHA-256 of `name/<name>`', async () => {
      const boxName = await getNameBoxName(NAME_VECTOR.name)
      expect(boxName).toHaveLength(32)
      expect(hex(boxName)).toBe(NAME_VECTOR.hash)
    })
  })

  describe('getAddressBoxName', () => {
    it('produces the SHA-256 of `addr/algo/` + public key', async () => {
      const boxName = await getAddressBoxName(ADDRESS)
      expect(boxName).toHaveLength(32)
      expect(hex(boxName)).toBe(ADDRESS_BOX_HASH)
    })

    it('accepts a string or an Address and yields the same box name', async () => {
      const fromString = await getAddressBoxName(ADDRESS)
      const fromAddress = await getAddressBoxName(Address.fromString(ADDRESS))
      expect(hex(fromAddress)).toBe(hex(fromString))
    })
  })

  describe('decodeAppIdFromNameBox', () => {
    it('reads the app ID from bytes 8-15 (ASA ID occupies bytes 0-7)', () => {
      const asaId = 123n
      const appId = 763844423n
      const box = new Uint8Array([
        ...encodeUint64(asaId),
        ...encodeUint64(appId),
      ])
      expect(decodeAppIdFromNameBox(box)).toBe(appId)
    })
  })
})
