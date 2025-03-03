import { Nfd, NfdClient, type ResolveOptions } from '@txnlab/nfd-sdk'
import { useState } from 'react'

export function App(): JSX.Element {
  const [input, setInput] = useState('')
  const [view, setView] = useState<ResolveOptions['view']>('brief')
  const [nfdData, setNfdData] = useState<Nfd | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError('')
    setNfdData(null)
    setLoading(true)

    try {
      const client = NfdClient.testNet()
      const data = await client.resolve(input, { view })
      setNfdData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1>NFD Resolver</h1>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter NFD name or app ID"
            style={{ marginRight: '0.5rem' }}
          />
          <select
            value={view}
            onChange={(e) => setView(e.target.value as ResolveOptions['view'])}
            style={{ marginRight: '0.5rem' }}
          >
            <option value="tiny">Tiny</option>
            <option value="brief">Brief</option>
            <option value="full">Full</option>
          </select>
          <button type="submit" disabled={loading || !input}>
            {loading ? 'Loading...' : 'Resolve'}
          </button>
        </div>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {nfdData && (
        <div>
          <h2>NFD Data</h2>
          <pre>{JSON.stringify(nfdData, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
