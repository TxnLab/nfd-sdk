import type { Nfd } from './types'

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
