'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  GlobeAltIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface TargetRequest {
  id: string
  domain: string
  profile: string
  priority: number
  withAssets: boolean
  notes?: string
  source: 'analyst'
  createdAt: string
}

interface TargetQueue {
  version: number
  updatedAt: string
  targets: TargetRequest[]
}

const profiles = ['quick', 'top-100', 'top-1000', 'full']

export default function TargetsPage() {
  const [domain, setDomain] = useState('')
  const [profile, setProfile] = useState('quick')
  const [priority, setPriority] = useState(1000)
  const [withAssets, setWithAssets] = useState(false)
  const [notes, setNotes] = useState('')
  const [queue, setQueue] = useState<TargetQueue | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void loadTargets()
  }, [])

  const loadTargets = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/targets', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Failed to load dispatcher target queue')
      }
      const data = await response.json() as TargetQueue
      setQueue(data)
    } catch (error) {
      console.error('Error loading targets:', error)
      toast.error('Dispatcher target queue is not reachable')
    } finally {
      setLoading(false)
    }
  }

  const submitTarget = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      setSubmitting(true)
      const response = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          domain,
          profile,
          priority,
          withAssets,
          notes: notes.trim() || undefined,
        }),
      })
      const payload = await response.json().catch(() => null) as { message?: string } | null
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Failed to add target')
      }

      setDomain('')
      setNotes('')
      toast.success('Target queued')
      await loadTargets()
    } catch (error) {
      console.error('Error submitting target:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add target')
    } finally {
      setSubmitting(false)
    }
  }

  const targets = queue?.targets ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeftIcon className="mr-2 h-5 w-5" />
            Back to Dashboard
          </Link>
          <button
            type="button"
            onClick={() => void loadTargets()}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            disabled={loading}
          >
            <ArrowPathIcon className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Target Queue</h1>
          <p className="mt-2 text-gray-600">Domains submitted here are sent to the dispatcher and served before random IPv4 work.</p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <form onSubmit={submitTarget} className="bg-white p-6 shadow rounded-lg">
            <div className="mb-5 flex items-center">
              <GlobeAltIcon className="mr-2 h-5 w-5 text-nweb-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Add Domain</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="domain" className="block text-sm font-medium text-gray-700">
                  Domain
                </label>
                <input
                  id="domain"
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  placeholder="example.com"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-nweb-blue-500 focus:outline-none focus:ring-1 focus:ring-nweb-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="profile" className="block text-sm font-medium text-gray-700">
                  Scan Profile
                </label>
                <select
                  id="profile"
                  value={profile}
                  onChange={(event) => setProfile(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-nweb-blue-500 focus:outline-none focus:ring-1 focus:ring-nweb-blue-500"
                >
                  {profiles.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
                  Priority
                </label>
                <input
                  id="priority"
                  type="number"
                  min={1}
                  max={10000}
                  value={priority}
                  onChange={(event) => setPriority(Number(event.target.value))}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-nweb-blue-500 focus:outline-none focus:ring-1 focus:ring-nweb-blue-500"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={withAssets}
                  onChange={(event) => setWithAssets(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-nweb-blue-600 focus:ring-nweb-blue-500"
                />
                Capture assets when the collector supports it
              </label>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-nweb-blue-500 focus:outline-none focus:ring-1 focus:ring-nweb-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center rounded-md bg-nweb-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-nweb-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PlusIcon className="mr-2 h-4 w-4" />
                {submitting ? 'Queueing...' : 'Queue Target'}
              </button>
            </div>
          </form>

          <div className="lg:col-span-2">
            <div className="bg-white shadow rounded-lg">
              <div className="border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Dispatcher Priority Targets</h2>
                  <span className="text-sm text-gray-500">{targets.length.toLocaleString()} queued</span>
                </div>
              </div>

              {loading ? (
                <div className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-5 w-2/3 rounded bg-gray-200" />
                    <div className="h-5 w-1/2 rounded bg-gray-200" />
                    <div className="h-5 w-3/4 rounded bg-gray-200" />
                  </div>
                </div>
              ) : targets.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No priority domains are queued.
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {targets.map((target) => (
                    <div key={target.id} className="px-6 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <CheckCircleIcon className="h-5 w-5 flex-none text-green-500" />
                            <span className="truncate font-medium text-gray-900">{target.domain}</span>
                          </div>
                          {target.notes && (
                            <p className="mt-1 text-sm text-gray-600">{target.notes}</p>
                          )}
                          <p className="mt-1 text-xs text-gray-500">
                            Queued {new Date(target.createdAt).toLocaleString()}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-700">{target.profile}</span>
                          <span className="rounded-full bg-nweb-blue-50 px-2 py-1 font-medium text-nweb-blue-700">priority {target.priority}</span>
                          {target.withAssets && (
                            <span className="rounded-full bg-purple-50 px-2 py-1 font-medium text-purple-700">assets</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
