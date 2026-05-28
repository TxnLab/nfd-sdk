import { Address, decodeUint64 } from 'algosdk'

import { concatUint8Arrays } from './bytes'

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    data as BufferSource,
  )
  return new Uint8Array(digest)
}

/**
 * Compute the registry box name for an NFD name: SHA-256 of `name/<name>`
 * @param name - The NFD name (e.g. 'example.algo')
 * @returns The 32-byte box name
 */
export async function getNameBoxName(name: string): Promise<Uint8Array> {
  return sha256(new TextEncoder().encode(`name/${name}`))
}

/**
 * Compute the registry reverse-index box name for an address: SHA-256 of
 * `addr/algo/` concatenated with the address's 32-byte public key
 * @param address - The address to look up
 * @returns The 32-byte box name
 */
export async function getAddressBoxName(
  address: string | Address,
): Promise<Uint8Array> {
  const addr =
    typeof address === 'string' ? Address.fromString(address) : address
  const prefix = new TextEncoder().encode('addr/algo/')
  return sha256(concatUint8Arrays(prefix, addr.publicKey))
}

/**
 * Decode an NFD application ID from a registry name-box value. The box stores
 * the ASA ID in bytes 0-7 and the app ID in bytes 8-15.
 * @param bytes - The raw box value
 * @returns The NFD application ID
 */
export function decodeAppIdFromNameBox(bytes: Uint8Array): bigint {
  return decodeUint64(bytes.slice(8, 16), 'bigint')
}
