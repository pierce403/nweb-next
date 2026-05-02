import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { WorkFile, WorkItem } from './types.js'

const allowedTargetPrefixes = new Set(['ip', 'host', 'cidr', 'asn', 'cid', 'file'])

export class WorkFileError extends Error {}

export function defaultWorkPath(): string {
  return resolve(process.cwd(), 'work', 'default.json')
}

export async function loadWorkFile(path = defaultWorkPath()): Promise<WorkFile> {
  const raw = await readFile(path, 'utf8')
  const parsed = JSON.parse(raw) as unknown
  return validateWorkFile(parsed, path)
}

export function filterWork(
  work: WorkItem[],
  filters: { profile?: string; label?: string; limit?: number },
): WorkItem[] {
  let filtered = [...work]

  if (filters.profile) {
    filtered = filtered.filter(item => item.profile === filters.profile)
  }

  if (filters.label) {
    const label = filters.label
    filtered = filtered.filter(item => item.labels?.includes(label))
  }

  filtered.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))

  if (filters.limit !== undefined) {
    filtered = filtered.slice(0, filters.limit)
  }

  return filtered
}

function validateWorkFile(value: unknown, path: string): WorkFile {
  if (!isRecord(value)) {
    throw new WorkFileError(`${path} must contain a JSON object`)
  }

  const version = requireNumber(value.version, 'version')
  const dispatcher = requireString(value.dispatcher, 'dispatcher')
  const updatedAt = requireString(value.updatedAt, 'updatedAt')

  if (!Array.isArray(value.work)) {
    throw new WorkFileError('work must be an array')
  }

  const work = value.work.map((item, index) => validateWorkItem(item, `work[${index}]`))
  const ids = new Set<string>()
  for (const item of work) {
    if (ids.has(item.id)) {
      throw new WorkFileError(`duplicate work id: ${item.id}`)
    }
    ids.add(item.id)
  }

  return { version, dispatcher, updatedAt, work }
}

function validateWorkItem(value: unknown, path: string): WorkItem {
  if (!isRecord(value)) {
    throw new WorkFileError(`${path} must be an object`)
  }

  const id = requireString(value.id, `${path}.id`)
  const profile = requireString(value.profile, `${path}.profile`)
  const priority = requireNumber(value.priority, `${path}.priority`)
  const withAssets = requireBoolean(value.withAssets, `${path}.withAssets`)

  if (!Array.isArray(value.targets) || value.targets.length === 0) {
    throw new WorkFileError(`${path}.targets must be a non-empty array`)
  }

  const targets = value.targets.map((target, index) => {
    const targetPath = `${path}.targets[${index}]`
    const normalized = requireString(target, targetPath)
    validateTargetSpec(normalized, targetPath)
    return normalized
  })

  return {
    id,
    description: optionalString(value.description, `${path}.description`),
    targets,
    profile,
    withAssets,
    priority,
    policy: isRecord(value.policy)
      ? {
          rateLimit: optionalString(value.policy.rateLimit, `${path}.policy.rateLimit`),
          respectOptOut: optionalBoolean(value.policy.respectOptOut, `${path}.policy.respectOptOut`),
          notes: optionalString(value.policy.notes, `${path}.policy.notes`),
        }
      : undefined,
    labels: optionalStringArray(value.labels, `${path}.labels`),
  }
}

function validateTargetSpec(target: string, path: string): void {
  const separator = target.indexOf(':')
  if (separator < 1) {
    throw new WorkFileError(`${path} must use prefix:value syntax`)
  }

  const prefix = target.slice(0, separator)
  const value = target.slice(separator + 1)
  if (!allowedTargetPrefixes.has(prefix)) {
    throw new WorkFileError(`${path} has unsupported prefix: ${prefix}`)
  }
  if (!value.trim()) {
    throw new WorkFileError(`${path} must include a value`)
  }
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
  if (value === undefined) return undefined
  return requireString(value, path)
}

function requireNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new WorkFileError(`${path} must be a finite number`)
  }
  return value
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new WorkFileError(`${path} must be a boolean`)
  }
  return value
}

function optionalBoolean(value: unknown, path: string): boolean | undefined {
  if (value === undefined) return undefined
  return requireBoolean(value, path)
}

function optionalStringArray(value: unknown, path: string): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) {
    throw new WorkFileError(`${path} must be an array`)
  }
  return value.map((item, index) => requireString(item, `${path}[${index}]`))
}
