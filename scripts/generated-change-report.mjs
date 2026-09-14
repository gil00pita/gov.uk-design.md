import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const generatedPaths = [
  'DESIGN.md',
  'catalog.json',
  'adapters',
  'design/govuk',
  'frameworks',
  'tokens',
  'ui-frameworks'
]

function parseArgs(argv) {
  const options = {
    failOnChange: false,
    maxPatchLines: 400,
    output: null,
    upstreamReport: null
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--fail-on-change') options.failOnChange = true
    else if (argument === '--output') {
      options.output = argv[++index]
      if (!options.output || options.output.startsWith('--')) throw new Error('--output requires a path')
    }
    else if (argument.startsWith('--output=')) options.output = argument.slice('--output='.length)
    else if (argument === '--upstream-report') {
      options.upstreamReport = argv[++index]
      if (!options.upstreamReport || options.upstreamReport.startsWith('--')) throw new Error('--upstream-report requires a path')
    }
    else if (argument.startsWith('--upstream-report=')) options.upstreamReport = argument.slice('--upstream-report='.length)
    else if (argument === '--max-patch-lines') options.maxPatchLines = Number(argv[++index])
    else if (argument.startsWith('--max-patch-lines=')) options.maxPatchLines = Number(argument.slice('--max-patch-lines='.length))
    else throw new Error(`unknown option: ${argument}`)
  }
  if (options.output === '' || options.upstreamReport === '') throw new Error('path options require a path')
  if (!Number.isSafeInteger(options.maxPatchLines) || options.maxPatchLines < 0) {
    throw new Error('--max-patch-lines must be a non-negative integer')
  }
  return options
}

function git(args, { allowDifference = false } = {}) {
  const result = spawnSync('git', args, { cwd: projectRoot, encoding: 'utf8' })
  if (result.status !== 0 && !(allowDifference && result.status === 1)) {
    throw new Error(`git ${args.join(' ')} failed:\n${result.stderr || result.stdout}`)
  }
  return result.stdout
}

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex')
}

function lineCount(contents) {
  if (contents.length === 0) return 0
  return contents.endsWith('\n') ? contents.split('\n').length - 1 : contents.split('\n').length
}

function shortHash(value) {
  return value ? value.slice(0, 12) : '—'
}

function tableCell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ')
}

function list(values) {
  return values.length > 0 ? values.map((value) => `\`${value}\``).join(', ') : '—'
}

function truncatePatch(patch, maxPatchLines) {
  const lines = patch.replace(/\n$/, '').split('\n')
  if (maxPatchLines === 0) return { patch: '', omitted: lines.length }
  if (lines.length <= maxPatchLines) return { patch: lines.join('\n'), omitted: 0 }
  return { patch: lines.slice(0, maxPatchLines).join('\n'), omitted: lines.length - maxPatchLines }
}

async function fileContentsAtHead(path) {
  const result = spawnSync('git', ['show', `HEAD:${path}`], { cwd: projectRoot, encoding: null })
  if (result.status === 0) return result.stdout
  return null
}

async function fileContentsAtWorktree(path) {
  return readFile(resolve(projectRoot, path)).catch((error) => {
    if (error.code === 'ENOENT') return null
    throw error
  })
}

function parseNameStatus(output) {
  const changes = new Map()
  for (const line of output.trim().split('\n')) {
    if (!line) continue
    const [rawStatus, ...paths] = line.split('\t')
    const status = rawStatus[0]
    const path = paths.at(-1)
    changes.set(path, { path, status, previousPath: paths.length === 2 ? paths[0] : null })
  }
  return changes
}

function patchFor(change) {
  if (change.status === 'A' && !change.previousPath) {
    return git(['diff', '--no-index', '--no-ext-diff', '--no-color', '--unified=3', '--', '/dev/null', change.path], { allowDifference: true })
  }
  return git(['diff', 'HEAD', '--no-ext-diff', '--no-color', '--unified=3', '--', change.path], { allowDifference: true })
}

export async function generatedChanges({ maxPatchLines = 400 } = {}) {
  const changes = parseNameStatus(git(['diff', 'HEAD', '--name-status', '--', ...generatedPaths]))
  const untracked = git(['ls-files', '--others', '--exclude-standard', '--', ...generatedPaths])
    .trim()
    .split('\n')
    .filter(Boolean)
  for (const path of untracked) changes.set(path, { path, status: 'A', previousPath: null })

  const reports = []
  for (const change of [...changes.values()].sort((left, right) => left.path.localeCompare(right.path, 'en-GB'))) {
    const [before, after] = await Promise.all([
      fileContentsAtHead(change.previousPath ?? change.path),
      fileContentsAtWorktree(change.path)
    ])
    const patchResult = truncatePatch(patchFor(change), maxPatchLines)
    reports.push({
      ...change,
      beforeLines: before === null ? 0 : lineCount(before.toString('utf8')),
      afterLines: after === null ? 0 : lineCount(after.toString('utf8')),
      beforeSha256: before === null ? null : sha256(before),
      afterSha256: after === null ? null : sha256(after),
      patch: patchResult.patch,
      omittedPatchLines: patchResult.omitted
    })
  }
  return reports
}

export function renderGeneratedChangeReport({ upstream = null, changes = [] }) {
  const lines = [
    '# GOV.UK Design System generated change report',
    '',
    'This report is deterministic for the same upstream snapshot and Git worktree. It is review evidence, not permission to update canonical records automatically.',
    ''
  ]

  if (upstream) {
    const release = upstream.changes.release
    lines.push(
      '## Upstream observation',
      '',
      `- Pinned GOV.UK Frontend: \`${release.baseline}\``,
      `- Observed GOV.UK Frontend: \`${release.observed}\``,
      `- Human review required: **${upstream.changes.hasChanges ? 'yes' : 'no'}**`,
      '',
      '| Inventory | Expected | Observed | Added | Removed |',
      '| --- | ---: | ---: | --- | --- |'
    )
    for (const kind of ['styles', 'components', 'patterns']) {
      const inventory = upstream.changes.inventories[kind]
      lines.push(`| ${kind} | ${inventory.expectedCount} | ${inventory.observedCount} | ${list(inventory.added)} | ${list(inventory.removed)} |`)
    }
    lines.push('')
  }

  lines.push('## Generated outputs', '')
  if (changes.length === 0) {
    lines.push('No generated output changes were detected.', '')
    return `${lines.join('\n')}\n`
  }

  lines.push(
    '| Path | Status | Before SHA-256 | After SHA-256 | Before lines | After lines |',
    '| --- | :---: | --- | --- | ---: | ---: |'
  )
  for (const change of changes) {
    lines.push(
      `| ${tableCell(change.path)} | ${tableCell(change.status)} | \`${shortHash(change.beforeSha256)}\` | \`${shortHash(change.afterSha256)}\` | ${change.beforeLines} | ${change.afterLines} |`
    )
  }
  lines.push('')

  for (const change of changes) {
    lines.push(`### ${change.path}`, '')
    if (change.patch) lines.push('```diff', change.patch, '```', '')
    else lines.push('Patch omitted by configuration.', '')
    if (change.omittedPatchLines > 0) lines.push(`_${change.omittedPatchLines} additional patch lines omitted._`, '')
  }
  return `${lines.join('\n')}\n`
}

export async function run(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  const upstream = options.upstreamReport
    ? JSON.parse(await readFile(resolve(options.upstreamReport), 'utf8'))
    : null
  const changes = await generatedChanges({ maxPatchLines: options.maxPatchLines })
  const report = renderGeneratedChangeReport({ upstream, changes })

  if (options.output) {
    const path = resolve(options.output)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, report, 'utf8')
  } else {
    process.stdout.write(report)
  }
  if (options.failOnChange && changes.length > 0) process.exitCode = 1
  return { upstream, changes, report }
}

const isDirectRun = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isDirectRun) {
  run().catch((error) => {
    process.stderr.write(`error: ${error.message}\n`)
    process.exitCode = 1
  })
}
