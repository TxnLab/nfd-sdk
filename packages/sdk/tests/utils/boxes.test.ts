import { describe, it, expect, vi } from 'vitest'

import { getAllBoxes } from '../../src/utils/internal/boxes'

import type { Algodv2 } from 'algosdk'

const APP_ID = 1207664422n
const encoder = new TextEncoder()

/** A box as algod returns it from `getApplicationBoxes` */
interface RawBox {
  name: Uint8Array
  value?: Uint8Array
}

/** One page of a `getApplicationBoxes` response */
interface BoxPage {
  boxes: RawBox[]
  nextToken?: string
  round?: number
}

/** Record of the query params applied to one `getApplicationBoxes` request */
interface BoxRequestCall {
  include: string[]
  next?: string
  round?: number
}

function box(name: string, value: string | Uint8Array): RawBox {
  return {
    name: encoder.encode(name),
    value: typeof value === 'string' ? encoder.encode(value) : value,
  }
}

/**
 * Build a mock algod serving the given pages in order, recording the query
 * params applied to each request
 */
function createMockAlgod(pages: BoxPage[]) {
  const calls: BoxRequestCall[] = []
  let pageIndex = 0

  const getApplicationBoxes = vi.fn(() => {
    const call: BoxRequestCall = { include: [] }
    calls.push(call)

    const page = pages[pageIndex++] ?? { boxes: [] }

    const request = {
      include: vi.fn((...values: string[]) => {
        call.include.push(...values)
        return request
      }),
      next: vi.fn((token: string) => {
        call.next = token
        return request
      }),
      round: vi.fn((round: number) => {
        call.round = Number(round)
        return request
      }),
      do: vi.fn(async () => page),
    }

    return request
  })

  return { algod: { getApplicationBoxes } as unknown as Algodv2, calls }
}

describe('getAllBoxes', () => {
  it('reads names and values in a single request', async () => {
    const { algod, calls } = createMockAlgod([
      {
        boxes: [box('u.url', 'https://example.com'), box('u.bio', 'hello')],
        round: 64449651,
      },
    ])

    const boxes = await getAllBoxes(algod, APP_ID)

    expect(boxes).toEqual([
      { name: 'u.url', value: encoder.encode('https://example.com') },
      { name: 'u.bio', value: encoder.encode('hello') },
    ])
    // One request, not one per box
    expect(algod.getApplicationBoxes).toHaveBeenCalledTimes(1)
    expect(algod.getApplicationBoxes).toHaveBeenCalledWith(APP_ID)
    expect(calls[0].include).toEqual(['values'])
  })

  it('returns an empty list for an app with no boxes', async () => {
    const { algod } = createMockAlgod([{ boxes: [] }])

    await expect(getAllBoxes(algod, APP_ID)).resolves.toEqual([])
  })

  it('throws when the node returns a box without a value', async () => {
    const { algod } = createMockAlgod([
      { boxes: [{ name: encoder.encode('u.url') }] },
    ])

    await expect(getAllBoxes(algod, APP_ID)).rejects.toThrow(/without a value/)
  })

  describe('pagination', () => {
    it('follows the next token and merges every page', async () => {
      const { algod } = createMockAlgod([
        {
          boxes: [box('u.url', 'https://example.com')],
          nextToken: 'b64:dS51cmw=',
          round: 64449651,
        },
        { boxes: [box('u.bio', 'hello')] },
      ])

      const boxes = await getAllBoxes(algod, APP_ID)

      expect(boxes.map((b) => b.name)).toEqual(['u.url', 'u.bio'])
      expect(algod.getApplicationBoxes).toHaveBeenCalledTimes(2)
    })

    it('pins pages after the first to the round of the first page', async () => {
      const { algod, calls } = createMockAlgod([
        {
          boxes: [box('u.url', 'https://example.com')],
          nextToken: 'b64:dS51cmw=',
          round: 64449651,
        },
        { boxes: [box('u.bio', 'hello')], round: 64449999 },
      ])

      await getAllBoxes(algod, APP_ID)

      // The first request is unpinned, later ones carry the first round
      expect(calls[0].round).toBeUndefined()
      expect(calls[0].next).toBeUndefined()
      expect(calls[1].round).toBe(64449651)
      expect(calls[1].next).toBe('b64:dS51cmw=')
      expect(calls[1].include).toEqual(['values'])
    })

    it('throws instead of looping when the cursor does not advance', async () => {
      // A node that keeps handing back the same token would otherwise spin
      // forever, accumulating boxes until the process runs out of memory
      const stuck = { boxes: [box('u.url', 'x')], nextToken: 'same-token' }
      const { algod } = createMockAlgod([stuck, stuck, stuck, stuck])

      await expect(getAllBoxes(algod, APP_ID)).rejects.toThrow(
        /did not advance/,
      )

      // Bailed on the repeat rather than exhausting every page
      expect(algod.getApplicationBoxes).toHaveBeenCalledTimes(2)
    })
  })
})
