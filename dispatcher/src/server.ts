import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { buildRandomIpv4WorkItems } from './random-ipv4.js'
import { loadWorkFile, filterWork, WorkFileError } from './work.js'
import { addDomainTarget, loadTargetQueue, targetRequestsToWorkItems } from './targets.js'
import type { GetWorkResponse } from './types.js'

const port = readPort(process.env.PORT, 7778)
const host = process.env.HOST ?? '127.0.0.1'
const workFilePath = process.env.DISPATCHER_WORK_FILE
const targetsFilePath = process.env.DISPATCHER_TARGETS_FILE

const server = createServer(async (request, response) => {
  try {
    await route(request, response)
  } catch (error) {
    const status = error instanceof WorkFileError ? 400 : 500
    sendJson(response, status, {
      error: 'dispatcher_error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

server.listen(port, host, () => {
  console.log(`nweb dispatcher listening on http://${host}:${port}`)
})

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (!request.url) {
    sendJson(response, 400, { error: 'missing_url' })
    return
  }

  const url = new URL(request.url, `http://${request.headers.host ?? `${host}:${port}`}`)

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, null)
    return
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, {
      ok: true,
      service: 'nweb-dispatcher',
      generatedAt: new Date().toISOString(),
    })
    return
  }

  if (request.method === 'GET' && url.pathname === '/targets') {
    const queue = await loadTargetQueue(targetsFilePath)
    sendJson(response, 200, queue)
    return
  }

  if (request.method === 'POST' && url.pathname === '/targets') {
    const body = await readJson(request)
    const result = await addDomainTarget(body, targetsFilePath)
    sendJson(response, 201, {
      target: result.target,
      count: result.queue.targets.length,
    })
    return
  }

  if (request.method === 'GET' && url.pathname === '/getwork') {
    const randomMode = optionalParam(url, 'random')
    if (randomMode && randomMode !== 'ipv4') {
      throw new WorkFileError('random must be ipv4 when provided')
    }

    const workFile = await loadWorkFile(workFilePath)
    const queue = await loadTargetQueue(targetsFilePath)
    const limit = parseLimit(url.searchParams.get('limit'))
    const profile = optionalParam(url, 'profile')
    const queuedWork = filterWork(targetRequestsToWorkItems(queue.targets), {
      profile,
      label: optionalParam(url, 'label'),
      limit,
    })
    const remainingLimit = limit === undefined ? undefined : Math.max(limit - queuedWork.length, 0)
    const fallbackWork = remainingLimit === 0
      ? []
      : randomMode === 'ipv4'
        ? buildRandomIpv4WorkItems({ count: remainingLimit ?? 1, profile })
        : filterWork(workFile.work, {
          profile,
          label: optionalParam(url, 'label'),
          limit: remainingLimit,
        })
    const work = [...queuedWork, ...fallbackWork]

    const payload: GetWorkResponse = {
      version: workFile.version,
      dispatcher: workFile.dispatcher,
      generatedAt: new Date().toISOString(),
      count: work.length,
      work,
    }

    sendJson(response, 200, payload)
    return
  }

  sendJson(response, 404, {
    error: 'not_found',
    routes: [
      'GET /health',
      'GET /targets',
      'POST /targets',
      'GET /getwork?profile=quick&label=local&limit=10',
      'GET /getwork?random=ipv4&limit=1',
    ],
  })
}

function optionalParam(url: URL, key: string): string | undefined {
  const value = url.searchParams.get(key)
  return value && value.trim() ? value : undefined
}

function parseLimit(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
    throw new WorkFileError('limit must be an integer from 1 to 1000')
  }

  return parsed
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  })
  response.end(status === 204 ? '' : `${JSON.stringify(body, null, 2)}\n`)
}

function readPort(value: string | undefined, fallback: number): number {
  if (!value) return fallback

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535')
  }

  return parsed
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {}

  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new WorkFileError('request body must be valid JSON')
  }
}
