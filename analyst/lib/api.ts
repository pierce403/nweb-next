import { sql } from 'kysely'
import { getDatabase } from './database'
import type {
  Submission,
  Record,
  SubmissionWithStats,
  DashboardStats,
  IndexerState
} from '../types/database'

export class APIError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
    this.name = 'APIError'
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
    console.error('Error fetching dashboard stats:', error)
    throw new APIError(500, 'Failed to fetch dashboard statistics')
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
  status?: string
  submitter?: string
  sortBy?: string
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

    // Add record count subquery
    query = query.select([
      ...Object.keys(db.selectFrom('submissions').selectAll().compile().columns || []),
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

    const validSortFields = ['timestamp', 'processed_at', 'created_at', 'submitter']
    if (validSortFields.includes(sortBy)) {
      query = query.orderBy(sortBy, sortOrder)
    } else {
      query = query.orderBy('timestamp', 'desc')
    }

    const results = await query.execute()
    return results as SubmissionWithStats[]
  } catch (error) {
    console.error('Error fetching submissions:', error)
    throw new APIError(500, 'Failed to fetch submissions')
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
    console.error('Error fetching submission:', error)
    throw new APIError(500, 'Failed to fetch submission')
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
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
} = {}): Promise<Record[]> {
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

    const validSortFields = ['timestamp', 'ip', 'port', 'service']
    if (validSortFields.includes(sortBy)) {
      query = query.orderBy(sortBy, sortOrder)
    } else {
      query = query.orderBy('timestamp', 'desc')
    }

    return await query.execute()
  } catch (error) {
    console.error('Error fetching records:', error)
    throw new APIError(500, 'Failed to fetch records')
  }
}

export async function getRecord(id: number): Promise<Record | null> {
  try {
    const db = await getDatabase()
    return await db.selectFrom('records')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
  } catch (error) {
    console.error('Error fetching record:', error)
    throw new APIError(500, 'Failed to fetch record')
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
    console.error('Error searching IPs:', error)
    throw new APIError(500, 'Failed to search IPs')
  }
}

export async function searchServices(query: string, limit = 20): Promise<Array<{service: string, count: number}>> {
  try {
    const db = await getDatabase()
    return await db.selectFrom('records')
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
  } catch (error) {
    console.error('Error searching services:', error)
    throw new APIError(500, 'Failed to search services')
  }
}

// Indexer state
export async function getIndexerState(): Promise<IndexerState | null> {
  try {
    const db = await getDatabase()
    return await db.selectFrom('indexer_state')
      .selectAll()
      .executeTakeFirst()
  } catch (error) {
    console.error('Error fetching indexer state:', error)
    return null
  }
}
