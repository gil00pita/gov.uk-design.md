import { Box, ChakraProvider } from '@chakra-ui/react'
import { createElement as h, useEffect, useRef } from 'react'
import { govukChakraSystem } from '../../ui-frameworks/chakra/govuk-system.mjs'

export const bodyClassScript = "document.body.className += ' js-enabled' + ('noModule' in HTMLScriptElement.prototype ? ' govuk-frontend-supported' : '');"

const initialisedScopes = new WeakSet()

export function GovukFrontendBoundary({ as = 'div', children, ...attributes }) {
  const containerRef = useRef(null)
  const initialAttributes = useRef(attributes)
  const initialChildren = useRef(children)

  useEffect(() => {
    const container = containerRef.current
    if (!container || initialisedScopes.has(container)) return
    initialisedScopes.add(container)

    import('govuk-frontend')
      .then(({ initAll }) => {
        if (!container.isConnected) {
          initialisedScopes.delete(container)
          return
        }

        initAll({
          scope: container,
          onError(error) {
            throw error
          }
        })
      })
      .catch((error) => {
        initialisedScopes.delete(container)
        queueMicrotask(() => {
          throw error
        })
      })
  }, [])

  return h(as, { ...initialAttributes.current, ref: containerRef }, initialChildren.current)
}

function ServiceOwnedSummary() {
  return h(
    Box,
    {
      as: 'section',
      bg: 'govuk-surface',
      className: 'govuk-chakra-service-surface',
      color: 'govuk-surface-text',
      'data-chakra-service-wrapper': '',
      marginBottom: 'govuk-responsive-9',
      maxW: 'govuk-page',
      padding: 'govuk-responsive-6'
    },
    h('h2', { className: 'govuk-heading-m' }, 'Service-owned summary'),
    h(
      'p',
      { className: 'govuk-body govuk-!-margin-bottom-0' },
      'Chakra tokens style this service-owned wrapper. GOV.UK Frontend still styles every GOV.UK component.'
    )
  )
}

function AccordionSection({ number, heading, children }) {
  return h(
    'div',
    { className: 'govuk-accordion__section' },
    h(
      'div',
      { className: 'govuk-accordion__section-header' },
      h(
        'h3',
        { className: 'govuk-accordion__section-heading' },
        h(
          'span',
          {
            className: 'govuk-accordion__section-button',
            id: 'chakra-accordion-guidance-heading-' + number
          },
          heading
        )
      )
    ),
    h(
      'div',
      {
        className: 'govuk-accordion__section-content',
        id: 'chakra-accordion-guidance-content-' + number
      },
      h('p', { className: 'govuk-body' }, children)
    )
  )
}

export function VerticalSlice() {
  return [
    h('h1', { className: 'govuk-heading-xl', key: 'heading' }, 'GOV.UK Design MD Chakra UI fixture'),
    h(ServiceOwnedSummary, { key: 'service-summary' }),
    h(
      'section',
      {
        'aria-labelledby': 'chakra-button-heading',
        className: 'govuk-!-margin-bottom-9',
        key: 'button'
      },
      h('h2', { className: 'govuk-heading-l', id: 'chakra-button-heading' }, 'Button'),
      h(
        'button',
        {
          className: 'govuk-button',
          'data-module': 'govuk-button',
          type: 'submit'
        },
        'Save and continue'
      )
    ),
    h(
      'section',
      {
        'aria-labelledby': 'chakra-text-input-heading',
        className: 'govuk-!-margin-bottom-9',
        key: 'text-input'
      },
      h('h2', { className: 'govuk-heading-l', id: 'chakra-text-input-heading' }, 'Text input'),
      h(
        'div',
        { className: 'govuk-form-group govuk-form-group--error' },
        h(
          'label',
          { className: 'govuk-label', htmlFor: 'chakra-national-insurance-number' },
          'National Insurance number'
        ),
        h(
          'div',
          { className: 'govuk-hint', id: 'chakra-national-insurance-number-hint' },
          'It is on your National Insurance card, benefit letter, payslip or P60.'
        ),
        h(
          'p',
          { className: 'govuk-error-message', id: 'chakra-national-insurance-number-error' },
          h('span', { className: 'govuk-visually-hidden' }, 'Error:'),
          ' Enter a National Insurance number in the correct format'
        ),
        h('input', {
          'aria-describedby': 'chakra-national-insurance-number-hint chakra-national-insurance-number-error',
          className: 'govuk-input govuk-input--width-10 govuk-input--error',
          id: 'chakra-national-insurance-number',
          name: 'nationalInsuranceNumber',
          spellCheck: 'false',
          type: 'text'
        })
      )
    ),
    h(
      'section',
      { 'aria-labelledby': 'chakra-accordion-heading', key: 'accordion' },
      h('h2', { className: 'govuk-heading-l', id: 'chakra-accordion-heading' }, 'Accordion'),
      h(
        'div',
        {
          className: 'govuk-accordion',
          'data-module': 'govuk-accordion',
          id: 'chakra-accordion-guidance'
        },
        h(
          AccordionSection,
          { heading: 'Writing well for the web', number: 1 },
          'This is the content for Writing well for the web.'
        ),
        h(
          AccordionSection,
          { heading: 'Know your audience', number: 2 },
          'This is the content for Know your audience.'
        )
      )
    )
  ]
}

export function FixtureDocument() {
  return h(
    'html',
    { className: 'govuk-template', lang: 'en' },
    h(
      'head',
      null,
      h('meta', { charSet: 'utf-8' }),
      h('meta', {
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
        name: 'viewport'
      }),
      h('meta', { content: '#1d70b8', name: 'theme-color' }),
      h('title', null, 'GOV.UK Design MD Chakra UI fixture'),
      h('link', { href: '/assets/images/favicon.ico', rel: 'icon', sizes: '48x48' }),
      h('link', { href: '/govuk-design/tokens/govuk.css', rel: 'stylesheet' }),
      h('link', { href: '/chakra/fallback.css', rel: 'stylesheet' }),
      h('link', { href: '/vendor/govuk/govuk-frontend.min.css', rel: 'stylesheet' })
    ),
    h(
      GovukFrontendBoundary,
      {
        as: 'body',
        className: 'govuk-template__body',
        suppressHydrationWarning: true
      },
      h('script', { dangerouslySetInnerHTML: { __html: bodyClassScript } }),
      h(
        'a',
        {
          className: 'govuk-skip-link',
          'data-module': 'govuk-skip-link',
          href: '#main-content'
        },
        'Skip to main content'
      ),
      h(
        ChakraProvider,
        { value: govukChakraSystem },
        h(
          'div',
          { className: 'govuk-width-container' },
          h(
            'main',
            { className: 'govuk-main-wrapper', id: 'main-content' },
            h(VerticalSlice)
          )
        )
      ),
      h('script', { src: '/chakra/client.js', type: 'module' })
    )
  )
}
