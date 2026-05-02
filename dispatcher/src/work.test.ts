import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRandomIpv4WorkItems, isAllowedIpv4 } from './random-ipv4.js'
import { addDomainTarget, loadTargetQueue, normalizeDomain, targetRequestsToWorkItems } from './targets.js'
import { filterWork, loadWorkFile } from './work.js'

test('loadWorkFile validates and loads dispatcher work', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nweb-dispatcher-'))
  const path = join(dir, 'work.json')
  await writeFile(
    path,
    JSON.stringify({
      version: 1,
      dispatcher: 'test',
      updatedAt: '2026-05-02T00:00:00Z',
      work: [
        {
          id: 'local',
          targets: ['ip:127.0.0.1'],
          profile: 'quick',
          withAssets: false,
          priority: 100,
          labels: ['local'],
        },
      ],
    }),
  )

  const workFile = await loadWorkFile(path)

  assert.equal(workFile.dispatcher, 'test')
  assert.equal(workFile.work[0]?.id, 'local')
})

test('filterWork filters and sorts by priority', () => {
  const work = filterWork(
    [
      {
        id: 'low',
        targets: ['ip:127.0.0.1'],
        profile: 'quick',
        withAssets: false,
        priority: 1,
        labels: ['local'],
      },
      {
        id: 'high',
        targets: ['ip:127.0.0.2'],
        profile: 'quick',
        withAssets: false,
        priority: 10,
        labels: ['local'],
      },
      {
        id: 'other',
        targets: ['host:example.com'],
        profile: 'top-100',
        withAssets: false,
        priority: 20,
        labels: ['public'],
      },
    ],
    { profile: 'quick', label: 'local', limit: 1 },
  )

  assert.deepEqual(
    work.map(item => item.id),
    ['high'],
  )
})

test('buildRandomIpv4WorkItems returns public IPv4 scan work', () => {
  const work = buildRandomIpv4WorkItems({ count: 5, profile: 'quick' })

  assert.equal(work.length, 5)
  assert.equal(new Set(work.map(item => item.targets[0])).size, 5)

  for (const item of work) {
    assert.match(item.id, /^random-ipv4-/)
    assert.equal(item.profile, 'quick')
    assert.equal(item.withAssets, false)
    assert.deepEqual(item.labels, ['random', 'public-ipv4'])

    const target = item.targets[0]
    assert.ok(target?.startsWith('ip:'))
    assert.equal(isAllowedIpv4(target.slice(3)), true)
  }
})

test('isAllowedIpv4 rejects non-public ranges', () => {
  for (const ip of ['10.0.0.1', '127.0.0.1', '172.16.0.1', '192.168.1.1', '224.0.0.1', '203.0.113.1']) {
    assert.equal(isAllowedIpv4(ip), false)
  }

  assert.equal(isAllowedIpv4('8.8.8.8'), true)
})

test('normalizeDomain accepts hostnames and rejects URLs', () => {
  assert.equal(normalizeDomain('Example.COM.'), 'example.com')
  assert.throws(() => normalizeDomain('https://example.com'), /scheme/)
  assert.throws(() => normalizeDomain('example.com/path'), /scheme/)
  assert.throws(() => normalizeDomain('localhost'), /valid DNS hostname/)
  assert.throws(() => normalizeDomain('192.0.2.1'), /valid DNS hostname/)
})

test('addDomainTarget persists prioritized analyst targets', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nweb-targets-'))
  const path = join(dir, 'targets.json')

  await addDomainTarget({ domain: 'low.example.com', profile: 'quick', priority: 100 }, path)
  const result = await addDomainTarget({ domain: 'High.Example.com', profile: 'quick', priority: 900, withAssets: true }, path)

  assert.equal(result.queue.targets.length, 2)
  assert.equal(result.queue.targets[0]?.domain, 'high.example.com')
  assert.equal(result.queue.targets[0]?.priority, 900)

  const reloaded = await loadTargetQueue(path)
  assert.equal(reloaded.targets[0]?.domain, 'high.example.com')
})

test('targetRequestsToWorkItems builds dispatcher work for domain queue', () => {
  const work = targetRequestsToWorkItems([
    {
      id: 'target-low',
      domain: 'low.example.com',
      profile: 'quick',
      priority: 100,
      withAssets: false,
      source: 'analyst',
      createdAt: '2026-05-02T00:00:00.000Z',
    },
    {
      id: 'target-high',
      domain: 'high.example.com',
      profile: 'quick',
      priority: 900,
      withAssets: true,
      source: 'analyst',
      createdAt: '2026-05-02T00:01:00.000Z',
    },
  ])

  assert.deepEqual(work.map(item => item.id), ['target-high', 'target-low'])
  assert.equal(work[0]?.targets[0], 'host:high.example.com')
  assert.deepEqual(work[0]?.labels, ['analyst', 'domain', 'priority'])
})
