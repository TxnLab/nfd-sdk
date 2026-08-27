import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import { Address } from 'algosdk'

import { APP_CALL_STATIC_FEE } from '../constants'
import { Nfd } from '../types'
import { parseTransactionError } from '../utils/error-parser'
import { toAmount } from '../utils/internal/numbers'

import { BaseModule } from './base'

/**
 * Response structure for purchase quote requests
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
 * Module for handling NFD purchasing operations (claiming and buying)
 */
export class PurchasingModule extends BaseModule {
  /**
   * Validate an Algorand address
   * @private
   */
  private validateAddress(address: string, paramName: string): void {
    try {
      Address.fromString(address)
    } catch {
      throw new Error(`Invalid ${paramName}: ${address}`)
    }
  }

  /**
   * Get a purchase quote for an NFD
   * @param nameOrAppId - The NFD name or application ID
   * @param buyer - The buyer address
   * @returns Detailed purchase quote including eligibility and pricing
   * @throws If the NFD cannot be resolved or quote cannot be generated
   */
  public async getPurchaseQuote(
    nameOrAppId: string | number | bigint,
    buyer: string,
  ): Promise<NfdPurchaseQuote> {
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
   * @returns The claimed NFD record
   * @throws If the claim operation fails
   */
  public async claim(nameOrAppId: string | number | bigint): Promise<Nfd> {
    // Ensure a signer is set
    const signer = this.requireSigner()

    const claimer = signer.addr.toString()

    // Validate claimer address
    this.validateAddress(claimer, 'claimer')

    // Get purchase quote to validate eligibility
    const quote = await this.getPurchaseQuote(nameOrAppId, claimer)

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
          staticFee: AlgoAmount.MicroAlgos(9000), // 0.009 ALGO
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
   * @returns The purchased NFD record
   * @throws If the buy operation fails
   */
  public async buy(nameOrAppId: string | number | bigint): Promise<Nfd> {
    // Ensure a signer is set
    const signer = this.requireSigner()

    const buyer = signer.addr.toString()

    // Validate buyer address
    this.validateAddress(buyer, 'buyer')

    // Get purchase quote to validate eligibility and get pricing
    const quote = await this.getPurchaseQuote(nameOrAppId, buyer)

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
          staticFee: AlgoAmount.MicroAlgos(9000), // 0.009 ALGO
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
   * @param claimer - The address to check claim eligibility for
   * @returns True if the NFD can be claimed, false otherwise
   */
  public async canClaim(
    nameOrAppId: string | number | bigint,
    claimer: string,
  ): Promise<boolean> {
    try {
      const quote = await this.getPurchaseQuote(nameOrAppId, claimer)
      return quote.canClaim && quote.authorized
    } catch {
      return false
    }
  }

  /**
   * Check if an NFD can be bought by a specific address
   * @param nameOrAppId - The NFD name or application ID
   * @param buyer - The address to check buy eligibility for
   * @returns True if the NFD can be bought, false otherwise
   */
  public async canBuy(
    nameOrAppId: string | number | bigint,
    buyer: string,
  ): Promise<boolean> {
    try {
      const quote = await this.getPurchaseQuote(nameOrAppId, buyer)
      return quote.canBuy && quote.authorized
    } catch {
      return false
    }
  }

  /**
   * Make an offer to purchase an NFD from its owner
   * @param nameOrAppId - The NFD name or application ID to make an offer on
   * @param amount - The offer amount in microAlgos
   * @param note - Optional note to the owner
   * @returns The NFD record
   * @throws If the offer fails
   */
  public async makeOffer(
    nameOrAppId: string | number | bigint,
    amount: bigint | number,
    note: string = '',
  ): Promise<Nfd> {
    const signer = this.requireSigner()
    const offer = toAmount(amount, 'Offer amount')

    // Only the app ID is needed to post the offer, so this takes a single
    // registry box read rather than a full resolve
    const nfdAppId = await this.parseAppId(nameOrAppId)
    const nfdInstanceClient = this.getInstanceClient(nfdAppId, signer.addr)

    try {
      await nfdInstanceClient
        .newGroup()
        .postOffer({
          args: {
            offer,
            note,
          },
          staticFee: AlgoAmount.MicroAlgos(APP_CALL_STATIC_FEE),
        })
        .send({ populateAppCallResources: true })
    } catch (error) {
      throw new Error(`Failed to make offer: ${parseTransactionError(error)}`)
    }

    return this.client.resolve(nfdAppId, { view: 'full' })
  }
}
