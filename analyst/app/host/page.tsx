'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface HostSummary {
  ip: string
  total_records: number
  open_ports: number[]
  unique_services: string[]
}

export default function HostPage() {
  const searchParams = useSearchParams()
  const ip = searchParams.get('h') || searchParams.get('ip') || ''

  const [summary, setSummary] = useState<HostSummary | null>(null)
  const [ports, setPorts] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  const [recent, setRecent] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ip) return
    fetchHost()
  }, [ip])

  const fetchHost = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/host?h=${encodeURIComponent(ip)}`)
      if (!res.ok) throw new Error('Failed to load host')
      const data = await res.json()
      setSummary(data.summary)
      setPorts(data.ports)
      setSubmissions(data.submissions)
      setRecent(data.recent)
    } catch (e) {
      console.error(e)
      toast.error('Failed to load host information')
    } finally {
      setLoading(false)
    }
  }

  if (!ip) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/search" className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeftIcon className="h-5 w-5 mr-2" /> Back to Search
          </Link>
          <div className="mt-6 bg-white shadow rounded-lg p-6">Missing h (ip) parameter.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center mb-6">
          <Link href="/search" className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeftIcon className="h-5 w-5 mr-2" /> Back to Search
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <GlobeAltIcon className="h-8 w-8 mr-2 text-nweb-blue-600" /> Host {ip}
          </h1>
          <p className="text-gray-600 mt-2">Summary of interesting information about this host</p>
        </div>

        {loading ? (
          <div className="bg-white shadow rounded-lg p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        ) : (
          <>
            {summary && (
              <div className="bg-white shadow rounded-lg p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Summary</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Total Records</div>
                    <div className="text-2xl font-semibold">{summary.total_records.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Open Ports</div>
                    <div className="text-2xl font-semibold">{summary.open_ports.length}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Services</div>
                    <div className="text-2xl font-semibold">{summary.unique_services.length}</div>
                  </div>
                </div>
                {summary.unique_services.length > 0 && (
                  <div className="mt-4">
                    <div className="text-sm text-gray-600 mb-1">Detected Services</div>
                    <div className="flex flex-wrap gap-2">
                      {summary.unique_services.map(s => (
                        <span key={s} className="px-2 py-1 rounded-md text-xs bg-gray-100 text-gray-700">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Ports & Services</h2>
              {ports.length === 0 ? (
                <div className="text-gray-500">No port data.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600">
                        <th className="py-2 pr-4">Port</th>
                        <th className="py-2 pr-4">Proto</th>
                        <th className="py-2 pr-4">State</th>
                        <th className="py-2 pr-4">Service</th>
                        <th className="py-2 pr-4">Product</th>
                        <th className="py-2 pr-4">Version</th>
                        <th className="py-2 pr-4">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ports.map((p, idx) => (
                        <tr key={idx} className="border-t border-gray-100">
                          <td className="py-2 pr-4 font-mono">{p.port}</td>
                          <td className="py-2 pr-4">{p.protocol}</td>
                          <td className="py-2 pr-4">{p.state}</td>
                          <td className="py-2 pr-4">{p.service || '-'}</td>
                          <td className="py-2 pr-4">{p.product || '-'}</td>
                          <td className="py-2 pr-4">{p.version || '-'}</td>
                          <td className="py-2 pr-4">{p.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Records</h2>
              {recent.length === 0 ? (
                <div className="text-gray-500">No recent records.</div>
              ) : (
                <div className="space-y-2">
                  {recent.map(r => (
                    <div key={r.id} className="text-sm text-gray-700">
                      <span className="font-mono">{r.ip}:{r.port}</span>
                      <span className="ml-2">{r.protocol.toUpperCase()} • {r.state}</span>
                      {r.service && <span className="ml-2">• {r.service}</span>}
                      {r.product && <span className="ml-2">• {r.product}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}


