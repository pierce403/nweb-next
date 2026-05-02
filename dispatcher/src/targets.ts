import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { TargetQueueFile, TargetRequest, WorkItem } from './types.js'
import { WorkFileError } from './work.js'

const domainPattern = /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/
const validProfiles = new Set(['quick', 'top-100', 'top-1000', 'full'])

export function defaultTargetsPath(): string {
  return resolve(process.cwd(), 'work', 'targets.json')
}

export async function loadTargetQueue(path = defaultTargetsPath()): Promise<TargetQueueFile> {
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    return validateTargetQueue(parsed, path)
  } catch (error) {
    if (isNotFound(error)) {
      return { version: 1, updatedAt: new Date(0).toISOString(), targets: [] }
    }
    throw error
  }
}

export async function addDomainTarget(
  input: unknown,
  path = defaultTargetsPath(),
): Promise<{ target: TargetRequest; queue: TargetQueueFile }> {
  if (!isRecord(input)) {
    throw new WorkFileError('target request must be a JSON object')
  }

  const domain = normalizeDomain(input.domain)
  const profile = normalizeProfile(input.profile)
  const priority = normalizePriority(input.priority)
  const withAssets = input.withAssets === undefined ? false : requireBoolean(input.withAssets, 'withAssets')
  const notes = optionalString(input.notes, 'notes')
  const now = new Date().toISOString()
  const target: TargetRequest = {
    id: buildTargetId(domain, now),
    domain,
    profile,
    priority,
    withAssets,
    ...(notes ? { notes } : {}),
    source: 'analyst',
    createdAt: now,
  }

  const queue = await loadTargetQueue(path)
  const filtered = queue.targets.filter(item => item.domain !== domain || item.profile !== profile)
  const updated: TargetQueueFile = {
    version: 1,
    updatedAt: now,
    targets: [target, ...filtered].sort(sortTargets),
  }
  await saveTargetQueue(updated, path)
  return { target, queue: updated }
}

export function targetRequestsToWorkItems(targets: TargetRequest[]): WorkItem[] {
  return [...targets].sort(sortTargets).map(target => ({
    id: target.id,
    description: `Analyst-prioritized domain target: ${target.domain}`,
    targets: [`host:${target.domain}`],
    profile: target.profile,
    withAssets: target.withAssets,
    priority: target.priority,
    policy: {
      rateLimit: 'polite',
      respectOptOut: true,
      ...(target.notes ? { notes: target.notes } : {}),
    },
    labels: ['analyst', 'domain', 'priority'],
  }))
}

export function normalizeDomain(value: unknown): string {
  if (typeof value !== 'string') {
    throw new WorkFileError('domain must be a string')
  }

  const domain = value.trim().toLowerCase().replace(/\.$/, '')
  if (domain.includes('://') || domain.includes('/') || domain.includes(':')) {
    throw new WorkFileError('domain must not include a scheme, path, or port')
  }
  if (!domainPattern.test(domain)) {
    throw new WorkFileError('domain must be a valid DNS hostname')
  }
  return domain
}

function normalizeProfile(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'quick'
  const profile = requireString(value, 'profile')
  if (!validProfiles.has(profile)) {
    throw new WorkFileError(`profile must be one of: ${Array.from(validProfiles).join(', ')}`)
  }
  return profile
}

function normalizePriority(value: unknown): number {
  if (value === undefined || value === null || value === '') return 1000
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 10000) {
    throw new WorkFileError('priority must be an integer from 1 to 10000')
  }
  return value
}

function validateTargetQueue(value: unknown, path: string): TargetQueueFile {
  if (!isRecord(value)) {
    throw new WorkFileError(`${path} must contain a JSON object`)
  }
  if (!Array.isArray(value.targets)) {
    throw new WorkFileError('targets must be an array')
  }
  return {
    version: 1,
    updatedAt: optionalString(value.updatedAt, 'updatedAt') ?? new Date(0).toISOString(),
    targets: value.targets.map((item, index) => validateTargetRequest(item, `targets[${index}]`)).sort(sortTargets),
  }
}

function validateTargetRequest(value: unknown, path: string): TargetRequest {
  if (!isRecord(value)) {
    throw new WorkFileError(`${path} must be an object`)
  }

  const source = optionalString(value.source, `${path}.source`) ?? 'analyst'
  if (source !== 'analyst') {
    throw new WorkFileError(`${path}.source must be analyst`)
  }

  const notes = optionalString(value.notes, `${path}.notes`)
  return {
    id: optionalString(value.id, `${path}.id`) ?? buildTargetId(normalizeDomain(value.domain), new Date(0).toISOString()),
    domain: normalizeDomain(value.domain),
    profile: normalizeProfile(value.profile),
    priority: normalizePriority(value.priority),
    withAssets: value.withAssets === undefined ? false : requireBoolean(value.withAssets, `${path}.withAssets`),
    ...(notes ? { notes } : {}),
    source,
    createdAt: optionalString(value.createdAt, `${path}.createdAt`) ?? new Date(0).toISOString(),
  }
}

function buildTargetId(domain: string, createdAt: string): string {
  const stamp = createdAt.replace(/\D/g, '').slice(0, 14)
  return `analyst-domain-${domain.replace(/[^a-z0-9]+/g, '-')}-${stamp}`
}

function sortTargets(a: TargetRequest, b: TargetRequest): number {
  return b.priority - a.priority || a.createdAt.localeCompare(b.createdAt) || a.domain.localeCompare(b.domain)
}

async function saveTargetQueue(queue: TargetQueueFile, path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(queue, null, 2)}\n`, 'utf8')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new WorkFileError(`${path} must be a non-empty string`)
  }
  return value
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return requireString(value, path)
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new WorkFileError(`${path} must be a boolean`)
  }
  return value
}

function isNotFound(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT'
}
