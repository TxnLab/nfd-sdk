import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import { NfdClient, type NfdMintQuote, type Nfd } from '@txnlab/nfd-sdk'
import { useWallet } from '@txnlab/use-wallet-react'
import { useState } from 'react'

import { WalletMenu } from './Connect'

/**
 * Initialize the NFD client for TestNet
 */
const nfd = NfdClient.testNet()

export function App() {
  const [nfdName, setNfdName] = useState('')
  const [years, setYears] = useState(1)
  const [reservedFor, setReservedFor] = useState('')
  const [nfdData, setNfdData] = useState<Nfd | null>(null)
  const [quoteData, setQuoteData] = useState<NfdMintQuote | null>(null)
  const [error, setError] = useState('')
  const [isMinting, setIsMinting] = useState(false)
  const [isQuoteLoading, setIsQuoteLoading] = useState(false)

  const { activeAddress, transactionSigner } = useWallet()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuoteData(null)
    setNfdData(null)
    setNfdName(e.target.value)
  }

  const handleReservedForChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuoteData(null)
    setNfdData(null)
    setReservedFor(e.target.value)
  }

  const handleGetQuote = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setQuoteData(null)
    setNfdData(null)
    setIsQuoteLoading(true)

    try {
      if (!activeAddress) {
        throw new Error('No active address')
      }

      if (!nfdName.trim()) {
        throw new Error('Please enter an NFD name')
      }

      /**
       * Get a quote for the NFD minting transaction
       */
      const quote = await nfd.getMintQuote(nfdName, {
        buyer: activeAddress,
        years,
      })

      setQuoteData(quote)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error(err)
    } finally {
      setIsQuoteLoading(false)
    }
  }

  const handleMint = async (quote: NfdMintQuote) => {
    setError('')
    setNfdData(null)
    setIsMinting(true)

    try {
      if (!activeAddress) {
        throw new Error('No active address')
      }

      /**
       * Mint the NFD using the quote data
       */
      const mintedNfd = await nfd
        .setSigner(activeAddress, transactionSigner)
        .mint(quote.nfdName, {
          buyer: quote.buyer,
          years: quote.years,
          ...(reservedFor.trim() && { reservedFor: reservedFor.trim() }),
        })

      setNfdData(mintedNfd)
      setQuoteData(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error(err)
    } finally {
      setIsMinting(false)
    }
  }

  const formatAlgos = (microAlgos: bigint): string => {
    return AlgoAmount.MicroAlgos(microAlgos).algos.toString()
  }

  return (
    <div>
      <h1>NFD Minter</h1>

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
          <form onSubmit={handleGetQuote} style={{ marginBottom: '20px' }}>
            <h2>Get NFD Mint Quote</h2>
            <fieldset style={{ border: 'none', padding: '0' }}>
              <div style={{ marginBottom: '10px' }}>
                <input
                  type="text"
                  value={nfdName}
                  onChange={handleInputChange}
                  placeholder="Enter NFD to mint (e.g., example.algo)"
                  style={{ width: '250px' }}
                />
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label htmlFor="years" style={{ marginRight: '10px' }}>
                  Registration period:
                </label>
                <select
                  id="years"
                  value={years}
                  onChange={(e) => setYears(Number(e.target.value))}
                >
                  {[1, 2, 3, 5, 10].map((y) => (
                    <option key={y} value={y}>
                      {y} {y === 1 ? 'year' : 'years'}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label htmlFor="reservedFor" style={{ marginRight: '10px' }}>
                  Reserved for (optional):
                </label>
                <input
                  id="reservedFor"
                  type="text"
                  value={reservedFor}
                  onChange={handleReservedForChange}
                  placeholder="Enter Algorand address"
                  style={{ width: '350px' }}
                />
              </div>
            </fieldset>

            <button type="submit" disabled={isQuoteLoading || !nfdName.trim()}>
              {isQuoteLoading ? 'Getting quote...' : 'Get Quote'}
            </button>
          </form>

          {quoteData && (
            <div
              style={{
                border: '1px solid #ccc',
                padding: '15px',
                margin: '10px 0',
                borderRadius: '4px',
              }}
            >
              <h3>Mint Quote for {quoteData.nfdName}</h3>
              <dl
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'max-content 1fr',
                  gap: '8px 12px',
                }}
              >
                <dt style={{ fontWeight: 'bold' }}>Registration Period:</dt>
                <dd style={{ margin: 0 }}>
                  {quoteData.years} {quoteData.years === 1 ? 'year' : 'years'}
                </dd>

                <dt style={{ fontWeight: 'bold' }}>Is Segment:</dt>
                <dd style={{ margin: 0 }}>
                  {quoteData.isSegment ? 'Yes' : 'No'}
                </dd>

                <dt style={{ fontWeight: 'bold' }}>Base Price:</dt>
                <dd style={{ margin: 0 }}>
                  {formatAlgos(quoteData.basePrice)} ALGO
                  {quoteData.years > 1 &&
                    ` (${formatAlgos(quoteData.basePrice / BigInt(quoteData.years))} ALGO per year)`}
                </dd>

                <dt style={{ fontWeight: 'bold' }}>Carry Cost:</dt>
                <dd style={{ margin: 0 }}>
                  {formatAlgos(quoteData.carryCost)} ALGO
                </dd>

                <dt style={{ fontWeight: 'bold' }}>Extra Fee:</dt>
                <dd style={{ margin: 0 }}>
                  {formatAlgos(quoteData.extraFee)} ALGO
                </dd>

                <dt style={{ fontWeight: 'bold' }}>Total Price:</dt>
                <dd style={{ margin: 0 }}>
                  {formatAlgos(quoteData.totalPrice)} ALGO
                </dd>
              </dl>
              <div style={{ marginTop: '15px' }}>
                <button
                  onClick={() => handleMint(quoteData)}
                  disabled={isMinting}
                >
                  {isMinting ? 'Minting...' : 'Proceed with Mint'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {nfdData && (
        <div
          style={{
            marginTop: '20px',
            padding: '15px',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        >
          <h2>NFD Minted Successfully!</h2>
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
          <details style={{ marginTop: '15px' }}>
            <summary>View Full NFD Data</summary>
            <pre>{JSON.stringify(nfdData, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  )
}
