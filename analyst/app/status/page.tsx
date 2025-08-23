'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon, CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface StatusInfo {
  database: {
    connected: boolean
    type: string
    stats?: {
      submissions: number
      records: number
      unique_ips: number
      unique_services: number
    }
  }
  dispatcher: {
    configured: boolean
    url?: string
  }
  system: {
    version: string
    uptime: string
  }
}

export default function StatusPage() {
  const [status, setStatus] = useState<StatusInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/status')
      if (!response.ok) {
        throw new Error('Failed to fetch status')
      }
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      console.error('Error fetching status:', error)
      toast.error('Failed to load status information')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center mb-8">
            <Link href="/" className="flex items-center text-gray-600 hover:text-gray-900">
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back to Dashboard
            </Link>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
              <div className="space-y-4">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center mb-8">
            <Link href="/" className="flex items-center text-gray-600 hover:text-gray-900">
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back to Dashboard
            </Link>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="text-center text-gray-500">
              <ExclamationTriangleIcon className="h-12 w-12 mx-auto mb-4" />
              <p>Unable to load status information</p>
            </div>
          </div>
        </div>
      </div>
    )
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
          <h1 className="text-3xl font-bold text-gray-900">System Status</h1>
          <p className="mt-2 text-gray-600">Overview of database, dispatcher, and system configuration</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Database Status */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Database</h2>
              <div className="ml-auto flex items-center">
                {status.database.connected ? (
                  <CheckCircleIcon className="h-6 w-6 text-green-500" />
                ) : (
                  <XCircleIcon className="h-6 w-6 text-red-500" />
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={`font-medium ${status.database.connected ? 'text-green-600' : 'text-red-600'}`}>
                  {status.database.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Type:</span>
                <span className="font-medium text-gray-900">{status.database.type}</span>
              </div>

              {status.database.connected && status.database.stats && (
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Statistics</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Submissions:</span>
                      <div className="font-medium text-gray-900">{status.database.stats.submissions.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Records:</span>
                      <div className="font-medium text-gray-900">{status.database.stats.records.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Unique IPs:</span>
                      <div className="font-medium text-gray-900">{status.database.stats.unique_ips.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Services:</span>
                      <div className="font-medium text-gray-900">{status.database.stats.unique_services.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Dispatcher Status */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Dispatcher</h2>
              <div className="ml-auto flex items-center">
                {status.dispatcher.configured ? (
                  <CheckCircleIcon className="h-6 w-6 text-green-500" />
                ) : (
                  <XCircleIcon className="h-6 w-6 text-yellow-500" />
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={`font-medium ${status.dispatcher.configured ? 'text-green-600' : 'text-yellow-600'}`}>
                  {status.dispatcher.configured ? 'Configured' : 'Not Configured'}
                </span>
              </div>

              {status.dispatcher.configured && status.dispatcher.url && (
                <div className="flex justify-between">
                  <span className="text-gray-600">URL:</span>
                  <span className="font-medium text-gray-900 text-sm break-all">{status.dispatcher.url}</span>
                </div>
              )}

              {!status.dispatcher.configured && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    No dispatcher configured. The system will generate random scan targets locally.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* System Status */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">System</h2>
              <div className="ml-auto flex items-center">
                <CheckCircleIcon className="h-6 w-6 text-green-500" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Version:</span>
                <span className="font-medium text-gray-900">{status.system.version}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className="font-medium text-green-600">Running</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>

            <div className="space-y-3">
              <button
                onClick={fetchStatus}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Refresh Status
              </button>

              <Link
                href="/api/getwork"
                target="_blank"
                className="block w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-center"
              >
                Test GetWork Endpoint
              </Link>

              <Link
                href="/api/submit"
                className="block w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-center"
              >
                Submit Endpoint Info
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
