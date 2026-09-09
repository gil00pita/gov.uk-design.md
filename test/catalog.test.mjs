import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { tokenIds } from '../scripts/lib/catalog.mjs'

const catalog = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url), 'utf8'))
const sourceManifest = JSON.parse(await readFile(new URL('../sources/govuk.json', import.meta.url), 'utf8'))
const tokens = JSON.parse(await readFile(new URL('../tokens/govuk.tokens.json', import.meta.url), 'utf8'))
const adapterManifest = JSON.parse(await readFile(new URL('../adapters/manifest.json', import.meta.url), 'utf8'))

test('generated catalog matches the reviewed style and component inventories', () => {
  assert.deepEqual(catalog.coverage.styles, { documented: 13, total: 13 })
  assert.deepEqual(catalog.coverage.components, { documented: 37, total: 37 })
  assert.deepEqual(catalog.coverage.patterns, { documented: 30, total: 30 })

  const expectedStyleIds = sourceManifest.inventories.styles.items.map(({ id }) => id).sort()
  const expectedComponentIds = sourceManifest.inventories.components.items.map(({ id }) => id).sort()
  const expectedPatternIds = sourceManifest.inventories.patterns.items.map(({ id }) => id).sort()
  assert.deepEqual(catalog.styles.map(({ id }) => id).sort(), expectedStyleIds)
  assert.deepEqual(catalog.components.map(({ id }) => id).sort(), expectedComponentIds)
  assert.deepEqual(catalog.patterns.map(({ id }) => id).sort(), expectedPatternIds)
  assert.equal(catalog.status, 'canonical-complete')
})

test('only the reviewed Trial components are marked trial', () => {
  const trialIds = catalog.components
    .filter(({ status }) => status === 'trial')
    .map(({ id }) => id)
    .sort()

  assert.deepEqual(trialIds, ['feedback', 'language-navigation'])
})

test('portable token catalog contains the reviewed token set', () => {
  assert.equal(tokenIds(tokens).length, 151)
})

test('AI adapter manifest covers the reviewed repository instruction formats', () => {
  assert.deepEqual(
    adapterManifest.adapters.map(({ id }) => id).sort(),
    ['claude-code', 'codex', 'cursor', 'gemini-cli', 'github-copilot']
  )
  assert.equal(adapterManifest.adapters.filter(({ mode }) => mode === 'managed-block').length, 4)
})
