import type { Nfd } from '@txnlab/nfd-sdk'

interface SearchResultsProps {
  results: { nfds: Nfd[]; total: number } | null
  searchParams: {
    page?: number
    limit?: number
  }
  changePage: (newPage: number) => void
}

export function SearchResults({
  results,
  searchParams,
  changePage,
}: SearchResultsProps): JSX.Element | null {
  if (!results) return null

  const currentPage = searchParams.page || 1
  const itemsPerPage = searchParams.limit || 10
  const totalPages = Math.ceil(results.total / itemsPerPage)

  return (
    <div>
      <h2>Search Results ({results.total} total)</h2>

      {results.total > 0 ? (
        <>
          <p>
            Showing {(currentPage - 1) * itemsPerPage + 1}-
            {Math.min(currentPage * itemsPerPage, results.total)} of{' '}
            {results.total} results
          </p>
          <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
            {results.nfds.map((nfd: Nfd) => (
              <div
                key={nfd.name}
                style={{
                  border: '1px solid #ddd',
                  padding: '1rem',
                  borderRadius: '4px',
                }}
              >
                <h3 style={{ fontWeight: 'bold', marginTop: 0 }}>{nfd.name}</h3>
                <p>Owner: {nfd.owner}</p>
                <p>Category: {nfd.category}</p>
                <p>State: {nfd.state}</p>
                <details>
                  <summary>View full NFD data</summary>
                  <pre>{JSON.stringify(nfd, null, 2)}</pre>
                </details>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p>No NFDs found matching your search criteria.</p>
      )}

      {results.total > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '1rem',
            maxWidth: '400px',
          }}
        >
          <button
            style={{
              marginRight: '0.5rem',
              opacity: currentPage <= 1 ? 0.5 : 1,
            }}
            onClick={() => changePage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            style={{
              marginLeft: '0.5rem',
              opacity: currentPage >= totalPages ? 0.5 : 1,
            }}
            onClick={() => changePage(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
