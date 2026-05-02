import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_DISPATCHER_URL = 'http://127.0.0.1:7778'

export async function GET() {
  try {
    const dispatcherUrl = getDispatcherUrl()
    const response = await fetch(`${dispatcherUrl}/targets`, { cache: 'no-store' })
    const body = await response.json().catch(() => null) as unknown

    return NextResponse.json(body, { status: response.status })
  } catch (error) {
    console.error('Targets API GET error:', error)
    return NextResponse.json(
      { error: 'dispatcher_unreachable', message: 'Dispatcher target queue is not reachable' },
      { status: 502 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const dispatcherUrl = getDispatcherUrl()
    const body = await request.json() as unknown
    const response = await fetch(`${dispatcherUrl}/targets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const payload = await response.json().catch(() => null) as unknown

    return NextResponse.json(payload, { status: response.status })
  } catch (error) {
    console.error('Targets API POST error:', error)
    return NextResponse.json(
      { error: 'dispatcher_unreachable', message: 'Dispatcher target queue is not reachable' },
      { status: 502 },
    )
  }
}

function getDispatcherUrl(): string {
  return (process.env.DISPATCHER_URL ?? DEFAULT_DISPATCHER_URL).replace(/\/+$/, '')
}
