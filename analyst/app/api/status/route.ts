import { NextRequest, NextResponse } from 'next/server'
import { getDashboardStats, logAPIError } from '../../../lib/api'

const DEFAULT_DISPATCHER_URL = 'http://127.0.0.1:7778'

export async function GET(request: NextRequest) {
  try {
    let databaseInfo = {
      connected: false,
      type: 'Unknown',
      stats: null as any
    }

    try {
      const stats = await getDashboardStats()
      databaseInfo = {
        connected: true,
        type: process.env.POSTGRES_URL ? 'PostgreSQL' : 'SQLite',
        stats: {
          submissions: stats.total_submissions,
          records: stats.total_records,
          unique_ips: stats.unique_ips,
          unique_services: stats.unique_services
        }
      }
    } catch (error) {
      logAPIError('Status database check failed', error)
      // Database not connected
      databaseInfo = {
        connected: false,
        type: 'Not Connected',
        stats: null
      }
    }

    const dispatcherInfo = {
      configured: true,
      reachable: false,
      url: getDispatcherUrl()
    }

    try {
      const response = await fetch(`${dispatcherInfo.url}/health`, { cache: 'no-store' })
      dispatcherInfo.reachable = response.ok
    } catch {
      dispatcherInfo.reachable = false
    }

    const systemInfo = {
      version: '1.0.0',
      uptime: process.uptime().toFixed(2) + 's'
    }

    return NextResponse.json({
      database: databaseInfo,
      dispatcher: dispatcherInfo,
      system: systemInfo
    })

  } catch (error) {
    console.error('Status API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function getDispatcherUrl(): string {
  return (process.env.DISPATCHER_URL ?? DEFAULT_DISPATCHER_URL).replace(/\/+$/, '')
}
