import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { Address, decodeUint64 } from 'algosdk'
import crypto from 'crypto-js'

import { resolveFromApi, reverseLookupFromApi, searchFromApi } from './api'
import { NfdInstanceClient } from './contracts/NFDInstanceClient'
import { NfdRegistryClient } from './contracts/NFDRegistryClient'

import type {
  Nfd,
  ResolveOptions,
  ReverseLookupOptions,
  SearchOptions,
} from './types'
import type { AppState } from '@algorandfoundation/algokit-utils/types/app'

/** The NFD registry app IDs for each network */
export enum NfdRegistryId {
  MAINNET = 760937186,
  TESTNET = 84366825,
}

/** Configuration options for the NFD client */
export interface NfdClientConfig {
  /**
   * An existing AlgorandClient instance
   */
  algorand?: AlgorandClient
  /**
   * The application ID of the NFD registry
   */
  registryId?: number | bigint
}

/**
 * Client for interacting with NFDs (Non-Fungible Domains) through both the API and smart contracts
 */
export class NfdClient {
  private readonly _algorand: AlgorandClient
  private readonly _registryId: bigint

  constructor(config: NfdClientConfig = {}) {
    this._algorand = config.algorand ?? AlgorandClient.mainNet()
    this._registryId =
      typeof config.registryId === 'number'
        ? BigInt(config.registryId)
        : (config.registryId ?? BigInt(NfdRegistryId.MAINNET))
  }

  /**
   * Create a new NfdClient instance configured for MainNet
   * @returns A new NfdClient instance
   */
  static mainNet(): NfdClient {
    return new NfdClient({
      algorand: AlgorandClient.mainNet(),
      registryId: NfdRegistryId.MAINNET,
    })
  }

  /**
   * Create a new NfdClient instance configured for TestNet
   * @returns A new NfdClient instance
   */
  static testNet(): NfdClient {
    return new NfdClient({
      algorand: AlgorandClient.testNet(),
      registryId: NfdRegistryId.TESTNET,
    })
  }

  /**
   * Get a registry client
   * @internal
   * @param defaultSender - Optional default sender address
   * @returns The NFD registry client
   */
  private getRegistryClient(
    defaultSender?: string | Address,
  ): NfdRegistryClient {
    return this._algorand.client.getTypedAppClientById(NfdRegistryClient, {
      appId: this._registryId,
      defaultSender,
    })
  }

  /**
   * Get an NFD instance client
   * @internal
   * @param nfdAppId - The NFD's application ID
   * @param defaultSender - Optional default sender address
   * @returns The NFD instance client
   */
  private getInstanceClient(
    nfdAppId: bigint,
    defaultSender?: string | Address,
  ): NfdInstanceClient {
    return this._algorand.client.getTypedAppClientById(NfdInstanceClient, {
      appId: nfdAppId,
      defaultSender,
    })
  }

  /**
   * Get the box name for an NFD in the registry
   * @internal
   * @param nfdName - The NFD name to get the box name for
   * @returns The box name as a Uint8Array
   */
  private getRegistryBoxNameForNFD(nfdName: string): Uint8Array {
    const hash = crypto.SHA256(`name/${nfdName}`)
    const wordArray = crypto.enc.Hex.parse(hash.toString())
    const u8 = new Uint8Array(wordArray.words.length * 4)
    wordArray.words.forEach((word: number, i: number) => {
      u8[i * 4 + 0] = (word >> 24) & 0xff
      u8[i * 4 + 1] = (word >> 16) & 0xff
      u8[i * 4 + 2] = (word >> 8) & 0xff
      u8[i * 4 + 3] = word & 0xff
    })
    return u8
  }

  /**
   * Get an NFD's application ID from its name
   * @param name - The NFD name
   * @returns The NFD's application ID
   * @throws If the NFD is not found
   */
  private async getAppIdFromName(name: string): Promise<bigint> {
    const registryClient = this.getRegistryClient()
    const boxName = this.getRegistryBoxNameForNFD(name)
    const appIdBytes = await registryClient.appClient.getBoxValue(boxName)
    if (!appIdBytes) {
      throw new Error(`NFD not found: ${name}`)
    }
    // Take the second 8 bytes for the app ID (bytes 8-15)
    const appIdBytesSliced = appIdBytes.slice(8, 16)
    return decodeUint64(appIdBytesSliced, 'bigint')
  }

  /**
   * Parse a name or app ID input into a bigint app ID
   * @internal
   * @param nameOrAppId - The NFD name or application ID to parse
   * @returns The NFD's application ID as a bigint
   * @throws If the input is an invalid NFD name
   */
  private async parseAppId(nameOrAppId: string | number): Promise<bigint> {
    // If it's already a number, just convert to bigint
    if (typeof nameOrAppId === 'number') {
      return BigInt(nameOrAppId)
    }

    // Try to parse as a number first
    const parsedNumber = parseInt(nameOrAppId)
    if (!isNaN(parsedNumber)) {
      return BigInt(parsedNumber)
    }

    // Validate and lookup NFD name
    if (!this.isValidName(nameOrAppId)) {
      throw new Error(
        `Invalid NFD name: ${nameOrAppId}. Name must be in the format 'name.algo' or 'segment.name.algo'`,
      )
    }

    return this.getAppIdFromName(nameOrAppId)
  }

  /**
   * Determine the state of an NFD based on its properties
   * @internal
   */
  private determineNfdState(params: {
    expired: boolean
    owner: string
    nfdAccount: string
    reservedFor?: string
    sellAmount: number
    isMinting: boolean
  }): 'available' | 'minting' | 'reserved' | 'forSale' | 'owned' | 'expired' {
    // Check expiration first
    if (params.expired) {
      return 'expired'
    }

    // Check if reserved
    if (params.owner === params.nfdAccount && params.reservedFor) {
      return 'reserved'
    }

    // Check if for sale (any non-zero sell amount)
    if (params.sellAmount !== 0) {
      return 'forSale'
    }

    // Check if minting
    if (params.isMinting) {
      return 'minting'
    }

    // Check if owned by someone other than the NFD account
    if (params.owner !== params.nfdAccount) {
      return 'owned'
    }

    // Default to available
    return 'available'
  }

  /**
   * Generate meta tags for an NFD based on its properties
   * @internal
   */
  private generateMetaTags(name: string, segmentCount: number): string[] {
    const tags: string[] = []

    // Only process valid NFD names
    if (this.isValidName(name)) {
      // Add character count tag based on basename length
      const basenameLength = this.getNfdBasename(name).length
      if (basenameLength < 10) {
        tags.push(`${basenameLength}_letters`)
      } else {
        tags.push('10+_letters')
      }

      // Add segment status tags
      if (this.isValidSegment(name)) {
        tags.push('segment')
      } else if (segmentCount === 0) {
        tags.push('pristine')
      }
    }

    return tags
  }

  /**
   * Check if name is a valid NFD root/segment
   * @internal
   */
  private isValidName(name: string): boolean {
    return /^([a-z0-9]{1,27}\.){0,1}(?<basename>[a-z0-9]{1,27})\.algo$/g.test(
      name,
    )
  }

  /**
   * Check if name is a valid NFD segment
   * @internal
   */
  private isValidSegment(name: string): boolean {
    return /^[a-z0-9]{1,27}\.(?<basename>[a-z0-9]{1,27})\.algo$/g.test(name)
  }

  /**
   * Get the basename of an NFD (e.g., for 'xxx.yyy.algo' returns 'yyy')
   * @internal
   */
  private getNfdBasename(name: string): string {
    if (!this.isValidName(name)) return name
    const parts = name.split('.')
    return parts[parts.length - 2]
  }

  /**
   * Parse a string value from global state, returning empty string if not found
   * @internal
   */
  private parseString(key: string, state: AppState): string {
    if (!state[key]) return ''
    return state[key].value?.toString() ?? ''
  }

  /**
   * Parse a uint64 value from global state, returning 0 if not found
   * @internal
   */
  private parseUint64(key: string, state: AppState): number {
    if (!state[key]) return 0
    const value = state[key]
    // Only process if it has valueRaw (string variant of AppState)
    if ('valueRaw' in value) {
      return Number(decodeUint64(value.valueRaw, 'bigint'))
    }
    return 0
  }

  /**
   * Parse an Algorand address from global state, returning empty string if not found
   * @internal
   */
  private parseAddress(key: string, state: AppState): string {
    if (!state[key]) return ''

    try {
      const value = state[key]
      // For raw 32-byte public keys (string variant with valueRaw)
      if ('valueRaw' in value && value.valueRaw.length === 32) {
        return new Address(value.valueRaw).toString()
      }

      // For regular address strings
      return Address.fromString(value.value.toString()).toString()
    } catch (error) {
      console.error(`Failed to parse address for key ${key}:`, error)
      return ''
    }
  }

  /**
   * Resolve an NFD by name or application ID by reading directly from the blockchain
   * @param nameOrAppId - The NFD name or application ID to resolve
   * @param options - Optional parameters
   * @returns The NFD
   * @throws If the NFD name is invalid or not found
   */
  async resolve(
    nameOrAppId: string | number,
    options: Pick<ResolveOptions, 'view'> = {},
  ): Promise<Nfd> {
    // Get the NFD app ID
    const nfdAppId = await this.parseAppId(nameOrAppId)

    // Get the NFD instance client
    const instanceClient = this.getInstanceClient(nfdAppId)

    // Get the global state in a single request
    const globalState = await instanceClient.appClient.getGlobalState()

    // Get all boxes to find user-defined and verified properties
    const boxes = await instanceClient.appClient.getBoxNames()

    // Filter boxes based on view type
    const view = options.view ?? 'brief'
    const filteredBoxes = boxes.filter((box) => {
      const boxName = box.name
      if (view === 'tiny') {
        // Only include caAlgo and url properties
        return (
          boxName === 'v.caAlgo.0.as' ||
          boxName === 'u.caalgo' ||
          boxName === 'u.url'
        )
      }
      if (view === 'brief') {
        // Include caAlgo, url, avatar, and reservedFor properties
        return (
          boxName === 'v.caAlgo.0.as' ||
          boxName === 'u.caalgo' ||
          boxName === 'u.url' ||
          boxName === 'u.avatar' ||
          boxName === 'v.avatar' ||
          boxName === 'v.avatarasaid' ||
          boxName === 'v.reservedFor'
        )
      }
      // Include all boxes for full view
      return true
    })

    const userDefined: Record<string, string> = {}
    const verified: Record<string, string> = {}
    const caAlgo: string[] = []
    const unverifiedCaAlgo: string[] = []

    // Process filtered boxes
    for (const box of filteredBoxes) {
      const boxName = box.name
      if (boxName.startsWith('u.') || boxName.startsWith('v.')) {
        const value = await instanceClient.appClient.getBoxValue(box.nameRaw)
        if (value) {
          if (boxName.startsWith('u.')) {
            const propertyName = boxName.slice(2)
            const propertyValue = new TextDecoder('utf-8').decode(value)
            userDefined[propertyName] = propertyValue

            // Extract unverified Algorand addresses
            if (propertyName === 'caalgo') {
              // Split comma-separated addresses and filter out empty strings
              const addresses = propertyValue
                .split(',')
                .map((addr) => addr.trim())
                .filter(Boolean)
              unverifiedCaAlgo.push(...addresses)
            }
          } else if (boxName === 'v.caAlgo.0.as') {
            // For verified caAlgo, the value contains concatenated 32-byte public keys
            try {
              // Each Algorand address public key is 32 bytes
              const PUBLIC_KEY_LENGTH = 32

              // Split the value into chunks of 32 bytes
              for (let i = 0; i < value.length; i += PUBLIC_KEY_LENGTH) {
                const publicKey = value.slice(i, i + PUBLIC_KEY_LENGTH)
                try {
                  const address = new Address(publicKey).toString()
                  if (address) {
                    caAlgo.push(address)
                  }
                } catch (error) {
                  console.error(
                    'Failed to parse Algorand address from caAlgo box at offset',
                    i,
                    ':',
                    error,
                  )
                }
              }
            } catch (error) {
              console.error(
                'Failed to parse Algorand addresses from box:',
                error,
              )
            }
          } else {
            const propertyName = boxName.slice(2)
            const propertyValue = new TextDecoder('utf-8').decode(value)
            verified[propertyName] = propertyValue
          }
        }
      }
    }

    const expirationTime = this.parseUint64('i.expirationTime', globalState)
    const isExpired =
      expirationTime > 0 && Math.floor(Date.now() / 1000) > expirationTime

    const stateParams = {
      expired: isExpired,
      owner: this.parseAddress('i.owner.a', globalState),
      nfdAccount: instanceClient.appAddress.toString(),
      reservedFor: verified['reservedFor'],
      sellAmount: this.parseUint64('i.sellamt', globalState),
      isMinting: this.parseString('i.minting', globalState) !== '',
    }
    const state = this.determineNfdState(stateParams)

    const name = this.parseString('i.name', globalState)
    const segmentCount = this.parseUint64('i.segmentCount', globalState)
    const metaTags = this.generateMetaTags(name, segmentCount)

    // Map the state values to an NFD object
    const nfd: Nfd = {
      name,
      appID: Number(nfdAppId),
      asaID: this.parseUint64('i.asaid', globalState),
      owner: this.parseAddress('i.owner.a', globalState),
      state,
      ...(isExpired && { expired: true }),
      ...(state === 'owned' && {
        depositAccount:
          caAlgo[0] ??
          unverifiedCaAlgo[0] ??
          this.parseAddress('i.owner.a', globalState),
      }),
      ...(this.parseUint64('i.sellamt', globalState) > 0 && {
        sellAmount: this.parseUint64('i.sellamt', globalState),
      }),
      seller: this.parseAddress('i.seller.a', globalState),
      nfdAccount: instanceClient.appAddress.toString(),
      metaTags,
      timeCreated: new Date(
        this.parseUint64('i.timeCreated', globalState) * 1000,
      ).toISOString(),
      timeChanged: new Date(
        this.parseUint64('i.timeChanged', globalState) * 1000,
      ).toISOString(),
      timePurchased: new Date(
        this.parseUint64('i.timePurchased', globalState) * 1000,
      ).toISOString(),
      ...(this.parseUint64('i.expirationTime', globalState) > 0 && {
        timeExpires: new Date(
          this.parseUint64('i.expirationTime', globalState) * 1000,
        ).toISOString(),
      }),
      properties: {
        internal: {
          ver: this.parseString('i.ver', globalState),
          contractLocked: this.parseString('i.contractLocked', globalState),
          ...(globalState['i.segmentLocked'] && {
            segmentLocked: this.parseString('i.segmentLocked', globalState),
          }),
          ...(this.parseUint64('i.segmentCount', globalState) > 0 && {
            segmentCount: this.parseUint64(
              'i.segmentCount',
              globalState,
            ).toString(),
          }),
          ...(globalState['i.vaultOptInLocked']?.value && {
            vaultOptInLocked: this.parseString(
              'i.vaultOptInLocked',
              globalState,
            ),
          }),
          ...(this.parseUint64('i.segmentPriceUsd', globalState) > 0 && {
            segmentPriceUsd: this.parseUint64(
              'i.segmentPriceUsd',
              globalState,
            ).toString(),
          }),
          highestSoldAmt: this.parseUint64(
            'i.highestSoldAmt',
            globalState,
          ).toString(),
          ...(this.parseAddress('i.segmentAgent', globalState) && {
            segmentAgent: this.parseAddress('i.segmentAgent', globalState),
          }),
          category: this.parseString('i.category', globalState),
          saleType: this.parseString('i.saleType', globalState),
          // Mirror top-level properties
          name: this.parseString('i.name', globalState),
          owner: this.parseAddress('i.owner.a', globalState),
          seller: this.parseAddress('i.seller.a', globalState),
          asaid: this.parseUint64('i.asaid', globalState).toString(),
          timeChanged: this.parseUint64(
            'i.timeChanged',
            globalState,
          ).toString(),
          timeCreated: this.parseUint64(
            'i.timeCreated',
            globalState,
          ).toString(),
          timePurchased: this.parseUint64(
            'i.timePurchased',
            globalState,
          ).toString(),
          ...(this.parseUint64('i.expirationTime', globalState) > 0 && {
            expirationTime: this.parseUint64(
              'i.expirationTime',
              globalState,
            ).toString(),
          }),
        },
        ...(Object.keys(userDefined).length > 0 && { userDefined }),
        ...(Object.keys(verified).length > 0 && { verified }),
      },
      ...(caAlgo.length > 0 && { caAlgo }),
      ...(unverifiedCaAlgo.length > 0 && { unverifiedCaAlgo }),
    }

    return nfd
  }

  /**
   * Resolve an NFD by name or application ID using the API
   * @param nameOrAppId - The NFD name or application ID to resolve
   * @param options - Optional parameters
   * @returns The NFD
   */
  async resolveApi(
    nameOrAppId: string | number,
    options: ResolveOptions = {},
  ): Promise<Nfd> {
    return resolveFromApi(nameOrAppId.toString(), options)
  }

  /**
   * Get NFD records by addresses (reverse lookup)
   * @param addresses - One or more addresses to look up, maximum of 20
   * @param options - Optional parameters for the lookup
   * @returns A record of addresses to their NFD records
   * @throws If an error occurs during the lookup
   */
  async reverseLookup(
    addresses: string[],
    options: ReverseLookupOptions = {},
  ): Promise<Record<string, Nfd>> {
    return reverseLookupFromApi(addresses, options)
  }

  /**
   * Search for NFDs using various filters and criteria
   * @param options - Optional parameters for the search
   * @returns An object containing the NFD records and total count
   * @throws If an error occurs during the search
   */
  async search(
    options: SearchOptions = {},
  ): Promise<{ nfds: Nfd[]; total: number }> {
    return searchFromApi(options)
  }
}
