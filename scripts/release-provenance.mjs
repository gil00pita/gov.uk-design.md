import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaultLimits = {
  packedBytes: 256 * 1024,
  unpackedBytes: 1024 * 1024
}

function parsePositiveInteger(value, option) {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${option} must be a positive integer`)
  return parsed
}

function parseArgs(argv, environment = process.env) {
  const options = {
    allowDirty: false,
    changelog: 'CHANGELOG.md',
    expectedTag: environment.GOVUK_EXPECTED_RELEASE_TAG || null,
    maxPackedBytes: parsePositiveInteger(environment.GOVUK_MAX_PACKED_BYTES ?? defaultLimits.packedBytes, 'GOVUK_MAX_PACKED_BYTES'),
    maxUnpackedBytes: parsePositiveInteger(environment.GOVUK_MAX_UNPACKED_BYTES ?? defaultLimits.unpackedBytes, 'GOVUK_MAX_UNPACKED_BYTES'),
    output: null
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--allow-dirty') options.allowDirty = true
    else if (argument === '--changelog') {
      options.changelog = argv[++index]
      if (!options.changelog || options.changelog.startsWith('--')) throw new Error('--changelog requires a value')
    }
    else if (argument.startsWith('--changelog=')) options.changelog = argument.slice('--changelog='.length)
    else if (argument === '--expected-tag') {
      options.expectedTag = argv[++index]
      if (!options.expectedTag || options.expectedTag.startsWith('--')) throw new Error('--expected-tag requires a value')
    }
    else if (argument.startsWith('--expected-tag=')) options.expectedTag = argument.slice('--expected-tag='.length)
    else if (argument === '--max-packed-bytes') options.maxPackedBytes = parsePositiveInteger(argv[++index], '--max-packed-bytes')
    else if (argument.startsWith('--max-packed-bytes=')) options.maxPackedBytes = parsePositiveInteger(argument.slice('--max-packed-bytes='.length), '--max-packed-bytes')
    else if (argument === '--max-unpacked-bytes') options.maxUnpackedBytes = parsePositiveInteger(argv[++index], '--max-unpacked-bytes')
    else if (argument.startsWith('--max-unpacked-bytes=')) options.maxUnpackedBytes = parsePositiveInteger(argument.slice('--max-unpacked-bytes='.length), '--max-unpacked-bytes')
    else if (argument === '--output') {
      options.output = argv[++index]
      if (!options.output || options.output.startsWith('--')) throw new Error('--output requires a value')
    }
    else if (argument.startsWith('--output=')) options.output = argument.slice('--output='.length)
    else throw new Error(`unknown option: ${argument}`)
  }
  for (const [name, value] of [['--changelog', options.changelog], ['--expected-tag', options.expectedTag], ['--output', options.output]]) {
    if (value === '') throw new Error(`${name} requires a value`)
  }
  return options
}

function command(commandName, args, { allowFailure = false, encoding = 'utf8', env } = {}) {
  const result = spawnSync(commandName, args, { cwd: projectRoot, encoding, env })
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${commandName} ${args.join(' ')} failed:\n${result.stderr || result.stdout}`)
  }
  return result
}

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex')
}

function integrityHex(integrity, algorithm) {
  const prefix = `${algorithm}-`
  if (typeof integrity !== 'string' || !integrity.startsWith(prefix)) {
    throw new Error(`npm pack did not report a ${algorithm} integrity digest`)
  }
  const digest = Buffer.from(integrity.slice(prefix.length), 'base64').toString('hex')
  const expectedLength = algorithm === 'sha512' ? 128 : null
  if (!digest || (expectedLength && digest.length !== expectedLength)) {
    throw new Error(`npm pack reported an invalid ${algorithm} integrity digest`)
  }
  return digest
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function findChangelogEntry(contents, version) {
  if (!/^## \[Unreleased\]\s*$/m.test(contents)) throw new Error('CHANGELOG.md must contain an Unreleased section')
  const pattern = new RegExp(`^## \\[${escapeRegExp(version)}\\] - (\\d{4}-\\d{2}-\\d{2})\\s*$`, 'm')
  const match = contents.match(pattern)
  if (!match || Number.isNaN(Date.parse(`${match[1]}T00:00:00Z`))) {
    throw new Error(`CHANGELOG.md must contain a dated ## [${version}] entry`)
  }
  return { heading: match[0].trim(), date: match[1] }
}

export function enforcePackageLimits(report, limits) {
  const errors = []
  if (!Number.isSafeInteger(report.size)) errors.push('npm pack did not report a packed size')
  else if (report.size > limits.packedBytes) errors.push(`packed size ${report.size} exceeds ${limits.packedBytes} bytes`)
  if (!Number.isSafeInteger(report.unpackedSize)) errors.push('npm pack did not report an unpacked size')
  else if (report.unpackedSize > limits.unpackedBytes) errors.push(`unpacked size ${report.unpackedSize} exceeds ${limits.unpackedBytes} bytes`)
  if (!Number.isSafeInteger(report.entryCount) || report.entryCount <= 0) errors.push('npm pack did not report package files')
  if (errors.length > 0) throw new Error(errors.join('; '))
  return {
    packedBytes: report.size,
    packedLimitBytes: limits.packedBytes,
    unpackedBytes: report.unpackedSize,
    unpackedLimitBytes: limits.unpackedBytes,
    fileCount: report.entryCount
  }
}

export function buildProvenance({
  packageMetadata,
  sourceManifest,
  packageLock,
  packReport,
  changelogEntry,
  commit,
  treeState,
  sourceManifestSha256,
  packageLockSha256,
  packageLimits,
  environment = process.env
}) {
  const pinnedImplementation = packageLock.packages?.['node_modules/govuk-frontend']
  if (!pinnedImplementation || pinnedImplementation.version !== sourceManifest.upstreams.govukFrontend.version) {
    throw new Error('package-lock.json does not match the reviewed GOV.UK Frontend version')
  }
  if (packReport.name !== packageMetadata.name || packReport.version !== packageMetadata.version) {
    throw new Error('npm pack identity does not match package.json')
  }
  if (!/^[0-9a-f]{40}$/i.test(packReport.shasum ?? '')) throw new Error('npm pack did not report a valid SHA-1 digest')

  return {
    schemaVersion: 1,
    subject: {
      name: `${packReport.name}@${packReport.version}`,
      filename: packReport.filename,
      digest: {
        sha1: packReport.shasum,
        sha512: integrityHex(packReport.integrity, 'sha512')
      },
      package: packageLimits
    },
    source: {
      repository: packageMetadata.repository?.url,
      commit,
      treeState
    },
    reviewedUpstream: {
      name: sourceManifest.upstreams.govukFrontend.package,
      version: sourceManifest.upstreams.govukFrontend.version,
      resolved: pinnedImplementation.resolved,
      integrity: pinnedImplementation.integrity,
      reviewedAt: sourceManifest.reviewedAt
    },
    materials: [
      { path: 'sources/govuk.json', digest: { sha256: sourceManifestSha256 } },
      { path: 'package-lock.json', digest: { sha256: packageLockSha256 } }
    ],
    changelog: changelogEntry,
    builder: environment.GITHUB_ACTIONS === 'true'
      ? {
          system: 'GitHub Actions',
          workflow: environment.GITHUB_WORKFLOW_REF ?? null,
          run: environment.GITHUB_RUN_ID
            ? `https://github.com/${environment.GITHUB_REPOSITORY}/actions/runs/${environment.GITHUB_RUN_ID}`
            : null
        }
      : { system: 'local', workflow: null, run: null },
    note: 'Unsigned release-candidate evidence. Registry publication should use npm trusted publishing or npm publish --provenance.'
  }
}

async function npmPackReport() {
  const cache = resolve(tmpdir(), 'govuk-design-md-release-provenance-npm-cache')
  await mkdir(cache, { recursive: true })
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const result = command(npm, ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    env: {
      ...process.env,
      npm_config_cache: cache,
      npm_config_fund: 'false',
      npm_config_update_notifier: 'false'
    }
  })
  const reports = JSON.parse(result.stdout)
  if (!Array.isArray(reports) || reports.length !== 1) throw new Error('npm pack did not return one package report')
  return reports[0]
}

export async function run(argv = process.argv.slice(2), environment = process.env) {
  const options = parseArgs(argv, environment)
  const [packageContents, manifestContents, lockContents, changelogContents, packReport] = await Promise.all([
    readFile(resolve(projectRoot, 'package.json'), 'utf8'),
    readFile(resolve(projectRoot, 'sources', 'govuk.json'), 'utf8'),
    readFile(resolve(projectRoot, 'package-lock.json'), 'utf8'),
    readFile(resolve(projectRoot, options.changelog), 'utf8'),
    npmPackReport()
  ])
  const packageMetadata = JSON.parse(packageContents)
  const sourceManifest = JSON.parse(manifestContents)
  const packageLock = JSON.parse(lockContents)
  const expectedTag = `v${packageMetadata.version}`
  if (options.expectedTag && options.expectedTag !== expectedTag) {
    throw new Error(`release tag ${options.expectedTag} does not match package version ${expectedTag}`)
  }

  const treeStatus = command('git', ['status', '--porcelain=v1', '--untracked-files=all']).stdout.trim()
  const treeState = treeStatus ? 'dirty' : 'clean'
  if (!options.allowDirty && treeState !== 'clean') throw new Error('release provenance requires a clean worktree')
  const commit = environment.GITHUB_SHA || command('git', ['rev-parse', 'HEAD']).stdout.trim()
  if (!/^[0-9a-f]{40}$/i.test(commit)) throw new Error('could not resolve a full Git commit SHA')

  const packageLimits = enforcePackageLimits(packReport, {
    packedBytes: options.maxPackedBytes,
    unpackedBytes: options.maxUnpackedBytes
  })
  const provenance = buildProvenance({
    packageMetadata,
    sourceManifest,
    packageLock,
    packReport,
    changelogEntry: findChangelogEntry(changelogContents, packageMetadata.version),
    commit,
    treeState,
    sourceManifestSha256: sha256(manifestContents),
    packageLockSha256: sha256(lockContents),
    packageLimits,
    environment
  })
  const serialized = `${JSON.stringify(provenance, null, 2)}\n`
  if (options.output) {
    const path = resolve(options.output)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, serialized, 'utf8')
  } else {
    process.stdout.write(serialized)
  }
  process.stderr.write(
    `release provenance: ${provenance.subject.name}, ${packageLimits.packedBytes}/${packageLimits.packedLimitBytes} packed bytes, ` +
    `${packageLimits.unpackedBytes}/${packageLimits.unpackedLimitBytes} unpacked bytes\n`
  )
  return provenance
}

const isDirectRun = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isDirectRun) {
  run().catch((error) => {
    process.stderr.write(`error: ${error.message}\n`)
    process.exitCode = 1
  })
}
