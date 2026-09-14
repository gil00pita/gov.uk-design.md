import assert from 'node:assert/strict'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const fixtureRoot = resolve(projectRoot, 'fixtures/shadcn')
const packageJson = JSON.parse(await readFile(resolve(projectRoot, 'package.json'), 'utf8'))
const appSource = await readFile(resolve(fixtureRoot, 'app.mjs'), 'utf8')
const alertDialogSource = await readFile(resolve(fixtureRoot, 'components/ui/alert-dialog.mjs'), 'utf8')
const inputCss = await readFile(resolve(fixtureRoot, 'input.css'), 'utf8')
const serverSource = await readFile(resolve(projectRoot, 'scripts/serve-shadcn-fixture.mjs'), 'utf8')
const visualCheckSource = await readFile(resolve(projectRoot, 'scripts/visual-check.mjs'), 'utf8')
const expectedDependencies = {
  cn: '0.2.6',
  'radix-ui': '1.6.7',
  shadcn: '4.21.0'
}
const evidenceDependenciesAbsent = Object.keys(expectedDependencies)
  .every((name) => packageJson.devDependencies?.[name] === undefined)

async function allPathsExist(paths) {
  try {
    await Promise.all(paths.map((path) => access(path)))
    return true
  } catch {
    return false
  }
}

const runtimeAvailable = await allPathsExist([
  resolve(projectRoot, 'node_modules/cn/package.json'),
  resolve(projectRoot, 'node_modules/radix-ui/package.json')
])

test('shadcn fixture pins the reviewed CLI, Radix and class helper versions', {
  skip: evidenceDependenciesAbsent ? 'awaiting the coordinating agent central dependency install' : false
}, () => {
  for (const [name, version] of Object.entries(expectedDependencies)) {
    assert.equal(packageJson.devDependencies?.[name], version)
  }
  assert.equal(packageJson.devDependencies?.react, '19.3.0')
  assert.equal(packageJson.devDependencies?.['react-dom'], '19.3.0')
  assert.equal(packageJson.devDependencies?.tailwindcss, '4.3.3')
  assert.equal(packageJson.devDependencies?.['govuk-frontend'], '6.5.0')
})

test('shadcn fixture keeps the copied Alert Dialog wrapper service-owned and on unified Radix', () => {
  assert.match(alertDialogSource, /import \{ AlertDialog as AlertDialogPrimitive \} from 'radix-ui'/)
  assert.match(alertDialogSource, /import \{ cn \} from 'cn'/)
  assert.match(alertDialogSource, /'data-slot': 'alert-dialog-content'/)
  assert.match(alertDialogSource, /AlertDialogPrimitive\.Title/)
  assert.match(alertDialogSource, /AlertDialogPrimitive\.Description/)
  assert.match(alertDialogSource, /AlertDialogPrimitive\.Cancel/)
  assert.match(alertDialogSource, /AlertDialogPrimitive\.Action/)
  assert.match(alertDialogSource, /bg-govuk-text\/50/)
  assert.match(alertDialogSource, /box-border/)
  assert.doesNotMatch(alertDialogSource, /bg-black/)
  assert.doesNotMatch(alertDialogSource, /@radix-ui\/react-alert-dialog/)
  assert.doesNotMatch(alertDialogSource, /className: ['"]govuk-(?:accordion|input|button)/)
})

test('shadcn fixture uses explicit official-markup fallbacks for GOV.UK components', () => {
  assert.match(appSource, /'data-adapter-fallback': 'official-govuk-button'/)
  assert.match(appSource, /'data-adapter-fallback': 'official-govuk-input'/)
  assert.match(appSource, /'data-adapter-fallback': 'official-govuk-accordion'/)
  assert.match(appSource, /className: 'govuk-button'/)
  assert.match(appSource, /className: 'govuk-input govuk-input--width-10 govuk-input--error'/)
  assert.match(appSource, /className: 'govuk-accordion'/)
  assert.match(appSource, /'data-module': 'govuk-accordion'/)
  assert.doesNotMatch(appSource, /components\/ui\/(?:button|input|accordion)/)
})

test('shadcn Tailwind build omits Preflight and scans only fixture source', () => {
  assert.match(inputCss, /@import "tailwindcss\/theme\.css" layer\(theme\)/)
  assert.match(inputCss, /@import "\.\.\/\.\.\/ui-frameworks\/shadcn\/govuk-theme\.css"/)
  assert.match(inputCss, /@import "tailwindcss\/utilities\.css" layer\(utilities\) source\(none\)/)
  assert.match(inputCss, /@source "\.\/app\.mjs"/)
  assert.match(inputCss, /@source "\.\/components\/ui\/alert-dialog\.mjs"/)
  assert.match(inputCss, /\.govuk-template__body \.shadcn-js-only/)
  assert.match(inputCss, /\.govuk-template__body\.js-enabled \.shadcn-js-only/)
  assert.doesNotMatch(inputCss, /tailwindcss\/preflight\.css/)
  assert.doesNotMatch(inputCss, /@import "tailwindcss"/)
})

test('shadcn fixture server compiles local source and exposes pinned local assets', () => {
  assert.match(serverSource, /GOVUK_SHADCN_FIXTURE_PORT \?\? '4179'/)
  assert.match(serverSource, /node_modules\/@tailwindcss\/cli\/dist\/index\.mjs/)
  assert.match(serverSource, /entryPoints: \[resolve\(fixtureRoot, 'client\.mjs'\)\]/)
  assert.match(serverSource, /pathname === '\/vendor\/shadcn\.css'/)
  assert.match(serverSource, /pathname === '\/shadcn\/client\.js'/)
  assert.match(serverSource, /pathname === '\/cancel'/)
  assert.match(serverSource, /pathname === '\/cancelled'/)
  assert.doesNotMatch(serverSource, /https:\/\/|cdn\.|unpkg\.|jsdelivr/)
})

test('shared browser automation covers the complete Alert Dialog evidence contract', () => {
  assert.match(visualCheckSource, /await trigger\.click\(\)/)
  assert.match(visualCheckSource, /initial focus did not move to the safe cancel action/)
  assert.match(visualCheckSource, /Shift\+Tab/)
  assert.match(visualCheckSource, /Tab did not wrap to the safe cancel action/)
  assert.match(visualCheckSource, /shadcn-\$\{viewportName\}-dialog-open\.png/)
  assert.match(visualCheckSource, /await cancel\.click\(\)/)
  assert.match(visualCheckSource, /action\.click\(\)/)
  assert.match(visualCheckSource, /url\.pathname === '\/cancel'/)
  assert.match(visualCheckSource, /url\.pathname === '\/cancelled'/)
})

test('shadcn server output preserves accessibility and progressive-enhancement contracts', {
  skip: runtimeAvailable ? false : 'radix-ui and cn are not installed yet'
}, async () => {
  const { renderCancellationPage, renderCancelledPage, renderFixturePage } = await import('../fixtures/shadcn/page.mjs')
  const html = renderFixturePage()
  const cancellationHtml = renderCancellationPage()
  const cancelledHtml = renderCancelledPage()
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])

  assert.match(html, /^<!doctype html><html class="govuk-template" lang="en">/)
  assert.match(html, /<body\b[^>]*><!--\nTHESIS:/)
  assert.match(html, /OWN-WORLD:/)
  assert.match(html, /STORY:/)
  assert.match(html, /FIRST VIEWPORT:/)
  assert.match(html, /FORM:/)
  assert.match(html, /FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN\.md/)
  assert.match(html, /data-adapter-composition="service-owned-alert-dialog"/)
  assert.match(html, /data-fixture-role="alert-dialog-no-javascript-fallback"/)
  assert.match(html, /href="\/cancel"/)
  assert.match(cancellationHtml, /Cancel and lose your answers\?/)
  assert.match(cancellationHtml, /href="\/cancelled"/)
  assert.match(cancellationHtml, /href="\/"/)
  assert.match(cancelledHtml, /Fixture answers cleared/)
  assert.match(cancelledHtml, /No data was submitted or stored by the fixture/)
  assert.equal((html.match(/data-adapter-fallback="official-govuk-/g) ?? []).length, 3)
  assert.equal((html.match(/class="govuk-accordion__section"/g) ?? []).length, 2)
  assert.equal(new Set(ids).size, ids.length, 'shadcn fixture contains duplicate IDs')

  for (const match of html.matchAll(/\b(?:aria-describedby|aria-labelledby)="([^"]+)"/g)) {
    for (const id of match[1].split(/\s+/)) {
      assert.ok(ids.includes(id), 'missing referenced ID: ' + id)
    }
  }

  for (const match of html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)) {
    assert.ok(ids.includes(match[1]), 'label points to missing input: ' + match[1])
  }

  for (const [, attributes] of html.matchAll(/<div class="govuk-accordion__section-content"[^>]*([^>]*)>/g)) {
    assert.doesNotMatch(attributes, /\bhidden\b/)
  }
})

test('shadcn fixture generates mapped utilities when the central theme is available', {
  skip: await allPathsExist([
    resolve(projectRoot, 'node_modules/@tailwindcss/cli/dist/index.mjs'),
    resolve(projectRoot, 'ui-frameworks/shadcn/govuk-theme.css')
  ]) ? false : 'awaiting generated shadcn theme'
}, async () => {
  const temporaryDirectory = await mkdtemp(resolve(tmpdir(), 'govuk-design-md-shadcn-test-'))
  const outputPath = resolve(temporaryDirectory, 'shadcn.css')

  try {
    const build = spawnSync(
      process.execPath,
      [resolve(projectRoot, 'node_modules/@tailwindcss/cli/dist/index.mjs'), '-i', resolve(fixtureRoot, 'input.css'), '-o', outputPath, '--minify'],
      { cwd: projectRoot, encoding: 'utf8' }
    )
    assert.equal(build.status, 0, build.stderr || build.stdout)
    const generatedCss = await readFile(outputPath, 'utf8')
    assert.match(generatedCss, /\.bg-govuk-surface\{background-color:var\(--color-govuk-surface\)\}/)
    assert.match(generatedCss, /\.border-govuk-text\{border-color:var\(--color-govuk-text\)\}/)
    assert.match(generatedCss, /\.box-border\{box-sizing:border-box\}/)
    assert.doesNotMatch(generatedCss, /\*,:after,:before[^}]*box-sizing:border-box/)
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true })
  }
})
