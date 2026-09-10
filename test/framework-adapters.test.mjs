import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const source = JSON.parse(await readFile(resolve(projectRoot, 'sources/framework-adapters.json'), 'utf8'))
const manifest = JSON.parse(await readFile(resolve(projectRoot, 'frameworks/manifest.json'), 'utf8'))
const htmlGuidance = await readFile(resolve(projectRoot, 'frameworks/html-css/DESIGN.md'), 'utf8')
const htmlFixture = await readFile(resolve(projectRoot, 'fixtures/vertical-slice/index.html'), 'utf8')
const reactGuidance = await readFile(resolve(projectRoot, 'frameworks/react/DESIGN.md'), 'utf8')
const reactFixture = await readFile(resolve(projectRoot, 'fixtures/react/app.mjs'), 'utf8')
const angularGuidance = await readFile(resolve(projectRoot, 'frameworks/angular/DESIGN.md'), 'utf8')
const angularFixture = await readFile(resolve(projectRoot, 'fixtures/angular/client.mjs'), 'utf8')

test('Plain HTML/CSS is the behaviour-tested reference adapter', () => {
  assert.equal(source.govukFrontendVersion, '6.5.0')
  assert.equal(manifest.govukFrontendVersion, source.govukFrontendVersion)
  assert.deepEqual(manifest.compatibilityLevels, [
    'guidance',
    'token',
    'markup',
    'behaviour-tested'
  ])
  assert.equal(manifest.adapters.length, 3)
  assert.deepEqual(manifest.adapters[0], {
    id: 'html-css',
    name: 'Plain HTML and CSS',
    status: 'reference',
    guidance: 'html-css/DESIGN.md',
    fixture: 'fixtures/vertical-slice/index.html',
    compatibility: ['guidance', 'token', 'markup', 'behaviour-tested']
  })
  assert.deepEqual(manifest.adapters[1], {
    id: 'react',
    name: 'React',
    status: 'experimental',
    guidance: 'react/DESIGN.md',
    fixture: 'fixtures/react/app.mjs',
    compatibility: ['guidance', 'token', 'markup', 'behaviour-tested']
  })
  assert.deepEqual(manifest.adapters[2], {
    id: 'angular',
    name: 'Angular',
    status: 'experimental',
    guidance: 'angular/DESIGN.md',
    fixture: 'fixtures/angular/app.mjs',
    compatibility: ['guidance', 'token', 'markup', 'behaviour-tested']
  })
})

test('Plain HTML/CSS guidance carries the page and enhancement contracts', () => {
  assert.match(htmlGuidance, /<html class="govuk-template" lang="en">/)
  assert.match(htmlGuidance, /govuk-frontend-supported/)
  assert.match(htmlGuidance, /import \{ initAll \} from '\/govuk\/govuk-frontend\.min\.js'/)
  assert.match(htmlGuidance, /initAll\(container\)/)
  assert.match(htmlGuidance, /portable CSS variables are for project extensions/i)
  assert.match(htmlGuidance, /Do not repeatedly call initAll\(\) over the whole document/)
})

test('Plain HTML/CSS fixture uses the adapter asset and markup model', () => {
  assert.match(htmlFixture, /href="\/vendor\/govuk\/govuk-frontend\.min\.css"/)
  assert.match(htmlFixture, /from '\/vendor\/govuk\/govuk-frontend\.min\.js'/)
  assert.match(htmlFixture, /class="govuk-button" data-module="govuk-button"/)
  assert.match(htmlFixture, /class="govuk-accordion" data-module="govuk-accordion"/)
})

test('React guidance preserves SSR, hydration and externally managed DOM boundaries', () => {
  assert.match(reactGuidance, /Status:\*\* Experimental/)
  assert.match(reactGuidance, /hydrateRoot\(\s*document/)
  assert.match(reactGuidance, /suppressHydrationWarning/)
  assert.match(reactGuidance, /const initialisedScopes = new WeakSet\(\)/)
  assert.match(reactGuidance, /scope: container/)
  assert.match(reactGuidance, /initialChildren = useRef\(children\)/)
  assert.match(reactGuidance, /no general public destroy lifecycle/i)
  assert.match(reactGuidance, /React Strict Mode runs an extra development Effect cycle/)
})

test('React fixture implements the reviewed boundary and client-only GOV.UK import', () => {
  assert.match(reactFixture, /export function GovukFrontendBoundary/)
  assert.match(reactFixture, /import\('govuk-frontend'\)/)
  assert.match(reactFixture, /initialisedScopes\.has\(container\)/)
  assert.match(reactFixture, /scope: container/)
  assert.match(reactFixture, /initialChildren\.current/)
})

test('Angular guidance preserves SSR, hydration and externally managed DOM boundaries', () => {
  assert.match(angularGuidance, /Status:\*\* Experimental/)
  assert.match(angularGuidance, /provideClientHydration\(withNoIncrementalHydration\(\)\)/)
  assert.match(angularGuidance, /await app\.whenStable\(\)/)
  assert.match(angularGuidance, /requestAnimationFrame/)
  assert.match(angularGuidance, /ChangeDetectionStrategy\.OnPush/)
  assert.match(angularGuidance, /afterNextRender/)
  assert.match(angularGuidance, /provideServerRendering\(\)/)
  assert.match(angularGuidance, /ngSkipHydration as the default integration strategy/)
  assert.match(angularGuidance, /no general public destroy lifecycle/i)
})

test('Angular fixture delays its client-only GOV.UK import until after application stability', () => {
  assert.match(angularFixture, /bootstrapApplication\(GovukFixtureComponent, appConfig\)/)
  assert.match(angularFixture, /await application\.whenStable\(\)/)
  assert.match(angularFixture, /requestAnimationFrame/)
  assert.match(angularFixture, /import\('govuk-frontend'\)/)
  assert.match(angularFixture, /scope,/)
})
