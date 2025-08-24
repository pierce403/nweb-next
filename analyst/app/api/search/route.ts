import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '../../../lib/database'

interface SearchResult {
  type: 'submission' | 'record' | 'ip' | 'service'
  id: string | number
  title: string
  subtitle?: string
  description?: string
  metadata?: Record<string, any>
  score?: number
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()
    const type = searchParams.get('type') || 'all'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    if (!query) {
      return NextResponse.json({
        query: '',
        total: 0,
        results: [],
        took: 0
      })
    }

    const db = await getDatabase()
    const startTime = Date.now()

    const results: SearchResult[] = []

    // Search submissions
    if (type === 'all' || type === 'submissions') {
      try {
        // Use separate queries for each field to work with mock database
        const submissionQueries = [
          db.selectFrom('submissions').selectAll().where('submitter', 'like', `%${query}%`).limit(limit),
          db.selectFrom('submissions').selectAll().where('job_id', 'like', `%${query}%`).limit(limit),
          db.selectFrom('submissions').selectAll().where('tool', 'like', `%${query}%`).limit(limit),
          db.selectFrom('submissions').selectAll().where('namespace', 'like', `%${query}%`).limit(limit)
        ]

        const submissionResults = []
        for (const queryObj of submissionQueries) {
          try {
            const results = await queryObj.execute()
            submissionResults.push(...results)
          } catch (error) {
            console.error('Submission query error:', error)
          }
        }

        // Remove duplicates
        const uniqueSubmissions = Array.from(new Map(submissionResults.map(s => [s.uid, s])).values())

        for (const submission of uniqueSubmissions) {
          results.push({
            type: 'submission',
            id: submission.uid,
            title: `${submission.tool} scan - ${submission.job_id}`,
            subtitle: `Submitter: ${submission.submitter}`,
            description: `${submission.dataset_type} scan completed at ${new Date(submission.finished_at * 1000).toLocaleString()}`,
            metadata: {
              status: submission.status,
              records: 'N/A', // Would need to join with records table
              tool: submission.tool,
              version: submission.version
            },
            score: calculateRelevance(query, [
              submission.submitter,
              submission.job_id,
              submission.tool,
              submission.namespace
            ])
          })
        }
      } catch (error) {
        console.error('Submission search error:', error)
      }
    }

    // Search records
    if (type === 'all' || type === 'records') {
      try {
        // Use separate queries for each field to work with mock database
        const recordQueries = [
          db.selectFrom('records').selectAll().where('ip', 'like', `%${query}%`).limit(limit),
          db.selectFrom('records').selectAll().where('service', 'like', `%${query}%`).limit(limit),
          db.selectFrom('records').selectAll().where('product', 'like', `%${query}%`).limit(limit)
        ]

        const recordResults = []
        for (const queryObj of recordQueries) {
          try {
            const results = await queryObj.execute()
            recordResults.push(...results)
          } catch (error) {
            console.error('Record query error:', error)
          }
        }

        // Remove duplicates
        const uniqueRecords = Array.from(new Map(recordResults.map(r => [r.id, r])).values())

        for (const record of uniqueRecords) {
          results.push({
            type: 'record',
            id: record.id,
            title: `${record.ip}:${record.port}`,
            subtitle: `${record.protocol.toUpperCase()} - ${record.state}`,
            description: record.service ? `${record.service} service detected` : 'Port scan result',
            metadata: {
              port: record.port,
              state: record.state,
              service: record.service,
              product: record.product,
              latency: record.latency_ms ? `${record.latency_ms}ms` : undefined
            },
            score: calculateRelevance(query, [
              record.ip,
              record.service || '',
              record.product || ''
            ])
          })
        }
      } catch (error) {
        console.error('Record search error:', error)
      }
    }

    // Search IPs (aggregated)
    if (type === 'all' || type === 'ips') {
      try {
        // For mock database compatibility, use simpler query
        const ipResults = await db
          .selectFrom('records')
          .select(['ip'])
          .where('ip', 'like', `%${query}%`)
          .limit(limit)
          .execute()

        // Count occurrences manually for each IP
        const ipCounts = new Map<string, number>()
        for (const record of ipResults) {
          ipCounts.set(record.ip, (ipCounts.get(record.ip) || 0) + 1)
        }

        const uniqueIpResults = Array.from(ipCounts.entries())
          .map(([ip, count]) => ({ ip, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit)

        for (const ipResult of uniqueIpResults) {
          results.push({
            type: 'ip',
            id: ipResult.ip,
            title: ipResult.ip,
            subtitle: `${ipResult.count} scan records`,
            description: `IP address found in scan data`,
            metadata: {
              total_scans: ipResult.count,
              link: `/host?h=${encodeURIComponent(ipResult.ip)}`
            },
            score: query === ipResult.ip ? 1.0 : 0.8
          })
        }
      } catch (error) {
        console.error('IP search error:', error)
      }
    }

    // Search services (aggregated)
    if (type === 'all' || type === 'services') {
      try {
        // For mock database compatibility, use simpler query
        const serviceResults = await db
          .selectFrom('records')
          .select(['service'])
          .where('service', 'like', `%${query}%`)
          .limit(limit * 10) // Get more to allow for counting
          .execute()

        // Count occurrences manually for each service
        const serviceCounts = new Map<string, number>()
        for (const record of serviceResults) {
          if (record.service) {
            serviceCounts.set(record.service, (serviceCounts.get(record.service) || 0) + 1)
          }
        }

        const uniqueServiceResults = Array.from(serviceCounts.entries())
          .map(([service, count]) => ({ service, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit)

        for (const serviceResult of uniqueServiceResults) {
          results.push({
            type: 'service',
            id: serviceResult.service,
            title: serviceResult.service,
            subtitle: `${serviceResult.count} detections`,
            description: `Service found in scan data`,
            metadata: {
              total_detections: serviceResult.count
            },
            score: query.toLowerCase() === serviceResult.service.toLowerCase() ? 1.0 : 0.9
          })
        }
      } catch (error) {
        console.error('Service search error:', error)
      }
    }

    // Sort results by relevance score
    results.sort((a, b) => (b.score || 0) - (a.score || 0))

    // Limit total results
    const finalResults = results.slice(0, limit)

    const endTime = Date.now()
    const took = endTime - startTime

    return NextResponse.json({
      query,
      total: finalResults.length,
      results: finalResults,
      took
    })

  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      {
        query: '',
        total: 0,
        results: [],
        took: 0,
        error: 'Search failed'
      },
      { status: 500 }
    )
  }
}

// Calculate relevance score based on how well the query matches the data
function calculateRelevance(query: string, fields: string[]): number {
  const queryLower = query.toLowerCase()
  let score = 0

  for (const field of fields) {
    if (!field) continue

    const fieldLower = field.toLowerCase()

    // Exact match gets highest score
    if (fieldLower === queryLower) {
      score = Math.max(score, 1.0)
      continue
    }

    // Starts with query gets high score
    if (fieldLower.startsWith(queryLower)) {
      score = Math.max(score, 0.9)
      continue
    }

    // Contains query gets medium score
    if (fieldLower.includes(queryLower)) {
      score = Math.max(score, 0.7)
      continue
    }

    // Similar words get lower score
    const queryWords = queryLower.split(/\s+/)
    const fieldWords = fieldLower.split(/\s+/)

    for (const qWord of queryWords) {
      for (const fWord of fieldWords) {
        if (fWord.includes(qWord) || qWord.includes(fWord)) {
          score = Math.max(score, 0.5)
        }
      }
    }
  }

  return score
}
