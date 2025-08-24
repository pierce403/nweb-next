import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '../../../lib/database'
import { sql } from 'kysely'
import { v4 as uuidv4 } from 'uuid'

interface ScanResult {
  uid: string
  submitter: string
  job_id: string
  namespace: string
  dataset_type: string
  cid: string
  merkle_root: string
  target_spec_cid: string
  started_at: number
  finished_at: number
  tool: string
  version: string
  vantage: string
  manifest_sha256: string
  extra: any
  timestamp: number
  processed_at?: string
  status: string
  error_message?: string
  created_at: string
  records: ScanRecord[]
}

interface ScanRecord {
  id?: number
  submission_uid: string
  timestamp: number
  ip: string
  port: number
  protocol: string
  state: string
  service?: string
  product?: string
  version?: string
  banner_sha256?: string
  cert_fpr?: string
  tls_ja3?: string
  latency_ms?: number
  tool: string
  tool_version: string
  options: string
  vantage: string
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase()

    // Parse the scan result from request body
    const scanResult: ScanResult = await request.json()

    // Insert submission
    await db.insertInto('submissions')
      .values(() => ({
        uid: scanResult.uid,
        submitter: scanResult.submitter,
        job_id: scanResult.job_id,
        namespace: scanResult.namespace,
        dataset_type: scanResult.dataset_type,
        cid: scanResult.cid,
        merkle_root: scanResult.merkle_root,
        target_spec_cid: scanResult.target_spec_cid,
        started_at: scanResult.started_at,
        finished_at: scanResult.finished_at,
        tool: scanResult.tool,
        version: scanResult.version,
        vantage: scanResult.vantage,
        manifest_sha256: scanResult.manifest_sha256,
        extra: Buffer.from(JSON.stringify(scanResult.extra ?? {})),
        timestamp: scanResult.timestamp,
        processed_at: scanResult.processed_at ? new Date(scanResult.processed_at) : new Date(),
        status: scanResult.status as any,
        error_message: scanResult.error_message || null,
        created_at: new Date(scanResult.created_at)
      }))
      .execute()

    // Insert records
    if (scanResult.records && scanResult.records.length > 0) {
      const recordsToInsert = scanResult.records.map(record => ({
        submission_uid: record.submission_uid,
        timestamp: record.timestamp,
        ip: record.ip,
        port: record.port,
        protocol: record.protocol,
        state: record.state,
        service: record.service || null,
        product: record.product || null,
        version: record.version || null,
        banner_sha256: record.banner_sha256 || null,
        cert_fpr: record.cert_fpr || null,
        tls_ja3: record.tls_ja3 || null,
        latency_ms: record.latency_ms || null,
        tool: record.tool,
        tool_version: record.tool_version,
        options: record.options,
        vantage: record.vantage
      }))

      // Insert records in batches to avoid SQL limits
      const batchSize = 100
      for (let i = 0; i < recordsToInsert.length; i += batchSize) {
        const batch = recordsToInsert.slice(i, i + batchSize)
        await db.insertInto('records')
          .values(batch)
          .execute()
      }
    }

    console.log(`✅ Successfully indexed scan result: ${scanResult.uid} with ${scanResult.records?.length || 0} records`)

    return NextResponse.json({
      success: true,
      message: 'Scan result indexed successfully',
      uid: scanResult.uid,
      records_count: scanResult.records?.length || 0
    })

  } catch (error) {
    console.error('Submit API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to index scan result',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Also support GET for documentation
export async function GET(request: NextRequest) {
  const documentation = {
    endpoint: '/api/submit',
    method: 'POST',
    description: 'Submit scan results for indexing into the database',
    format: {
      uid: 'string (unique identifier)',
      submitter: 'string (ethereum address)',
      job_id: 'string',
      namespace: 'string',
      dataset_type: 'string (e.g., "nmap-full", "nmap-top-1000")',
      cid: 'string (IPFS content identifier)',
      merkle_root: 'string (merkle root hash)',
      target_spec_cid: 'string (target specification CID)',
      started_at: 'number (unix timestamp)',
      finished_at: 'number (unix timestamp)',
      tool: 'string (e.g., "nmap", "masscan")',
      version: 'string (tool version)',
      vantage: 'string (geographic vantage point)',
      manifest_sha256: 'string (manifest hash)',
      extra: 'object (additional metadata)',
      timestamp: 'number (submission timestamp)',
      processed_at: 'string (optional, ISO date)',
      status: 'string (e.g., "completed", "failed")',
      error_message: 'string (optional, error description)',
      created_at: 'string (ISO date)',
      records: 'array of scan records'
    },
    record_format: {
      submission_uid: 'string',
      timestamp: 'number',
      ip: 'string',
      port: 'number',
      protocol: 'string (tcp/udp)',
      state: 'string (open/closed/filtered)',
      service: 'string (optional)',
      product: 'string (optional)',
      version: 'string (optional)',
      banner_sha256: 'string (optional)',
      cert_fpr: 'string (optional)',
      tls_ja3: 'string (optional)',
      latency_ms: 'number (optional)',
      tool: 'string',
      tool_version: 'string',
      options: 'string (JSON)',
      vantage: 'string'
    }
  }

  return NextResponse.json(documentation)
}
