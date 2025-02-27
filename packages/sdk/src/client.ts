import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import { Address, decodeUint64, TransactionSigner } from 'algosdk'
import crypto from 'crypto-js'

import { resolveFromApi, reverseLookupFromApi, searchFromApi } from './api'
import { NfdInstanceClient } from './contracts/NFDInstanceClient'
import { NfdRegistryClient } from './contracts/NFDRegistryClient'
import { canMintSegment } from './utils'

import type { Constraints, PriceInfo } from './contracts/NFDRegistryClient'
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

/** The default sender addresses (fee sinks) for each network */
export enum DefaultSender {
  MAINNET = 'Y76M3MSY6DKBRHBL7C3NNDXGS5IIMQVQVUAB6MP4XEMMGVF2QWNPL226CA',
  TESTNET = 'A7NMWS3NT3IUDMLVO26ULGXGIIOUQ3ND2TXSER6EBGRZNOBOUIQXHIBGDE',
}

/**
 * Configuration options for the NFD client
 */
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
 * Configuration options for minting a new NFD
 */
export interface NfdMintParams {
  /**
   * The address of the buyer
   */
  buyer: string

  /**
   * Number of years until expiration (1-20)
   */
  years: number
}

/**
 * Configuration options for getting an NFD price quote
 */
export interface NfdMintQuoteParams {
  /**
   * The address of the potential buyer
   */
  buyer: string

  /**
   * Number of years to get a quote for (default: 1)
   */
  years?: number
}

/**
 * Detailed price quote for minting an NFD
 */
export interface NfdMintQuote {
  /** Base price for the specified years in microAlgos */
  basePrice: bigint
  /** Fixed carry cost in microAlgos */
  carryCost: bigint
  /** Extra fee for minting in microAlgos */
  extraFee: bigint
  /** Total price including all fees in microAlgos */
  totalPrice: bigint
  /** Number of years the quote is for */
  years: number
  /** The NFD name being quoted */
  nfdName: string
  /** The address of the buyer */
  buyer: string
  /** Whether the NFD is a segment */
  isSegment: boolean
}

/**
 * Client for interacting with NFDs (Non-Fungible Domains) through both the API and smart contracts
 */
export class NfdClient {
  private readonly _algorand: AlgorandClient
  private readonly _registryId: bigint
  private readonly _defaultSender: string

  constructor(config: NfdClientConfig = {}) {
    this._algorand = config.algorand ?? AlgorandClient.mainNet()
    this._registryId =
      typeof config.registryId === 'number'
        ? BigInt(config.registryId)
        : (config.registryId ?? BigInt(NfdRegistryId.MAINNET))

    this._defaultSender =
      this._registryId === BigInt(NfdRegistryId.TESTNET)
        ? DefaultSender.TESTNET
        : DefaultSender.MAINNET
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
   * Set the default signer for subsequent transactions
   * @param signer - The transaction signer
   * @returns The NfdClient instance for chaining
   */
  setSigner(signer: TransactionSigner): NfdClient {
    this._algorand.setDefaultSigner(signer)
    return this
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
   * @returns The NFD's application ID or null if not found
   */
  private async getAppIdFromName(name: string): Promise<bigint | null> {
    const registryClient = this.getRegistryClient()
    const boxName = this.getRegistryBoxNameForNFD(name)
    try {
      const appIdBytes = await registryClient.appClient.getBoxValue(boxName)
      if (!appIdBytes) {
        return null
      }
      // Take the second 8 bytes for the app ID (bytes 8-15)
      const appIdBytesSliced = appIdBytes.slice(8, 16)
      return decodeUint64(appIdBytesSliced, 'bigint')
    } catch (error) {
      // Check if error is a 404 response
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      // Re-throw other errors
      throw error
    }
  }

  /**
   * Parse a name or app ID input into a bigint app ID
   * @internal
   * @param nameOrAppId - The NFD name or application ID to parse
   * @returns The NFD's application ID as a bigint
   * @throws If the input is an invalid NFD name or the NFD does not exist
   */
  private async parseAppId(
    nameOrAppId: string | number | bigint,
  ): Promise<bigint> {
    // If it's already a number or bigint, just return it
    if (typeof nameOrAppId !== 'string') {
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

    const appId = await this.getAppIdFromName(nameOrAppId)
    if (appId === null) {
      throw new Error(`NFD not found: ${nameOrAppId}`)
    }

    return appId
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
      if (this.isSegmentName(name)) {
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
  private isSegmentName(name: string): boolean {
    return /^[a-z0-9]{1,27}\.(?<basename>[a-z0-9]{1,27})\.algo$/g.test(name)
  }

  /**
   * Extract the parent NFD name from a segment NFD name
   * @internal
   * @param segmentName - The segment NFD name (e.g., "xxx.yyy.algo")
   * @returns The parent NFD name (e.g., "yyy.algo")
   * @throws If the segment name is invalid
   */
  private extractParentName(segmentName: string): string {
    if (!this.isSegmentName(segmentName)) {
      throw new Error(`Invalid segment name: ${segmentName}`)
    }
    return segmentName.split('.')[1] + '.algo'
  }

  /**
   * Get the basename of an NFD (e.g., for "xxx.yyy.algo" returns "yyy")
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
   * Validate segment minting permissions
   * @internal
   * @param segmentName - The segment NFD name to validate
   * @param caller - The address of the caller/potential buyer
   * @throws If the segment name is invalid, the parent NFD does not exist, or the caller is not authorized to mint a segment
   */
  private async validateSegmentMinting(
    segmentName: string,
    caller: string,
  ): Promise<void> {
    // Extract the parent NFD name from the segment name (throws if invalid)
    const parentName = this.extractParentName(segmentName)

    try {
      // Resolve the parent NFD to check its properties
      const parentNfd = await this.resolve(parentName)

      // Check if the caller is authorized to mint a segment
      if (!canMintSegment(parentNfd, caller)) {
        throw new Error(
          `Cannot mint segment '${segmentName}' due to permission restrictions on the parent NFD '${parentName}'. ` +
            `Only the owner can mint segments when segment minting is locked.`,
        )
      }
    } catch (error) {
      // If the error is that the parent NFD doesn't exist
      if (error instanceof Error && error.message.includes('NFD not found')) {
        throw new Error(
          `Cannot mint segment '${segmentName}' because its parent NFD '${parentName}' does not exist. ` +
            `A segment NFD (xxx.yyy.algo) can only be minted if its parent NFD (yyy.algo) already exists. ` +
            `Please mint the parent NFD first.`,
        )
      }
      // Re-throw other errors
      throw error
    }
  }

  /**
   * Get price information for an NFD from the registry contract
   * @internal
   * @param nfdName - The name of the NFD to get a price for
   * @param caller - The address of the caller/potential buyer
   * @returns The NFD price information
   * @throws If the price information cannot be retrieved
   */
  private async getPriceInfo(
    nfdName: string,
    caller: string,
  ): Promise<PriceInfo> {
    // Validate NFD name format
    if (!this.isValidName(nfdName)) {
      throw new Error(
        `Invalid NFD name: ${nfdName}. Name must be in the format "xxx.algo" or "xxx.yyy.algo"`,
      )
    }

    // If the NFD is a segment, validate minting permissions
    if (this.isSegmentName(nfdName)) {
      await this.validateSegmentMinting(nfdName, caller)
    }

    // Get the registry client for executing the price query
    const registryClient = this.getRegistryClient(caller)

    // Get price quote for the NFD
    const result = await registryClient
      .newGroup()
      .gas({ args: {} })
      .getPrice({ args: { nfdName, caller } })
      .simulate({
        skipSignatures: true,
        allowUnnamedResources: true,
        extraOpcodeBudget: 2100,
      })

    // Check for simulation failure
    const failureMessage = result.simulateResponse.txnGroups[0].failureMessage
    if (failureMessage) {
      throw new Error(`Failed to get price: ${failureMessage}`)
    }

    const priceInfo = result.returns[1]
    if (!priceInfo) {
      throw new Error('Failed to get price: Price info not returned')
    }

    return priceInfo
  }

  /**
   * Get the protocol constraints from the NFD registry
   * @internal
   * @returns The protocol constraints
   * @throws If an error occurs while fetching the constraints
   */
  private async getConstraints(): Promise<Constraints> {
    const registryClient = this.getRegistryClient(this._defaultSender)

    try {
      const result = await registryClient.newGroup().getConstraints().simulate({
        skipSignatures: true,
        allowUnnamedResources: true,
      })

      if (!result.returns) {
        throw new Error('No data returned')
      }

      const constraints = result.returns[0]
      if (!constraints) {
        throw new Error('No constraints returned')
      }

      return constraints
    } catch (error) {
      throw new Error(
        `Failed to get protocol constraints: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Get a price quote for minting an NFD
   * @param nfdName - The name of the NFD to get a quote for
   * @param params - Parameters for the quote
   * @returns A detailed price quote including base price, fees, and total
   * @throws If the quote cannot be generated
   */
  async getMintQuote(
    nfdName: string,
    params: NfdMintQuoteParams,
  ): Promise<NfdMintQuote> {
    const { buyer, years = 1 } = params

    // Validate NFD name format
    if (!this.isValidName(nfdName)) {
      throw new Error(
        `Invalid NFD name: ${nfdName}. Name must be in the format "xxx.algo" or "xxx.yyy.algo"`,
      )
    }

    // Check if NFD already exists
    const existingAppId = await this.getAppIdFromName(nfdName)
    if (existingAppId !== null) {
      throw new Error(
        `NFD already exists: ${nfdName} (appID: ${existingAppId})`,
      )
    }

    // Get constraints to determine max years allowed
    let maxYearsAllowed = 20 // Default fallback
    try {
      const constraints = await this.getConstraints()
      maxYearsAllowed = Number(constraints.maxYearsAllowed)
    } catch (error) {
      console.warn('Failed to get constraints, using default max years:', error)
    }

    // Validate years parameter
    if (years <= 0 || !Number.isInteger(years)) {
      throw new Error('Years must be a positive integer')
    }

    if (years > maxYearsAllowed) {
      throw new Error(
        `Years cannot exceed the maximum allowed (${maxYearsAllowed})`,
      )
    }

    // Determine if the NFD is a segment
    const isSegment = this.isSegmentName(nfdName)

    // If the NFD is a segment, validate minting permissions
    if (isSegment) {
      await this.validateSegmentMinting(nfdName, buyer)
    }

    // Get the price info from the registry
    const priceInfo = await this.getPriceInfo(nfdName, buyer)

    // Calculate extra fee based on NFD type
    const extraFee = isSegment ? BigInt(12000) : BigInt(10000)

    // Calculate base price for the specified number of years
    const basePrice = priceInfo.oneYearPrice * BigInt(years)

    // Calculate total price including all components
    const totalPrice = basePrice + priceInfo.carryCost + extraFee

    return {
      basePrice,
      carryCost: priceInfo.carryCost,
      extraFee,
      totalPrice,
      years,
      nfdName,
      buyer,
      isSegment,
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
    nameOrAppId: string | number | bigint,
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
    // First, group boxes by their base field name to handle split fields
    const boxGroups: Record<string, string[]> = {}

    // Group box names by their base field name
    for (const box of filteredBoxes) {
      const boxName = box.name
      if (boxName.startsWith('u.') || boxName.startsWith('v.')) {
        // Check if this is a split field (has _XX suffix)
        const splitMatch = boxName.match(/^([uv]\.[^_]+)_(\d{2})$/)

        if (splitMatch) {
          // This is a split field, group it by base name
          const baseName = splitMatch[1]
          const index = parseInt(splitMatch[2])

          if (!boxGroups[baseName]) {
            boxGroups[baseName] = []
          }
          // Store the box name at the correct index
          boxGroups[baseName][index] = boxName
        } else {
          // Regular field (not split), add it as a single-item array
          boxGroups[boxName] = [boxName]
        }
      }
    }

    // Process each group of boxes
    for (const [baseFieldName, boxNames] of Object.entries(boxGroups)) {
      // Sort the box names to ensure correct order (important for split fields)
      boxNames.sort()

      let value = new Uint8Array(0)

      // Fetch and combine values from all boxes in this group
      for (const boxName of boxNames) {
        if (!boxName) continue // Skip undefined entries

        const box = filteredBoxes.find((b) => b.name === boxName)
        if (!box) continue

        const boxValue = await instanceClient.appClient.getBoxValue(box.nameRaw)
        if (!boxValue) continue

        // Concatenate the value
        const newCombined = new Uint8Array(value.length + boxValue.length)
        newCombined.set(value)
        newCombined.set(boxValue, value.length)
        value = newCombined
      }

      if (value.length === 0) continue

      // Process the combined value based on field type
      if (baseFieldName === 'v.caAlgo.0.as') {
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
          console.error('Failed to parse Algorand addresses from box:', error)
        }
      } else if (baseFieldName.startsWith('u.')) {
        // User-defined field
        const propertyName = baseFieldName.slice(2) // Remove 'u.'
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
      } else if (baseFieldName.startsWith('v.')) {
        // Verified field
        const propertyName = baseFieldName.slice(2) // Remove 'v.'
        const propertyValue = new TextDecoder('utf-8').decode(value)
        verified[propertyName] = propertyValue
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
      ...(globalState['i.parentAppID'] && {
        parentAppID: this.parseUint64('i.parentAppID', globalState),
      }),
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
          ...(globalState['i.parentAppID'] && {
            parentAppID: this.parseUint64(
              'i.parentAppID',
              globalState,
            ).toString(),
          }),
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
   * Mint a new NFD
   * @param nfdName - The name of the NFD to mint
   * @param params - Configuration options for minting
   * @returns The minted NFD record
   * @throws If the mint operation fails
   */
  async mint(nfdName: string, params: NfdMintParams): Promise<Nfd> {
    // Validate NFD name format
    if (!this.isValidName(nfdName)) {
      throw new Error(
        `Invalid NFD name: ${nfdName}. Name must be in the format 'name.algo' or 'segment.name.algo'`,
      )
    }

    // Check if NFD already exists
    const existingAppId = await this.getAppIdFromName(nfdName)
    if (existingAppId !== null) {
      throw new Error(
        `NFD already exists: ${nfdName} (appID: ${existingAppId})`,
      )
    }

    const { buyer: buyerAddr, years: numYears } = params

    // Validate years parameter
    if (numYears <= 0) {
      throw new Error('Years must be greater than 0')
    }

    if (!Number.isInteger(numYears)) {
      throw new Error('Years must be an integer')
    }

    // Get constraints to determine max years allowed
    let maxYearsAllowed = 20 // Default fallback
    try {
      const constraints = await this.getConstraints()
      maxYearsAllowed = Number(constraints.maxYearsAllowed)
    } catch (error) {
      console.warn('Failed to get constraints, using default max years:', error)
    }

    if (numYears > maxYearsAllowed) {
      throw new Error(
        `Years cannot exceed the maximum allowed (${maxYearsAllowed})`,
      )
    }

    // Determine if the NFD is a segment
    const isSegment = this.isSegmentName(nfdName)

    // If the NFD is a segment, validate minting permissions
    if (isSegment) {
      await this.validateSegmentMinting(nfdName, buyerAddr)
    }

    // Get price info from the registry
    const priceInfo = await this.getPriceInfo(nfdName, buyerAddr)

    // Calculate extra fee based on NFD type
    const extraFee = isSegment ? 12000 : 10000

    // Get the registry client for executing the mint transaction
    const registryClient = this.getRegistryClient(buyerAddr)

    // Create payment transaction for the NFD price
    const paymentTxn = await this._algorand.createTransaction.payment({
      sender: buyerAddr,
      receiver: registryClient.appAddress,
      // Calculate total cost: (years * yearly price) + carry cost
      amount: AlgoAmount.MicroAlgos(
        BigInt(numYears) * priceInfo.oneYearPrice + priceInfo.carryCost,
      ),
    })

    // Execute the mint transaction
    const mintResult = await registryClient
      .newGroup()
      .gas({ args: {}, note: '1' })
      .gas({ args: {}, note: '2' })
      .gas({ args: {}, note: '3' })
      .gas({ args: {}, note: '4' })
      .mintNfd({
        args: {
          purchaseTxn: paymentTxn,
          nfdName,
          reservedFor: buyerAddr,
          linkOnMint: false,
        },
        extraFee: AlgoAmount.MicroAlgos(extraFee),
      })
      .send({ populateAppCallResources: true })

    const nfdAppId = mintResult.returns[4]

    if (!nfdAppId) {
      throw new Error(
        'NFD was minted successfully but the app ID was not returned',
      )
    }

    // Return the minted NFD record
    return this.resolve(nfdAppId, { view: 'full' })
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
