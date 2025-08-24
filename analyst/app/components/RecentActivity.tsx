'use client'

import { useEffect, useState } from 'react'
import { DashboardStats as DashboardStatsType } from '../../types/database'
import { format, parseISO } from 'date-fns'
import { ChartBarIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

export function RecentActivity() {
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
      toast.error('Failed to load recent activity')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Recent Activity
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

  if (!stats || stats.recent_activity.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Recent Activity
        </h3>
        <div className="text-center text-gray-500 py-8">
          <ChartBarIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No recent activity</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Recent Activity (Last 7 Days)
      </h3>
      <div className="space-y-3">
        {stats.recent_activity.map((activity, index) => (
          <div
            key={`${activity.date}-${index}`}
            className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
          >
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="w-2 h-2 bg-nweb-blue-500 rounded-full"></div>
              </div>
              <div className="text-sm font-medium text-gray-900">
                {format(parseISO(activity.date), 'MMM dd')}
              </div>
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span>{activity.submissions.toLocaleString()} submissions</span>
              <span>{activity.records.toLocaleString()} records</span>
            </div>
          </div>
        ))}
      </div>
      {stats.recent_activity.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          <ChartBarIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No recent activity found</p>
        </div>
      )}
    </div>
  )
}
