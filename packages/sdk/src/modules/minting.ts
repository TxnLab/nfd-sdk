import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'

import {
  canMintSegment,
  extractParentName,
  isSegmentName,
  isValidName,
} from '../utils/nfd'

import { BaseModule } from './base'

import type { PriceInfo } from '../contracts/NFDRegistryClient'
import type { Nfd } from '../types'

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
 * Module for NFD minting and renewal operations
 */
export class MintingModule extends BaseModule {
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
    const parentName = extractParentName(segmentName)

    try {
      // Resolve the parent NFD to check its properties
      const parentNfd = await this.client.resolve(parentName)

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
    if (!isValidName(nfdName)) {
      throw new Error(
        `Invalid NFD name: ${nfdName}. Name must be in the format "xxx.algo" or "xxx.yyy.algo"`,
      )
    }

    // If the NFD is a segment, validate minting permissions
    if (isSegmentName(nfdName)) {
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
    const { buyer, years = 1 } = params

    // Validate NFD name format
    if (!isValidName(nfdName)) {
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
    const isSegment = isSegmentName(nfdName)

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
   * Mint a new NFD
   * @param nfdName - The name of the NFD to mint
   * @param params - Configuration options for minting
   * @returns The minted NFD record
   * @throws If the mint operation fails
   */
  public async mint(nfdName: string, params: NfdMintParams): Promise<Nfd> {
    // Ensure a signer is set
    this.requireSigner()

    // Validate NFD name format
    if (!isValidName(nfdName)) {
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
    const isSegment = isSegmentName(nfdName)

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
    const paymentTxn = await this.algorand.createTransaction.payment({
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
    return this.client.resolve(nfdAppId, { view: 'full' })
  }
}
