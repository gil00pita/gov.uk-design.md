import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const fixturePath = resolve(projectRoot, 'fixtures/vertical-slice/index.html')
const packagePath = resolve(projectRoot, 'package.json')

const html = await readFile(fixturePath, 'utf8')
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))

test('fixture uses the exact reviewed GOV.UK Frontend release', () => {
  assert.equal(packageJson.devDependencies['govuk-frontend'], '6.5.0')
  assert.match(html, /href="\/vendor\/govuk\/govuk-frontend\.min\.css"/)
  assert.match(html, /import \{ initAll \} from '\/vendor\/govuk\/govuk-frontend\.min\.js'/)
  assert.match(html, /govuk-frontend-supported/)
})

test('fixture contains the three vertical-slice component contracts', () => {
  assert.match(html, /class="govuk-button" data-module="govuk-button"/)
  assert.match(html, /class="govuk-input govuk-input--width-10 govuk-input--error"/)
  assert.match(html, /class="govuk-accordion" data-module="govuk-accordion"/)
  assert.equal((html.match(/class="govuk-accordion__section"/g) ?? []).length, 2)
})

test('fixture IDs are unique and all accessibility ID references resolve', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
  assert.equal(new Set(ids).size, ids.length, 'fixture contains duplicate IDs')

  for (const match of html.matchAll(/\b(?:aria-describedby|aria-labelledby)="([^"]+)"/g)) {
    for (const id of match[1].split(/\s+/)) {
      assert.ok(ids.includes(id), `missing referenced ID: ${id}`)
    }
  }

  for (const match of html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)) {
    assert.ok(ids.includes(match[1]), `label points to missing input: ${match[1]}`)
  }
})

test('accordion content is present before JavaScript enhancement', () => {
  const contentRegions = [...html.matchAll(/<div id="accordion-guidance-content-[^"]+" class="govuk-accordion__section-content"([^>]*)>/g)]
  assert.equal(contentRegions.length, 2)

  for (const [, attributes] of contentRegions) {
    assert.doesNotMatch(attributes, /\bhidden\b/)
  }
})
