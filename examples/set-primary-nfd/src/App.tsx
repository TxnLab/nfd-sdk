import { NfdClient, parseTransactionError, type Nfd } from '@txnlab/nfd-sdk'
import { useWallet } from '@txnlab/use-wallet-react'
import { useState, useEffect, useCallback } from 'react'

import { WalletMenu } from './Connect'

/**
 * Initialize the NFD client for TestNet
 */
const nfd = NfdClient.testNet()

export function App() {
  const [linkedNfds, setLinkedNfds] = useState<Nfd[]>([])
  const [primaryNfd, setPrimaryNfd] = useState<Nfd | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSettingPrimary, setIsSettingPrimary] = useState(false)

  const { activeAddress, transactionSigner } = useWallet()

  // Use our custom hook for API sync state
  const { isSyncing, startSyncCheck } = useApiSync()

  // Fetch NFDs linked to the connected address
  const fetchLinkedNfds = useCallback(async () => {
    if (!activeAddress) return

    setIsLoading(true)
    setError('')

    try {
      // Use searchByOwner to get all NFDs owned by this address
      const response = await nfd.searchByOwner(activeAddress, {
        nocache: true,
      })

      // Filter NFDs to only include those that have the active address in caAlgo
      const linkedNfds = response.nfds.filter((nfdItem: Nfd) => {
        return (
          nfdItem &&
          nfdItem.caAlgo &&
          Array.isArray(nfdItem.caAlgo) &&
          nfdItem.caAlgo.includes(activeAddress)
        )
      })

      setLinkedNfds(linkedNfds)
    } catch (err) {
      setError(`Failed to fetch linked NFDs: ${parseTransactionError(err)}`)
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [activeAddress])

  // Fetch the primary NFD for the connected address
  const fetchPrimaryNfd = useCallback(async () => {
    if (!activeAddress) return

    setIsLoading(true)
    setError('')

    try {
      const resolvedNfd = await nfd.resolveAddress(activeAddress, {
        nocache: true,
      })
      setPrimaryNfd(resolvedNfd)
    } catch (err) {
      setError(`Failed to resolve address: ${parseTransactionError(err)}`)
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [activeAddress])

  // Fetch linked NFDs and primary NFD when wallet connects
  useEffect(() => {
    if (activeAddress) {
      fetchLinkedNfds()
      fetchPrimaryNfd()
    } else {
      setLinkedNfds([])
      setPrimaryNfd(null)
    }
  }, [activeAddress, fetchLinkedNfds, fetchPrimaryNfd])

  // Set an NFD as the primary NFD for the connected address
  const handleSetPrimaryNfd = async (nfdToSet: Nfd) => {
    if (!activeAddress || !transactionSigner) {
      setError('Please connect your wallet first')
      return
    }

    setIsSettingPrimary(true)
    setError('')

    try {
      // Chain setSigner before manage and call setPrimaryNfd
      await nfd
        .setSigner(activeAddress, transactionSigner)
        .manage(nfdToSet.name)
        .setPrimaryNfd(activeAddress)

      // Optimistically update the UI with the NFD we just set as primary
      setPrimaryNfd(nfdToSet)

      // Start the API sync check process
      startSyncCheck({
        checkFn: async () => {
          const resolvedNfd = await nfd.resolveAddress(activeAddress, {
            nocache: true,
          })
          return resolvedNfd?.name === nfdToSet.name
        },
        onSuccess: fetchPrimaryNfd,
      })
    } catch (err) {
      const errorMsg = parseTransactionError(err)
      setError(`Failed to set primary NFD: ${errorMsg}`)
      console.error(err)
    } finally {
      setIsSettingPrimary(false)
    }
  }

  return (
    <div style={{ maxWidth: '800px', marginBottom: '2rem' }}>
      <h1>Set Primary NFD</h1>

      <div style={{ marginBottom: '20px' }}>
        <WalletMenu />
      </div>

      {error && (
        <div style={{ color: 'red', margin: '10px 0' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {activeAddress ? (
        <>
          <div style={{ marginBottom: '20px' }}>
            <h2>Your Primary NFD</h2>
            {isLoading ? (
              <p>Loading primary NFD...</p>
            ) : primaryNfd ? (
              <div
                style={{
                  padding: '15px',
                  border: '1px solid #ccc',
                  borderRadius: '5px',
                }}
              >
                <h3 style={{ margin: '0 0 5px 0' }}>{primaryNfd.name}</h3>
                <p style={{ margin: '0', color: '#666' }}>
                  This is your primary NFD for {activeAddress}
                </p>
                {isSyncing && (
                  <p style={{ color: 'orange', margin: '0' }}>
                    (Waiting for API to sync...)
                  </p>
                )}
              </div>
            ) : (
              <p>No primary NFD found for this address</p>
            )}
          </div>

          <div>
            <h2>Your Linked NFDs</h2>
            <p>
              These are NFDs that you own and have linked to your current
              address.
            </p>
            {isLoading ? (
              <p>Loading your NFDs...</p>
            ) : linkedNfds.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {linkedNfds.map((nfd) => (
                  <div
                    key={nfd.name}
                    style={{
                      padding: '15px',
                      border: '1px solid #ccc',
                      borderRadius: '5px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <h3 style={{ margin: '0 0 5px 0' }}>{nfd.name}</h3>
                      <p style={{ margin: '0', color: '#666' }}>
                        {primaryNfd && primaryNfd.name === nfd.name && (
                          <>
                            <span
                              style={{
                                border: '1px solid #4361ee',
                                backgroundColor: '#f1f5ff',
                                borderRadius: '12px',
                                padding: '2px 6px',
                                fontSize: '0.85em',
                                marginRight: '8px',
                                color: '#4361ee',
                              }}
                            >
                              Primary
                            </span>
                            {isSyncing && (
                              <span
                                style={{ color: 'orange', marginLeft: '5px' }}
                              >
                                (Syncing...)
                              </span>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => handleSetPrimaryNfd(nfd)}
                      disabled={Boolean(
                        isSettingPrimary ||
                        isSyncing ||
                        (primaryNfd && primaryNfd.name === nfd.name),
                      )}
                    >
                      Set as Primary
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p>You don't have any NFDs linked to this address</p>
            )}
          </div>
        </>
      ) : (
        <div style={{ marginTop: '50px' }}>
          <p>Connect your wallet to view and manage your NFDs</p>
        </div>
      )}
    </div>
  )
}

/**
 * Custom hook to handle API sync state after transactions
 * This helps manage the delay between a successful transaction and
 * when the API reflects the updated state
 */
function useApiSync() {
  const [isSyncing, setIsSyncing] = useState(false)

  const startSyncCheck = useCallback(
    ({
      checkFn,
      onSuccess,
      maxAttempts = 5,
      delayMs = 3000,
    }: {
      checkFn: () => Promise<boolean>
      onSuccess?: () => void
      maxAttempts?: number
      delayMs?: number
    }) => {
      setIsSyncing(true)

      const checkApiSync = async () => {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          // Wait before checking
          await new Promise((resolve) => setTimeout(resolve, delayMs))

          try {
            // Check if the API now returns the expected state
            const isInSync = await checkFn()

            if (isInSync) {
              // If the API is in sync, we're done
              if (onSuccess) {
                onSuccess()
              }
              setIsSyncing(false)
              return
            }

            console.log(
              `API sync check ${attempt + 1}/${maxAttempts}: Not synced yet`,
            )
          } catch (err) {
            console.error('Error checking API sync:', err)
          }
        }

        // If we've reached the maximum number of attempts, stop checking
        setIsSyncing(false)
        console.log(
          'Reached maximum API sync check attempts. The UI shows the correct state, but the API may not be synced yet.',
        )
      }

      // Start the background check without awaiting it
      checkApiSync()
    },
    [],
  )

  return { isSyncing, startSyncCheck }
}
