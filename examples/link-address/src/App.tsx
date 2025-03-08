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
  const [isSettingPrimary, setIsSettingPrimary] = useState(false)
  const [linkedAddresses, setLinkedAddresses] = useState<string[]>([])

  const { activeAddress, activeWalletAddresses, transactionSigner } =
    useWallet()

  const handleNfdInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNfdData(null)
    setNfdName(e.target.value)
    setLinkedAddresses([])
    setAddressToLink('')
  }

  const handleAddressSelectChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setAddressToLink(e.target.value)
  }

  const handleLookupNfd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setNfdData(null)
    setLinkedAddresses([])
    setAddressToLink('')
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

      if (!addressToLink) {
        throw new Error('Please select an address to link')
      }

      // Check if the address is already linked
      if (linkedAddresses.includes(addressToLink)) {
        throw new Error('This address is already linked to the NFD')
      }

      // Check if the active address is the owner
      if (nfdData.owner !== activeAddress) {
        throw new Error('Only the owner can link addresses to this NFD')
      }

      // Check if the address to link is in the available addresses
      if (
        !activeWalletAddresses ||
        !activeWalletAddresses.includes(addressToLink)
      ) {
        throw new Error(
          'The address to link must be one of your connected wallet addresses',
        )
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

  const handleSetPrimaryAddress = async (address: string) => {
    setError('')
    setIsSettingPrimary(true)

    try {
      if (!activeAddress) {
        throw new Error('No active address')
      }

      if (!nfdData) {
        throw new Error('No NFD selected')
      }

      // Check if the active address is the owner
      if (nfdData.owner !== activeAddress) {
        throw new Error(
          'Only the owner can set the primary address for this NFD',
        )
      }

      /**
       * Set the address as primary for the NFD
       */
      const updatedNfd = await nfd
        .setSigner(activeAddress, transactionSigner)
        .manage(nfdName)
        .setPrimaryAddress(address)

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
      setIsSettingPrimary(false)
    }
  }

  const availableAddresses = activeWalletAddresses
    ? activeWalletAddresses.filter((addr) => !linkedAddresses.includes(addr))
    : []

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
                    {linkedAddresses.map((address, index) => (
                      <li key={address} style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              marginRight: '8px',
                              wordBreak: 'break-all',
                            }}
                          >
                            {address}
                          </span>
                          {index === 0 && (
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
                          )}
                          {nfdData.owner === activeAddress && (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {index > 0 && (
                                <button
                                  onClick={() =>
                                    handleSetPrimaryAddress(address)
                                  }
                                  disabled={isSettingPrimary}
                                  style={{ marginRight: '4px' }}
                                >
                                  Set Primary
                                </button>
                              )}
                              <button
                                onClick={() => handleUnlinkAddress(address)}
                                disabled={isUnlinking}
                              >
                                Unlink
                              </button>
                            </div>
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
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      flexWrap: 'wrap',
                    }}
                  >
                    {availableAddresses.length > 0 ? (
                      <select
                        value={addressToLink}
                        onChange={handleAddressSelectChange}
                        style={{ width: '350px' }}
                      >
                        <option value="">Select an address to link</option>
                        {availableAddresses.map((address) => (
                          <option key={address} value={address}>
                            {address}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p style={{ margin: 0 }}>
                        No available addresses to link.
                      </p>
                    )}
                    <div>
                      <button
                        onClick={handleLinkAddress}
                        disabled={
                          isLinking ||
                          !addressToLink ||
                          availableAddresses.length === 0
                        }
                      >
                        {isLinking ? 'Linking...' : 'Link Address'}
                      </button>
                    </div>
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
