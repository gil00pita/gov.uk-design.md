import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const source = JSON.parse(await readFile(resolve(projectRoot, 'sources/ui-framework-adapters.json'), 'utf8'))
const manifest = JSON.parse(await readFile(resolve(projectRoot, 'ui-frameworks/manifest.json'), 'utf8'))
const guidance = await readFile(resolve(projectRoot, 'ui-frameworks/tailwind/DESIGN.md'), 'utf8')
const theme = await readFile(resolve(projectRoot, 'ui-frameworks/tailwind/govuk-theme.css'), 'utf8')
const matrix = await readFile(resolve(projectRoot, 'ui-frameworks/compatibility.md'), 'utf8')
const entryPoint = await readFile(resolve(projectRoot, 'DESIGN.md'), 'utf8')

test('Tailwind is a separately scoped behaviour-tested UI-framework adapter', () => {
  assert.equal(source.govukFrontendVersion, '6.5.0')
  assert.deepEqual(source.adapters.map(({ id }) => id), ['tailwind', 'chakra', 'shadcn'])
  assert.deepEqual(manifest.adapters[0], {
    id: 'tailwind',
    name: 'Tailwind CSS',
    status: 'experimental',
    implementation: {
      name: 'Tailwind CSS',
      package: 'tailwindcss',
      version: '4.3.3'
    },
    guidance: 'tailwind/DESIGN.md',
    files: ['tailwind/DESIGN.md', 'tailwind/govuk-theme.css'],
    tokenMapping: 'tailwind/govuk-theme.css',
    fixture: 'fixtures/tailwind/index.html',
    compatibility: ['guidance', 'token', 'markup', 'behaviour-tested'],
    compatibilityBoundary: source.adapters[0].compatibilityBoundary
  })
  assert.equal(manifest.compatibilityMatrix, 'compatibility.md')
  assert.match(entryPoint, /## UI-framework adapters/)
  assert.match(entryPoint, /\[Tailwind CSS\]\(ui-frameworks\/tailwind\/DESIGN\.md\)/)
  assert.match(entryPoint, /\[Chakra UI\]\(ui-frameworks\/chakra\/DESIGN\.md\)/)
  assert.match(entryPoint, /\[shadcn\/ui \(Radix\)\]\(ui-frameworks\/shadcn\/DESIGN\.md\)/)
  assert.match(matrix, /# UI-framework compatibility matrix/)
  assert.match(matrix, /\[Tailwind CSS\]\(tailwind\/DESIGN\.md\)/)
  assert.match(matrix, /\[Chakra UI\]\(chakra\/DESIGN\.md\)/)
  assert.match(matrix, /\[shadcn\/ui \(Radix\)\]\(shadcn\/DESIGN\.md\)/)
  assert.match(matrix, /No level makes an application conformant by itself/)
})

test('Tailwind guidance preserves the GOV.UK component, cascade and browser boundaries', () => {
  assert.match(guidance, /theme as evidence of conformance/i)
  assert.match(guidance, /Do not use the one-line `@import "tailwindcss"`/)
  assert.match(guidance, /Keep Tailwind utilities off the internal DOM of GOV\.UK Frontend components/)
  assert.match(guidance, /Tailwind CSS 4 targets Safari 16\.4, Chrome 111 and Firefox 128/)
  assert.match(guidance, /@import "tailwindcss\/utilities\.css" layer\(utilities\) source\(none\)/)
  assert.match(theme, /This Tailwind CSS 4 bridge is for service-owned extensions, not component recreation/)
  assert.match(theme, /--spacing-govuk-responsive-6: var\(--govuk-spacing-responsive-6\)/)
  assert.doesNotMatch(theme, /font-family/)
})
