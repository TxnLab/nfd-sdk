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
  const [metadataFields, setMetadataFields] = useState<
    { key: string; value: string }[]
  >([{ key: '', value: '' }])
  const [nfdData, setNfdData] = useState<Nfd | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSettingMetadata, setIsSettingMetadata] = useState(false)
  const [userMetadata, setUserMetadata] = useState<Record<string, string>>({})

  const { activeAddress, transactionSigner } = useWallet()

  const handleNfdInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNfdData(null)
    setNfdName(e.target.value)
    setUserMetadata({})
  }

  const handleMetadataKeyChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const newFields = [...metadataFields]
    newFields[index].key = e.target.value
    setMetadataFields(newFields)
  }

  const handleMetadataValueChange = (
    index: number,
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const newFields = [...metadataFields]
    newFields[index].value = e.target.value
    setMetadataFields(newFields)
  }

  const addMetadataField = () => {
    setMetadataFields([...metadataFields, { key: '', value: '' }])
  }

  const removeMetadataField = (index: number) => {
    if (metadataFields.length > 1) {
      const newFields = [...metadataFields]
      newFields.splice(index, 1)
      setMetadataFields(newFields)
    }
  }

  const handleLookupNfd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setNfdData(null)
    setUserMetadata({})
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

      // Extract user-defined metadata from the NFD data
      const metadata: Record<string, string> = {}
      if (resolvedNfd.properties?.userDefined) {
        Object.entries(resolvedNfd.properties.userDefined).forEach(
          ([key, value]) => {
            metadata[key] = value as string
          },
        )
      }
      setUserMetadata(metadata)
    } catch (err) {
      // Use the parseTransactionError utility to get a user-friendly error message
      setError(parseTransactionError(err))
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetMetadata = async () => {
    setError('')
    setIsSettingMetadata(true)

    try {
      if (!activeAddress) {
        throw new Error('No active address')
      }

      if (!nfdData) {
        throw new Error('No NFD selected')
      }

      // Check if at least one field has both key and value
      const hasValidField = metadataFields.some(
        (field) => field.key.trim() !== '',
      )

      if (!hasValidField) {
        throw new Error('Please enter at least one metadata key')
      }

      // Check if the active address is the owner
      if (nfdData.owner !== activeAddress) {
        throw new Error('Only the owner can set metadata for this NFD')
      }

      // Combine all metadata fields into a single object
      const metadata: Record<string, string> = {}
      metadataFields.forEach((field) => {
        if (field.key.trim() !== '') {
          metadata[field.key.trim()] = field.value
        }
      })

      /**
       * Set metadata for the NFD
       */
      const updatedNfd = await nfd
        .setSigner(activeAddress, transactionSigner)
        .manage(nfdName)
        .setMetadata(metadata)

      setNfdData(updatedNfd)

      // Update the metadata display
      const newMetadata: Record<string, string> = {}
      if (updatedNfd.properties?.userDefined) {
        Object.entries(updatedNfd.properties.userDefined).forEach(
          ([key, value]) => {
            newMetadata[key] = value as string
          },
        )
      }
      setUserMetadata(newMetadata)

      // Reset the form
      setMetadataFields([{ key: '', value: '' }])
    } catch (err) {
      // Use the parseTransactionError utility to get a user-friendly error message
      setError(parseTransactionError(err))
      console.error(err)
    } finally {
      setIsSettingMetadata(false)
    }
  }

  const handleDeleteMetadata = async (key: string) => {
    setError('')
    setIsSettingMetadata(true)

    try {
      if (!activeAddress) {
        throw new Error('No active address')
      }

      if (!nfdData) {
        throw new Error('No NFD selected')
      }

      // Check if the active address is the owner
      if (nfdData.owner !== activeAddress) {
        throw new Error('Only the owner can delete metadata from this NFD')
      }

      /**
       * Delete metadata by setting it to an empty string
       */
      const updatedNfd = await nfd
        .setSigner(activeAddress, transactionSigner)
        .manage(nfdName)
        .setMetadata({ [key]: '' })

      setNfdData(updatedNfd)

      // Update the metadata display
      const newMetadata: Record<string, string> = {}
      if (updatedNfd.properties?.userDefined) {
        Object.entries(updatedNfd.properties.userDefined).forEach(
          ([k, value]) => {
            // Skip the deleted key or empty values
            if (k !== key && value !== '') {
              newMetadata[k] = value as string
            }
          },
        )
      }
      setUserMetadata(newMetadata)
    } catch (err) {
      // Use the parseTransactionError utility to get a user-friendly error message
      setError(parseTransactionError(err))
      console.error(err)
    } finally {
      setIsSettingMetadata(false)
    }
  }

  return (
    <div>
      <h1>NFD Metadata Manager</h1>

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
                <h3>User-Defined Metadata</h3>
                {Object.keys(userMetadata).length === 0 ? (
                  <p>No user-defined metadata for this NFD.</p>
                ) : (
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      marginTop: '10px',
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          style={{
                            textAlign: 'left',
                            padding: '8px',
                            borderBottom: '1px solid #ddd',
                          }}
                        >
                          Key
                        </th>
                        <th
                          style={{
                            textAlign: 'left',
                            padding: '8px',
                            borderBottom: '1px solid #ddd',
                          }}
                        >
                          Value
                        </th>
                        {nfdData.owner === activeAddress && (
                          <th
                            style={{
                              textAlign: 'center',
                              padding: '8px',
                              borderBottom: '1px solid #ddd',
                              width: '80px',
                            }}
                          >
                            Action
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(userMetadata).map(([key, value]) => (
                        <tr key={key}>
                          <td
                            style={{
                              padding: '8px',
                              borderBottom: '1px solid #ddd',
                              fontWeight: 'bold',
                            }}
                          >
                            {key}
                          </td>
                          <td
                            style={{
                              padding: '8px',
                              borderBottom: '1px solid #ddd',
                              wordBreak: 'break-word',
                            }}
                          >
                            {value}
                          </td>
                          {nfdData.owner === activeAddress && (
                            <td
                              style={{
                                padding: '8px',
                                borderBottom: '1px solid #ddd',
                                textAlign: 'center',
                              }}
                            >
                              <button
                                onClick={() => handleDeleteMetadata(key)}
                                disabled={isSettingMetadata}
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '12px',
                                }}
                              >
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {nfdData.owner === activeAddress && (
                <div style={{ marginTop: '20px' }}>
                  <h3>Add/Update Metadata</h3>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      maxWidth: '600px',
                    }}
                  >
                    {metadataFields.map((field, index) => (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          gap: '15px',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div style={{ flex: '1', maxWidth: '200px' }}>
                          <label
                            htmlFor={`metadataKey-${index}`}
                            style={{ display: 'block', marginBottom: '5px' }}
                          >
                            Key:
                          </label>
                          <input
                            id={`metadataKey-${index}`}
                            type="text"
                            value={field.key}
                            onChange={(e) => handleMetadataKeyChange(index, e)}
                            placeholder="Enter metadata key"
                            style={{ width: '100%' }}
                          />
                        </div>
                        <div style={{ flex: '2' }}>
                          <label
                            htmlFor={`metadataValue-${index}`}
                            style={{ display: 'block', marginBottom: '5px' }}
                          >
                            Value:
                          </label>
                          <textarea
                            id={`metadataValue-${index}`}
                            value={field.value}
                            onChange={(e) =>
                              handleMetadataValueChange(index, e)
                            }
                            placeholder="Enter metadata value"
                            style={{ width: '100%', height: '80px' }}
                          />
                        </div>
                        <div style={{ marginTop: '25px' }}>
                          <button
                            type="button"
                            onClick={() => removeMetadataField(index)}
                            disabled={metadataFields.length === 1}
                            style={{
                              padding: '2px 8px',
                              fontSize: '12px',
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={addMetadataField}
                        style={{
                          padding: '5px 10px',
                        }}
                      >
                        Add Field
                      </button>
                      <button
                        onClick={handleSetMetadata}
                        disabled={
                          isSettingMetadata ||
                          !metadataFields.some(
                            (field) => field.key.trim() !== '',
                          )
                        }
                      >
                        {isSettingMetadata
                          ? 'Setting Metadata...'
                          : 'Set Metadata'}
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
