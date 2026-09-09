#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto'
import { access, copyFile, mkdir, readFile, readdir, rename, rmdir, stat, unlink, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifestFilename = '.govuk-design-md.json'
const managedBlockStart = '<!-- govuk-design-md:start -->'
const managedBlockEnd = '<!-- govuk-design-md:end -->'

function usage() {
  return `govuk-design-md <command> [options]

Commands:
  init                 Install reviewed GOV.UK guidance into a repository
  add                  Alias for init
  check                Check installed files for local modifications
  diff                 Preview differences from this package release
  update               Update unmodified managed content; emit conflict files for local edits
  uninstall            Remove unmodified package content and managed blocks

Options:
  --target <directory> Repository to inspect or modify (default: current directory)
  --dry-run            Preview init or update operations without writing files
  --help               Show this help
  --version            Show the package version
`
}

function parseArguments(argv) {
  const args = { command: null, target: process.cwd(), dryRun: false, help: false, version: false }
  const remaining = [...argv]

  while (remaining.length > 0) {
    const value = remaining.shift()
    if (value === '--target') {
      const target = remaining.shift()
      if (!target) throw new Error('--target requires a directory')
      args.target = target
    } else if (value === '--dry-run') {
      args.dryRun = true
    } else if (value === '--help' || value === '-h') {
      args.help = true
    } else if (value === '--version' || value === '-v') {
      args.version = true
    } else if (!args.command && !value.startsWith('-')) {
      args.command = value
    } else {
      throw new Error(`unknown argument: ${value}`)
    }
  }

  return args
}

async function exists(path) {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function portablePath(path) {
  return path.split(sep).join('/')
}

function resolveManagedPath(target, path) {
  if (isAbsolute(path)) throw new Error(`manifest contains an absolute path: ${path}`)
  const resolvedTarget = resolve(target)
  const resolvedPath = resolve(resolvedTarget, path)
  if (resolvedPath !== resolvedTarget && !resolvedPath.startsWith(`${resolvedTarget}${sep}`)) {
    throw new Error(`manifest path escapes the target repository: ${path}`)
  }
  return resolvedPath
}

async function sha256(path) {
  const contents = await readFile(path)
  return sha256Contents(contents)
}

function sha256Contents(contents) {
  return createHash('sha256').update(contents).digest('hex')
}

function managedBlock(contents, startMarker = managedBlockStart, endMarker = managedBlockEnd) {
  const start = contents.indexOf(startMarker)
  const end = contents.indexOf(endMarker)
  if (start === -1 || end === -1 || end < start) return null
  if (contents.indexOf(startMarker, start + startMarker.length) !== -1) return null
  if (contents.indexOf(endMarker, end + endMarker.length) !== -1) return null
  return contents.slice(start, end + endMarker.length)
}

function appendManagedBlock(contents, block) {
  const cleanBlock = block.trimEnd()
  if (contents.length === 0) return `${cleanBlock}\n`
  if (contents.endsWith('\n\n')) return `${contents}${cleanBlock}\n`
  if (contents.endsWith('\n')) return `${contents}\n${cleanBlock}\n`
  return `${contents}\n\n${cleanBlock}\n`
}

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...await filesIn(path))
    if (entry.isFile()) files.push(path)
  }
  return files
}

async function installPlan(target, existingEntryPoint = null) {
  const mappings = []
  const directories = [
    ['design/govuk', 'design/govuk'],
    ['agents/govuk-design-system', '.agents/skills/govuk-design-system'],
    ['frameworks', 'frameworks']
  ]

  for (const [sourceDirectory, targetDirectory] of directories) {
    const absoluteSourceDirectory = resolve(packageRoot, sourceDirectory)
    for (const source of await filesIn(absoluteSourceDirectory)) {
      mappings.push({
        source,
        target: resolve(target, targetDirectory, relative(absoluteSourceDirectory, source)),
        mode: 'file'
      })
    }
  }

  const entryName = existingEntryPoint ?? (await exists(resolve(target, 'DESIGN.md')) ? 'GOVUK-DESIGN.md' : 'DESIGN.md')
  if (!['DESIGN.md', 'GOVUK-DESIGN.md'].includes(entryName)) {
    throw new Error(`manifest contains an unsupported entry point: ${entryName}`)
  }
  mappings.push({ source: resolve(packageRoot, 'DESIGN.md'), target: resolve(target, entryName), mode: 'file' })

  const adapterManifest = JSON.parse(await readFile(resolve(packageRoot, 'adapters', 'manifest.json'), 'utf8'))
  for (const adapter of adapterManifest.adapters ?? []) {
    if (!['file', 'managed-block'].includes(adapter.mode)) {
      throw new Error(`adapter ${adapter.id ?? '<unknown>'} has an unsupported install mode`)
    }
    mappings.push({
      source: resolveManagedPath(resolve(packageRoot, 'adapters'), adapter.source),
      target: resolveManagedPath(target, adapter.destination),
      mode: adapter.mode
    })
  }

  return { mappings, entryName }
}

async function assertTarget(target) {
  const targetStat = await stat(target).catch(() => null)
  if (!targetStat?.isDirectory()) throw new Error(`target is not an existing directory: ${target}`)
}

async function initialise(target, dryRun) {
  await assertTarget(target)
  const manifestPath = resolve(target, manifestFilename)
  if (await exists(manifestPath)) {
    throw new Error(`${manifestFilename} already exists; use check to inspect this installation`)
  }

  const { mappings, entryName } = await installPlan(target)
  const conflicts = []
  for (const mapping of mappings) {
    if (!await exists(mapping.target)) continue
    const path = portablePath(relative(target, mapping.target))
    if (mapping.mode === 'file') {
      conflicts.push(path)
      continue
    }
    const contents = await readFile(mapping.target, 'utf8')
    if (contents.includes(managedBlockStart) || contents.includes(managedBlockEnd)) {
      conflicts.push(`${path} (contains an unmanaged govuk-design-md block)`)
    }
  }
  if (conflicts.length > 0) {
    throw new Error(`refusing to overwrite existing files:\n${conflicts.map((path) => `  ${path}`).join('\n')}`)
  }

  if (dryRun) {
    for (const mapping of mappings) {
      const path = portablePath(relative(target, mapping.target))
      if (mapping.mode === 'managed-block' && await exists(mapping.target)) {
        process.stdout.write(`would append managed block to ${path}\n`)
      } else {
        process.stdout.write(`would install ${path}\n`)
      }
    }
    process.stdout.write(`would create ${manifestFilename}\n`)
    return
  }

  const packageMetadata = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'))
  const catalog = JSON.parse(await readFile(resolve(packageRoot, 'catalog.json'), 'utf8'))
  const managedFiles = {}

  for (const mapping of mappings) {
    await mkdir(dirname(mapping.target), { recursive: true })
    const path = portablePath(relative(target, mapping.target))
    if (mapping.mode === 'managed-block') {
      const sourceBlock = await readFile(mapping.source, 'utf8')
      const block = managedBlock(sourceBlock)
      if (!block) throw new Error(`adapter source does not contain one valid managed block: ${path}`)
      const targetExisted = await exists(mapping.target)
      const currentContents = targetExisted ? await readFile(mapping.target, 'utf8') : ''
      await writeFile(mapping.target, appendManagedBlock(currentContents, block), 'utf8')
      managedFiles[path] = {
        mode: 'managed-block',
        hash: sha256Contents(block),
        startMarker: managedBlockStart,
        endMarker: managedBlockEnd,
        created: !targetExisted
      }
    } else {
      await copyFile(mapping.source, mapping.target, constants.COPYFILE_EXCL)
      managedFiles[path] = { mode: 'file', hash: await sha256(mapping.target) }
    }
  }

  const manifest = {
    schemaVersion: 2,
    packageVersion: packageMetadata.version,
    govukFrontendVersion: catalog.govukFrontendVersion,
    entryPoint: entryName,
    managedFiles
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  process.stdout.write(`installed ${mappings.length} files; entry point: ${entryName}\n`)
}

async function loadInstallationManifest(target) {
  const manifestPath = resolve(target, manifestFilename)
  if (!await exists(manifestPath)) throw new Error(`${manifestFilename} was not found in ${target}`)
  return JSON.parse(await readFile(manifestPath, 'utf8'))
}

function normaliseOwnershipRecord(record) {
  if (typeof record === 'string') return { mode: 'file', hash: record }
  return record
}

async function desiredMappingState(mapping) {
  if (mapping.mode === 'managed-block') {
    const sourceContents = await readFile(mapping.source, 'utf8')
    const block = managedBlock(sourceContents)
    if (!block) throw new Error(`adapter source does not contain one valid managed block: ${mapping.source}`)
    return { hash: sha256Contents(block), contents: block }
  }
  const contents = await readFile(mapping.source)
  return { hash: sha256Contents(contents), contents }
}

async function inspectUpdate(target) {
  await assertTarget(target)
  const manifest = await loadInstallationManifest(target)
  const { mappings, entryName } = await installPlan(target, manifest.entryPoint)
  const currentPaths = new Set()
  const changes = []

  for (const mapping of mappings) {
    const path = portablePath(relative(target, mapping.target))
    currentPaths.add(path)
    const desired = await desiredMappingState(mapping)
    const ownership = normaliseOwnershipRecord(manifest.managedFiles?.[path])
    const targetExists = await exists(mapping.target)
    const change = { path, mapping, desired, ownership, targetExists, status: 'unchanged', reason: '' }

    if (!ownership) {
      if (!targetExists) {
        change.status = 'add'
      } else if (mapping.mode === 'managed-block') {
        const contents = await readFile(mapping.target, 'utf8')
        if (contents.includes(managedBlockStart) || contents.includes(managedBlockEnd)) {
          change.status = 'conflict'
          change.reason = 'target contains a block not owned by the install manifest'
        } else {
          change.status = 'add-block'
        }
      } else {
        change.status = 'conflict'
        change.reason = 'target exists but is not owned by the install manifest'
      }
      changes.push(change)
      continue
    }

    if (ownership.mode !== mapping.mode) {
      change.status = 'conflict'
      change.reason = `ownership mode changed from ${ownership.mode} to ${mapping.mode}`
      changes.push(change)
      continue
    }
    if (!targetExists) {
      change.status = 'restore'
      changes.push(change)
      continue
    }

    if (mapping.mode === 'managed-block') {
      const contents = await readFile(mapping.target, 'utf8')
      const installedBlock = managedBlock(contents, ownership.startMarker, ownership.endMarker)
      if (!installedBlock) {
        change.status = 'conflict'
        change.reason = 'managed block is missing or ambiguous'
      } else {
        const actualHash = sha256Contents(installedBlock)
        if (actualHash === desired.hash) {
          change.status = 'unchanged'
        } else if (actualHash === ownership.hash) {
          change.status = 'update'
        } else {
          change.status = 'conflict'
          change.reason = 'managed block has local modifications'
        }
      }
    } else {
      const actualHash = await sha256(mapping.target)
      if (actualHash === desired.hash) {
        change.status = 'unchanged'
      } else if (actualHash === ownership.hash) {
        change.status = 'update'
      } else {
        change.status = 'conflict'
        change.reason = 'managed file has local modifications'
      }
    }
    changes.push(change)
  }

  for (const path of Object.keys(manifest.managedFiles ?? {})) {
    if (!currentPaths.has(path)) changes.push({ path, status: 'retired', reason: 'not present in this package release' })
  }

  return { manifest, mappings, entryName, changes }
}

function describeChange(change, future = false) {
  const prefix = future ? 'would ' : ''
  if (change.status === 'add') return `${prefix}add ${change.path}`
  if (change.status === 'add-block') return `${prefix}append managed block to ${change.path}`
  if (change.status === 'restore') return `${prefix}restore ${change.path}`
  if (change.status === 'update') return `${prefix}update ${change.path}`
  if (change.status === 'retired') return `${change.path}: retained but no longer managed by this release`
  if (change.status === 'conflict') return `${change.path}: conflict (${change.reason})`
  return `${change.path}: unchanged`
}

async function desiredTargetContents(change) {
  if (change.mapping.mode === 'file') return change.desired.contents
  const block = change.desired.contents
  if (!change.targetExists) return `${block}\n`
  const contents = await readFile(change.mapping.target, 'utf8')
  if (change.status === 'add-block') return appendManagedBlock(contents, block)
  const existingBlock = managedBlock(
    contents,
    change.ownership?.startMarker ?? managedBlockStart,
    change.ownership?.endMarker ?? managedBlockEnd
  )
  if (!existingBlock) throw new Error(`cannot replace missing managed block in ${change.path}`)
  return contents.replace(existingBlock, block)
}

async function commitAtomically(writes) {
  const transactionId = randomUUID()
  const staged = []
  const applied = []

  try {
    for (const [index, write] of writes.entries()) {
      await mkdir(dirname(write.target), { recursive: true })
      const temporary = `${write.target}.govuk-design-md.tmp-${transactionId}-${index}`
      await writeFile(temporary, write.contents, { flag: 'wx' })
      staged.push({ ...write, temporary, backup: `${write.target}.govuk-design-md.backup-${transactionId}-${index}` })
    }

    for (const write of staged) {
      const hadTarget = await exists(write.target)
      if (hadTarget) await rename(write.target, write.backup)
      try {
        await rename(write.temporary, write.target)
      } catch (error) {
        if (hadTarget) await rename(write.backup, write.target)
        throw error
      }
      applied.push({ ...write, hadTarget })
    }
  } catch (error) {
    for (const write of [...applied].reverse()) {
      if (await exists(write.target)) await unlink(write.target).catch(() => {})
      if (write.hadTarget && await exists(write.backup)) await rename(write.backup, write.target).catch(() => {})
    }
    for (const write of staged) {
      if (await exists(write.temporary)) await unlink(write.temporary).catch(() => {})
    }
    throw new Error(`atomic update failed and was rolled back: ${error.message}`)
  }

  for (const write of applied) {
    if (write.hadTarget) await unlink(write.backup).catch(() => {
      process.stderr.write(`warning: could not remove update backup ${write.backup}\n`)
    })
  }
}

async function diff(target) {
  const { changes } = await inspectUpdate(target)
  const differences = changes.filter(({ status }) => status !== 'unchanged')
  if (differences.length === 0) {
    process.stdout.write('installation is current\n')
    return
  }
  for (const change of differences) process.stdout.write(`${describeChange(change, true)}\n`)
  if (differences.some(({ status }) => status === 'conflict')) process.exitCode = 1
}

async function update(target, dryRun) {
  const { manifest, mappings, entryName, changes } = await inspectUpdate(target)
  const conflicts = changes.filter(({ status }) => status === 'conflict')

  if (conflicts.length > 0) {
    for (const conflict of conflicts) process.stderr.write(`${describeChange(conflict)}\n`)
    if (!dryRun) {
      const conflictWrites = []
      for (const conflict of conflicts) {
        const conflictPath = `${conflict.mapping.target}.govuk-design-md.new`
        if (await exists(conflictPath)) {
          throw new Error(`refusing to overwrite existing conflict file: ${portablePath(relative(target, conflictPath))}`)
        }
        const contents = conflict.mapping.mode === 'managed-block'
          ? `${conflict.desired.contents}\n`
          : conflict.desired.contents
        conflictWrites.push({ target: conflictPath, contents })
      }
      await commitAtomically(conflictWrites)
      for (const conflict of conflicts) {
        process.stderr.write(`wrote ${portablePath(relative(target, `${conflict.mapping.target}.govuk-design-md.new`))}\n`)
      }
    }
    process.exitCode = 1
    return
  }

  const actionable = changes.filter(({ status }) => ['add', 'add-block', 'restore', 'update'].includes(status))
  const retired = changes.filter(({ status }) => status === 'retired').map(({ path }) => path)
  if (dryRun) {
    for (const change of [...actionable, ...changes.filter(({ status }) => status === 'retired')]) {
      process.stdout.write(`${describeChange(change, true)}\n`)
    }
    if (actionable.length === 0 && retired.length === 0) process.stdout.write('installation is current\n')
    return
  }

  const packageMetadata = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'))
  const catalog = JSON.parse(await readFile(resolve(packageRoot, 'catalog.json'), 'utf8'))
  const managedFiles = {}
  for (const mapping of mappings) {
    const path = portablePath(relative(target, mapping.target))
    const desired = await desiredMappingState(mapping)
    managedFiles[path] = mapping.mode === 'managed-block'
      ? {
          mode: 'managed-block',
          hash: desired.hash,
          startMarker: managedBlockStart,
          endMarker: managedBlockEnd,
          created: changes.find((change) => change.path === path)?.ownership?.created ?? !await exists(mapping.target)
        }
      : { mode: 'file', hash: desired.hash }
  }
  const nextManifest = {
    schemaVersion: 2,
    packageVersion: packageMetadata.version,
    govukFrontendVersion: catalog.govukFrontendVersion,
    entryPoint: entryName,
    managedFiles
  }
  if (retired.length > 0) {
    nextManifest.retiredFiles = [...new Set([...(manifest.retiredFiles ?? []), ...retired])].sort()
  } else if (Array.isArray(manifest.retiredFiles) && manifest.retiredFiles.length > 0) {
    nextManifest.retiredFiles = manifest.retiredFiles
  }

  const writes = []
  for (const change of actionable) {
    writes.push({ target: change.mapping.target, contents: await desiredTargetContents(change) })
  }
  const manifestContents = `${JSON.stringify(nextManifest, null, 2)}\n`
  const currentManifestContents = await readFile(resolve(target, manifestFilename), 'utf8')
  if (manifestContents !== currentManifestContents) {
    writes.push({ target: resolve(target, manifestFilename), contents: manifestContents })
  }

  if (writes.length === 0) {
    process.stdout.write('installation is current\n')
    return
  }
  await commitAtomically(writes)
  for (const change of actionable) process.stdout.write(`${describeChange(change)}\n`)
  for (const path of retired) process.stdout.write(`${path}: retained but no longer managed by this release\n`)
  process.stdout.write(`updated installation to ${packageMetadata.version}\n`)
}

async function removeEmptyParents(path, target) {
  let directory = dirname(path)
  const root = resolve(target)
  while (directory !== root && directory.startsWith(`${root}${sep}`)) {
    try {
      await rmdir(directory)
    } catch {
      break
    }
    directory = dirname(directory)
  }
}

async function uninstall(target, dryRun) {
  await assertTarget(target)
  const manifest = await loadInstallationManifest(target)
  const removals = []
  const problems = []

  for (const [path, rawRecord] of Object.entries(manifest.managedFiles ?? {})) {
    const record = normaliseOwnershipRecord(rawRecord)
    const absolutePath = resolveManagedPath(target, path)
    if (!await exists(absolutePath)) {
      removals.push({ path, absolutePath, record, missing: true })
      continue
    }
    if (record?.mode === 'file') {
      if (await sha256(absolutePath) !== record.hash) problems.push(`${path}: modified`)
      removals.push({ path, absolutePath, record })
      continue
    }
    if (record?.mode === 'managed-block') {
      const contents = await readFile(absolutePath, 'utf8')
      const block = managedBlock(contents, record.startMarker, record.endMarker)
      if (!block) {
        problems.push(`${path}: managed block missing or ambiguous`)
      } else if (sha256Contents(block) !== record.hash) {
        problems.push(`${path}: managed block modified`)
      }
      removals.push({ path, absolutePath, record, contents, block })
      continue
    }
    problems.push(`${path}: manifest has an unsupported ownership mode`)
  }

  if (problems.length > 0) {
    for (const problem of problems) process.stderr.write(`${problem}\n`)
    process.stderr.write('uninstall stopped; no managed content was removed\n')
    process.exitCode = 1
    return
  }

  for (const removal of removals) {
    if (removal.missing) continue
    const action = removal.record.mode === 'managed-block' ? 'remove managed block from' : 'remove'
    if (dryRun) process.stdout.write(`would ${action} ${removal.path}\n`)
  }
  if (dryRun) {
    process.stdout.write(`would remove ${manifestFilename}\n`)
    return
  }

  for (const removal of removals) {
    if (removal.missing) continue
    if (removal.record.mode === 'file') {
      await unlink(removal.absolutePath)
    } else {
      const remaining = removal.contents.replace(removal.block, '')
      if (removal.record.created && remaining.trim().length === 0) {
        await unlink(removal.absolutePath)
      } else {
        await writeFile(removal.absolutePath, remaining, 'utf8')
      }
    }
  }
  await unlink(resolve(target, manifestFilename))
  for (const removal of [...removals].reverse()) {
    if (!removal.missing) await removeEmptyParents(removal.absolutePath, target)
  }
  process.stdout.write(`uninstalled ${removals.length} managed entries\n`)
}

async function check(target) {
  await assertTarget(target)
  const manifest = await loadInstallationManifest(target)
  const problems = []

  for (const [path, record] of Object.entries(manifest.managedFiles ?? {})) {
    const absolutePath = resolveManagedPath(target, path)
    if (!await exists(absolutePath)) {
      problems.push(`${path}: missing`)
      continue
    }
    if (typeof record === 'string' || record?.mode === 'file') {
      const expectedHash = typeof record === 'string' ? record : record.hash
      const actualHash = await sha256(absolutePath)
      if (actualHash !== expectedHash) problems.push(`${path}: modified`)
      continue
    }
    if (record?.mode === 'managed-block') {
      const contents = await readFile(absolutePath, 'utf8')
      const block = managedBlock(contents, record.startMarker, record.endMarker)
      if (!block) {
        problems.push(`${path}: managed block missing or ambiguous`)
      } else if (sha256Contents(block) !== record.hash) {
        problems.push(`${path}: managed block modified`)
      }
      continue
    }
    problems.push(`${path}: manifest has an unsupported ownership mode`)
  }

  if (problems.length > 0) {
    for (const problem of problems) process.stderr.write(`${problem}\n`)
    process.exitCode = 1
  } else {
    process.stdout.write(`installation is intact (${Object.keys(manifest.managedFiles).length} files)\n`)
  }
}

async function main() {
  const args = parseArguments(process.argv.slice(2))
  const packageMetadata = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'))

  if (args.version) {
    process.stdout.write(`${packageMetadata.version}\n`)
    return
  }
  if (args.help || !args.command) {
    process.stdout.write(usage())
    return
  }

  const target = resolve(args.target)
  if (args.command === 'init' || args.command === 'add') return initialise(target, args.dryRun)
  if (args.command === 'check') return check(target)
  if (args.command === 'diff') return diff(target)
  if (args.command === 'update') return update(target, args.dryRun)
  if (args.command === 'uninstall') return uninstall(target, args.dryRun)
  throw new Error(`unknown command: ${args.command}`)
}

main().catch((error) => {
  process.stderr.write(`govuk-design-md: ${error.message}\n`)
  process.exitCode = 1
})
