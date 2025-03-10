import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account'
import { Address, TransactionSigner } from 'algosdk'

import { NfdApiClient } from './api-client'
import { NfdRegistryId } from './constants'
import { LookupModule } from './modules/lookup'
import { NfdManager } from './modules/manager'
import {
  MintingModule,
  NfdMintParams,
  NfdMintQuote,
  NfdMintQuoteParams,
} from './modules/minting'

import type {
  Nfd,
  ResolveOptions,
  SearchOptions,
  SearchResponse,
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
  private readonly _minting: MintingModule

  private _signer: TransactionSignerAccount | null = null

  constructor(config: NfdClientConfig = {}) {
    this._algorand = config.algorand ?? AlgorandClient.mainNet()
    this._registryId = BigInt(config.registryId ?? NfdRegistryId.MAINNET)
    this._api = new NfdApiClient(this._registryId)

    // Initialize modules
    this._lookup = new LookupModule(this)
    this._minting = new MintingModule(this)
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
    return this._minting.mint(nfdName, params)
  }

  /**
   * Find the NFD associated with a specific wallet address
   * @param address - The wallet address to look up
   * @param options - Additional options for the lookup
   * @returns The NFD associated with the address, or null if not found
   */
  public async resolveAddress(
    address: string | Address,
    options: {
      view?: 'tiny' | 'thumbnail' | 'brief' | 'full'
      allowUnverified?: boolean
    } = {},
  ): Promise<Nfd | null> {
    const addressStr =
      typeof address === 'string' ? address : address.toString()
    const result = await this.api.reverseLookup([addressStr], options)
    return result[addressStr] || null
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
}
