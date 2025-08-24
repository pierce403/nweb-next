import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '../../../lib/database'
import { sql } from 'kysely'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ip = searchParams.get('h') || searchParams.get('ip')

    if (!ip) {
      return NextResponse.json({ error: 'Missing h (ip) param' }, { status: 400 })
    }

    const db = await getDatabase()

    // Summary facts
    const facts = await db
      .selectFrom('records')
      .select([ 'ip', sql<number>`count(*)`.as('records') ])
      .where('ip', '=', ip)
      .groupBy('ip')
      .executeTakeFirst()

    // Ports/services aggregated
    const ports = await db
      .selectFrom('records')
      .select([
        'port',
        'protocol',
        'state',
        'service',
        'product',
        'version',
        sql<number>`count(*)`.as('count')
      ])
      .where('ip', '=', ip)
      .groupBy('port')
      .groupBy('protocol')
      .groupBy('state')
      .groupBy('service')
      .groupBy('product')
      .groupBy('version')
      .orderBy('count', 'desc')
      .limit(200)
      .execute()

    // Recent rows
    const recent = await db
      .selectFrom('records')
      .selectAll()
      .where('ip', '=', ip)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .execute()

    // Submissions containing this IP
    const submissions = await db
      .selectFrom('submissions')
      .select([ 'uid', 'dataset_type', 'tool', 'version', 'timestamp' ])
      .where(eb => eb.exists(
        eb.selectFrom('records')
          .select(sql`1`)
          .whereRef('records.submission_uid', '=', 'submissions.uid')
          .where('records.ip', '=', ip)
      ))
      .orderBy('timestamp', 'desc')
      .limit(20)
      .execute()

    const summary = {
      ip,
      total_records: Number(facts?.records || 0),
      open_ports: ports.filter(p => p.state === 'open').map(p => p.port),
      unique_services: Array.from(new Set(ports.map(p => p.service).filter(Boolean))) as string[],
    }

    return NextResponse.json({ summary, ports, submissions, recent, ipfs: [] })
  } catch (error) {
    console.error('Host API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


