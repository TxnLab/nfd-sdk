import { NfdClient, type Nfd } from '@txnlab/nfd-sdk'
import { useWallet } from '@txnlab/use-wallet-react'
import { useState } from 'react'

import { WalletMenu } from './Connect'

export function App() {
  const [input, setInput] = useState('')
  const [nfdData, setNfdData] = useState<Nfd | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { activeAddress, transactionSigner } = useWallet()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setNfdData(null)
    setLoading(true)

    try {
      if (!activeAddress) {
        throw new Error('No active address')
      }

      const data = await NfdClient.testNet()
        .setSigner(transactionSigner)
        .mint(input, {
          buyer: activeAddress,
          years: 1,
        })
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
      <h1>NFD Minter</h1>

      <WalletMenu />

      {activeAddress && (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <h2>Mint NFD</h2>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter NFD to mint"
              style={{ marginRight: '0.5rem' }}
            />
            <button
              type="submit"
              disabled={loading || !input}
              style={{ marginTop: '0.5rem' }}
            >
              {loading ? 'Minting...' : 'Mint'}
            </button>
          </div>
        </form>
      )}

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
