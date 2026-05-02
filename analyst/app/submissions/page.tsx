'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface Submission {
  uid: string
  job_id: string
  dataset_type: string
  cid: string
  merkle_root: string
  started_at: number
  finished_at: number
  tool: string
  version: string
  vantage: string
  timestamp: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error_message: string | null
  record_count: number
  unique_ips: number
  unique_ports: number
  primary_ip: string | null
  extra?: Record<string, unknown>
}

interface SubmissionsResponse {
  submissions: Submission[]
}

const statusOptions = ['all', 'completed', 'pending', 'processing', 'failed'] as const

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [status, setStatus] = useState<(typeof statusOptions)[number]>('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadSubmissions()
  }, [status])

  const loadSubmissions = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ limit: '100' })
      if (status !== 'all') params.set('status', status)

      const response = await fetch(`/api/submissions?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Failed to load submissions')
      }
      const data = await response.json() as SubmissionsResponse
      setSubmissions(data.submissions)
    } catch (error) {
      console.error('Error loading submissions:', error)
      toast.error('Failed to load submissions')
    } finally {
      setLoading(false)
    }
  }

  const filteredSubmissions = submissions.filter((submission) => {
    const needle = query.trim().toLowerCase()
    if (!needle) return true
    return [
      submission.uid,
      submission.job_id,
      submission.dataset_type,
      submission.cid,
      submission.merkle_root,
      submission.tool,
      submission.vantage,
      String(submission.extra?.dispatcher_work_id ?? ''),
    ].some((value) => value.toLowerCase().includes(needle))
  })

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-bold text-gray-900">Submissions</h1>
        <p className="mt-2 text-sm text-gray-600">Recently indexed scan submissions from the local Analyst database</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xl flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by UID, work ID, dataset, CID, tool, or vantage"
            className="block w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-gray-900 shadow-sm focus:border-nweb-blue-500 focus:outline-none focus:ring-1 focus:ring-nweb-blue-500"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-nweb-blue-500 focus:outline-none focus:ring-1 focus:ring-nweb-blue-500"
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadSubmissions()}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            disabled={loading}
          >
            <ArrowPathIcon className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Indexed Submissions</h2>
            <span className="text-sm text-gray-500">{filteredSubmissions.length.toLocaleString()} shown</span>
          </div>
        </div>

        {loading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 w-3/4 rounded bg-gray-200" />
              <div className="h-6 w-2/3 rounded bg-gray-200" />
              <div className="h-6 w-1/2 rounded bg-gray-200" />
            </div>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No submissions match the current filters.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredSubmissions.map((submission) => (
              <div key={submission.uid} className="px-6 py-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {statusIcon(submission.status)}
                      <span className="truncate font-medium text-gray-900">{submission.dataset_type}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{submission.status}</span>
                    </div>
                    <div className="mt-2 font-mono text-xs text-gray-600 break-all">{submission.uid}</div>
                    <div className="mt-2 text-sm text-gray-600">
                      {submission.tool} {submission.version} from {submission.vantage}
                    </div>
                    <div className="mt-1 text-sm text-gray-600">
                      Work: {String(submission.extra?.dispatcher_work_id ?? submission.job_id)}
                    </div>
                    {submission.error_message && (
                      <div className="mt-2 text-sm text-red-600">{submission.error_message}</div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm lg:min-w-80">
                    <Metric label="Records" value={submission.record_count.toLocaleString()} />
                    <Metric label="IPs" value={submission.unique_ips.toLocaleString()} />
                    <Metric label="Ports" value={submission.unique_ports.toLocaleString()} />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-gray-500">{formatUnixTimestamp(submission.timestamp)}</span>
                  {submission.unique_ips === 1 && submission.primary_ip && (
                    <Link
                      href={`/host?h=${encodeURIComponent(submission.primary_ip)}`}
                      className="text-nweb-blue-600 hover:text-nweb-blue-700"
                    >
                      Host view
                    </Link>
                  )}
                  <Link
                    href={`/search?q=${encodeURIComponent(submission.uid)}&type=submissions`}
                    className="text-nweb-blue-600 hover:text-nweb-blue-700"
                  >
                    Search UID
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
    </div>
  )
}

function statusIcon(status: Submission['status']) {
  if (status === 'completed') return <CheckCircleIcon className="h-5 w-5 flex-none text-green-500" />
  if (status === 'failed') return <ExclamationTriangleIcon className="h-5 w-5 flex-none text-red-500" />
  return <ClockIcon className="h-5 w-5 flex-none text-yellow-500" />
}

function formatUnixTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString()
}
