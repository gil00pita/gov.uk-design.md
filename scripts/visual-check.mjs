import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const fixtureDefinitions = [
  { id: 'html-css', port: 4173, script: 'scripts/serve-fixture.mjs' },
  { id: 'react', port: 4174, script: 'scripts/serve-react-fixture.mjs' },
  { id: 'angular', port: 4175, script: 'scripts/serve-angular-fixture.mjs' },
  { id: 'svelte', port: 4176, script: 'scripts/serve-svelte-fixture.mjs' },
  { id: 'astro', port: 4177, script: 'scripts/serve-astro-fixture.mjs' },
  { id: 'tailwind', port: 4178, script: 'scripts/serve-tailwind-fixture.mjs' },
  { id: 'shadcn', port: 4179, script: 'scripts/serve-shadcn-fixture.mjs' },
  { id: 'chakra', port: 4180, script: 'scripts/serve-chakra-fixture.mjs' }
]

function parseArgs(argv) {
  const options = { fixtures: null, output: resolve(tmpdir(), 'govuk-design-md-visual-evidence') }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--fixture') options.fixtures = (argv[++index] ?? '').split(',').filter(Boolean)
    else if (argument.startsWith('--fixture=')) options.fixtures = argument.slice('--fixture='.length).split(',').filter(Boolean)
    else if (argument === '--output') options.output = resolve(argv[++index] ?? '')
    else if (argument.startsWith('--output=')) options.output = resolve(argument.slice('--output='.length))
    else throw new Error(`unknown option: ${argument}`)
  }
  if (!options.output) throw new Error('--output requires a path')
  const known = new Set(fixtureDefinitions.map(({ id }) => id))
  for (const id of options.fixtures ?? []) {
    if (!known.has(id)) throw new Error(`unknown fixture: ${id}`)
  }
  return options
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}

async function waitForServer(url, child, output) {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`fixture server exited before readiness:\n${output.join('')}`)
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {}
    await delay(250)
  }
  throw new Error(`fixture server did not become ready: ${url}\n${output.join('')}`)
}

async function stopServer(child) {
  if (child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise((resolveExit) => child.once('exit', resolveExit)),
    delay(5_000).then(() => child.kill('SIGKILL'))
  ])
}

function startServer(fixture) {
  const output = []
  const child = spawn(process.execPath, [resolve(projectRoot, fixture.script)], {
    cwd: projectRoot,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  child.stdout.on('data', (chunk) => output.push(chunk.toString()))
  child.stderr.on('data', (chunk) => output.push(chunk.toString()))
  return { child, output }
}

function captureDiagnostics(page) {
  const diagnostics = []
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      const location = message.location()
      const source = location.url ? ` (${location.url}:${location.lineNumber + 1}:${location.columnNumber + 1})` : ''
      diagnostics.push(`${message.type()}: ${message.text()}${source}`)
    }
  })
  page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.message}`))
  page.on('requestfailed', (request) => diagnostics.push(`requestfailed: ${request.url()} ${request.failure()?.errorText ?? ''}`))
  page.on('response', (response) => {
    if (response.status() >= 400) diagnostics.push(`http ${response.status()}: ${response.url()}`)
  })
  return diagnostics
}

async function assertPageContract(page, fixture) {
  await page.goto(`http://127.0.0.1:${fixture.port}`, { waitUntil: 'networkidle' })
  await page.locator('.govuk-heading-xl').waitFor()
  const accordionButton = page.locator('.govuk-accordion__section-button').first()
  await accordionButton.waitFor()
  await accordionButton.click()
  assert.equal(await accordionButton.getAttribute('aria-expanded'), 'true', `${fixture.id}: pointer did not expand Accordion`)
  await accordionButton.press('Enter')
  assert.equal(await accordionButton.getAttribute('aria-expanded'), 'false', `${fixture.id}: Enter did not collapse Accordion`)
  await accordionButton.press('Enter')
  assert.equal(await accordionButton.getAttribute('aria-expanded'), 'true', `${fixture.id}: Enter did not expand Accordion`)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  assert.equal(overflow, false, `${fixture.id}: horizontal overflow`)
  if (fixture.id === 'chakra') {
    const styles = await page.locator('[data-chakra-service-wrapper]').evaluate((element) => {
      const computed = getComputedStyle(element)
      return {
        backgroundColor: computed.backgroundColor,
        paddingTop: computed.paddingTop,
        className: element.className,
        rootSpacing: getComputedStyle(document.documentElement).getPropertyValue('--govuk-spacing-responsive-6').trim(),
        stylesheets: [...document.styleSheets].map(({ href }) => href ?? 'inline'),
        fallbackRules: [...document.styleSheets]
          .filter(({ href }) => href?.endsWith('/chakra/fallback.css'))
          .flatMap((sheet) => [...sheet.cssRules].map(({ cssText }) => cssText))
      }
    })
    assert.equal(styles.backgroundColor, 'rgb(244, 248, 251)', `chakra: mapped background did not resolve: ${JSON.stringify(styles)}`)
    assert.equal(styles.paddingTop, '30px', `chakra: mapped spacing did not resolve: ${JSON.stringify(styles)}`)
  }
}

async function assertShadcnDialog(page, outputDirectory, viewportName) {
  const trigger = page.locator('[data-fixture-role="service-owned-alert-dialog-trigger"]')
  const cancel = page.locator('[data-fixture-role="service-owned-alert-dialog-cancel"]')
  const action = page.locator('[data-fixture-role="service-owned-alert-dialog-action"]')

  await trigger.click()
  const dialog = page.getByRole('alertdialog')
  await dialog.waitFor()
  assert.equal(await dialog.getByRole('heading').count(), 1, 'shadcn: AlertDialog requires one visible title')
  assert.equal(await cancel.evaluate((element) => element === document.activeElement), true, 'shadcn: initial focus did not move to the safe cancel action')
  await page.screenshot({ path: resolve(outputDirectory, `shadcn-${viewportName}-dialog-open.png`) })

  await page.keyboard.press('Shift+Tab')
  assert.equal(await action.evaluate((element) => element === document.activeElement), true, 'shadcn: reverse Tab did not wrap within the dialog')
  assert.equal(await dialog.evaluate((element) => element.contains(document.activeElement)), true, 'shadcn: reverse Tab escaped the dialog')
  await page.keyboard.press('Tab')
  assert.equal(await cancel.evaluate((element) => element === document.activeElement), true, 'shadcn: Tab did not wrap to the safe cancel action')
  assert.equal(await dialog.evaluate((element) => element.contains(document.activeElement)), true, 'shadcn: Tab escaped the dialog')

  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'detached' })
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-fixture-role') === 'service-owned-alert-dialog-trigger')
  assert.equal(await trigger.evaluate((element) => element === document.activeElement), true, 'shadcn: focus did not return to trigger')

  await trigger.press('Enter')
  await dialog.waitFor()
  await cancel.click()
  await dialog.waitFor({ state: 'detached' })
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-fixture-role') === 'service-owned-alert-dialog-trigger')
  assert.equal(await trigger.evaluate((element) => element === document.activeElement), true, 'shadcn: cancel did not return focus to trigger')

  await trigger.click()
  await dialog.waitFor()
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/cancelled'),
    action.click()
  ])
  await page.getByRole('heading', { name: 'Fixture answers cleared' }).waitFor()
  await page.goto('http://127.0.0.1:4179', { waitUntil: 'networkidle' })
}

async function assertNoJavaScript(browser, fixture) {
  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const page = await context.newPage()
    const diagnostics = captureDiagnostics(page)
    await page.goto(`http://127.0.0.1:${fixture.port}`, { waitUntil: 'load' })
    const regions = page.locator('.govuk-accordion__section-content')
    assert.ok(await regions.count() >= 2, `${fixture.id}: missing server-rendered Accordion content`)
    for (let index = 0; index < await regions.count(); index += 1) {
      assert.equal(await regions.nth(index).isVisible(), true, `${fixture.id}: no-JavaScript Accordion content is hidden`)
    }
    if (fixture.id === 'shadcn') {
      const fallback = page.locator('[data-fixture-role="alert-dialog-no-javascript-fallback"]')
      assert.equal(await fallback.isVisible(), true)
      await Promise.all([
        page.waitForURL((url) => url.pathname === '/cancel'),
        fallback.click()
      ])
      await page.getByRole('heading', { name: 'Cancel and lose your answers?' }).waitFor()
      await Promise.all([
        page.waitForURL((url) => url.pathname === '/cancelled'),
        page.getByRole('link', { name: 'Cancel and lose answers' }).click()
      ])
      await page.getByRole('heading', { name: 'Fixture answers cleared' }).waitFor()
    }
    assert.deepEqual(diagnostics, [], `${fixture.id}: no-JavaScript browser diagnostics`)
  } finally {
    await context.close()
  }
}

async function checkFixture(browser, fixture, outputDirectory) {
  const server = startServer(fixture)
  const url = `http://127.0.0.1:${fixture.port}`
  try {
    await waitForServer(url, server.child, server.output)
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    try {
      const page = await context.newPage()
      const diagnostics = captureDiagnostics(page)
      await assertPageContract(page, fixture)
      await page.screenshot({ fullPage: true, path: resolve(outputDirectory, `${fixture.id}-desktop.png`) })
      if (fixture.id === 'shadcn') await assertShadcnDialog(page, outputDirectory, 'desktop')

      await page.setViewportSize({ width: 390, height: 844 })
      await page.reload({ waitUntil: 'networkidle' })
      const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
      assert.equal(mobileOverflow, false, `${fixture.id}: mobile horizontal overflow`)
      if (fixture.id === 'chakra') {
        assert.equal(
          await page.locator('[data-chakra-service-wrapper]').evaluate((element) => getComputedStyle(element).paddingTop),
          '20px',
          'chakra: responsive spacing token did not resolve on mobile'
        )
      }
      await page.screenshot({ fullPage: true, path: resolve(outputDirectory, `${fixture.id}-mobile.png`) })
      if (fixture.id === 'shadcn') await assertShadcnDialog(page, outputDirectory, 'mobile')
      assert.deepEqual(diagnostics, [], `${fixture.id}: browser diagnostics`)
    } finally {
      await context.close()
    }
    await assertNoJavaScript(browser, fixture)
    process.stdout.write(`visual fixture passed: ${fixture.id}\n`)
  } finally {
    await stopServer(server.child)
  }
}

const options = parseArgs(process.argv.slice(2))
const selected = options.fixtures
  ? fixtureDefinitions.filter(({ id }) => options.fixtures.includes(id))
  : fixtureDefinitions
await mkdir(options.output, { recursive: true })

const launchOptions = { headless: true }
if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
  launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
}
const browser = await chromium.launch(launchOptions)
try {
  for (const fixture of selected) await checkFixture(browser, fixture, options.output)
} finally {
  await browser.close()
}

process.stdout.write(`visual checks passed for ${selected.length} fixtures; evidence: ${options.output}\n`)
