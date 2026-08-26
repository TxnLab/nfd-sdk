import type { Algodv2 } from 'algosdk'

/**
 * An application box, with its name decoded and its value included
 */
export interface AppBox {
  /** The box name, decoded as UTF-8 */
  name: string
  /** The box value */
  value: Uint8Array
}

/**
 * Get every box for an application, with values included
 *
 * Uses the `include=values` query parameter so that names and values arrive
 * together, which takes one request per page rather than one request per box.
 * Pages after the first are pinned to the round the first page was read at, so
 * a multi-page read is consistent.
 *
 * Requires algosdk >= 3.6.0 and an algod node new enough to honour
 * `include=values`.
 *
 * @param algod - The algod client to read through
 * @param appId - The application ID to read boxes from
 * @returns Every box for the application
 * @throws If the node returns boxes without values, or does not advance the
 * pagination cursor
 */
export async function getAllBoxes(
  algod: Algodv2,
  appId: bigint,
): Promise<AppBox[]> {
  const decoder = new TextDecoder('utf-8')
  const boxes: AppBox[] = []

  // The algod endpoint is caller-supplied, so the cursor is not trusted to
  // advance on its own; a repeated token would otherwise loop forever
  const seenTokens = new Set<string>()

  let nextToken: string | undefined
  let round: number | undefined

  do {
    const request = algod.getApplicationBoxes(appId).include('values')

    if (nextToken) {
      request.next(nextToken)
    }
    if (round !== undefined) {
      request.round(round)
    }

    const response = await request.do()
    round ??= response.round

    for (const box of response.boxes) {
      if (box.value === undefined) {
        throw new Error(
          `Box "${decoder.decode(box.name)}" of app ${appId} was returned without a value. ` +
            'The algod node does not support the `include=values` query parameter; ' +
            'a newer node is required.',
        )
      }

      boxes.push({
        name: decoder.decode(box.name),
        value: box.value,
      })
    }

    nextToken = response.nextToken

    if (nextToken) {
      if (seenTokens.has(nextToken)) {
        throw new Error(
          `Box pagination for app ${appId} did not advance: the algod node repeated a page cursor.`,
        )
      }
      seenTokens.add(nextToken)
    }
  } while (nextToken)

  return boxes
}
