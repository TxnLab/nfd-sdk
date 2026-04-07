import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account'
import { Address, TransactionSigner } from 'algosdk'

import { NfdApiClient } from './api-client'
import { NfdRegistryId } from './constants'
import { LookupModule } from './modules/lookup'
import { NfdManager } from './modules/manager'
import { MetadataModule } from './modules/metadata'
import {
  MintingModule,
  NfdMintParams,
  NfdMintQuote,
  NfdMintQuoteParams,
} from './modules/minting'
import { NfdPurchaseQuote, PurchasingModule } from './modules/purchasing'

import type {
  Nfd,
  NfdImageResult,
  ResolveOptions,
  ReverseLookupOptions,
  SearchOptions,
  SearchResponse,
  SuggestOptions,
  VerifyConfirmResult,
  VerifyField,
  VerifyRequestResult,
} from './types'

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
 * Client for interacting with NFDs (Non-Fungible Domains) through the smart contracts and the API
 */
export class NfdClient {
  private readonly _algorand: AlgorandClient
  private readonly _registryId: bigint
  private readonly _api: NfdApiClient

  // Core modules
  private readonly _lookup: LookupModule
  private readonly _metadata: MetadataModule
  private readonly _minting: MintingModule
  private readonly _purchasing: PurchasingModule

  private _signer: TransactionSignerAccount | null = null

  constructor(config: NfdClientConfig = {}) {
    this._algorand = config.algorand ?? AlgorandClient.mainNet()
    this._registryId = BigInt(config.registryId ?? NfdRegistryId.MAINNET)
    this._api = new NfdApiClient(this._registryId)

    // Initialize modules
    this._lookup = new LookupModule(this)
    this._metadata = new MetadataModule(this)
    this._minting = new MintingModule(this)
    this._purchasing = new PurchasingModule(this)
  }

  /**
   * Create a new NfdClient instance configured for MainNet
   * @returns A new NfdClient instance
   */
  public static mainNet(): NfdClient {
    return new NfdClient({
      algorand: AlgorandClient.mainNet(),
      registryId: NfdRegistryId.MAINNET,
    })
  }

  /**
   * Create a new NfdClient instance configured for TestNet
   * @returns A new NfdClient instance
   */
  public static testNet(): NfdClient {
    return new NfdClient({
      algorand: AlgorandClient.testNet(),
      registryId: NfdRegistryId.TESTNET,
    })
  }

  /**
   * Get the AlgorandClient instance
   * @returns The AlgorandClient instance
   */
  public get algorand(): AlgorandClient {
    return this._algorand
  }

  /**
   * Get the registry ID
   * @returns The registry ID
   */
  public get registryId(): bigint {
    return this._registryId
  }

  /**
   * Get the API client for interacting with the NFD API
   */
  public get api(): NfdApiClient {
    return this._api
  }

  /**
   * Get the current signer
   * @returns The current signer or null if not set
   */
  public get signer(): TransactionSignerAccount | null {
    return this._signer
  }

  /**
   * Tracks the given signer against the given sender for later signing.
   * @param sender - The sender address to use this signer for
   * @param signer - The signer to sign transactions with for the given sender
   * @returns The `NfdClient` instance so method calls can be chained
   */
  public setSigner(
    sender: string | Address,
    signer: TransactionSigner,
  ): NfdClient {
    this._algorand.setSigner(sender, signer)
    const addr =
      typeof sender === 'string' ? Address.fromString(sender) : sender
    this._signer = { addr, signer }
    return this
  }

  /**
   * Create a manager for a specific NFD
   * @param nameOrAppId - The NFD name or application ID to manage
   * @returns An NFD manager instance
   */
  public manage(nameOrAppId: string | number | bigint): NfdManager {
    return new NfdManager(this, nameOrAppId)
  }

  /**
   * Get access to purchasing and claiming functionality
   * @returns A purchasing module instance
   */
  public purchasing(): PurchasingModule {
    return new PurchasingModule(this)
  }

  /**
   * Resolve an NFD by name or application ID by reading directly from the blockchain
   * @param nameOrAppId - The NFD name or application ID to resolve
   * @param options - Optional parameters
   * @returns The NFD record
   * @throws If the NFD name is invalid or not found
   */
  public async resolve(
    nameOrAppId: string | number | bigint,
    options: ResolveOptions = {},
  ): Promise<Nfd> {
    return this._lookup.resolve(nameOrAppId, options)
  }

  /**
   * Get a price quote for minting an NFD
   * @param nfdName - The name of the NFD to get a quote for
   * @param params - Parameters for the quote
   * @returns A detailed price quote including base price, fees, and total
   * @throws If the quote cannot be generated
   */
  public async getMintQuote(
    nfdName: string,
    params: NfdMintQuoteParams,
  ): Promise<NfdMintQuote> {
    return this._minting.getMintQuote(nfdName, params)
  }

  /**
   * Mint a new NFD
   * @param nfdName - The name of the NFD to mint
   * @param params - Configuration options for minting
   * @returns The minted NFD record
   * @throws If the mint operation fails
   */
  public async mint(nfdName: string, params: NfdMintParams): Promise<Nfd> {
    try {
      return await this._minting.mint(nfdName, params)
    } finally {
      // Reset signer after operation
      this._signer = null
    }
  }

  /**
   * Get a quote for purchasing an NFD
   * @param nameOrAppId - The NFD name or application ID to get a quote for
   * @returns A detailed purchase quote including price and eligibility
   * @throws If the quote cannot be generated or signer is not set
   */
  public async getPurchaseQuote(
    nameOrAppId: string | number | bigint,
  ): Promise<NfdPurchaseQuote> {
    if (!this._signer) {
      throw new Error('Signer must be set before getting purchase quote')
    }

    return this._purchasing.getPurchaseQuote(
      nameOrAppId,
      this._signer.addr.toString(),
    )
  }

  /**
   * Claim an NFD that is reserved for the claimer
   * @param nameOrAppId - The NFD name or application ID to claim
   * @returns The claimed NFD record
   * @throws If the claim operation fails or signer is not set
   */
  public async claim(nameOrAppId: string | number | bigint): Promise<Nfd> {
    if (!this._signer) {
      throw new Error('Signer must be set before claiming NFD')
    }

    try {
      return await this._purchasing.claim(nameOrAppId)
    } finally {
      // Reset signer after operation
      this._signer = null
    }
  }

  /**
   * Buy an NFD from the secondary market
   * @param nameOrAppId - The NFD name or application ID to buy
   * @returns The purchased NFD record
   * @throws If the buy operation fails or signer is not set
   */
  public async buy(nameOrAppId: string | number | bigint): Promise<Nfd> {
    if (!this._signer) {
      throw new Error('Signer must be set before buying NFD')
    }

    try {
      return await this._purchasing.buy(nameOrAppId)
    } finally {
      // Reset signer after operation
      this._signer = null
    }
  }

  /**
   * Resolve an address to find its associated NFD
   * @param address - The address to resolve
   * @param options - Options for the lookup
   * @returns The NFD associated with the address, or null if not found
   */
  public async resolveAddress(
    address: string | Address,
    options: ReverseLookupOptions = {},
  ): Promise<Nfd | null> {
    const addressStr =
      typeof address === 'string' ? address : address.toString()

    const result = await this.api.reverseLookup([addressStr], options)
    const nfd = result[addressStr]

    if (!nfd) {
      return null
    }

    return nfd
  }

  /**
   * Resolve multiple addresses to find their associated NFDs
   * @param addresses - Array of addresses to resolve
   * @param options - Options for the lookup
   * @returns Record mapping addresses to their associated NFD (one per address)
   */
  public async resolveAddresses(
    addresses: Array<string | Address>,
    options: ReverseLookupOptions = {},
  ): Promise<Record<string, Nfd>> {
    const addressStrings = addresses.map((addr) =>
      typeof addr === 'string' ? addr : addr.toString(),
    )

    return this.api.reverseLookup(addressStrings, options)
  }

  /**
   * Search for all NFDs owned by a specific wallet address
   * @param address - The wallet address to search for
   * @param options - Additional search options to apply
   * @returns Search response containing owned NFDs
   * @remarks
   * By default, this method returns up to 20 results. You can override this by
   * specifying a different limit in the options parameter.
   */
  public async searchByOwner(
    address: string | Address,
    options: Omit<SearchOptions, 'owner' | 'state'> = {},
  ): Promise<SearchResponse> {
    const addressStr =
      typeof address === 'string' ? address : address.toString()
    return this.api.search({
      limit: 20,
      ...options,
      owner: addressStr,
      state: ['owned'],
    })
  }

  /**
   * Search for all NFDs that are currently for sale
   * @param options - Additional search options to apply
   * @returns Search response containing NFDs for sale
   * @remarks
   * By default, this method returns up to 20 results. You can override this by
   * specifying a different limit in the options parameter.
   */
  public async searchForSale(
    options: Omit<SearchOptions, 'state'> = {},
  ): Promise<SearchResponse> {
    return this.api.search({
      limit: 20,
      ...options,
      state: ['forSale'],
    })
  }

  /**
   * Get the avatar image information for an NFD
   * @param nameOrAppId - The NFD name or application ID
   * @returns The avatar image result with raw value, HTTPS URL, verification status, and ASA ID
   * @remarks The URL will always be provided - either the actual avatar or a default fallback image
   */
  public async getAvatarImage(
    nameOrAppId: string | number | bigint,
  ): Promise<NfdImageResult>

  /**
   * Get the avatar image information for an NFD
   * @param nfd - The NFD data object (for optimized parsing without additional resolve)
   * @returns The avatar image result with raw value, HTTPS URL, verification status, and ASA ID
   * @remarks The URL will always be provided - either the actual avatar or a default fallback image
   */
  public async getAvatarImage(nfd: Nfd): Promise<NfdImageResult>

  /**
   * Get the avatar image information for an NFD
   * @param input - Either NFD name/application ID or NFD data object
   * @returns The avatar image result with raw value, HTTPS URL, verification status, and ASA ID
   */
  public async getAvatarImage(
    input: string | number | bigint | Nfd,
  ): Promise<NfdImageResult> {
    if (this._metadata.isNfdObject(input)) {
      return this._metadata.getAvatarImage(input)
    } else {
      return this._metadata.getAvatarImage(input)
    }
  }

  /**
   * Get the banner image information for an NFD
   * @param nameOrAppId - The NFD name or application ID
   * @returns The banner image result with raw value, HTTPS URL, verification status, and ASA ID
   */
  public async getBannerImage(
    nameOrAppId: string | number | bigint,
  ): Promise<NfdImageResult>

  /**
   * Get the banner image information for an NFD
   * @param nfd - The NFD data object (for optimized parsing without additional resolve)
   * @returns The banner image result with raw value, HTTPS URL, verification status, and ASA ID
   */
  public async getBannerImage(nfd: Nfd): Promise<NfdImageResult>

  /**
   * Get the banner image information for an NFD
   * @param input - Either NFD name/application ID or NFD data object
   * @returns The banner image result with raw value, HTTPS URL, verification status, and ASA ID
   */
  public async getBannerImage(
    input: string | number | bigint | Nfd,
  ): Promise<NfdImageResult> {
    if (this._metadata.isNfdObject(input)) {
      return this._metadata.getBannerImage(input)
    } else {
      return this._metadata.getBannerImage(input)
    }
  }
  /**
   * Get name suggestions for NFD registration
   * @param name - The name (even partial) to search for
   * @param options - Suggestion options including the buyer address
   * @returns Array of suggested NFD records
   */
  public async suggest(name: string, options: SuggestOptions): Promise<Nfd[]> {
    return this.api.suggest(name, options)
  }

  /**
   * Make an offer to purchase an NFD from its owner
   * @param nameOrAppId - The NFD name or application ID to make an offer on
   * @param amount - The offer amount in microAlgos
   * @param note - Optional note to the owner
   * @returns The NFD record
   * @throws If the offer fails or signer is not set
   */
  public async makeOffer(
    nameOrAppId: string | number | bigint,
    amount: bigint | number,
    note: string = '',
  ): Promise<Nfd> {
    if (!this._signer) {
      throw new Error('Signer must be set before making an offer')
    }

    try {
      return await this._purchasing.makeOffer(nameOrAppId, amount, note)
    } finally {
      this._signer = null
    }
  }

  /**
   * Start a verification request for an NFD property
   * @param name - The NFD name to verify a property for
   * @param field - The field to verify
   * @returns Verification request result with challenge and ID
   * @throws If the verification request fails or signer is not set
   */
  public async verifyRequest(
    name: string,
    field: VerifyField,
  ): Promise<VerifyRequestResult> {
    if (!this._signer) {
      throw new Error('Signer must be set before requesting verification')
    }

    try {
      return await this.api.verifyRequest(
        name,
        this._signer.addr.toString(),
        field,
      )
    } finally {
      this._signer = null
    }
  }

  /**
   * Confirm a verification request
   * @param id - The verification request ID
   * @param challenge - The challenge value (optional depending on verification type)
   * @returns Verification confirmation result
   */
  public async verifyConfirm(
    id: string,
    challenge?: string,
  ): Promise<VerifyConfirmResult> {
    return this.api.verifyConfirm(id, challenge)
  }
}
