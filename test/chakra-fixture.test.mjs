import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const packageJson = JSON.parse(await readFile(resolve(projectRoot, 'package.json'), 'utf8'))
const adapterSource = JSON.parse(await readFile(resolve(projectRoot, 'sources/ui-framework-adapters.json'), 'utf8'))
const appSource = await readFile(resolve(projectRoot, 'fixtures/chakra/app.mjs'), 'utf8')
const clientSource = await readFile(resolve(projectRoot, 'fixtures/chakra/client.mjs'), 'utf8')
const fallbackCss = await readFile(resolve(projectRoot, 'fixtures/chakra/fallback.css'), 'utf8')
const pageSource = await readFile(resolve(projectRoot, 'fixtures/chakra/page.mjs'), 'utf8')
const serverSource = await readFile(resolve(projectRoot, 'scripts/serve-chakra-fixture.mjs'), 'utf8')

test('Chakra fixture pins its evidence dependencies and adapter', () => {
  assert.equal(packageJson.devDependencies['@chakra-ui/react'], '3.37.0')
  assert.equal(packageJson.devDependencies['@emotion/react'], '11.14.0')
  assert.equal(packageJson.devDependencies.react, '19.3.0')
  assert.equal(packageJson.devDependencies['react-dom'], '19.3.0')
  assert.equal(packageJson.devDependencies['govuk-frontend'], '6.5.0')

  const adapter = adapterSource.adapters.find(({ id }) => id === 'chakra')
  assert.ok(adapter, 'missing Chakra UI adapter source')
  assert.equal(adapter.implementation.package, '@chakra-ui/react')
  assert.equal(adapter.implementation.version, '3.37.0')
  assert.deepEqual(adapter.compatibility, ['guidance', 'token', 'markup', 'behaviour-tested'])
})

test('Chakra fixture keeps style props on a service-owned wrapper', () => {
  assert.match(appSource, /data-chakra-service-wrapper/)
  assert.match(appSource, /bg: 'govuk-surface'/)
  assert.match(appSource, /padding: 'govuk-responsive-6'/)
  assert.match(appSource, /maxW: 'govuk-page'/)
  assert.doesNotMatch(appSource, /h\(Button\b/)

  assert.match(appSource, /className: 'govuk-button'/)
  assert.match(appSource, /className: 'govuk-input govuk-input--width-10 govuk-input--error'/)
  assert.match(appSource, /className: 'govuk-accordion'/)
})

test('Chakra fixture declares an explicit no-reset and no-runtime fallback boundary', async () => {
  const systemSource = await readFile(
    resolve(projectRoot, 'ui-frameworks/chakra/govuk-system.mjs'),
    'utf8'
  )

  assert.match(systemSource, /defaultBaseConfig/)
  assert.match(systemSource, /disableLayers:\s*true/)
  assert.match(systemSource, /preflight:\s*false/)
  assert.match(systemSource, /globalCss:\s*\{\}/)
  assert.match(systemSource, /cssVarsPrefix:\s*['"]govuk-chakra['"]/)
  assert.doesNotMatch(systemSource, /fontFamily|fonts:/)

  assert.match(appSource, /href: '\/govuk-design\/tokens\/govuk\.css'/)
  assert.match(appSource, /href: '\/chakra\/fallback\.css'/)
  assert.match(fallbackCss, /\.govuk-chakra-service-surface/)
  assert.match(fallbackCss, /var\(--govuk-spacing-responsive-6\)/)
  assert.doesNotMatch(fallbackCss, /\.govuk-(?:button|input|accordion)\b/)
})

test('Chakra server output preserves semantics and no-JavaScript content', async () => {
  const { renderFixturePage } = await import('../fixtures/chakra/page.mjs')
  const html = renderFixturePage()

  assert.match(html, /^<!doctype html><html class="govuk-template" lang="en">/)
  assert.match(html, /class="govuk-template__body"/)
  assert.match(html, /href="\/vendor\/govuk\/govuk-frontend\.min\.css"/)
  assert.match(html, /src="\/chakra\/client\.js"/)
  assert.match(html, /data-chakra-service-wrapper=""/)
  assert.match(html, /class="govuk-button" data-module="govuk-button"/)
  assert.match(html, /class="govuk-input govuk-input--width-10 govuk-input--error"/)
  assert.match(html, /class="govuk-accordion" data-module="govuk-accordion"/)
  assert.equal((html.match(/class="govuk-accordion__section"/g) ?? []).length, 2)

  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
  assert.equal(new Set(ids).size, ids.length, 'Chakra fixture contains duplicate IDs')

  for (const match of html.matchAll(/\b(?:aria-describedby|aria-labelledby)="([^"]+)"/g)) {
    for (const id of match[1].split(/\s+/)) {
      assert.ok(ids.includes(id), 'missing referenced ID: ' + id)
    }
  }

  for (const match of html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)) {
    assert.ok(ids.includes(match[1]), 'label points to missing input: ' + match[1])
  }

  const contentRegions = [
    ...html.matchAll(/<div class="govuk-accordion__section-content" id="chakra-accordion-guidance-content-[^"]+"([^>]*)>/g)
  ]
  assert.equal(contentRegions.length, 2)
  for (const [, attributes] of contentRegions) {
    assert.doesNotMatch(attributes, /\bhidden\b/)
  }
})

test('Chakra client hydrates before scoped GOV.UK Frontend initialisation', () => {
  assert.match(clientSource, /hydrateRoot\(document/)
  assert.match(clientSource, /onRecoverableError/)
  assert.match(appSource, /import\('govuk-frontend'\)/)
  assert.match(appSource, /initAll\(\{\s*scope: container,/s)
  assert.match(appSource, /const initialisedScopes = new WeakSet\(\)/)
})

test('Chakra fixture emits its preserved-world direction contract as a hydratable comment', () => {
  assert.match(pageSource, /THESIS: Preserve the established GOV\.UK vertical slice/)
  assert.match(pageSource, /OWN-WORLD: GOV\.UK colour, spacing, typography/)
  assert.match(pageSource, /STORY: The reader sees the adapter boundary/)
  assert.match(pageSource, /FIRST VIEWPORT: A GOV\.UK heading/)
  assert.match(pageSource, /FORM: Established GOV\.UK fixture extension/)
  assert.match(pageSource, /FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN\.md/)
  assert.match(pageSource, /documentHtml\.replace\(\/\(<body\\b\[\^>\]\*>\)\//)
  assert.match(clientSource, /hydrateRoot\(document/)
})

test('Chakra fixture server contains asset routes and rejects escaped paths', () => {
  assert.match(serverSource, /\['\/govuk-design\/', govukDesignRoot\]/)
  assert.match(serverSource, /\['\/chakra\/', fixtureRoot\]/)
  assert.match(serverSource, /function within\(root, candidate\)/)
  assert.match(serverSource, /within\(root, candidate\) \? candidate : null/)
})
