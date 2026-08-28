import {
  NfdClient,
  type SearchOptions,
  type SearchResponse,
} from '@txnlab/nfd-sdk'
import { useState, useEffect, useCallback } from 'react'

import { SearchForm } from './components/SearchForm'
import { SearchResults } from './components/SearchResults'

export function App(): JSX.Element {
  // State for search parameters
  const [searchParams, setSearchParams] = useState<{
    substring?: string
    category?: string[]
    state?: string[]
    owner?: string
    limit?: number
    page?: number
    view?: string
  }>({
    substring: '',
    category: [],
    state: [],
    owner: '',
    limit: 10,
    page: 1,
    view: 'brief',
  })

  // State for search results and UI state
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shouldSearch, setShouldSearch] = useState(false)

  /**
   * Perform the search using NFD API Client
   */
  const performSearch = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')

    try {
      // Prepare search options from the current search parameters
      const options: SearchOptions = {}

      if (searchParams.substring) options.substring = searchParams.substring
      if (searchParams.owner) options.owner = searchParams.owner

      // Handle category
      if (searchParams.category && searchParams.category.length > 0) {
        options.category = searchParams.category as SearchOptions['category']
      }

      // Handle state
      if (searchParams.state && searchParams.state.length > 0) {
        options.state = searchParams.state as SearchOptions['state']
      }

      // Handle limit and offset
      if (searchParams.limit) options.limit = searchParams.limit
      if (searchParams.page)
        options.offset = (searchParams.page - 1) * (searchParams.limit || 10)

      // Handle view
      if (searchParams.view)
        options.view = searchParams.view as SearchOptions['view']

      /**
       * Search for NFDs using the NFD SDK
       *
       * ALTERNATIVE APPROACH:
       * For integrators who only need API search and batch lookup functionality,
       * the NfdApiClient can be imported and used directly:
       *
       * import { NfdApiClient } from '@txnlab/nfd-sdk'
       * const searchResults = await NfdApiClient.testNet().search(options)
       */
      const searchResults = await NfdClient.testNet().api.search(options)

      setResults(searchResults)
    } catch (err) {
      console.error('Error searching NFDs:', err)
      setError('Error searching NFDs. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [searchParams])

  // Effect to trigger search when shouldSearch is true
  useEffect(() => {
    if (shouldSearch) {
      performSearch()
      setShouldSearch(false)
    }
  }, [performSearch, shouldSearch])

  // Handle text input changes
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target

    // Don't reset page if we're changing the view
    if (name === 'view') {
      setSearchParams((prev) => ({ ...prev, [name]: value }))
    } else {
      // Reset page to 1 when changing search criteria
      setSearchParams((prev) => ({ ...prev, [name]: value, page: 1 }))
    }
  }

  // Handle checkbox changes for category and state filters
  const handleCheckboxChange = (
    group: string,
    value: string,
    checked: boolean,
  ) => {
    setSearchParams((prev) => {
      const currentValues = (prev[group as keyof typeof prev] as string[]) || []

      let newValues: string[]
      if (checked) {
        newValues = [...currentValues, value]
      } else {
        newValues = currentValues.filter((v) => v !== value)
      }

      return {
        ...prev,
        [group]: newValues,
        page: 1,
      }
    })
  }

  // Handle number input changes (limit, page)
  const handleNumberChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target
    const numValue = parseInt(value, 10)

    if (name === 'limit') {
      // Reset page to 1 when limit changes to avoid invalid offsets
      setSearchParams((prev) => ({
        ...prev,
        [name]: numValue,
        page: 1,
      }))
      // Trigger search when limit changes
      setShouldSearch(true)
    } else if (name === 'page') {
      // Only update the page, don't reset it
      setSearchParams((prev) => ({ ...prev, [name]: numValue }))
      // Trigger search when page changes
      setShouldSearch(true)
    } else {
      // For any other numeric inputs, update the value and reset page to 1
      setSearchParams((prev) => ({ ...prev, [name]: numValue, page: 1 }))
    }
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    // Reset page to 1 when submitting the form for a new search
    setSearchParams((prev) => ({ ...prev, page: 1 }))

    // Perform the search with the updated parameters
    performSearch()
  }

  // Handle page changes
  const changePage = (newPage: number) => {
    setSearchParams({
      ...searchParams,
      page: newPage,
    })
    setShouldSearch(true)
  }

  // Check if a value is selected in a group
  const isSelected = (group: string, value: string): boolean => {
    const values = searchParams[group as keyof typeof searchParams] as
      string[] | undefined
    return values ? values.includes(value) : false
  }

  return (
    <div style={{ marginBottom: '2rem' }}>
      <h1>NFD API Search</h1>
      <p>Search for NFDs using the NFD API Client</p>

      {/* Search Form Component */}
      <SearchForm
        searchParams={searchParams}
        loading={loading}
        handleInputChange={handleInputChange}
        handleCheckboxChange={handleCheckboxChange}
        handleNumberChange={handleNumberChange}
        handleSubmit={handleSubmit}
        isSelected={isSelected}
      />

      {/* Error Message */}
      {error && (
        <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>
      )}

      {/* Search Results Component */}
      <SearchResults
        results={results}
        searchParams={searchParams}
        changePage={changePage}
      />
    </div>
  )
}
