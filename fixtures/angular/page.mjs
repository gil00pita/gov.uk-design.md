import '@angular/compiler'
import { bootstrapApplication } from '@angular/platform-browser'
import { provideServerRendering, renderApplication } from '@angular/platform-server'
import { GovukFixtureComponent } from './app.mjs'
import { appConfig } from './config.mjs'

export const bodyClassScript = "document.body.className += ' js-enabled' + ('noModule' in HTMLScriptElement.prototype ? ' govuk-frontend-supported' : '');"

const document = `<!doctype html>
<html class="govuk-template" lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#1d70b8">
    <title>GOV.UK Design MD Angular fixture</title>
    <link rel="icon" sizes="48x48" href="/assets/images/favicon.ico">
    <link rel="stylesheet" href="/vendor/govuk/govuk-frontend.min.css">
  </head>
  <body class="govuk-template__body">
    <script>${bodyClassScript}</script>
    <a class="govuk-skip-link" href="#main-content" data-module="govuk-skip-link">
      Skip to main content
    </a>
    <govuk-fixture></govuk-fixture>
    <script type="module" src="/angular/client.js"></script>
  </body>
</html>`

export async function renderFixturePage() {
  return renderApplication(
    (context) => bootstrapApplication(
      GovukFixtureComponent,
      {
        providers: [...appConfig.providers, provideServerRendering()]
      },
      context
    ),
    {
      allowedHosts: ['127.0.0.1'],
      document,
      url: 'http://127.0.0.1:4175/'
    }
  )
}
