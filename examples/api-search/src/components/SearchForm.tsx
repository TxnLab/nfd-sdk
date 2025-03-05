import React from 'react'

interface SearchFormProps {
  searchParams: {
    substring?: string
    category?: string[]
    state?: string[]
    owner?: string
    limit?: number
    page?: number
    view?: string
  }
  loading: boolean
  handleInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void
  handleCheckboxChange: (group: string, value: string, checked: boolean) => void
  handleNumberChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void
  handleSubmit: (e: React.FormEvent) => Promise<void>
  isSelected: (group: string, value: string) => boolean
}

export function SearchForm({
  searchParams,
  loading,
  handleInputChange,
  handleCheckboxChange,
  handleNumberChange,
  handleSubmit,
  isSelected,
}: SearchFormProps): JSX.Element {
  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: '1rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          Search Text:
          <input
            type="text"
            name="substring"
            value={searchParams.substring}
            onChange={handleInputChange}
            placeholder="e.g., 'algo'"
            style={{ marginLeft: '0.5rem', width: '200px' }}
            minLength={3}
            title="Please enter at least 3 characters"
          />
        </label>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          Owner Address:
          <input
            type="text"
            name="owner"
            value={searchParams.owner}
            onChange={handleInputChange}
            placeholder="Algorand address"
            style={{ marginLeft: '0.5rem', width: '300px' }}
          />
        </label>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={{ marginBottom: '0.5rem' }}>Category:</div>
        <div>
          <label style={{ marginRight: '1rem' }}>
            <input
              type="checkbox"
              checked={isSelected('category', 'curated')}
              onChange={(e) =>
                handleCheckboxChange('category', 'curated', e.target.checked)
              }
            />
            Curated
          </label>
          <label style={{ marginRight: '1rem' }}>
            <input
              type="checkbox"
              checked={isSelected('category', 'premium')}
              onChange={(e) =>
                handleCheckboxChange('category', 'premium', e.target.checked)
              }
            />
            Premium
          </label>
          <label>
            <input
              type="checkbox"
              checked={isSelected('category', 'common')}
              onChange={(e) =>
                handleCheckboxChange('category', 'common', e.target.checked)
              }
            />
            Common
          </label>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={{ marginBottom: '0.5rem' }}>State:</div>
        <div>
          <label style={{ marginRight: '1rem' }}>
            <input
              type="checkbox"
              checked={isSelected('state', 'reserved')}
              onChange={(e) =>
                handleCheckboxChange('state', 'reserved', e.target.checked)
              }
            />
            Reserved
          </label>
          <label style={{ marginRight: '1rem' }}>
            <input
              type="checkbox"
              checked={isSelected('state', 'forSale')}
              onChange={(e) =>
                handleCheckboxChange('state', 'forSale', e.target.checked)
              }
            />
            For Sale
          </label>
          <label style={{ marginRight: '1rem' }}>
            <input
              type="checkbox"
              checked={isSelected('state', 'owned')}
              onChange={(e) =>
                handleCheckboxChange('state', 'owned', e.target.checked)
              }
            />
            Owned
          </label>
          <label>
            <input
              type="checkbox"
              checked={isSelected('state', 'expired')}
              onChange={(e) =>
                handleCheckboxChange('state', 'expired', e.target.checked)
              }
            />
            Expired
          </label>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ marginRight: '1rem' }}>
          Limit:
          <select
            name="limit"
            value={searchParams.limit}
            onChange={handleNumberChange}
            style={{ marginLeft: '0.5rem' }}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </label>

        <label style={{ marginRight: '1rem' }}>
          Page:
          <select
            name="page"
            value={searchParams.page}
            onChange={handleNumberChange}
            style={{ marginLeft: '0.5rem' }}
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
              <option key={num} value={num}>
                {num}
              </option>
            ))}
          </select>
        </label>

        <label>
          View:
          <select
            name="view"
            value={searchParams.view}
            onChange={handleInputChange}
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
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
    </form>
  )
}
