import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const registryUrl = 'https://registry.npmjs.org/govuk-frontend/latest'
const inventoryKinds = ['styles', 'components', 'patterns']

function parseArgs(argv) {
  const options = {
    failOnChange: false,
    output: null
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--fail-on-change') options.failOnChange = true
    else if (argument === '--output') {
      options.output = argv[++index]
      if (!options.output || options.output.startsWith('--')) throw new Error('--output requires a path')
    }
    else if (argument.startsWith('--output=')) options.output = argument.slice('--output='.length)
    else throw new Error(`unknown option: ${argument}`)
  }

  if (options.output === '') throw new Error('--output requires a path')
  return options
}

function decodeHtml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
}

export function parseInventoryHtml(html, kind, indexUrl) {
  if (!inventoryKinds.includes(kind)) throw new Error(`unsupported inventory kind: ${kind}`)

  const items = new Map()
  for (const match of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*(["'])(.*?)\1[^>]*>/gis)) {
    let url
    try {
      url = new URL(decodeHtml(match[2]), indexUrl)
    } catch {
      continue
    }

    const pathMatch = url.pathname.match(new RegExp(`^/${kind}/([a-z0-9]+(?:-[a-z0-9]+)*)/?$`))
    if (!pathMatch || url.origin !== new URL(indexUrl).origin) continue

    url.hash = ''
    url.search = ''
    if (!url.pathname.endsWith('/')) url.pathname += '/'
    items.set(pathMatch[1], { id: pathMatch[1], url: url.href })
  }

  return [...items.values()].sort((left, right) => left.id.localeCompare(right.id, 'en-GB'))
}

function inventorySnapshot(inventory) {
  return {
    expectedCount: inventory.expectedCount,
    items: inventory.items
      .map(({ id, url }) => ({ id, url }))
      .sort((left, right) => left.id.localeCompare(right.id, 'en-GB'))
  }
}

function inventoryChanges(baseline, observed) {
  const baselineIds = new Set(baseline.items.map(({ id }) => id))
  const observedIds = new Set(observed.items.map(({ id }) => id))
  return {
    added: [...observedIds].filter((id) => !baselineIds.has(id)).sort((a, b) => a.localeCompare(b, 'en-GB')),
    removed: [...baselineIds].filter((id) => !observedIds.has(id)).sort((a, b) => a.localeCompare(b, 'en-GB')),
    expectedCount: baseline.expectedCount,
    observedCount: observed.items.length
  }
}

export function compareUpstream(baseline, observed) {
  const inventories = Object.fromEntries(inventoryKinds.map((kind) => [
    kind,
    inventoryChanges(baseline.inventories[kind], observed.inventories[kind])
  ]))
  const releaseChanged = baseline.govukFrontendVersion !== observed.govukFrontendVersion
  const inventoryChanged = Object.values(inventories).some(({ added, removed, expectedCount, observedCount }) => (
    added.length > 0 || removed.length > 0 || expectedCount !== observedCount
  ))

  return {
    release: {
      baseline: baseline.govukFrontendVersion,
      observed: observed.govukFrontendVersion,
      changed: releaseChanged
    },
    inventories,
    hasChanges: releaseChanged || inventoryChanged
  }
}

async function request(fetchImpl, url, options = {}, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    try {
      const response = await fetchImpl(url, {
        redirect: 'follow',
        ...options,
        headers: {
          accept: '*/*',
          'user-agent': 'govuk-design-md-upstream-monitor/1',
          ...options.headers
        },
        signal: controller.signal
      })
      if (response.status !== 429 && response.status < 500) return response
      await response.body?.cancel()
      lastError = new Error(`${url} returned HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    } finally {
      clearTimeout(timeout)
    }
  }
  throw new Error(`request failed for ${url}: ${lastError?.message ?? 'unknown error'}`)
}

async function fetchJson(fetchImpl, url) {
  const response = await request(fetchImpl, url, { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`)
  return response.json()
}

async function fetchText(fetchImpl, url) {
  const response = await request(fetchImpl, url, { headers: { accept: 'text/html' } })
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`)
  return response.text()
}

export async function checkUpstream({
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  sourceManifest
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('global fetch is unavailable; use Node.js 18 or newer')
  const manifest = sourceManifest ?? JSON.parse(await readFile(resolve(projectRoot, 'sources', 'govuk.json'), 'utf8'))
  const baseline = {
    govukFrontendVersion: manifest.upstreams.govukFrontend.version,
    inventories: Object.fromEntries(inventoryKinds.map((kind) => [kind, inventorySnapshot(manifest.inventories[kind])]))
  }
  const latestPackage = await fetchJson(fetchImpl, registryUrl)
  if (typeof latestPackage.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(latestPackage.version)) {
    throw new Error(`${registryUrl} did not return a valid version`)
  }

  const observedInventoryEntries = await Promise.all(inventoryKinds.map(async (kind) => {
    const inventory = manifest.inventories[kind]
    const html = await fetchText(fetchImpl, inventory.indexUrl)
    const items = parseInventoryHtml(html, kind, inventory.indexUrl)
    if (items.length === 0) throw new Error(`no ${kind} links found at ${inventory.indexUrl}`)
    return [kind, { items }]
  }))
  const observed = {
    govukFrontendVersion: latestPackage.version,
    inventories: Object.fromEntries(observedInventoryEntries)
  }

  return {
    schemaVersion: 1,
    checkedAt: now().toISOString(),
    sources: {
      registry: registryUrl,
      inventories: Object.fromEntries(inventoryKinds.map((kind) => [kind, manifest.inventories[kind].indexUrl]))
    },
    baseline,
    observed,
    changes: compareUpstream(baseline, observed)
  }
}

export async function run(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArgs(argv)
  const report = await checkUpstream(dependencies)

  const serialized = `${JSON.stringify(report, null, 2)}\n`
  if (options.output) {
    const path = resolve(options.output)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, serialized, 'utf8')
  } else process.stdout.write(serialized)

  process.stderr.write(
    `upstream check: release ${report.changes.release.baseline} -> ${report.changes.release.observed}; ` +
    `${report.changes.hasChanges ? 'review required' : 'no inventory or release drift'}\n`
  )
  if (options.failOnChange && report.changes.hasChanges) process.exitCode = 1
  return report
}

const isDirectRun = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isDirectRun) {
  run().catch((error) => {
    process.stderr.write(`error: ${error.message}\n`)
    process.exitCode = 1
  })
}
