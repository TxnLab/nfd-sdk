import { Address } from 'algosdk'

import { isZeroBytes } from './bytes'
import { determineNfdState, generateMetaTags } from './nfd'
import { parseAddress, parseString, parseUint64 } from './state'

import type { Nfd } from '../../types'
import type {
  AppState,
  BoxName,
} from '@algorandfoundation/algokit-utils/types/app'

/** The view types supported when reading an NFD's box properties */
export type NfdView = 'tiny' | 'brief' | 'full'

/**
 * Parameters for building an NFD record from on-chain state.
 */
export interface BuildNfdRecordParams {
  /** The NFD instance application ID */
  appId: bigint
  /** The NFD instance application address */
  appAddress: string
  /** The instance's global state */
  globalState: AppState
  /** The instance's box names */
  boxes: BoxName[]
  /** Reads a box value by its raw name */
  getBoxValue: (nameRaw: Uint8Array) => Promise<Uint8Array>
  /** The view type controlling which boxes are read */
  view?: NfdView
}

/**
 * Build a full {@link Nfd} record from an NFD instance's on-chain global state
 * and boxes. This is the shared parsing logic used by both the full
 * `NfdClient` and the slim `NfdResolver` lookup entry, so the two produce
 * identical records.
 */
export async function buildNfdRecord({
  appId,
  appAddress,
  globalState,
  boxes,
  getBoxValue,
  view = 'brief',
}: BuildNfdRecordParams): Promise<Nfd> {
  // Filter boxes based on view type
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

  // Group box names by their base field name to handle split fields
  const boxGroups: Record<string, string[]> = {}

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

      const boxValue = await getBoxValue(box.nameRaw)
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

          // Skip zero addresses (all bytes are zero)
          if (isZeroBytes(publicKey)) {
            continue
          }

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

        // Set the verified.caAlgo property as a comma-delimited string
        if (caAlgo.length > 0) {
          verified.caAlgo = caAlgo.join(',')
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

  const expirationTime = parseUint64('i.expirationTime', globalState)
  const isExpired =
    expirationTime > 0 && Math.floor(Date.now() / 1000) > expirationTime

  const stateParams = {
    expired: isExpired,
    owner: parseAddress('i.owner.a', globalState),
    nfdAccount: appAddress,
    reservedFor: parseAddress('i.reservedOwner.a', globalState) || undefined,
    sellAmount: parseUint64('i.sellamt', globalState),
    isMinting: parseString('i.minting', globalState) !== '',
  }
  const state = determineNfdState(stateParams)

  const name = parseString('i.name', globalState)
  const segmentCount = parseUint64('i.segmentCount', globalState)
  const metaTags = generateMetaTags(name, segmentCount)

  // Map the state values to an NFD object
  const nfd: Nfd = {
    name,
    appID: Number(appId),
    asaID: parseUint64('i.asaid', globalState),
    ...(globalState['i.parentAppID'] && {
      parentAppID: parseUint64('i.parentAppID', globalState),
    }),
    owner: parseAddress('i.owner.a', globalState),
    state,
    ...(isExpired && { expired: true }),
    ...(state === 'owned' && {
      depositAccount:
        caAlgo[0] ??
        unverifiedCaAlgo[0] ??
        parseAddress('i.owner.a', globalState),
    }),
    ...(parseUint64('i.sellamt', globalState) > 0 && {
      sellAmount: parseUint64('i.sellamt', globalState),
    }),
    seller: parseAddress('i.seller.a', globalState),
    nfdAccount: appAddress,
    ...(parseAddress('i.reservedOwner.a', globalState) && {
      reservedFor: parseAddress('i.reservedOwner.a', globalState),
    }),
    metaTags,
    timeCreated: new Date(
      parseUint64('i.timeCreated', globalState) * 1000,
    ).toISOString(),
    timeChanged: new Date(
      parseUint64('i.timeChanged', globalState) * 1000,
    ).toISOString(),
    timePurchased: new Date(
      parseUint64('i.timePurchased', globalState) * 1000,
    ).toISOString(),
    ...(parseUint64('i.expirationTime', globalState) > 0 && {
      timeExpires: new Date(
        parseUint64('i.expirationTime', globalState) * 1000,
      ).toISOString(),
    }),
    properties: {
      internal: {
        ver: parseString('i.ver', globalState),
        contractLocked: parseString('i.contractLocked', globalState),
        ...(globalState['i.segmentLocked'] && {
          segmentLocked: parseString('i.segmentLocked', globalState),
        }),
        ...(parseUint64('i.segmentCount', globalState) > 0 && {
          segmentCount: parseUint64('i.segmentCount', globalState).toString(),
        }),
        ...(globalState['i.vaultOptInLocked']?.value && {
          vaultOptInLocked: parseString('i.vaultOptInLocked', globalState),
        }),
        ...(parseUint64('i.segmentPriceUsd', globalState) > 0 && {
          segmentPriceUsd: parseUint64(
            'i.segmentPriceUsd',
            globalState,
          ).toString(),
        }),
        highestSoldAmt: parseUint64('i.highestSoldAmt', globalState).toString(),
        ...(parseAddress('i.segmentAgent', globalState) && {
          segmentAgent: parseAddress('i.segmentAgent', globalState),
        }),
        category: parseString('i.category', globalState),
        saleType: parseString('i.saleType', globalState),
        // Mirror top-level properties
        name: parseString('i.name', globalState),
        owner: parseAddress('i.owner.a', globalState),
        seller: parseAddress('i.seller.a', globalState),
        ...(parseAddress('i.reservedOwner.a', globalState) && {
          reservedOwner: parseAddress('i.reservedOwner.a', globalState),
        }),
        asaid: parseUint64('i.asaid', globalState).toString(),
        ...(globalState['i.parentAppID'] && {
          parentAppID: parseUint64('i.parentAppID', globalState).toString(),
        }),
        timeChanged: parseUint64('i.timeChanged', globalState).toString(),
        timeCreated: parseUint64('i.timeCreated', globalState).toString(),
        timePurchased: parseUint64('i.timePurchased', globalState).toString(),
        ...(parseUint64('i.expirationTime', globalState) > 0 && {
          expirationTime: parseUint64(
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
