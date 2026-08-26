import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { Address, decodeUint64 } from 'algosdk'

import { DefaultSender, NfdRegistryId } from './constants'
import { getAllBoxes } from './utils/internal/boxes'
import { isZeroBytes } from './utils/internal/bytes'
import { buildNfdRecord, type NfdView } from './utils/internal/nfd-record'
import {
  decodeAppIdFromNameBox,
  getAddressBoxName,
  getNameBoxName,
} from './utils/internal/registry-box'
import { isValidName } from './utils/nfd'

import type { Nfd, ResolveOptions, ReverseLookupOptions } from './types'
import type { Arc56Contract } from '@algorandfoundation/algokit-utils/types/app-arc56'
import type { AppClient } from '@algorandfoundation/algokit-utils/types/app-client'

export type { Nfd, ResolveOptions, ReverseLookupOptions } from './types'
export { NfdRegistryId } from './constants'

/**
 * A minimal ARC-56 app spec. The generic `AppClient` requires a spec, but
 * lookups only use `getGlobalState`/`getBoxNames`/`getBoxValue`, none of which
 * touch the ABI — so an empty spec is sufficient and avoids bundling the large
 * generated contract specs.
 */
const MINIMAL_APP_SPEC: Arc56Contract = {
  arcs: [4, 56],
  name: 'NfdLookup',
  structs: {},
  methods: [],
  state: {
    schema: {
      global: { ints: 0, bytes: 0 },
      local: { ints: 0, bytes: 0 },
    },
    keys: { global: {}, local: {}, box: {} },
    maps: { global: {}, local: {}, box: {} },
  },
  bareActions: { create: [], call: [] },
}

/** Configuration for {@link NfdResolver} */
export interface NfdResolverConfig {
  /** An `AlgorandClient` to use for RPC calls. Defaults to MainNet. */
  algorand?: AlgorandClient
  /** The NFD registry app ID. Defaults to MainNet. */
  registryId?: number | bigint
}

function isErrorWith404(error: unknown): boolean {
  return error instanceof Error && error.message.includes('404')
}

function toResolveView(
  view: ReverseLookupOptions['view'],
): NfdView | undefined {
  // The on-chain reader supports 'tiny' | 'brief' | 'full'. Map the API-only
  // 'thumbnail' view onto 'tiny'.
  if (view === 'thumbnail') return 'tiny'
  return view
}

/**
 * Lightweight, lookup-only NFD resolver that reads directly from on-chain
 * state. Unlike the full `NfdClient`, it does not pull in the generated typed
 * contract clients or the NFD HTTP API client, resulting in a dramatically
 * smaller bundle. It supports forward resolution (name/app ID → record) and
 * on-chain reverse resolution (address → record).
 */
export class NfdResolver {
  private readonly algorand: AlgorandClient
  private readonly registryId: bigint
  private readonly defaultSender: string

  constructor(config: NfdResolverConfig = {}) {
    this.algorand = config.algorand ?? AlgorandClient.mainNet()
    this.registryId = BigInt(config.registryId ?? NfdRegistryId.MAINNET)
    this.defaultSender =
      this.registryId === BigInt(NfdRegistryId.TESTNET)
        ? DefaultSender.TESTNET
        : DefaultSender.MAINNET
  }

  /** Create a resolver configured for MainNet. */
  static mainNet(): NfdResolver {
    return new NfdResolver({
      algorand: AlgorandClient.mainNet(),
      registryId: NfdRegistryId.MAINNET,
    })
  }

  /** Create a resolver configured for TestNet. */
  static testNet(): NfdResolver {
    return new NfdResolver({
      algorand: AlgorandClient.testNet(),
      registryId: NfdRegistryId.TESTNET,
    })
  }

  private appClientFor(appId: bigint): AppClient {
    return this.algorand.client.getAppClientById({
      appId,
      appSpec: MINIMAL_APP_SPEC,
      defaultSender: this.defaultSender,
    })
  }

  private get registryClient(): AppClient {
    return this.appClientFor(this.registryId)
  }

  private async getAppIdFromName(name: string): Promise<bigint | null> {
    const boxName = await getNameBoxName(name)
    try {
      const appIdBytes = await this.registryClient.getBoxValue(boxName)
      if (!appIdBytes) return null
      return decodeAppIdFromNameBox(appIdBytes)
    } catch (error) {
      if (isErrorWith404(error)) return null
      throw error
    }
  }

  private async parseAppId(
    nameOrAppId: string | number | bigint,
  ): Promise<bigint> {
    if (typeof nameOrAppId !== 'string') {
      return BigInt(nameOrAppId)
    }

    const parsedNumber = parseInt(nameOrAppId)
    if (!isNaN(parsedNumber)) {
      return BigInt(parsedNumber)
    }

    if (!isValidName(nameOrAppId)) {
      throw new Error(
        `Invalid NFD name: ${nameOrAppId}. Name must be in the format 'name.algo' or 'segment.name.algo'`,
      )
    }

    const appId = await this.getAppIdFromName(nameOrAppId)
    if (appId === null) {
      throw new Error(`NFD not found: ${nameOrAppId}`)
    }

    return appId
  }

  /**
   * Resolve an NFD by name or application ID by reading directly from the
   * blockchain.
   * @param nameOrAppId - The NFD name or application ID to resolve
   * @param options - Optional parameters
   * @returns The NFD record
   * @throws If the NFD name is invalid or not found
   */
  async resolve(
    nameOrAppId: string | number | bigint,
    options: ResolveOptions = {},
  ): Promise<Nfd> {
    const nfdAppId = await this.parseAppId(nameOrAppId)
    const instance = this.appClientFor(nfdAppId)

    // Names and values arrive together, so this is one request per page rather
    // than one per box
    const [globalState, boxes] = await Promise.all([
      instance.getGlobalState(),
      getAllBoxes(this.algorand.client.algod, nfdAppId),
    ])

    return buildNfdRecord({
      appId: nfdAppId,
      appAddress: instance.appAddress.toString(),
      globalState,
      boxes,
      view: options.view,
    })
  }

  /**
   * Read the registry's reverse-index box for an address and return the linked
   * NFD application IDs (primary first). Only verified links are indexed
   * on-chain, so `ReverseLookupOptions.allowUnverified` has no effect here.
   */
  private async getAddressAppIds(address: string | Address): Promise<bigint[]> {
    const boxName = await getAddressBoxName(address)
    let boxValue: Uint8Array
    try {
      boxValue = await this.registryClient.getBoxValue(boxName)
    } catch (error) {
      if (isErrorWith404(error)) return []
      throw error
    }
    if (!boxValue || boxValue.length === 0) return []

    const appIds: bigint[] = []
    for (let i = 0; i + 8 <= boxValue.length; i += 8) {
      const chunk = boxValue.slice(i, i + 8)
      if (isZeroBytes(chunk)) continue
      appIds.push(decodeUint64(chunk, 'bigint'))
    }
    return appIds
  }

  /**
   * Reverse lookup: resolve an address to its primary NFD by reading the
   * registry's on-chain reverse index.
   * @param address - The address to resolve
   * @param options - Optional parameters
   * @returns The address's primary NFD, or `null` if none is linked
   */
  async resolveAddress(
    address: string | Address,
    options: ReverseLookupOptions = {},
  ): Promise<Nfd | null> {
    const appIds = await this.getAddressAppIds(address)
    const primaryAppId = appIds[0]
    if (primaryAppId === undefined) return null

    return this.resolve(primaryAppId, { view: toResolveView(options.view) })
  }

  /**
   * Reverse lookup for multiple addresses. Returns a record mapping each
   * address (that has a linked NFD) to its primary NFD.
   * @param addresses - The addresses to resolve
   * @param options - Optional parameters
   * @returns A record of address string → primary NFD
   */
  async resolveAddresses(
    addresses: Array<string | Address>,
    options: ReverseLookupOptions = {},
  ): Promise<Record<string, Nfd>> {
    const entries = await Promise.all(
      addresses.map(async (address) => {
        const addressStr =
          typeof address === 'string' ? address : address.toString()
        const nfd = await this.resolveAddress(address, options)
        return [addressStr, nfd] as const
      }),
    )

    const result: Record<string, Nfd> = {}
    for (const [addressStr, nfd] of entries) {
      if (nfd) result[addressStr] = nfd
    }
    return result
  }
}
