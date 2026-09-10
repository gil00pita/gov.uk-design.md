import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { appendFile, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const cli = resolve(projectRoot, 'bin', 'govuk-design-md.js')
const packageMetadata = JSON.parse(await readFile(resolve(projectRoot, 'package.json'), 'utf8'))

function run(...args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' })
}

function hash(contents) {
  return createHash('sha256').update(contents).digest('hex')
}

function extractManagedBlock(contents) {
  const match = contents.match(/<!-- govuk-design-md:start -->[\s\S]*?<!-- govuk-design-md:end -->/)
  assert.ok(match, 'expected one govuk-design-md managed block')
  return match[0]
}

async function temporaryProject() {
  return mkdtemp(resolve(tmpdir(), 'govuk-design-md-test-'))
}

test('init installs the generated guidance and check verifies it', async () => {
  const target = await temporaryProject()
  const init = run('init', '--target', target)
  assert.equal(init.status, 0, init.stderr)
  assert.match(init.stdout, /entry point: DESIGN\.md/)

  for (const path of [
    'DESIGN.md',
    '.govuk-design-md.json',
    'design/govuk/catalog.json',
    'design/govuk/NOTICE.md',
    'design/govuk/LICENSE-CONTENT.md',
    'design/govuk/LICENSE-CODE.md',
    'design/govuk/components/button.md',
    'design/govuk/components/text-input.md',
    'design/govuk/components/accordion.md',
    'design/govuk/patterns/question-pages.md',
    'frameworks/manifest.json',
    'frameworks/html-css/DESIGN.md',
    'frameworks/react/DESIGN.md',
    'frameworks/angular/DESIGN.md',
    'frameworks/svelte/DESIGN.md',
    'AGENTS.md',
    'CLAUDE.md',
    'GEMINI.md',
    '.github/copilot-instructions.md',
    '.cursor/rules/govuk-design-system.mdc',
    '.agents/skills/govuk-design-system/SKILL.md'
  ]) {
    assert.ok(await readFile(resolve(target, path), 'utf8'))
  }

  const check = run('check', '--target', target)
  assert.equal(check.status, 0, check.stderr)
  assert.match(check.stdout, /installation is intact/)

  const manifest = JSON.parse(await readFile(resolve(target, '.govuk-design-md.json'), 'utf8'))
  assert.equal(manifest.schemaVersion, 3)
  assert.deepEqual(manifest.selections, {
    frameworks: ['html-css', 'react', 'angular', 'svelte'],
    ai: ['codex', 'claude-code', 'gemini-cli', 'github-copilot', 'cursor']
  })
  assert.equal(manifest.managedFiles['AGENTS.md'].mode, 'managed-block')
  assert.equal(manifest.managedFiles['AGENTS.md'].created, true)
  assert.equal(manifest.managedFiles['.cursor/rules/govuk-design-system.mdc'].mode, 'file')
})

test('init preserves an existing DESIGN.md', async () => {
  const target = await temporaryProject()
  await writeFile(resolve(target, 'DESIGN.md'), '# Local design\n', 'utf8')

  const init = run('init', '--target', target)
  assert.equal(init.status, 0, init.stderr)
  assert.equal(await readFile(resolve(target, 'DESIGN.md'), 'utf8'), '# Local design\n')
  assert.match(await readFile(resolve(target, 'GOVUK-DESIGN.md'), 'utf8'), /GOV\.UK Design System guidance/)
})

test('add is an alias for init', async () => {
  const target = await temporaryProject()
  const result = run('add', '--target', target)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /entry point: DESIGN\.md/)
})

test('init installs only explicitly selected framework and AI adapters', async () => {
  const target = await temporaryProject()
  const result = run(
    'init',
    '--target',
    target,
    '--framework',
    'svelte',
    '--ai=codex,cursor'
  )
  assert.equal(result.status, 0, result.stderr)

  assert.ok(await readFile(resolve(target, 'design/govuk/catalog.json'), 'utf8'))
  assert.ok(await readFile(resolve(target, 'frameworks/svelte/DESIGN.md'), 'utf8'))
  await assert.rejects(readFile(resolve(target, 'frameworks/html-css/DESIGN.md'), 'utf8'))
  await assert.rejects(readFile(resolve(target, 'frameworks/react/DESIGN.md'), 'utf8'))
  await assert.rejects(readFile(resolve(target, 'frameworks/angular/DESIGN.md'), 'utf8'))
  assert.ok(await readFile(resolve(target, 'AGENTS.md'), 'utf8'))
  assert.ok(await readFile(resolve(target, '.cursor/rules/govuk-design-system.mdc'), 'utf8'))
  assert.ok(await readFile(resolve(target, '.agents/skills/govuk-design-system/SKILL.md'), 'utf8'))
  await assert.rejects(readFile(resolve(target, 'CLAUDE.md'), 'utf8'))
  await assert.rejects(readFile(resolve(target, 'GEMINI.md'), 'utf8'))
  await assert.rejects(readFile(resolve(target, '.github/copilot-instructions.md'), 'utf8'))

  const frameworkManifest = JSON.parse(await readFile(resolve(target, 'frameworks/manifest.json'), 'utf8'))
  assert.deepEqual(frameworkManifest.adapters.map(({ id }) => id), ['svelte'])

  const entryPoint = await readFile(resolve(target, 'DESIGN.md'), 'utf8')
  assert.match(entryPoint, /\[Svelte\]\(frameworks\/svelte\/DESIGN\.md\)/)
  assert.doesNotMatch(entryPoint, /\[Plain HTML and CSS\]/)
  assert.doesNotMatch(entryPoint, /\[React\]/)
  assert.doesNotMatch(entryPoint, /\[Angular\]/)

  const manifest = JSON.parse(await readFile(resolve(target, '.govuk-design-md.json'), 'utf8'))
  assert.deepEqual(manifest.selections, { frameworks: ['svelte'], ai: ['codex', 'cursor'] })
  assert.equal(run('check', '--target', target).status, 0)
})

test('init supports explicit none selections without touching AI instruction files', async () => {
  const target = await temporaryProject()
  const result = run('init', '--target', target, '--framework', 'none', '--ai', 'none')
  assert.equal(result.status, 0, result.stderr)

  assert.ok(await readFile(resolve(target, 'design/govuk/catalog.json'), 'utf8'))
  const frameworkManifest = JSON.parse(await readFile(resolve(target, 'frameworks/manifest.json'), 'utf8'))
  assert.deepEqual(frameworkManifest.adapters, [])
  assert.match(
    await readFile(resolve(target, 'DESIGN.md'), 'utf8'),
    /No framework adapter was selected during installation/
  )

  for (const path of [
    'frameworks/html-css/DESIGN.md',
    'frameworks/react/DESIGN.md',
    'frameworks/angular/DESIGN.md',
    'frameworks/svelte/DESIGN.md',
    '.agents/skills/govuk-design-system/SKILL.md',
    'AGENTS.md',
    'CLAUDE.md',
    'GEMINI.md',
    '.github/copilot-instructions.md',
    '.cursor/rules/govuk-design-system.mdc'
  ]) {
    await assert.rejects(readFile(resolve(target, path), 'utf8'))
  }

  const manifest = JSON.parse(await readFile(resolve(target, '.govuk-design-md.json'), 'utf8'))
  assert.deepEqual(manifest.selections, { frameworks: [], ai: [] })
  assert.equal(run('check', '--target', target).status, 0)
})

test('adapter selection rejects unknown IDs before installation', async () => {
  const target = await temporaryProject()
  const result = run('init', '--target', target, '--framework', 'react,vue')
  assert.equal(result.status, 1)
  assert.match(result.stderr, /unknown framework adapter: vue/)
  assert.match(result.stderr, /available: html-css, react, angular, svelte, all, none/)
  await assert.rejects(readFile(resolve(target, '.govuk-design-md.json'), 'utf8'))
})

test('adapter selection options are limited to init and add', async () => {
  const target = await temporaryProject()
  assert.equal(run('init', '--target', target).status, 0)
  const result = run('check', '--target', target, '--framework', 'react')
  assert.equal(result.status, 1)
  assert.match(result.stderr, /can only be used with init or add/)
})

test('check reports a modified managed file', async () => {
  const target = await temporaryProject()
  assert.equal(run('init', '--target', target).status, 0)
  await writeFile(resolve(target, 'design/govuk/components/button.md'), 'locally changed\n', 'utf8')

  const check = run('check', '--target', target)
  assert.equal(check.status, 1)
  assert.match(check.stderr, /button\.md: modified/)
})

test('init preserves existing AI instructions and check ignores edits outside the managed block', async () => {
  const target = await temporaryProject()
  await writeFile(resolve(target, 'AGENTS.md'), '# Local agent instructions\n\n- Keep this line.\n', 'utf8')

  const init = run('init', '--target', target)
  assert.equal(init.status, 0, init.stderr)
  const installed = await readFile(resolve(target, 'AGENTS.md'), 'utf8')
  assert.match(installed, /^# Local agent instructions/m)
  assert.match(installed, /<!-- govuk-design-md:start -->/)
  assert.equal(installed.match(/<!-- govuk-design-md:start -->/g)?.length, 1)

  await appendFile(resolve(target, 'AGENTS.md'), '\n- A later local instruction.\n', 'utf8')
  const check = run('check', '--target', target)
  assert.equal(check.status, 0, check.stderr)
})

test('check reports changes inside an AI adapter managed block', async () => {
  const target = await temporaryProject()
  assert.equal(run('init', '--target', target).status, 0)
  const path = resolve(target, 'CLAUDE.md')
  const installed = await readFile(path, 'utf8')
  await writeFile(path, installed.replace('Preserve official semantic HTML', 'Change official semantic HTML'), 'utf8')

  const check = run('check', '--target', target)
  assert.equal(check.status, 1)
  assert.match(check.stderr, /CLAUDE\.md: managed block modified/)
})

test('init refuses an orphaned managed block without taking ownership', async () => {
  const target = await temporaryProject()
  await writeFile(
    resolve(target, 'GEMINI.md'),
    '<!-- govuk-design-md:start -->\nlocal block\n<!-- govuk-design-md:end -->\n',
    'utf8'
  )

  const init = run('init', '--target', target)
  assert.equal(init.status, 1)
  assert.match(init.stderr, /contains an unmanaged govuk-design-md block/)
})

test('diff previews and update replaces an unmodified older managed file', async () => {
  const target = await temporaryProject()
  assert.equal(run('init', '--target', target).status, 0)
  const designPath = resolve(target, 'DESIGN.md')
  const oldContents = '# Older generated guidance\n'
  await writeFile(designPath, oldContents, 'utf8')

  const manifestPath = resolve(target, '.govuk-design-md.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  manifest.packageVersion = '0.3.0'
  manifest.managedFiles['DESIGN.md'].hash = hash(oldContents)
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  const preview = run('diff', '--target', target)
  assert.equal(preview.status, 0, preview.stderr)
  assert.match(preview.stdout, /would update DESIGN\.md/)

  const dryRun = run('update', '--dry-run', '--target', target)
  assert.equal(dryRun.status, 0, dryRun.stderr)
  assert.equal(await readFile(designPath, 'utf8'), oldContents)

  const update = run('update', '--target', target)
  assert.equal(update.status, 0, update.stderr)
  assert.equal(await readFile(designPath, 'utf8'), await readFile(resolve(projectRoot, 'DESIGN.md'), 'utf8'))
  const updatedManifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  assert.equal(updatedManifest.packageVersion, packageMetadata.version)
})

test('update changes only an unmodified managed block and preserves local instructions', async () => {
  const target = await temporaryProject()
  const agentsPath = resolve(target, 'AGENTS.md')
  await writeFile(agentsPath, '# Local instructions\n\n- Preserve this.\n', 'utf8')
  assert.equal(run('init', '--target', target).status, 0)

  const installed = await readFile(agentsPath, 'utf8')
  const currentBlock = extractManagedBlock(installed)
  const oldBlock = currentBlock.replace('official semantic HTML', 'older semantic HTML')
  const oldContents = installed.replace(currentBlock, oldBlock)
  await writeFile(agentsPath, oldContents, 'utf8')

  const manifestPath = resolve(target, '.govuk-design-md.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  manifest.packageVersion = '0.3.0'
  manifest.managedFiles['AGENTS.md'].hash = hash(oldBlock)
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  const update = run('update', '--target', target)
  assert.equal(update.status, 0, update.stderr)
  const updated = await readFile(agentsPath, 'utf8')
  assert.match(updated, /^# Local instructions/m)
  assert.match(updated, /- Preserve this\./)
  assert.equal(extractManagedBlock(updated), currentBlock)
})

test('update preserves the installed framework and AI selections', async () => {
  const target = await temporaryProject()
  assert.equal(
    run('init', '--target', target, '--framework', 'react', '--ai', 'cursor').status,
    0
  )

  const guidancePath = resolve(target, 'frameworks/react/DESIGN.md')
  const oldContents = '# Older React guidance\n'
  await writeFile(guidancePath, oldContents, 'utf8')

  const manifestPath = resolve(target, '.govuk-design-md.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  manifest.packageVersion = '0.3.0'
  manifest.managedFiles['frameworks/react/DESIGN.md'].hash = hash(oldContents)
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')

  const update = run('update', '--target', target)
  assert.equal(update.status, 0, update.stderr)
  assert.equal(
    await readFile(guidancePath, 'utf8'),
    await readFile(resolve(projectRoot, 'frameworks/react/DESIGN.md'), 'utf8')
  )
  await assert.rejects(readFile(resolve(target, 'frameworks/html-css/DESIGN.md'), 'utf8'))
  await assert.rejects(readFile(resolve(target, 'frameworks/angular/DESIGN.md'), 'utf8'))
  await assert.rejects(readFile(resolve(target, 'frameworks/svelte/DESIGN.md'), 'utf8'))
  await assert.rejects(readFile(resolve(target, 'AGENTS.md'), 'utf8'))
  assert.ok(await readFile(resolve(target, '.cursor/rules/govuk-design-system.mdc'), 'utf8'))

  const updatedManifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  assert.deepEqual(updatedManifest.selections, { frameworks: ['react'], ai: ['cursor'] })
})

test('update never overwrites a locally modified managed file and emits a conflict file', async () => {
  const target = await temporaryProject()
  assert.equal(run('init', '--target', target).status, 0)
  const buttonPath = resolve(target, 'design/govuk/components/button.md')
  await writeFile(buttonPath, 'local button guidance\n', 'utf8')

  const update = run('update', '--target', target)
  assert.equal(update.status, 1)
  assert.match(update.stderr, /button\.md: conflict/)
  assert.match(update.stderr, /button\.md\.govuk-design-md\.new/)
  assert.equal(await readFile(buttonPath, 'utf8'), 'local button guidance\n')
  assert.equal(
    await readFile(`${buttonPath}.govuk-design-md.new`, 'utf8'),
    await readFile(resolve(projectRoot, 'design/govuk/components/button.md'), 'utf8')
  )
})

test('uninstall removes clean managed content and preserves pre-existing files', async () => {
  const target = await temporaryProject()
  const designPath = resolve(target, 'DESIGN.md')
  const agentsPath = resolve(target, 'AGENTS.md')
  await writeFile(designPath, '# Local design\n', 'utf8')
  await writeFile(agentsPath, '# Local agent instructions\n', 'utf8')
  assert.equal(run('init', '--target', target).status, 0)

  const dryRun = run('uninstall', '--dry-run', '--target', target)
  assert.equal(dryRun.status, 0, dryRun.stderr)
  assert.ok(await readFile(resolve(target, 'GOVUK-DESIGN.md'), 'utf8'))

  const uninstall = run('uninstall', '--target', target)
  assert.equal(uninstall.status, 0, uninstall.stderr)
  assert.equal(await readFile(designPath, 'utf8'), '# Local design\n')
  const agents = await readFile(agentsPath, 'utf8')
  assert.match(agents, /^# Local agent instructions/m)
  assert.doesNotMatch(agents, /govuk-design-md:start/)
  await assert.rejects(readFile(resolve(target, 'GOVUK-DESIGN.md'), 'utf8'))
  await assert.rejects(readFile(resolve(target, '.govuk-design-md.json'), 'utf8'))
  await assert.rejects(readFile(resolve(target, 'design/govuk/catalog.json'), 'utf8'))
  await assert.rejects(readFile(resolve(target, 'CLAUDE.md'), 'utf8'))
})

test('uninstall stops before removing anything when managed content was modified', async () => {
  const target = await temporaryProject()
  assert.equal(run('init', '--target', target).status, 0)
  const buttonPath = resolve(target, 'design/govuk/components/button.md')
  await writeFile(buttonPath, 'local button guidance\n', 'utf8')

  const uninstall = run('uninstall', '--target', target)
  assert.equal(uninstall.status, 1)
  assert.match(uninstall.stderr, /uninstall stopped; no managed content was removed/)
  assert.equal(await readFile(buttonPath, 'utf8'), 'local button guidance\n')
  assert.ok(await readFile(resolve(target, 'DESIGN.md'), 'utf8'))
  assert.ok(await readFile(resolve(target, '.govuk-design-md.json'), 'utf8'))
})

test('dry-run does not create a manifest', async () => {
  const target = await temporaryProject()
  const result = run('init', '--dry-run', '--target', target)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /would create \.govuk-design-md\.json/)

  const check = run('check', '--target', target)
  assert.equal(check.status, 1)
  assert.match(check.stderr, /was not found/)
})
