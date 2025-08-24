'use client'

import { useEffect, useState } from 'react'
import { DashboardStats as DashboardStatsType } from '../../types/database'
import { ServerIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

export function TopServices() {
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
      toast.error('Failed to load top services')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Top Services
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

  if (!stats || stats.top_services.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Top Services
        </h3>
        <div className="text-center text-gray-500 py-8">
          <ServerIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No services found</p>
        </div>
      </div>
    )
  }

  const maxCount = Math.max(...stats.top_services.map(s => s.count))

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Top Services
      </h3>
      <div className="space-y-3">
        {stats.top_services.slice(0, 10).map((service, index) => {
          const percentage = (service.count / maxCount) * 100
          return (
            <div
              key={`${service.service}-${index}`}
              className="flex items-center justify-between py-2"
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="flex-shrink-0 w-6 text-sm font-medium text-gray-600">
                  #{index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {service.service}
                  </p>
                  <div className="mt-1">
                    <div className="flex items-center">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-nweb-blue-500 h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0 ml-4">
                <span className="text-sm font-medium text-gray-600">
                  {service.count.toLocaleString()}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
