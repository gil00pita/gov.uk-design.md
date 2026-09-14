import { createElement as h, StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { FixtureDocument } from './app.mjs'

export const directionContract = `<!--
THESIS: This is a strict compatibility proof: shadcn may compose one protected service-owned cancellation alert, while official GOV.UK Button, Text input and Accordion remain visibly unchanged; it refuses a component-gallery reconstruction.
OWN-WORLD: GOV.UK white and pale-blue surfaces, functional blue, black text, yellow focus, square controls, strong rules and the established GOV.UK type and spacing hierarchy.
STORY: The visitor may review cancellation in a protected alert or a no-JavaScript route, then audits three plainly labelled official-markup fallbacks and their real behaviour.
FIRST VIEWPORT: A one-column GOV.UK width container starts with an XL heading, cancellation context and a secondary alert trigger; the three vertically stacked fallback examples follow, with the primary action inside the Button example.
FORM: Established GOV.UK evidence-fixture extension, first and only scoped form; seed key is not applicable because this does not create or replace the visual world.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`

function FallbackDocument({ cancelled = false }) {
  const title = cancelled ? 'Fixture answers cleared' : 'Cancel and lose your answers?'

  return h(
    'html',
    { className: 'govuk-template', lang: 'en' },
    h(
      'head',
      null,
      h('meta', { charSet: 'utf-8' }),
      h('meta', { content: 'width=device-width, initial-scale=1', name: 'viewport' }),
      h('title', null, title),
      h('link', { href: '/assets/images/favicon.ico', rel: 'icon', sizes: '48x48' }),
      h('link', { href: '/vendor/govuk/govuk-frontend.min.css', rel: 'stylesheet' })
    ),
    h(
      'body',
      { className: 'govuk-template__body' },
      h(
        'div',
        { className: 'govuk-width-container' },
        h(
          'main',
          { className: 'govuk-main-wrapper', id: 'main-content' },
          h('h1', { className: 'govuk-heading-xl' }, title),
          cancelled
            ? h(
                'p',
                { className: 'govuk-body' },
                'This evidence-only route cleared the browser page. No data was submitted or stored by the fixture.'
              )
            : [
                h(
                  'p',
                  { className: 'govuk-body', key: 'explanation' },
                  'Any answers entered on the fixture page will be cleared if you continue. This is a no-JavaScript confirmation route for test evidence only.'
                ),
                h(
                  'a',
                  {
                    className: 'govuk-button',
                    'data-module': 'govuk-button',
                    href: '/',
                    key: 'keep',
                    role: 'button'
                  },
                  'Keep my answers'
                ),
                h(
                  'p',
                  { className: 'govuk-body', key: 'cancel' },
                  h('a', { className: 'govuk-link', href: '/cancelled' }, 'Cancel and lose answers')
                )
              ],
          cancelled
            ? h('p', { className: 'govuk-body' }, h('a', { className: 'govuk-link', href: '/' }, 'Return to the fixture'))
            : null
        )
      )
    )
  )
}

export function renderFixturePage() {
  const html = renderToString(h(StrictMode, null, h(FixtureDocument)))
  return '<!doctype html>' + html.replace(/(<body\b[^>]*>)/, `$1${directionContract}`)
}

export function renderCancellationPage() {
  return '<!doctype html>' + renderToString(h(FallbackDocument))
}

export function renderCancelledPage() {
  return '<!doctype html>' + renderToString(h(FallbackDocument, { cancelled: true }))
}
