import { DEFAULT_AVATAR_DATA_URI } from '../assets'
import { checkIpfsAvailability } from '../utils/ipfs'

import { BaseModule } from './base'

import type { NfdClient } from '../client'
import type { Nfd, NfdImageResult } from '../types'

/**
 * Module for NFD metadata operations, including avatar and banner image resolution
 */
export class MetadataModule extends BaseModule {
  constructor(client: NfdClient) {
    super(client)
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
    if (this.isNfdObject(input)) {
      // Fast path: parse from existing NFD data
      return this.parseImageFromNfd(input, 'avatar')
    } else {
      // Slow path: resolve NFD first, then parse
      const nfd = await this.client.resolve(input, { view: 'full' })
      return this.parseImageFromNfd(nfd, 'avatar')
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
    if (this.isNfdObject(input)) {
      // Fast path: parse from existing NFD data
      return this.parseImageFromNfd(input, 'banner')
    } else {
      // Slow path: resolve NFD first, then parse
      const nfd = await this.client.resolve(input, { view: 'full' })
      return this.parseImageFromNfd(nfd, 'banner')
    }
  }

  /**
   * Type guard to check if input is an NFD object
   * @param input - The input to check
   * @returns True if input is an Nfd object
   */
  public isNfdObject(input: string | number | bigint | Nfd): input is Nfd {
    return typeof input === 'object' && input !== null && 'properties' in input
  }

  /**
   * Parse image information from an NFD for a specific image type
   * @private
   * @param nfd - The NFD data object
   * @param imageType - The type of image ('avatar' or 'banner')
   * @returns The image result with raw value, HTTPS URL, verification status, and ASA ID
   */
  private async parseImageFromNfd(
    nfd: Nfd,
    imageType: 'avatar' | 'banner',
  ): Promise<NfdImageResult> {
    const properties = nfd.properties

    if (!properties) {
      // No properties - provide fallback for avatar only
      if (imageType === 'avatar') {
        return {
          raw: null,
          url: DEFAULT_AVATAR_DATA_URI,
          verified: false,
          asaId: null,
          isFallback: true,
        }
      }

      return {
        raw: null,
        url: null,
        verified: false,
        asaId: null,
      }
    }

    // Check verified properties first (these are NFT-based images)
    if (properties.verified) {
      const verifiedImage = properties.verified[imageType]
      if (verifiedImage) {
        const asaIdKey = `${imageType}asaid` as keyof typeof properties.verified
        const asaId = properties.verified[asaIdKey]

        return {
          raw: verifiedImage,
          url: await checkIpfsAvailability(verifiedImage),
          verified: true,
          asaId: asaId ? parseInt(asaId, 10) : null,
        }
      }
    }

    // Check user-defined properties (these are regular images)
    if (properties.userDefined) {
      const userDefinedImage = properties.userDefined[imageType]
      if (userDefinedImage) {
        return {
          raw: userDefinedImage,
          url: await checkIpfsAvailability(userDefinedImage),
          verified: false,
          asaId: null,
        }
      }
    }

    // No image found - provide fallback for avatar only
    if (imageType === 'avatar') {
      return {
        raw: null,
        url: DEFAULT_AVATAR_DATA_URI,
        verified: false,
        asaId: null,
        isFallback: true,
      }
    }

    // No banner found - return null URL
    return {
      raw: null,
      url: null,
      verified: false,
      asaId: null,
    }
  }
}
