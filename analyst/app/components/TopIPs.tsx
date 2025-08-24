'use client'

import { useEffect, useState } from 'react'
import { DashboardStats as DashboardStatsType } from '../../types/database'
import { GlobeAltIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

export function TopIPs() {
  const [stats, setStats] = useState<DashboardStatsType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/dashboard/stats')
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats')
      }
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      toast.error('Failed to load top IPs')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Most Scanned IPs
        </h3>
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-4 w-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </div>
              <div className="h-4 bg-gray-200 rounded w-16"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!stats || stats.top_ips.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Most Scanned IPs
        </h3>
        <div className="text-center text-gray-500 py-8">
          <GlobeAltIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No IP data found</p>
        </div>
      </div>
    )
  }

  const maxCount = Math.max(...stats.top_ips.map(ip => ip.count))

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Most Scanned IPs
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.top_ips.slice(0, 9).map((ip, index) => {
          const percentage = (ip.count / maxCount) * 100
          return (
            <div
              key={`${ip.ip}-${index}`}
              className="bg-gray-50 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-mono text-gray-900 truncate">
                  {ip.ip}
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  #{index + 1}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">
                    {ip.count.toLocaleString()} scans
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-nweb-green-500 h-2 rounded-full"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
