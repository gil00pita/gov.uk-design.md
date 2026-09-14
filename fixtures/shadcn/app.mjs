import { createElement as h, useEffect, useRef } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from './components/ui/alert-dialog.mjs'

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
        window.__govukShadcnFixtureReady = true
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
            id: 'shadcn-accordion-guidance-heading-' + number
          },
          heading
        )
      )
    ),
    h(
      'div',
      {
        className: 'govuk-accordion__section-content',
        id: 'shadcn-accordion-guidance-content-' + number
      },
      h('p', { className: 'govuk-body' }, children)
    )
  )
}

function CancellationConfirmation() {
  return h(
    'section',
    {
      'aria-labelledby': 'shadcn-cancellation-heading',
      className: 'govuk-!-margin-bottom-9',
      'data-adapter-composition': 'service-owned-alert-dialog'
    },
    h('h2', { className: 'govuk-heading-l', id: 'shadcn-cancellation-heading' }, 'Protected service-owned interruption'),
    h(
      'p',
      { className: 'govuk-body' },
      'This evidence-only interaction confirms cancellation before a person leaves answers they entered in the fixture. It does not represent a live service or claim that data has been saved.'
    ),
    h(
      AlertDialog,
      null,
      h(
        AlertDialogTrigger,
        { asChild: true },
        h(
          'button',
          {
            className: 'govuk-button govuk-button--secondary shadcn-js-only',
            'data-fixture-role': 'service-owned-alert-dialog-trigger',
            'data-module': 'govuk-button',
            type: 'button'
          },
          'Cancel this fixture'
        )
      ),
      h(
        AlertDialogContent,
        null,
        h(
          AlertDialogHeader,
          null,
          h(AlertDialogTitle, { className: 'govuk-heading-m' }, 'Cancel and lose your answers?'),
          h(
            AlertDialogDescription,
            { className: 'govuk-body' },
            'Any answers entered on this fixture page will be cleared when you follow the cancellation route. You can keep your answers and return to the form instead.'
          )
        ),
        h(
          AlertDialogFooter,
          null,
          h(
            AlertDialogCancel,
            { asChild: true },
            h(
              'button',
              {
                className: 'govuk-button govuk-button--secondary govuk-!-margin-bottom-0',
                'data-fixture-role': 'service-owned-alert-dialog-cancel',
                type: 'button'
              },
              'Keep my answers'
            )
          ),
          h(
            AlertDialogAction,
            { asChild: true },
            h(
              'a',
              {
                className: 'govuk-button govuk-button--warning govuk-!-margin-bottom-0',
                'data-fixture-role': 'service-owned-alert-dialog-action',
                href: '/cancelled',
                role: 'button'
              },
              'Cancel and lose answers'
            )
          )
        )
      )
    ),
    h(
      'noscript',
      null,
      h(
        'a',
        {
          className: 'govuk-link',
          'data-fixture-role': 'alert-dialog-no-javascript-fallback',
          href: '/cancel'
        },
        'Review cancellation without JavaScript'
      )
    )
  )
}

export function VerticalSlice() {
  return [
    h('h1', { className: 'govuk-heading-xl', key: 'heading' }, 'GOV.UK Design MD shadcn fixture'),
    h(CancellationConfirmation, { key: 'cancellation-confirmation' }),
    h(
      'section',
      {
        'aria-labelledby': 'shadcn-button-heading',
        className: 'govuk-!-margin-bottom-9',
        'data-adapter-fallback': 'official-govuk-button',
        key: 'button'
      },
      h('h2', { className: 'govuk-heading-l', id: 'shadcn-button-heading' }, 'Button — official markup fallback'),
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
        'aria-labelledby': 'shadcn-text-input-heading',
        className: 'govuk-!-margin-bottom-9',
        'data-adapter-fallback': 'official-govuk-input',
        key: 'text-input'
      },
      h('h2', { className: 'govuk-heading-l', id: 'shadcn-text-input-heading' }, 'Text input — official markup fallback'),
      h(
        'div',
        { className: 'govuk-form-group govuk-form-group--error' },
        h(
          'label',
          { className: 'govuk-label', htmlFor: 'shadcn-national-insurance-number' },
          'National Insurance number'
        ),
        h(
          'div',
          { className: 'govuk-hint', id: 'shadcn-national-insurance-number-hint' },
          'It is on your National Insurance card, benefit letter, payslip or P60.'
        ),
        h(
          'p',
          { className: 'govuk-error-message', id: 'shadcn-national-insurance-number-error' },
          h('span', { className: 'govuk-visually-hidden' }, 'Error:'),
          ' Enter a National Insurance number in the correct format'
        ),
        h('input', {
          'aria-describedby': 'shadcn-national-insurance-number-hint shadcn-national-insurance-number-error',
          className: 'govuk-input govuk-input--width-10 govuk-input--error',
          id: 'shadcn-national-insurance-number',
          name: 'nationalInsuranceNumber',
          spellCheck: 'false',
          type: 'text'
        })
      )
    ),
    h(
      'section',
      {
        'aria-labelledby': 'shadcn-accordion-heading',
        'data-adapter-fallback': 'official-govuk-accordion',
        key: 'accordion'
      },
      h('h2', { className: 'govuk-heading-l', id: 'shadcn-accordion-heading' }, 'Accordion — official markup fallback'),
      h(
        'div',
        {
          className: 'govuk-accordion',
          'data-module': 'govuk-accordion',
          id: 'shadcn-accordion-guidance'
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
      h('title', null, 'GOV.UK Design MD shadcn fixture'),
      h('link', { href: '/assets/images/favicon.ico', rel: 'icon', sizes: '48x48' }),
      h('link', { href: '/vendor/shadcn.css', rel: 'stylesheet' }),
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
        'div',
        { className: 'govuk-width-container' },
        h(
          'main',
          { className: 'govuk-main-wrapper', id: 'main-content' },
          h(VerticalSlice)
        )
      ),
      h('script', { src: '/shadcn/client.js', type: 'module' })
    )
  )
}
