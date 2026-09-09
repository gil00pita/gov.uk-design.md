import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const source = JSON.parse(await readFile(resolve(projectRoot, 'sources/framework-adapters.json'), 'utf8'))
const manifest = JSON.parse(await readFile(resolve(projectRoot, 'frameworks/manifest.json'), 'utf8'))
const guidance = await readFile(resolve(projectRoot, 'frameworks/html-css/DESIGN.md'), 'utf8')
const fixture = await readFile(resolve(projectRoot, 'fixtures/vertical-slice/index.html'), 'utf8')

test('Plain HTML/CSS is the behaviour-tested reference adapter', () => {
  assert.equal(source.govukFrontendVersion, '6.5.0')
  assert.equal(manifest.govukFrontendVersion, source.govukFrontendVersion)
  assert.deepEqual(manifest.compatibilityLevels, [
    'guidance',
    'token',
    'markup',
    'behaviour-tested'
  ])
  assert.equal(manifest.adapters.length, 1)
  assert.deepEqual(manifest.adapters[0], {
    id: 'html-css',
    name: 'Plain HTML and CSS',
    status: 'reference',
    guidance: 'html-css/DESIGN.md',
    fixture: 'fixtures/vertical-slice/index.html',
    compatibility: ['guidance', 'token', 'markup', 'behaviour-tested']
  })
})

test('Plain HTML/CSS guidance carries the page and enhancement contracts', () => {
  assert.match(guidance, /<html class="govuk-template" lang="en">/)
  assert.match(guidance, /govuk-frontend-supported/)
  assert.match(guidance, /import \{ initAll \} from '\/govuk\/govuk-frontend\.min\.js'/)
  assert.match(guidance, /initAll\(container\)/)
  assert.match(guidance, /portable CSS variables are for project extensions/i)
  assert.match(guidance, /Do not repeatedly call initAll\(\) over the whole document/)
})

test('Plain HTML/CSS fixture uses the adapter asset and markup model', () => {
  assert.match(fixture, /href="\/vendor\/govuk\/govuk-frontend\.min\.css"/)
  assert.match(fixture, /from '\/vendor\/govuk\/govuk-frontend\.min\.js'/)
  assert.match(fixture, /class="govuk-button" data-module="govuk-button"/)
  assert.match(fixture, /class="govuk-accordion" data-module="govuk-accordion"/)
})
