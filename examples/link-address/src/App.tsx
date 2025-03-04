import { NfdClient, parseTransactionError, type Nfd } from '@txnlab/nfd-sdk'
import { useWallet } from '@txnlab/use-wallet-react'
import { useState } from 'react'

import { WalletMenu } from './Connect'

/**
 * Initialize the NFD client for TestNet
 */
const nfd = NfdClient.testNet()

export function App() {
  const [nfdName, setNfdName] = useState('')
  const [addressToLink, setAddressToLink] = useState('')
  const [nfdData, setNfdData] = useState<Nfd | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLinking, setIsLinking] = useState(false)
  const [isUnlinking, setIsUnlinking] = useState(false)
  const [linkedAddresses, setLinkedAddresses] = useState<string[]>([])

  const { activeAddress, transactionSigner } = useWallet()

  const handleNfdInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNfdData(null)
    setNfdName(e.target.value)
    setLinkedAddresses([])
  }

  const handleAddressInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddressToLink(e.target.value)
  }

  const handleLookupNfd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setNfdData(null)
    setLinkedAddresses([])
    setIsLoading(true)

    try {
      if (!nfdName.trim()) {
        throw new Error('Please enter an NFD name')
      }

      /**
       * Resolve the NFD to get its data
       */
      const resolvedNfd = await nfd.resolve(nfdName, { view: 'full' })
      setNfdData(resolvedNfd)

      // Extract linked addresses from the NFD data
      const addresses: string[] = []
      if (resolvedNfd.caAlgo && resolvedNfd.caAlgo.length > 0) {
        resolvedNfd.caAlgo.forEach((addr) => {
          if (addr) {
            addresses.push(addr)
          }
        })
      }
      setLinkedAddresses(addresses)
    } catch (err) {
      // Use the parseTransactionError utility to get a user-friendly error message
      setError(parseTransactionError(err))
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLinkAddress = async () => {
    setError('')
    setIsLinking(true)

    try {
      if (!activeAddress) {
        throw new Error('No active address')
      }

      if (!nfdData) {
        throw new Error('No NFD selected')
      }

      if (!addressToLink.trim()) {
        throw new Error('Please enter an address to link')
      }

      // Check if the address is already linked
      if (linkedAddresses.includes(addressToLink)) {
        throw new Error('This address is already linked to the NFD')
      }

      // Check if the active address is the owner
      if (nfdData.owner !== activeAddress) {
        throw new Error('Only the owner can link addresses to this NFD')
      }

      /**
       * Link the address to the NFD
       */
      const updatedNfd = await nfd
        .setSigner(activeAddress, transactionSigner)
        .manage(nfdName)
        .linkAddress(addressToLink)

      setNfdData(updatedNfd)

      // Update the linked addresses list
      const addresses: string[] = []
      if (updatedNfd.caAlgo && updatedNfd.caAlgo.length > 0) {
        updatedNfd.caAlgo.forEach((addr) => {
          if (addr) {
            addresses.push(addr)
          }
        })
      }
      setLinkedAddresses(addresses)
      setAddressToLink('')
    } catch (err) {
      setError(parseTransactionError(err))
      console.error(err)
    } finally {
      setIsLinking(false)
    }
  }

  const handleUnlinkAddress = async (address: string) => {
    setError('')
    setIsUnlinking(true)

    try {
      if (!activeAddress) {
        throw new Error('No active address')
      }

      if (!nfdData) {
        throw new Error('No NFD selected')
      }

      // Check if the active address is the owner
      if (nfdData.owner !== activeAddress) {
        throw new Error('Only the owner can unlink addresses from this NFD')
      }

      /**
       * Unlink the address from the NFD
       */
      const updatedNfd = await nfd
        .setSigner(activeAddress, transactionSigner)
        .manage(nfdName)
        .unlinkAddress(address)

      setNfdData(updatedNfd)

      // Update the linked addresses list
      const addresses: string[] = []
      if (updatedNfd.caAlgo && updatedNfd.caAlgo.length > 0) {
        updatedNfd.caAlgo.forEach((addr) => {
          if (addr) {
            addresses.push(addr)
          }
        })
      }
      setLinkedAddresses(addresses)
    } catch (err) {
      setError(parseTransactionError(err))
      console.error(err)
    } finally {
      setIsUnlinking(false)
    }
  }

  return (
    <div>
      <h1>NFD Address Linker</h1>

      <div
        style={{
          marginBottom: '30px',
          paddingBottom: '20px',
          borderBottom: '2px solid #eee',
        }}
      >
        <WalletMenu />
      </div>

      {activeAddress && (
        <div>
          <form onSubmit={handleLookupNfd} style={{ marginBottom: '20px' }}>
            <h2>Look up NFD</h2>
            <fieldset style={{ border: 'none', padding: '0' }}>
              <div style={{ marginBottom: '10px' }}>
                <input
                  type="text"
                  value={nfdName}
                  onChange={handleNfdInputChange}
                  placeholder="Enter NFD name (e.g., example.algo)"
                  style={{ width: '250px' }}
                />
              </div>
            </fieldset>

            <button type="submit" disabled={isLoading || !nfdName.trim()}>
              {isLoading ? 'Looking up...' : 'Look up NFD'}
            </button>
          </form>

          {nfdData && (
            <div
              style={{
                marginTop: '20px',
                padding: '15px',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
            >
              <h2>NFD Details</h2>
              <dl
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'max-content 1fr',
                  gap: '8px 12px',
                }}
              >
                <dt style={{ fontWeight: 'bold' }}>Name:</dt>
                <dd style={{ margin: 0 }}>{nfdData.name}</dd>

                <dt style={{ fontWeight: 'bold' }}>App ID:</dt>
                <dd style={{ margin: 0 }}>{nfdData.appID}</dd>

                <dt style={{ fontWeight: 'bold' }}>Owner:</dt>
                <dd style={{ margin: 0 }}>{nfdData.owner}</dd>

                <dt style={{ fontWeight: 'bold' }}>Expires:</dt>
                <dd style={{ margin: 0 }}>
                  {nfdData.timeExpires
                    ? new Date(nfdData.timeExpires).toLocaleDateString()
                    : 'N/A'}
                </dd>
              </dl>

              <div style={{ marginTop: '20px' }}>
                <h3>Linked Addresses</h3>
                {linkedAddresses.length === 0 ? (
                  <p>No addresses linked to this NFD.</p>
                ) : (
                  <ul style={{ paddingLeft: '20px' }}>
                    {linkedAddresses.map((address) => (
                      <li key={address} style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              marginRight: '10px',
                            }}
                          >
                            {address}
                          </span>
                          {nfdData.owner === activeAddress && (
                            <button
                              onClick={() => handleUnlinkAddress(address)}
                              disabled={isUnlinking}
                              style={{
                                padding: '2px 8px',
                                fontSize: '12px',
                              }}
                            >
                              {isUnlinking ? 'Unlinking...' : 'Unlink'}
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {nfdData.owner === activeAddress && (
                <div style={{ marginTop: '20px' }}>
                  <h3>Link New Address</h3>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      value={addressToLink}
                      onChange={handleAddressInputChange}
                      placeholder="Enter Algorand address to link"
                      style={{ width: '350px' }}
                    />
                    <button
                      onClick={handleLinkAddress}
                      disabled={isLinking || !addressToLink.trim()}
                    >
                      {isLinking ? 'Linking...' : 'Link Address'}
                    </button>
                  </div>
                </div>
              )}

              <details style={{ marginTop: '15px' }}>
                <summary>View Full NFD Data</summary>
                <pre>{JSON.stringify(nfdData, null, 2)}</pre>
              </details>
            </div>
          )}
        </div>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  )
}
