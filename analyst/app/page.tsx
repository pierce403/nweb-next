import { Suspense } from 'react'
import { DashboardStats } from './components/DashboardStats'
import { RecentActivity } from './components/RecentActivity'
import { TopServices } from './components/TopServices'
import { TopIPs } from './components/TopIPs'
import { StatsSkeleton } from './components/Skeletons'

export default function Dashboard() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Overview of scan data and recent activity
        </p>
      </div>

      {/* Stats Cards */}
      <Suspense fallback={<StatsSkeleton />}>
        <DashboardStats />
      </Suspense>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <div className="card">
          <Suspense fallback={
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          }>
            <RecentActivity />
          </Suspense>
        </div>

        {/* Top Services */}
        <div className="card">
          <Suspense fallback={
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          }>
            <TopServices />
          </Suspense>
        </div>
      </div>

      {/* Top IPs */}
      <div className="card">
        <Suspense fallback={
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        }>
          <TopIPs />
        </Suspense>
      </div>
    </div>
  )
}
