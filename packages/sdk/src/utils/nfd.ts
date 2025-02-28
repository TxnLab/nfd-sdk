import type { Nfd } from '../types'

/**
 * Check if segment minting is unlocked for an NFD
 * @param nfd - The NFD object to check
 * @returns True if segment minting is unlocked, false otherwise
 *
 * Note: By default, segment minting is locked when a root NFD is created.
 * The segmentLocked property is only set to '0' when explicitly unlocked.
 * If the property doesn't exist or is set to any value other than '0',
 * segment minting should be considered locked.
 */
export function isSegmentMintingUnlocked(nfd: Nfd | null): boolean {
  if (!nfd) return false
  return nfd.properties?.internal?.segmentLocked === '0'
}

/**
 * Check if the caller is authorized to mint a segment for the given parent NFD
 * @param nfd - The parent NFD object
 * @param callerAddress - The address of the caller attempting to mint a segment
 * @returns True if the caller is authorized to mint a segment, false otherwise
 */
export function canMintSegment(
  nfd: Nfd | null,
  callerAddress: string,
): boolean {
  if (!nfd) return false

  // If segment minting is unlocked, anyone can mint segments
  if (isSegmentMintingUnlocked(nfd)) return true

  // If segment minting is locked, only the owner can mint segments
  return nfd.owner === callerAddress
}

/**
 * Check if name is a valid NFD root/segment
 * @param name - The NFD name to validate
 * @returns True if the name is valid, false otherwise
 */
export function isValidName(name: string): boolean {
  return /^([a-z0-9]{1,27}\.){0,1}(?<basename>[a-z0-9]{1,27})\.algo$/g.test(
    name,
  )
}

/**
 * Check if name is a valid NFD segment
 * @param name - The NFD name to validate
 * @returns True if the name is a segment, false otherwise
 */
export function isSegmentName(name: string): boolean {
  return /^[a-z0-9]{1,27}\.(?<basename>[a-z0-9]{1,27})\.algo$/g.test(name)
}

/**
 * Extract the parent NFD name from a segment NFD name
 * @param segmentName - The segment NFD name (e.g., "xxx.yyy.algo")
 * @returns The parent NFD name (e.g., "yyy.algo")
 * @throws If the segment name is invalid
 */
export function extractParentName(segmentName: string): string {
  if (!isSegmentName(segmentName)) {
    throw new Error(`Invalid segment name: ${segmentName}`)
  }
  return segmentName.split('.')[1] + '.algo'
}

/**
 * Get the basename of an NFD (e.g., for "xxx.yyy.algo" returns "yyy")
 * @param name - The NFD name
 * @returns The basename of the NFD
 */
export function getNfdBasename(name: string): string {
  if (!isValidName(name)) return name
  const parts = name.split('.')
  return parts[parts.length - 2]
}

/**
 * Determine the state of an NFD based on its properties
 * @param params - Parameters to determine the state
 * @returns The NFD state
 */
export function determineNfdState(params: {
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
 * @param name - The NFD name
 * @param segmentCount - The number of segments
 * @returns An array of meta tags
 */
export function generateMetaTags(name: string, segmentCount: number): string[] {
  const tags: string[] = []

  // Only process valid NFD names
  if (isValidName(name)) {
    // Add character count tag based on basename length
    const basenameLength = getNfdBasename(name).length
    if (basenameLength < 10) {
      tags.push(`${basenameLength}_letters`)
    } else {
      tags.push('10+_letters')
    }

    // Add segment status tags
    if (isSegmentName(name)) {
      tags.push('segment')
    } else if (segmentCount === 0) {
      tags.push('pristine')
    }
  }

  return tags
}
