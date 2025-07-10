import { NfdClient, type NfdImageResult } from '@txnlab/nfd-sdk'
import { useState } from 'react'

interface MetadataResults {
  avatar: NfdImageResult
  banner: NfdImageResult
}

export function App(): JSX.Element {
  const [input, setInput] = useState('')
  const [results, setResults] = useState<MetadataResults | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError('')
    setResults(null)
    setLoading(true)

    try {
      const client = NfdClient.mainNet()

      // Demonstrate both avatar and banner resolution
      const [avatar, banner] = await Promise.all([
        client.getAvatarImage(input),
        client.getBannerImage(input),
      ])

      setResults({ avatar, banner })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const formatUrlForDisplay = (url: string, isFallback?: boolean): string => {
    // Handle data URIs (like base64 images)
    if (url.startsWith('data:')) {
      if (isFallback) {
        return 'data:image/jpeg;base64,... (default NFD avatar)'
      }
      // For other data URIs, show type and truncate
      const [prefix] = url.split(',')
      return `${prefix},...`
    }

    return url
  }

  const renderImageResult = (
    type: 'Avatar' | 'Banner',
    result: NfdImageResult,
  ): JSX.Element => (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1rem',
      }}
    >
      <h3>{type} Image</h3>

      {result.url ? (
        <div style={{ marginBottom: '1rem' }}>
          <img
            src={result.url}
            alt={`NFD ${type.toLowerCase()}`}
            style={{
              maxWidth: type === 'Avatar' ? '128px' : '300px',
              maxHeight: type === 'Avatar' ? '128px' : '150px',
              objectFit: 'cover',
              borderRadius: type === 'Avatar' ? '50%' : '4px',
              border: '2px solid #eee',
            }}
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
            }}
          />
        </div>
      ) : (
        <div
          style={{
            padding: '2rem',
            background: '#f5f5f5',
            borderRadius: '4px',
            textAlign: 'center',
            color: '#666',
            marginBottom: '1rem',
          }}
        >
          No {type.toLowerCase()} image set
        </div>
      )}

      <div style={{ fontSize: '0.9rem' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <strong>Raw Value:</strong>{' '}
          <code style={{ background: '#f5f5f5', padding: '0.2rem' }}>
            {result.raw || 'null'}
          </code>
        </div>

        <div style={{ marginBottom: '0.5rem' }}>
          <strong>Resolved URL:</strong>{' '}
          {result.url ? (
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}
              title={result.url} // Show full URL on hover
            >
              {formatUrlForDisplay(result.url, result.isFallback)}
            </a>
          ) : (
            <span style={{ color: '#666' }}>null</span>
          )}
        </div>

        <div style={{ marginBottom: '0.5rem' }}>
          <strong>Verified:</strong>{' '}
          <span
            style={{
              color: result.verified ? 'green' : '#666',
              fontWeight: result.verified ? 'bold' : 'normal',
            }}
          >
            {result.verified ? 'Yes' : 'No'}
          </span>
          {result.verified && result.asaId && (
            <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>
              (ASA ID: {result.asaId})
            </span>
          )}
        </div>

        {result.isFallback && (
          <div
            style={{
              background: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: '4px',
              padding: '0.5rem',
              fontSize: '0.8rem',
              color: '#856404',
            }}
          >
            ℹ️ Using default NFD avatar (no custom avatar set)
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <h1>NFD Metadata Example</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Enter an NFD name or app ID to resolve its avatar and banner images.
        This demonstrates the SDK's metadata functionality with automatic IPFS
        to HTTPS conversion.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter NFD name (e.g., algofoundation.algo) or app ID"
            style={{
              width: '300px',
              padding: '0.5rem',
              marginRight: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
          <button
            type="submit"
            disabled={loading || !input}
            style={{
              padding: '0.5rem 1rem',
              background: loading || !input ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading || !input ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Loading...' : 'Get Images'}
          </button>
        </div>
      </form>

      {error && (
        <div
          style={{
            color: 'red',
            background: '#ffebee',
            border: '1px solid #ffcdd2',
            borderRadius: '4px',
            padding: '1rem',
            marginBottom: '1rem',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {results && (
        <div>
          <h2>Metadata Results</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
            }}
          >
            <div>{renderImageResult('Avatar', results.avatar)}</div>
            <div>{renderImageResult('Banner', results.banner)}</div>
          </div>

          <div
            style={{
              marginTop: '2rem',
              padding: '1rem',
              paddingTop: '0.25rem',
              background: '#f8f9fa',
              borderRadius: '4px',
              fontSize: '0.9rem',
            }}
          >
            <h4>🔍 What This Demonstrates</h4>
            <ul style={{ paddingLeft: '1.5rem' }}>
              <li>
                <strong>Avatar Fallback:</strong> Always returns a URL (default
                NFD avatar if none set)
              </li>
              <li>
                <strong>Banner Behavior:</strong> Returns null if no banner is
                configured
              </li>
              <li>
                <strong>IPFS Resolution:</strong> Converts ipfs:// URLs to
                https:// automatically
              </li>
              <li>
                <strong>Verification Status:</strong> Shows if image is from
                verified NFT properties
              </li>
              <li>
                <strong>Performance:</strong> Both images resolved in parallel
                for efficiency
              </li>
            </ul>
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: '3rem',
          padding: '1.5rem',
          paddingTop: '0',
          background: '#e7f3ff',
          borderRadius: '8px',
          border: '1px solid #bee5eb',
        }}
      >
        <h4>💡 Try These Examples</h4>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
          }}
        >
          <button
            onClick={() => setInput('nfdomains.algo')}
            style={{
              padding: '0.5rem',
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            nfdomains.algo
          </button>
          <button
            onClick={() => setInput('doug.algo')}
            style={{
              padding: '0.5rem',
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            doug.algo
          </button>
          <button
            onClick={() => setInput('heyheyhey.algo')}
            style={{
              padding: '0.5rem',
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            heyheyhey.algo
          </button>
        </div>
      </div>
    </div>
  )
}
