import { NextRequest, NextResponse } from 'next/server'
import { getDashboardStats } from '../../../../lib/api'

export async function GET(request: NextRequest) {
  try {
    const stats = await getDashboardStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Dashboard stats API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
