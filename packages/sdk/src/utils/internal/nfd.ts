import { isValidName, isSegmentName, getNfdBasename } from '../nfd'

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
