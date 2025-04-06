import { describe, it, expect, vi, beforeEach } from 'vitest'

import { client } from '../src'

describe('@txnlab/nfd-fetch', () => {
  it('should have a client instance', () => {
    expect(client).toBeDefined()
  })
})
