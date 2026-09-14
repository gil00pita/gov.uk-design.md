import { createElement as h, StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { FixtureDocument } from './app.mjs'

export const directionContract = `<!--
THESIS: Preserve the established GOV.UK vertical slice while proving one service-owned Chakra token surface; component reconstruction is out of scope.
OWN-WORLD: GOV.UK colour, spacing, typography, native controls and square-edged component language remain authoritative.
STORY: The reader sees the adapter boundary, then verifies Button, Text input and Accordion retain official GOV.UK contracts.
FIRST VIEWPORT: A GOV.UK heading leads into one quiet blue surface, followed immediately by the official component evidence.
FORM: Established GOV.UK fixture extension; the tightly bounded adapter scope needs no new visual-world seed.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`

export function renderFixturePage() {
  const documentHtml = renderToString(h(StrictMode, null, h(FixtureDocument)))
  const documentedHtml = documentHtml.replace(/(<body\b[^>]*>)/, '$1' + directionContract)
  return '<!doctype html>' + documentedHtml
}
