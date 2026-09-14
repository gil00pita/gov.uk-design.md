import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, symlink, writeFile, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { projectRoot, loadComponents, loadStyles, loadPatterns, expectedGeneratedFiles } from '../scripts/lib/catalog.mjs'

const exportPath = resolve(projectRoot, 'adapters/open-design/DESIGN.md')
const cli = resolve(projectRoot, 'bin/govuk-design-md.js')
const run = (...args) => spawnSync(process.execPath, [cli, 'export-open-design', ...args], { encoding: 'utf8' })

test('OpenDesign export is current, self-contained and preserves reviewed guidance and examples', async () => {
  const markdown = await readFile(exportPath, 'utf8')
  assert.equal(markdown, (await expectedGeneratedFiles()).get(exportPath))
  assert.match(markdown, /^---\nname: GOV\.UK Design System\n/)
  assert.match(markdown, /^# GOV\.UK Design System$/m)
  assert.match(markdown, /^> Category: Government & Public Services$/m)
  assert.equal([...markdown.matchAll(/^## \d\. /gm)].length, 9)
  const tokens = JSON.parse(await readFile(resolve(projectRoot, 'tokens/govuk.tokens.json'), 'utf8'))
  assert.ok(markdown.includes(`primary: "${tokens.govuk.color.link.$value}"`))
  const [components, styles, patterns] = await Promise.all([loadComponents(), loadStyles(), loadPatterns()])
  for (const record of [...components, ...styles, ...patterns]) {
    assert.ok(markdown.includes(`### ${record.name}\n`), record.id)
    assert.ok(markdown.includes(record.summary), record.id)
    assert.ok(markdown.includes(record.source.guidanceUrl), record.id)
    for (const rule of record.accessibility) assert.ok(markdown.includes(rule), `${record.id}: accessibility`)
    for (const example of record.htmlExamples ?? []) assert.ok(markdown.includes(example.html), `${record.id}: HTML`)
  }
  const links = [...markdown.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1])
  assert.ok(links.length >= 80)
  assert.ok(links.every((link) => link.startsWith('https://') || link.startsWith('#')), 'all links must work without sibling files')
  assert.match(markdown, /not affiliated with or endorsed/)
  assert.match(markdown, /Open Government Licence v3\.0/)
})

test('OpenDesign export creates missing target directories and refuses to overwrite user content or symlinks', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'govuk-open-design-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const target = resolve(root, 'new/library')
  const preview = run('--target', target, '--dry-run')
  assert.equal(preview.status, 0, preview.stderr)
  await assert.rejects(access(target), { code: 'ENOENT' })
  const exported = run('--target', target)
  assert.equal(exported.status, 0, exported.stderr)
  assert.equal(await readFile(resolve(target, 'DESIGN.md'), 'utf8'), await readFile(exportPath, 'utf8'))
  await writeFile(resolve(target, 'DESIGN.md'), 'User-owned guidance')
  assert.equal(run('--target', target).status, 1)
  assert.equal(await readFile(resolve(target, 'DESIGN.md'), 'utf8'), 'User-owned guidance')
  await rm(resolve(target, 'DESIGN.md'))
  const missing = resolve(root, 'missing.md')
  await symlink(missing, resolve(target, 'DESIGN.md'))
  assert.equal(run('--target', target).status, 1)
  await assert.rejects(access(missing), { code: 'ENOENT' })
  assert.equal(run('--target', root, '--framework', 'react').status, 1)
})
