import { createHash, randomUUID } from 'node:crypto'
import { access, copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, unlink, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, relative, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageMetadata = JSON.parse(await readFile(resolve(projectRoot, 'package.json'), 'utf8'))
const catalog = JSON.parse(await readFile(resolve(projectRoot, 'catalog.json'), 'utf8'))
const expectedReleaseTag = process.env.GOVUK_EXPECTED_RELEASE_TAG
const outputDirectory = resolve(process.env.GOVUK_RELEASE_DIRECTORY ?? resolve(projectRoot, 'release'))
const archiveRootName = `govuk-design-md-v${packageMetadata.version}`
const archivePath = resolve(outputDirectory, `${archiveRootName}.zip`)
const temporaryArchivePath = resolve(outputDirectory, `.${archiveRootName}-${randomUUID()}.zip`)
const stagingDirectory = await mkdtemp(resolve(tmpdir(), 'govuk-design-md-release-'))
const archiveRoot = resolve(stagingDirectory, archiveRootName)
const overlay = resolve(archiveRoot, 'repository-overlay')

async function exists(path) {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    ...options
  })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed:\n${result.stderr || result.stdout}`)
  }
  return result.stdout
}

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const paths = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, 'en-GB'))) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) paths.push(...await filesIn(path))
    if (entry.isFile()) paths.push(path)
  }
  return paths
}

function portablePath(path) {
  return path.split(sep).join('/')
}

try {
  if (expectedReleaseTag && expectedReleaseTag !== `v${packageMetadata.version}`) {
    throw new Error(`release tag ${expectedReleaseTag} does not match package version v${packageMetadata.version}`)
  }
  await mkdir(outputDirectory, { recursive: true })
  if (await exists(archivePath)) {
    throw new Error(`refusing to overwrite existing release archive: ${archivePath}`)
  }

  await mkdir(overlay, { recursive: true })
  run(process.execPath, [resolve(projectRoot, 'bin/govuk-design-md.js'), 'init', '--target', overlay])
  run(process.execPath, [resolve(projectRoot, 'bin/govuk-design-md.js'), 'check', '--target', overlay])

  await copyFile(resolve(projectRoot, 'docs/manual-install.md'), resolve(archiveRoot, 'MANUAL-INSTALL.md'))
  await copyFile(resolve(projectRoot, 'README.md'), resolve(archiveRoot, 'README.md'))
  await copyFile(resolve(projectRoot, 'NOTICE.md'), resolve(archiveRoot, 'NOTICE.md'))
  await copyFile(resolve(projectRoot, 'LICENSE-CONTENT.md'), resolve(archiveRoot, 'LICENSE-CONTENT.md'))
  await copyFile(resolve(projectRoot, 'LICENSE-CODE.md'), resolve(archiveRoot, 'LICENSE-CODE.md'))
  await writeFile(resolve(archiveRoot, 'RELEASE.json'), `${JSON.stringify({
    schemaVersion: 1,
    packageVersion: packageMetadata.version,
    govukFrontendVersion: catalog.govukFrontendVersion,
    overlayManifest: 'repository-overlay/.govuk-design-md.json'
  }, null, 2)}\n`, 'utf8')

  const checksums = []
  for (const path of await filesIn(archiveRoot)) {
    const contents = await readFile(path)
    const digest = createHash('sha256').update(contents).digest('hex')
    checksums.push(`${digest}  ${portablePath(relative(archiveRoot, path))}`)
  }
  await writeFile(resolve(archiveRoot, 'SHA256SUMS.txt'), `${checksums.join('\n')}\n`, 'utf8')

  run('zip', ['-q', '-r', temporaryArchivePath, archiveRootName], { cwd: stagingDirectory })
  await rename(temporaryArchivePath, archivePath)
  process.stdout.write(`created ${portablePath(relative(projectRoot, archivePath))}\n`)
} finally {
  await unlink(temporaryArchivePath).catch(() => {})
  await rm(stagingDirectory, { recursive: true, force: true })
}
