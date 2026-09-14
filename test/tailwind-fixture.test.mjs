import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import test, { after } from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const fixtureRoot = resolve(projectRoot, 'fixtures/tailwind')
const html = await readFile(resolve(fixtureRoot, 'index.html'), 'utf8')
const inputCss = await readFile(resolve(fixtureRoot, 'input.css'), 'utf8')
const themeCss = await readFile(resolve(projectRoot, 'ui-frameworks/tailwind/govuk-theme.css'), 'utf8')
const packageJson = JSON.parse(await readFile(resolve(projectRoot, 'package.json'), 'utf8'))
const outputDirectory = await mkdtemp(resolve(tmpdir(), 'govuk-design-md-tailwind-test-'))
const outputPath = resolve(outputDirectory, 'tailwind.css')
const tailwindCli = resolve(projectRoot, 'node_modules/@tailwindcss/cli/dist/index.mjs')
const build = spawnSync(
  process.execPath,
  [tailwindCli, '-i', resolve(fixtureRoot, 'input.css'), '-o', outputPath, '--minify'],
  { cwd: projectRoot, encoding: 'utf8' }
)

if (build.status !== 0) throw new Error(build.stderr || build.stdout)
const generatedCss = await readFile(outputPath, 'utf8')

after(async () => {
  await rm(outputDirectory, { force: true, recursive: true })
})

test('Tailwind fixture pins its evidence dependencies and stylesheet order', () => {
  assert.equal(packageJson.devDependencies.tailwindcss, '4.3.3')
  assert.equal(packageJson.devDependencies['@tailwindcss/cli'], '4.3.3')
  assert.equal(packageJson.devDependencies['govuk-frontend'], '6.5.0')
  assert.ok(
    html.indexOf('href="/vendor/tailwind.css"') < html.indexOf('href="/vendor/govuk/govuk-frontend.min.css"'),
    'layered Tailwind CSS must load before unlayered GOV.UK Frontend CSS'
  )
  assert.doesNotMatch(html, /cdn\.tailwindcss|@tailwindcss\/browser/)
})

test('Tailwind build omits Preflight and scans only the explicit fixture source', () => {
  assert.match(inputCss, /@import "tailwindcss\/theme\.css" layer\(theme\)/)
  assert.match(inputCss, /@import "tailwindcss\/utilities\.css" layer\(utilities\) source\(none\)/)
  assert.match(inputCss, /@source "\.\/index\.html"/)
  assert.doesNotMatch(inputCss, /tailwindcss\/preflight\.css/)
  assert.doesNotMatch(inputCss, /@import "tailwindcss"/)
  assert.doesNotMatch(generatedCss, /box-sizing:border-box/)
})

test('Tailwind build generates namespaced GOV.UK token utilities', () => {
  assert.match(themeCss, /@import "\.\.\/\.\.\/design\/govuk\/tokens\/govuk\.css"/)
  assert.match(themeCss, /@theme static/)
  assert.match(themeCss, /--color-govuk-brand: var\(--govuk-color-brand\)/)
  assert.match(themeCss, /--breakpoint-govuk-tablet: 40\.0625rem/)
  assert.match(generatedCss, /\.bg-govuk-surface\{background-color:var\(--color-govuk-surface\)\}/)
  assert.match(generatedCss, /\.p-govuk-responsive-6\{padding:var\(--spacing-govuk-responsive-6\)\}/)
  assert.match(generatedCss, /\.text-govuk-text\{color:var\(--color-govuk-text\)\}/)
  assert.match(generatedCss, /@media \(min-width:40\.0625rem\).*\.govuk-tablet\\:max-w-govuk-page/s)
})

test('Tailwind fixture preserves official component markup', () => {
  assert.match(html, /<button class="govuk-button" data-module="govuk-button" type="submit">/)
  assert.match(html, /class="govuk-input govuk-input--width-10 govuk-input--error"/)
  assert.match(html, /class="govuk-accordion" data-module="govuk-accordion"/)
  assert.equal((html.match(/class="govuk-accordion__section"/g) ?? []).length, 2)
  assert.match(html, /import \{ initAll \} from '\/vendor\/govuk\/govuk-frontend\.min\.js'/)
})

test('Tailwind fixture has unique and resolvable accessibility IDs', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
  assert.equal(new Set(ids).size, ids.length, 'Tailwind fixture contains duplicate IDs')

  for (const match of html.matchAll(/\b(?:aria-describedby|aria-labelledby)="([^"]+)"/g)) {
    for (const id of match[1].split(/\s+/)) {
      assert.ok(ids.includes(id), `missing referenced ID: ${id}`)
    }
  }

  for (const match of html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)) {
    assert.ok(ids.includes(match[1]), `label points to missing input: ${match[1]}`)
  }
})

test('Tailwind fixture exposes Accordion content without JavaScript', () => {
  const contentRegions = [
    ...html.matchAll(/<div\b(?=[^>]*\bclass="govuk-accordion__section-content")(?=[^>]*\bid="tailwind-accordion-guidance-content-[^"]+")([^>]*)>/g)
  ]
  assert.equal(contentRegions.length, 2)
  for (const [, attributes] of contentRegions) assert.doesNotMatch(attributes, /\bhidden\b/)
})
