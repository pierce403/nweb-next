import { NextRequest, NextResponse } from 'next/server'
import { getSubmissions, APIError, logAPIError } from '../../../lib/api'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInteger(searchParams.get('limit'), 50), 200)
    const offset = parseInteger(searchParams.get('offset'), 0)
    const status = searchParams.get('status') || undefined

    const submissions = await getSubmissions({
      limit,
      offset,
      status: isSubmissionStatus(status) ? status : undefined,
    })

    return NextResponse.json({
      submissions: submissions.map((submission) => ({
        ...submission,
        extra: decodeExtra(submission.extra),
      })),
      limit,
      offset,
    })
  } catch (error) {
    logAPIError('Submissions API failed', error)
    const status = error instanceof APIError ? error.statusCode : 500
    return NextResponse.json(
      {
        error: error instanceof APIError ? error.message : 'Failed to fetch submissions',
        code: error instanceof APIError ? error.code : 'INTERNAL_ERROR',
      },
      { status },
    )
  }
}

function parseInteger(value: string | null, fallback: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback
}

function isSubmissionStatus(value: string | undefined): value is 'pending' | 'processing' | 'completed' | 'failed' {
  return value === 'pending' || value === 'processing' || value === 'completed' || value === 'failed'
}

function decodeExtra(value: unknown): unknown {
  if (Buffer.isBuffer(value)) {
    try {
      return JSON.parse(value.toString('utf8')) as unknown
    } catch {
      return {}
    }
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown
    } catch {
      return {}
    }
  }
  return value ?? {}
}
