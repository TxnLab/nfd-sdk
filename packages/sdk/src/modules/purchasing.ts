import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import { isValidAddress } from 'algosdk'

import { parseTransactionError } from '../utils/error-parser'

import { BaseModule } from './base'

import type { Nfd } from '../types'

/**
 * Configuration options for claiming a reserved NFD
 */
export interface NfdClaimParams {
  /**
   * The address of the claimer (must match the reservedFor address)
   */
  claimer: string
}

/**
 * Configuration options for buying an NFD from the secondary market
 */
export interface NfdBuyParams {
  /**
   * The address of the buyer
   */
  buyer: string

  /**
   * Optional maximum amount willing to pay in microAlgos.
   * If not provided, will pay the exact sell amount.
   * If provided and the sell amount is higher, the transaction will fail.
   */
  maxPayment?: bigint | number
}

/**
 * Configuration options for getting a purchase quote
 */
export interface NfdPurchaseQuoteParams {
  /**
   * The address of the potential buyer/claimer
   */
  buyer: string
}

/**
 * Purchase quote information for an NFD
 */
export interface NfdPurchaseQuote {
  /** The NFD name being quoted */
  nfdName: string
  /** The address of the buyer */
  buyer: string
  /** Whether this NFD can be claimed (is reserved for the buyer) */
  canClaim: boolean
  /** Whether this NFD can be bought (is for sale) */
  canBuy: boolean
  /** The price to purchase in microAlgos (calculated amount for claims, sellAmount for purchases) */
  price: bigint
  /** The address the NFD is reserved for (if any) */
  reservedFor?: string
  /** The current sell amount in microAlgos (if for sale) */
  sellAmount?: bigint
  /** The current state of the NFD */
  state: string
  /** Whether the buyer is authorized to make this purchase */
  authorized: boolean
  /** Reason why purchase is not authorized (if applicable) */
  authorizationError?: string
}

/**
 * Module for NFD purchasing and claiming operations
 */
export class PurchasingModule extends BaseModule {
  /**
   * Validate that the provided address is valid
   * @internal
   * @param address - The address to validate
   * @param paramName - Name of the parameter being validated (for error messages)
   * @throws If the address is invalid
   */
  private validateAddress(address: string, paramName: string): void {
    if (!isValidAddress(address)) {
      throw new Error(`Invalid ${paramName}: ${address}`)
    }
  }

  /**
   * Get detailed purchase information for an NFD
   * @param nameOrAppId - The NFD name or application ID
   * @param params - Parameters for the quote
   * @returns Detailed purchase quote including eligibility and pricing
   * @throws If the NFD cannot be resolved or quote cannot be generated
   */
  public async getPurchaseQuote(
    nameOrAppId: string | number | bigint,
    params: NfdPurchaseQuoteParams,
  ): Promise<NfdPurchaseQuote> {
    const { buyer } = params

    // Validate buyer address
    this.validateAddress(buyer, 'buyer')

    // Resolve NFD to get current information
    const nfd = await this.client.resolve(nameOrAppId, { view: 'full' })

    // Check if buyer can claim this NFD (is reserved for them)
    // Check all possible locations for reservation info
    const reservedForAddress =
      nfd.reservedFor ||
      nfd.properties?.internal?.reservedOwner ||
      nfd.properties?.verified?.reservedFor
    const isReservedForBuyer = reservedForAddress === buyer

    // NFD can be claimed if it's in 'reserved' state OR if it's 'forSale' but reserved for the buyer
    const canClaim =
      (nfd.state === 'reserved' || nfd.state === 'forSale') &&
      isReservedForBuyer

    // Check if buyer can buy this NFD (is for sale and not specifically reserved)
    const canBuy = nfd.state === 'forSale' && !reservedForAddress

    let authorized = false
    let authorizationError: string | undefined

    // Determine authorization
    if (nfd.state === 'reserved' || nfd.state === 'forSale') {
      if (reservedForAddress && !isReservedForBuyer) {
        authorized = false
        authorizationError = `NFD is reserved for ${reservedForAddress}, but buyer is ${buyer}`
      } else if (canClaim || canBuy) {
        authorized = true
      } else {
        authorized = false
        authorizationError = `NFD is not available for purchase (state: ${nfd.state})`
      }
    } else {
      authorized = false
      authorizationError = `NFD is not available for purchase (state: ${nfd.state})`
    }

    // Determine price
    let price = BigInt(0)
    if (canClaim && nfd.sellAmount) {
      // For claims, calculate the amount based on sellAmount minus mintingKickoffAmount
      const sellAmount = Number(nfd.sellAmount)
      const mintingKickoffAmount =
        Number(nfd.properties?.internal?.mintingKickoffAmount) || 0
      const claimAmount = Math.max(sellAmount - mintingKickoffAmount, 0)
      price = BigInt(claimAmount)
    } else if (canBuy && nfd.sellAmount) {
      price = BigInt(nfd.sellAmount)
    }

    return {
      nfdName: nfd.name,
      buyer,
      canClaim,
      canBuy,
      price,
      reservedFor: reservedForAddress,
      sellAmount: nfd.sellAmount ? BigInt(nfd.sellAmount) : undefined,
      state: nfd.state || 'unknown',
      authorized,
      authorizationError,
    }
  }

  /**
   * Claim an NFD that is reserved for the caller
   * @param nameOrAppId - The NFD name or application ID to claim
   * @param params - Parameters for claiming
   * @returns The claimed NFD record
   * @throws If the claim operation fails
   */
  public async claim(
    nameOrAppId: string | number | bigint,
    params: NfdClaimParams,
  ): Promise<Nfd> {
    // Ensure a signer is set
    const signer = this.requireSigner()

    const { claimer } = params

    // Validate claimer address
    this.validateAddress(claimer, 'claimer')

    // Ensure the signer matches the claimer
    if (signer.addr.toString() !== claimer) {
      throw new Error(
        `Signer address (${signer.addr.toString()}) does not match claimer address (${claimer})`,
      )
    }

    // Get purchase quote to validate eligibility
    const quote = await this.getPurchaseQuote(nameOrAppId, { buyer: claimer })

    if (!quote.canClaim) {
      throw new Error(
        quote.authorizationError ||
          `Cannot claim NFD: ${quote.nfdName} (state: ${quote.state})`,
      )
    }

    if (!quote.authorized) {
      throw new Error(
        quote.authorizationError ||
          `Not authorized to claim NFD: ${quote.nfdName}`,
      )
    }

    // Resolve NFD to get app ID
    const nfd = await this.client.resolve(nameOrAppId, { view: 'full' })
    if (!nfd.appID) {
      throw new Error(`Cannot determine app ID for NFD: ${nfd.name}`)
    }

    // Get the NFD instance client
    const nfdInstanceClient = this.getInstanceClient(BigInt(nfd.appID), claimer)

    try {
      // Create payment transaction with calculated claim amount
      const paymentTxn = await this.algorand.createTransaction.payment({
        sender: claimer,
        receiver: nfdInstanceClient.appAddress,
        amount: AlgoAmount.MicroAlgos(quote.price),
      })

      // Execute the purchase (claim) transaction using transaction group pattern
      await nfdInstanceClient
        .newGroup()
        .purchase({
          args: { payment: paymentTxn },
          staticFee: AlgoAmount.MicroAlgos(4000), // 0.004 ALGO
        })
        .send({ populateAppCallResources: true })

      // Return the updated NFD record
      return this.client.resolve(nfd.appID, { view: 'full' })
    } catch (error) {
      throw new Error(`Failed to claim NFD: ${parseTransactionError(error)}`)
    }
  }

  /**
   * Buy an NFD from the secondary market
   * @param nameOrAppId - The NFD name or application ID to buy
   * @param params - Parameters for buying
   * @returns The purchased NFD record
   * @throws If the buy operation fails
   */
  public async buy(
    nameOrAppId: string | number | bigint,
    params: NfdBuyParams,
  ): Promise<Nfd> {
    // Ensure a signer is set
    const signer = this.requireSigner()

    const { buyer, maxPayment } = params

    // Validate buyer address
    this.validateAddress(buyer, 'buyer')

    // Ensure the signer matches the buyer
    if (signer.addr.toString() !== buyer) {
      throw new Error(
        `Signer address (${signer.addr.toString()}) does not match buyer address (${buyer})`,
      )
    }

    // Get purchase quote to validate eligibility and get pricing
    const quote = await this.getPurchaseQuote(nameOrAppId, { buyer })

    if (!quote.canBuy) {
      throw new Error(
        quote.authorizationError ||
          `Cannot buy NFD: ${quote.nfdName} (state: ${quote.state})`,
      )
    }

    if (!quote.authorized) {
      throw new Error(
        quote.authorizationError ||
          `Not authorized to buy NFD: ${quote.nfdName}`,
      )
    }

    // Validate max payment if provided
    if (maxPayment !== undefined && quote.price > BigInt(maxPayment)) {
      throw new Error(
        `NFD price (${quote.price} microAlgos) exceeds maximum payment (${maxPayment} microAlgos)`,
      )
    }

    // Resolve NFD to get app ID
    const nfd = await this.client.resolve(nameOrAppId, { view: 'full' })
    if (!nfd.appID) {
      throw new Error(`Cannot determine app ID for NFD: ${nfd.name}`)
    }

    // Get the NFD instance client
    const nfdInstanceClient = this.getInstanceClient(BigInt(nfd.appID), buyer)

    try {
      // Create payment transaction for the purchase amount
      const paymentTxn = await this.algorand.createTransaction.payment({
        sender: buyer,
        receiver: nfdInstanceClient.appAddress,
        amount: AlgoAmount.MicroAlgos(quote.price),
      })

      // Execute the purchase transaction using transaction group pattern
      await nfdInstanceClient
        .newGroup()
        .purchase({
          args: { payment: paymentTxn },
          staticFee: AlgoAmount.MicroAlgos(4000), // 0.004 ALGO
        })
        .send({ populateAppCallResources: true })

      // Return the updated NFD record
      return this.client.resolve(nfd.appID, { view: 'full' })
    } catch (error) {
      throw new Error(`Failed to buy NFD: ${parseTransactionError(error)}`)
    }
  }

  /**
   * Check if an NFD can be claimed by a specific address
   * @param nameOrAppId - The NFD name or application ID
   * @param claimer - The address of the potential claimer
   * @returns True if the NFD can be claimed by the address
   */
  public async canClaim(
    nameOrAppId: string | number | bigint,
    claimer: string,
  ): Promise<boolean> {
    try {
      const quote = await this.getPurchaseQuote(nameOrAppId, { buyer: claimer })
      return quote.canClaim && quote.authorized
    } catch {
      return false
    }
  }

  /**
   * Check if an NFD can be bought by a specific address
   * @param nameOrAppId - The NFD name or application ID
   * @param buyer - The address of the potential buyer
   * @returns True if the NFD can be bought by the address
   */
  public async canBuy(
    nameOrAppId: string | number | bigint,
    buyer: string,
  ): Promise<boolean> {
    try {
      const quote = await this.getPurchaseQuote(nameOrAppId, { buyer })
      return quote.canBuy && quote.authorized
    } catch {
      return false
    }
  }
}
