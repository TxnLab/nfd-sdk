import { NfdClient, type Nfd, type ReverseLookupOptions } from '@txnlab/nfd-sdk'
import { useState } from 'react'

export function App(): JSX.Element {
  // State for lookup parameters
  const [addresses, setAddresses] = useState<string[]>([''])
  const [allowUnverified, setAllowUnverified] = useState<boolean>(false)
  const [view, setView] = useState<string>('brief')

  // State for lookup results and UI state
  const [results, setResults] = useState<Record<string, Nfd> | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Handle input changes for addresses
  const handleAddressChange = (index: number, value: string) => {
    const newAddresses = [...addresses]
    newAddresses[index] = value
    setAddresses(newAddresses)
  }

  // Add a new address input field
  const addAddressField = () => {
    setAddresses([...addresses, ''])
  }

  // Remove an address input field
  const removeAddressField = (index: number) => {
    if (addresses.length > 1) {
      const newAddresses = [...addresses]
      newAddresses.splice(index, 1)
      setAddresses(newAddresses)
    }
  }

  // Handle select input changes
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setView(e.target.value)
  }

  // Handle checkbox changes
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAllowUnverified(e.target.checked)
  }

  // Handle form submission and perform lookup
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    // Filter out empty addresses
    const validAddresses = addresses.filter((addr) => addr.trim() !== '')

    if (validAddresses.length === 0) {
      setError('Please enter at least one wallet address')
      return
    }

    setLoading(true)
    setError('')
    setResults(null)

    try {
      // Prepare lookup options
      const options: ReverseLookupOptions = {
        view: view as 'tiny' | 'thumbnail' | 'brief' | 'full',
        allowUnverified,
      }

      /**
       * Look up NFDs by wallet address using the NFD SDK
       *
       * ALTERNATIVE APPROACH:
       * For integrators who only need API search and batch lookup functionality,
       * the NfdApiClient can be imported and used directly:
       *
       * import { NfdApiClient } from '@txnlab/nfd-sdk'
       * const lookupResults = await NfdApiClient.testNet().reverseLookup(validAddresses, options)
       */

      // Using the recommended approach with NfdClient
      const lookupResults = await NfdClient.testNet().api.reverseLookup(
        validAddresses, // Pass array of addresses
        options,
      )

      setResults(lookupResults)
    } catch (err) {
      console.error('Error looking up NFDs:', err)
      setError(
        'Error looking up NFDs. Please check the addresses and try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginBottom: '2rem' }}>
      <h1>NFD SDK Reverse Lookup</h1>
      <p>Look up NFDs owned by specific wallet addresses</p>

      <form onSubmit={handleSubmit} style={{ marginBottom: '1rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Wallet Addresses:
          </label>

          {addresses.map((address, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                marginBottom: '0.5rem',
                alignItems: 'center',
              }}
            >
              <input
                type="text"
                value={address}
                onChange={(e) => handleAddressChange(index, e.target.value)}
                placeholder="Enter Algorand wallet address"
                style={{ width: '400px' }}
              />

              {addresses.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeAddressField(index)}
                  style={{ marginLeft: '0.5rem' }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addAddressField}
            style={{ marginTop: '0.5rem' }}
          >
            Add Another Address
          </button>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ marginRight: '1rem' }}>
            <input
              type="checkbox"
              checked={allowUnverified}
              onChange={handleCheckboxChange}
            />
            Allow Unverified
          </label>

          <label>
            View:
            <select
              name="view"
              value={view}
              onChange={handleSelectChange}
              style={{ marginLeft: '0.5rem' }}
            >
              <option value="tiny">Tiny</option>
              <option value="thumbnail">Thumbnail</option>
              <option value="brief">Brief</option>
              <option value="full">Full</option>
            </select>
          </label>
        </div>

        <div>
          <button type="submit" disabled={loading}>
            {loading ? 'Looking up...' : 'Lookup'}
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>
      )}

      {/* Results */}
      {results && (
        <div>
          <h2>Lookup Results</h2>

          {Object.keys(results).length > 0 ? (
            <>
              <p>
                Found {Object.keys(results).length} NFDs for{' '}
                {addresses.filter((a) => a.trim()).length} address(es)
              </p>

              <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
                {Object.entries(results).map(([address, nfd]) => {
                  return (
                    <div
                      key={`${address}-${nfd.name}`}
                      style={{
                        border: '1px solid #ddd',
                        padding: '1rem',
                        borderRadius: '4px',
                      }}
                    >
                      <h3 style={{ fontWeight: 'bold', marginTop: 0 }}>
                        {nfd.name}
                      </h3>
                      <p>
                        Owner: {nfd.owner?.substring(0, 8)}...
                        {nfd.owner?.substring(nfd.owner.length - 8)}
                      </p>
                      <p>
                        Address: {address.substring(0, 8)}...
                        {address.substring(address.length - 8)}
                      </p>
                      <p>Verified: {nfd.caAlgo ? 'Yes' : 'No'}</p>
                      <details>
                        <summary>View full NFD data</summary>
                        <pre>{JSON.stringify(nfd, null, 2)}</pre>
                      </details>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <p>No NFDs found for the provided wallet address(es).</p>
          )}
        </div>
      )}
    </div>
  )
}
