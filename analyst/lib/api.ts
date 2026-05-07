import { sql, type Selectable } from 'kysely'
import { getDatabase } from './database'
import type {
  Submission,
  Record as DBRecord,
  SubmissionWithStats,
  DashboardStats,
  IndexerState
} from '../types/database'

export class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = statusCode === 503 ? 'SERVICE_UNAVAILABLE' : 'API_ERROR',
  ) {
    super(message)
    this.name = 'APIError'
  }
}

type ErrorLike = {
  code?: string
  errno?: number
  syscall?: string
  hostname?: string
  address?: string
  port?: number
  cause?: unknown
}

const databaseConnectionCodes = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  '28P01',
  '3D000',
  '53300',
  '57P01',
  '57P03',
])

export function isDatabaseConnectionError(error: unknown): boolean {
  const details = getErrorDetails(error)
  if (details.code && databaseConnectionCodes.has(details.code)) {
    return true
  }
  const message = error instanceof Error ? error.message : String(error)
  return /getaddrinfo|connect ECONN|timeout|terminating connection|too many connections/i.test(message)
}

export function toAPIError(error: unknown, fallbackMessage: string): APIError {
  if (error instanceof APIError) {
    return error
  }
  if (isDatabaseConnectionError(error)) {
    return new APIError(
      503,
      'Database is unavailable. Check POSTGRES_URL, DNS, and network access.',
      'DATABASE_UNAVAILABLE',
    )
  }
  return new APIError(500, fallbackMessage)
}

export function logAPIError(context: string, error: unknown): void {
  const details = getErrorDetails(error)
  if (error instanceof APIError) {
    console.warn(context, {
      code: error.code,
      statusCode: error.statusCode,
      message: error.message,
    })
    return
  }
  if (isDatabaseConnectionError(error)) {
    console.warn(context, {
      code: details.code,
      errno: details.errno,
      syscall: details.syscall,
      hostname: details.hostname,
      address: details.address,
      port: details.port,
      message: error instanceof Error ? error.message : String(error),
    })
    return
  }
  console.error(context, error)
}

function getErrorDetails(error: unknown): ErrorLike {
  if (!error || typeof error !== 'object') {
    return {}
  }
  const current = error as ErrorLike
  const cause = getErrorDetails(current.cause)
  return {
    code: current.code ?? cause.code,
    errno: current.errno ?? cause.errno,
    syscall: current.syscall ?? cause.syscall,
    hostname: current.hostname ?? cause.hostname,
    address: current.address ?? cause.address,
    port: current.port ?? cause.port,
  }
}

// Dashboard statistics
export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const db = await getDatabase()

    // Get basic counts
    const [submissionStats, recordStats, ipStats, serviceStats] = await Promise.all([
      db.selectFrom('submissions')
        .select([
          'status',
          sql<number>`count(*)`.as('count')
        ])
        .groupBy('status')
        .execute(),

      db.selectFrom('records')
        .select(sql<number>`count(*)`.as('total'))
        .executeTakeFirst(),

      db.selectFrom('records')
        .select(sql<number>`count(distinct ip)`.as('unique_ips'))
        .executeTakeFirst(),

      db.selectFrom('records')
        .select(sql<number>`count(distinct service)`.as('unique_services'))
        .where('service', 'is not', null)
        .executeTakeFirst(),
    ])

    // Get submissions by status
    const submissionsByStatus = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    }

    submissionStats.forEach(stat => {
      submissionsByStatus[stat.status as keyof typeof submissionsByStatus] = Number(stat.count)
    })

    // Get recent activity (last 7 days)
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60)
    const recentActivity = await db.selectFrom('records')
      .select([
        sql<string>`date(datetime(timestamp, 'unixepoch'))`.as('date'),
        sql<number>`count(*)`.as('records')
      ])
      .where('timestamp', '>=', sevenDaysAgo)
      .groupBy(sql`date(datetime(timestamp, 'unixepoch'))`)
      .orderBy('date', 'desc')
      .execute()

    // Get top services
    const topServices = await db.selectFrom('records')
      .select([
        'service',
        sql<number>`count(*)`.as('count')
      ])
      .where('service', 'is not', null)
      .groupBy('service')
      .orderBy('count', 'desc')
      .limit(10)
      .execute()

    // Get top IPs
    const topIPs = await db.selectFrom('records')
      .select([
        'ip',
        sql<number>`count(*)`.as('count')
      ])
      .groupBy('ip')
      .orderBy('count', 'desc')
      .limit(10)
      .execute()

    // Get submissions activity
    const submissionsActivity = await db.selectFrom('submissions')
      .select([
        sql<string>`date(datetime(timestamp, 'unixepoch'))`.as('date'),
        sql<number>`count(*)`.as('submissions')
      ])
      .where('timestamp', '>=', sevenDaysAgo)
      .groupBy(sql`date(datetime(timestamp, 'unixepoch'))`)
      .orderBy('date', 'desc')
      .execute()

    // Combine records and submissions activity
    const activityMap = new Map()
    recentActivity.forEach(item => {
      activityMap.set(item.date, { records: Number(item.records), submissions: 0 })
    })
    submissionsActivity.forEach(item => {
      const existing = activityMap.get(item.date) || { records: 0, submissions: 0 }
      activityMap.set(item.date, { ...existing, submissions: Number(item.submissions) })
    })

    const recent_activity = Array.from(activityMap.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => b.date.localeCompare(a.date))

    return {
      total_submissions: Object.values(submissionsByStatus).reduce((a, b) => a + b, 0),
      total_records: Number(recordStats?.total || 0),
      unique_ips: Number(ipStats?.unique_ips || 0),
      unique_services: Number(serviceStats?.unique_services || 0),
      submissions_by_status: submissionsByStatus,
      recent_activity,
      top_services: topServices.map(s => ({ service: s.service || 'Unknown', count: Number(s.count) })),
      top_ips: topIPs.map(ip => ({ ip: ip.ip, count: Number(ip.count) })),
    }
  } catch (error) {
    throw toAPIError(error, 'Failed to fetch dashboard statistics')
  }
}

// Submissions
export async function getSubmissions({
  limit = 50,
  offset = 0,
  status,
  submitter,
  sortBy = 'timestamp',
  sortOrder = 'desc',
}: {
  limit?: number
  offset?: number
  status?: Submission['status']
  submitter?: string
  sortBy?: 'timestamp' | 'processed_at' | 'created_at' | 'submitter'
  sortOrder?: 'asc' | 'desc'
} = {}): Promise<SubmissionWithStats[]> {
  try {
    const db = await getDatabase()
    let query = db.selectFrom('submissions')
      .selectAll()
      .limit(limit)
      .offset(offset)

    if (status) {
      query = query.where('status', '=', status)
    }

    if (submitter) {
      query = query.where('submitter', '=', submitter)
    }

    // Add record count subqueries
    query = query.select([
      sql<number>`(
        select count(*) from records where records.submission_uid = submissions.uid
      )`.as('record_count'),
      sql<number>`(
        select count(distinct ip) from records where records.submission_uid = submissions.uid
      )`.as('unique_ips'),
      sql<number>`(
        select count(distinct port) from records where records.submission_uid = submissions.uid
      )`.as('unique_ports'),
      sql<string>`(
        select min(ip) from records where records.submission_uid = submissions.uid
      )`.as('primary_ip'),
    ] as any)

    const validSortFields = ['timestamp', 'processed_at', 'created_at', 'submitter'] as const
    if ((validSortFields as readonly string[]).includes(sortBy)) {
      query = query.orderBy(sortBy, sortOrder)
    } else {
      query = query.orderBy('timestamp', 'desc')
    }

    const results = await query.execute()
    return results as SubmissionWithStats[]
  } catch (error) {
    throw toAPIError(error, 'Failed to fetch submissions')
  }
}

export async function getSubmission(uid: string): Promise<SubmissionWithStats | null> {
  try {
    const db = await getDatabase()
    const result = await db.selectFrom('submissions')
      .selectAll()
      .select([
        sql<number>`(
          select count(*) from records where records.submission_uid = submissions.uid
        )`.as('record_count'),
        sql<number>`(
          select count(distinct ip) from records where records.submission_uid = submissions.uid
        )`.as('unique_ips'),
        sql<number>`(
          select count(distinct port) from records where records.submission_uid = submissions.uid
        )`.as('unique_ports'),
      ] as any)
      .where('uid', '=', uid)
      .executeTakeFirst()

    return result as SubmissionWithStats | null
  } catch (error) {
    throw toAPIError(error, 'Failed to fetch submission')
  }
}

// Records
export async function getRecords({
  limit = 100,
  offset = 0,
  ip,
  port,
  service,
  submission_uid,
  sortBy = 'timestamp',
  sortOrder = 'desc',
}: {
  limit?: number
  offset?: number
  ip?: string
  port?: number
  service?: string
  submission_uid?: string
  sortBy?: 'timestamp' | 'ip' | 'port' | 'service'
  sortOrder?: 'asc' | 'desc'
} = {}): Promise<Selectable<DBRecord>[]> {
  try {
    const db = await getDatabase()
    let query = db.selectFrom('records')
      .selectAll()
      .limit(Math.min(limit, 1000)) // Cap at 1000
      .offset(offset)

    if (ip) {
      query = query.where('ip', '=', ip)
    }

    if (port) {
      query = query.where('port', '=', port)
    }

    if (service) {
      query = query.where('service', '=', service)
    }

    if (submission_uid) {
      query = query.where('submission_uid', '=', submission_uid)
    }

    const validSortFields = ['timestamp', 'ip', 'port', 'service'] as const
    if ((validSortFields as readonly string[]).includes(sortBy)) {
      query = query.orderBy(sortBy, sortOrder)
    } else {
      query = query.orderBy('timestamp', 'desc')
    }

    return await query.execute()
  } catch (error) {
    throw toAPIError(error, 'Failed to fetch records')
  }
}

export async function getRecord(id: number): Promise<Selectable<DBRecord> | null> {
  try {
    const db = await getDatabase()
    const row = await db.selectFrom('records')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
    return row ?? null
  } catch (error) {
    throw toAPIError(error, 'Failed to fetch record')
  }
}

// Search functionality
export async function searchIPs(query: string, limit = 20): Promise<Array<{ip: string, count: number}>> {
  try {
    const db = await getDatabase()
    return await db.selectFrom('records')
      .select([
        'ip',
        sql<number>`count(*)`.as('count')
      ])
      .where('ip', 'like', `%${query}%`)
      .groupBy('ip')
      .orderBy('count', 'desc')
      .limit(limit)
      .execute()
  } catch (error) {
    throw toAPIError(error, 'Failed to search IPs')
  }
}

export async function searchServices(query: string, limit = 20): Promise<Array<{service: string, count: number}>> {
  try {
    const db = await getDatabase()
    const rows = await db.selectFrom('records')
      .select([
        'service',
        sql<number>`count(*)`.as('count')
      ])
      .where('service', 'like', `%${query}%`)
      .where('service', 'is not', null)
      .groupBy('service')
      .orderBy('count', 'desc')
      .limit(limit)
      .execute()
    return rows.map(r => ({ service: r.service || 'Unknown', count: Number(r.count) }))
  } catch (error) {
    throw toAPIError(error, 'Failed to search services')
  }
}

// Indexer state
export async function getIndexerState(): Promise<IndexerState | null> {
  try {
    const db = await getDatabase()
    const row = await db.selectFrom('indexer_state')
      .selectAll()
      .executeTakeFirst()
    return row ?? null
  } catch (error) {
    logAPIError('Indexer state query failed', error)
    return null
  }
}
