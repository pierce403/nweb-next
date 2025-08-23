'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeftIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface SearchResult {
  type: 'submission' | 'record' | 'ip' | 'service'
  id: string | number
  title: string
  subtitle?: string
  description?: string
  metadata?: Record<string, any>
  score?: number
}

interface SearchResults {
  query: string
  total: number
  results: SearchResult[]
  took: number
}

export default function SearchPage() {
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchType, setSearchType] = useState<'all' | 'submissions' | 'records' | 'ips' | 'services'>('all')

  useEffect(() => {
    const q = searchParams.get('q')
    if (q && q.trim()) {
      setQuery(q)
      performSearch(q, searchType)
    }
  }, [searchParams])

  const performSearch = async (searchQuery: string, type: string = 'all') => {
    if (!searchQuery.trim()) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        type: type
      })

      const response = await fetch(`/api/search?${params}`)
      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      setResults(data)
    } catch (error) {
      console.error('Search error:', error)
      toast.error('Failed to perform search')
      setResults(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      // Update URL with search query
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.set('q', query)
      window.history.pushState({}, '', newUrl.toString())

      performSearch(query, searchType)
    }
  }

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'submission':
        return '📄'
      case 'record':
        return '🔍'
      case 'ip':
        return '🌐'
      case 'service':
        return '🛠️'
      default:
        return '📋'
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center mb-8">
          <Link href="/" className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to Dashboard
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Search</h1>
          <p className="mt-2 text-gray-600">Search through scan data, submissions, IPs, and services</p>
        </div>

        {/* Search Form */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search for IPs, services, submissions, or scan data..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nweb-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value as any)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nweb-blue-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="submissions">Submissions</option>
                <option value="records">Records</option>
                <option value="ips">IPs</option>
                <option value="services">Services</option>
              </select>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-nweb-blue-600 text-white rounded-lg hover:bg-nweb-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>
        </div>

        {/* Search Results */}
        {results && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Search Results for "{results.query}"
              </h2>
              <div className="text-sm text-gray-600">
                Found {results.total} results in {results.took}ms
              </div>
            </div>

            {results.results.length === 0 ? (
              <div className="bg-white shadow rounded-lg p-8 text-center">
                <MagnifyingGlassIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
                <p className="text-gray-600">Try adjusting your search query or search type.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {results.results.map((result, index) => (
                  <div key={`${result.type}-${result.id}`} className="bg-white shadow rounded-lg p-6">
                    <div className="flex items-start space-x-4">
                      <div className="text-2xl">{getResultIcon(result.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-lg font-medium text-gray-900 truncate">
                            {result.title}
                          </h3>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                            {result.type}
                          </span>
                          {result.score && (
                            <span className="text-xs text-gray-500">
                              Score: {Math.round(result.score * 100)}%
                            </span>
                          )}
                        </div>

                        {result.subtitle && (
                          <p className="text-sm text-gray-600 mb-2">{result.subtitle}</p>
                        )}

                        {result.description && (
                          <p className="text-sm text-gray-700 mb-3">{result.description}</p>
                        )}

                        {result.metadata && (
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(result.metadata).map(([key, value]) => (
                              <span key={key} className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-gray-100 text-gray-700">
                                <span className="font-medium">{key}:</span>
                                <span className="ml-1">{String(value)}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search Tips */}
        {!results && !loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-blue-900 mb-2">Search Tips</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Search for IP addresses (e.g., "192.168.1.1")</li>
              <li>• Search for services (e.g., "http", "ssh", "mysql")</li>
              <li>• Search for submission IDs or job IDs</li>
              <li>• Use quotes for exact matches (e.g., "Apache httpd")</li>
              <li>• Filter by type using the dropdown to narrow results</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
