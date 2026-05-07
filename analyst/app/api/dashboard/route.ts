import { NextRequest, NextResponse } from 'next/server'
import { APIError, getDashboardStats, logAPIError } from '../../../lib/api'

export async function GET(request: NextRequest) {
  try {
    const stats = await getDashboardStats()
    return NextResponse.json(stats)
  } catch (error) {
    logAPIError('Dashboard API failed', error)
    const status = error instanceof APIError ? error.statusCode : 500
    return NextResponse.json(
      {
        error: error instanceof APIError ? error.message : 'Internal server error',
        code: error instanceof APIError ? error.code : 'INTERNAL_ERROR',
      },
      { status }
    )
  }
}
