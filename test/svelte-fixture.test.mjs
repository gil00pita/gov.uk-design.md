import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { renderFixturePage } from '../fixtures/svelte/page.mjs'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const packageJson = JSON.parse(await readFile(resolve(projectRoot, 'package.json'), 'utf8'))
const html = await renderFixturePage()

test('Svelte fixture pins its evidence dependencies and server-renders the page shell', () => {
  assert.equal(packageJson.devDependencies.svelte, '5.57.0')
  assert.equal(packageJson.devDependencies['govuk-frontend'], '6.5.0')
  assert.match(html, /^<!doctype html>\s*<html class="govuk-template" lang="en">/i)
  assert.match(html, /class="govuk-template__body"/)
  assert.match(html, /govuk-frontend-supported/)
  assert.match(html, /href="\/vendor\/govuk\/govuk-frontend\.min\.css"/)
  assert.match(html, /src="\/svelte\/client\.js"/)
  assert.match(html, /<svelte-fixture><!--\[-->/)
  assert.match(html, /data-govuk-svelte-boundary/)
})

test('Svelte server output preserves the three vertical-slice component contracts', () => {
  assert.match(html, /<button\b(?=[^>]*\bclass="govuk-button")(?=[^>]*\bdata-module="govuk-button")[^>]*>/)
  assert.match(html, /class="govuk-input govuk-input--width-10 govuk-input--error"/)
  assert.match(html, /<div\b(?=[^>]*\bclass="govuk-accordion")(?=[^>]*\bdata-module="govuk-accordion")[^>]*>/)
  assert.equal((html.match(/class="govuk-accordion__section"/g) ?? []).length, 2)
})

test('Svelte server output has unique and resolvable accessibility IDs', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
  assert.equal(new Set(ids).size, ids.length, 'Svelte fixture contains duplicate IDs')

  for (const match of html.matchAll(/\b(?:aria-describedby|aria-labelledby)="([^"]+)"/g)) {
    for (const id of match[1].split(/\s+/)) {
      assert.ok(ids.includes(id), 'missing referenced ID: ' + id)
    }
  }

  for (const match of html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)) {
    assert.ok(ids.includes(match[1]), 'label points to missing input: ' + match[1])
  }
})

test('Svelte server output exposes Accordion content without JavaScript', () => {
  const contentRegions = [
    ...html.matchAll(/<div\b(?=[^>]*\bclass="govuk-accordion__section-content")(?=[^>]*\bid="svelte-accordion-guidance-content-[^"]+")([^>]*)>/g)
  ]
  assert.equal(contentRegions.length, 2)

  for (const [, attributes] of contentRegions) {
    assert.doesNotMatch(attributes, /\bhidden\b/)
  }
})
