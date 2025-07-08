import { NfdClient, type Nfd, type SearchResponse } from '@txnlab/nfd-sdk'
import { useWallet } from '@txnlab/use-wallet-react'
import { useState, useEffect, useCallback } from 'react'

import { WalletMenu } from './Connect'

/**
 * Initialize the NFD client for TestNet
 */
const nfd = NfdClient.testNet()

export function App() {
  const [reservedNfds, setReservedNfds] = useState<Nfd[]>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [claimingNfd, setClaimingNfd] = useState<string | null>(null)
  const [claimedNfds, setClaimedNfds] = useState<Set<string>>(new Set())

  const { activeAddress, transactionSigner } = useWallet()

  /**
   * Search for NFDs reserved for the active address
   */
  const searchReservedNfds = useCallback(async () => {
    if (!activeAddress) return

    setIsLoading(true)
    setError('')

    try {
      // Search for NFDs reserved for the active address
      const searchResults: SearchResponse = await nfd.api.search({
        reservedFor: activeAddress,
        view: 'full',
        limit: 100, // Get up to 100 reserved NFDs
      })

      console.log('searchResults', searchResults)
      setReservedNfds(searchResults.nfds)
    } catch (err) {
      console.error('Error searching for reserved NFDs:', err)
      setError('Failed to load reserved NFDs. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [activeAddress])

  /**
   * Claim a reserved NFD
   */
  const claimNfd = async (nfdName: string) => {
    if (!activeAddress || !transactionSigner) {
      setError('Please connect your wallet first')
      return
    }

    setClaimingNfd(nfdName)
    setError('')

    try {
      // Use the simplified API to claim the NFD directly
      const claimedNfd = await nfd
        .setSigner(activeAddress, transactionSigner)
        .claim(nfdName)

      console.log('Successfully claimed NFD:', claimedNfd)

      // Add to claimed NFDs set
      setClaimedNfds((prev) => new Set(prev).add(nfdName))

      // Refresh the list of reserved NFDs
      await searchReservedNfds()
    } catch (err) {
      console.error('Error claiming NFD:', err)
      setError(
        `Failed to claim ${nfdName}. ${err instanceof Error ? err.message : 'Please try again.'}`,
      )
    } finally {
      setClaimingNfd(null)
    }
  }

  // Load reserved NFDs when wallet connects
  useEffect(() => {
    if (activeAddress) {
      searchReservedNfds()
    } else {
      setReservedNfds([])
      setError('')
      setClaimedNfds(new Set())
    }
  }, [activeAddress, searchReservedNfds])

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>NFD Claim Tool</h1>
      <p>Claim NFDs that are reserved for your wallet address</p>

      <div
        style={{
          marginBottom: '30px',
          paddingBottom: '20px',
          borderBottom: '2px solid #eee',
        }}
      >
        <WalletMenu />
      </div>

      {error && (
        <div
          style={{
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            padding: '12px',
            marginBottom: '20px',
            color: '#900',
          }}
        >
          {error}
        </div>
      )}

      {activeAddress && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h2>Connected Address</h2>
            <code
              style={{
                background: '#f5f5f5',
                padding: '8px',
                borderRadius: '4px',
                wordBreak: 'break-all',
              }}
            >
              {activeAddress}
            </code>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <button
              onClick={searchReservedNfds}
              disabled={isLoading}
              style={{
                padding: '10px 20px',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? 'Searching...' : 'Refresh Reserved NFDs'}
            </button>
          </div>

          <div>
            <h2>Reserved NFDs ({reservedNfds.length})</h2>

            {isLoading && (
              <p style={{ fontStyle: 'italic', color: '#666' }}>
                Searching for NFDs reserved for your address...
              </p>
            )}

            {!isLoading && reservedNfds.length === 0 && (
              <p style={{ fontStyle: 'italic', color: '#666' }}>
                No NFDs are currently reserved for your address.
              </p>
            )}

            {reservedNfds.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                {reservedNfds.map((nfdData) => (
                  <div
                    key={nfdData.name}
                    style={{
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '12px',
                      background: claimedNfds.has(nfdData.name)
                        ? '#f0f8f0'
                        : '#fff',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}
                    >
                      <div>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>
                          {nfdData.name}
                        </h3>
                        <p
                          style={{
                            margin: '0',
                            color: '#666',
                            fontSize: '14px',
                          }}
                        >
                          State: <strong>{nfdData.state}</strong>
                        </p>
                        {nfdData.reservedFor && (
                          <p
                            style={{
                              margin: '4px 0 0 0',
                              color: '#666',
                              fontSize: '12px',
                            }}
                          >
                            Reserved for: <code>{nfdData.reservedFor}</code>
                          </p>
                        )}
                        {claimedNfds.has(nfdData.name) && (
                          <p
                            style={{
                              margin: '4px 0 0 0',
                              color: '#28a745',
                              fontSize: '14px',
                              fontWeight: 'bold',
                            }}
                          >
                            ✓ Successfully claimed!
                          </p>
                        )}
                      </div>

                      <div>
                        {!claimedNfds.has(nfdData.name) && (
                          <button
                            onClick={() => claimNfd(nfdData.name)}
                            disabled={claimingNfd === nfdData.name}
                            style={{
                              padding: '8px 16px',
                              background:
                                claimingNfd === nfdData.name
                                  ? '#6c757d'
                                  : '#28a745',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor:
                                claimingNfd === nfdData.name
                                  ? 'not-allowed'
                                  : 'pointer',
                              fontSize: '14px',
                            }}
                          >
                            {claimingNfd === nfdData.name
                              ? 'Claiming...'
                              : 'Claim NFD'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!activeAddress && (
        <div style={{ textAlign: 'center', color: '#666', marginTop: '40px' }}>
          <p>
            Please connect your wallet to search for and claim reserved NFDs.
          </p>
        </div>
      )}
    </div>
  )
}
