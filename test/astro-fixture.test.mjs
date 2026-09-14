import assert from 'node:assert/strict'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import test, { after } from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const fixtureRoot = resolve(projectRoot, 'fixtures/astro')
const fixtureSource = await readFile(resolve(fixtureRoot, 'src/pages/index.astro'), 'utf8')
const fixtureServerSource = await readFile(resolve(projectRoot, 'scripts/serve-astro-fixture.mjs'), 'utf8')
const packageJson = JSON.parse(await readFile(resolve(projectRoot, 'package.json'), 'utf8'))
const outputDirectory = await mkdtemp(resolve(tmpdir(), 'govuk-design-md-astro-test-'))
const astroCli = resolve(projectRoot, 'node_modules/astro/bin/astro.mjs')
const build = spawnSync(process.execPath, [astroCli, 'build', '--root', fixtureRoot], {
  cwd: projectRoot,
  encoding: 'utf8',
  env: {
    ...process.env,
    ASTRO_TELEMETRY_DISABLED: '1',
    GOVUK_ASTRO_FIXTURE_OUT_DIR: outputDirectory
  }
})

if (build.status !== 0) {
  throw new Error(build.stderr || build.stdout)
}

const html = await readFile(resolve(outputDirectory, 'index.html'), 'utf8')

after(async () => {
  await rm(outputDirectory, { force: true, recursive: true })
})

test('Astro fixture pins its evidence dependencies and builds the page shell', () => {
  assert.equal(packageJson.devDependencies.astro, '7.3.2')
  assert.equal(packageJson.devDependencies['govuk-frontend'], '6.5.0')
  assert.match(html, /^<!doctype html><html class="govuk-template" lang="en">/i)
  assert.match(html, /class="govuk-template__body"/)
  assert.match(html, /govuk-frontend-supported/)
  assert.match(html, /data-govuk-astro-boundary/)
  assert.match(html, /<link rel="stylesheet" href="\/_astro\//)
  assert.doesNotMatch(html, /<astro-island\b/)
})

test('Astro fixture copies the GOV.UK assets referenced by the compiled CSS', async () => {
  await access(resolve(outputDirectory, 'assets/fonts/light-94a07e06a1-v2.woff2'))
  await access(resolve(outputDirectory, 'assets/fonts/bold-b542beb274-v2.woff2'))
})

test('Astro build output preserves the three vertical-slice component contracts', () => {
  assert.match(html, /<button\b(?=[^>]*\bclass="govuk-button")(?=[^>]*\bdata-module="govuk-button")[^>]*>/)
  assert.match(html, /class="govuk-input govuk-input--width-10 govuk-input--error"/)
  assert.match(html, /<div\b(?=[^>]*\bclass="govuk-accordion")(?=[^>]*\bdata-module="govuk-accordion")[^>]*>/)
  assert.equal((html.match(/class="govuk-accordion__section"/g) ?? []).length, 2)
})

test('Astro build output has unique and resolvable accessibility IDs', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
  assert.equal(new Set(ids).size, ids.length, 'Astro fixture contains duplicate IDs')

  for (const match of html.matchAll(/\b(?:aria-describedby|aria-labelledby)="([^"]+)"/g)) {
    for (const id of match[1].split(/\s+/)) {
      assert.ok(ids.includes(id), 'missing referenced ID: ' + id)
    }
  }

  for (const match of html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)) {
    assert.ok(ids.includes(match[1]), 'label points to missing input: ' + match[1])
  }
})

test('Astro output exposes Accordion content without JavaScript', () => {
  const contentRegions = [
    ...html.matchAll(/<div\b(?=[^>]*\bclass="govuk-accordion__section-content")(?=[^>]*\bid="astro-accordion-guidance-content-[^"]+")([^>]*)>/g)
  ]
  assert.equal(contentRegions.length, 2)

  for (const [, attributes] of contentRegions) {
    assert.doesNotMatch(attributes, /\bhidden\b/)
  }
})

test('Astro fixture scopes client enhancement and supports ClientRouter navigation', () => {
  assert.match(fixtureSource, /const initialisedScopes = new WeakSet<Element>\(\)/)
  assert.match(fixtureSource, /import\('govuk-frontend'\)/)
  assert.match(fixtureSource, /scope,/)
  assert.match(fixtureSource, /document\.addEventListener\('astro:page-load', initialiseGovuk\)/)
  assert.doesNotMatch(fixtureSource, /transition:persist/)
  assert.doesNotMatch(fixtureSource, /client:only/)
})

test('Astro fixture server stays foregrounded in agent-run browser automation', () => {
  assert.match(fixtureServerSource, /'--ignore-lock'/)
  assert.match(fixtureServerSource, /ASTRO_DEV_BACKGROUND: '0'/)
  assert.match(fixtureServerSource, /child\.kill\(signal\)/)
})
