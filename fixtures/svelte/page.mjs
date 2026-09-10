import { resolve } from 'node:path'
import { build } from 'esbuild'
import { sveltePlugin } from './build.mjs'

export const bodyClassScript = "document.body.className += ' js-enabled' + ('noModule' in HTMLScriptElement.prototype ? ' govuk-frontend-supported' : '');"

const fixtureRoot = import.meta.dirname

const serverModulePromise = build({
  bundle: true,
  entryPoints: [resolve(fixtureRoot, 'server.mjs')],
  external: ['govuk-frontend'],
  format: 'esm',
  logLevel: 'silent',
  platform: 'node',
  plugins: [sveltePlugin('server')],
  target: ['node18'],
  write: false
}).then(({ outputFiles }) => {
  const source = Buffer.from(outputFiles[0].contents).toString('base64')
  return import(`data:text/javascript;base64,${source}`)
})

export async function renderFixturePage() {
  const { renderApp } = await serverModulePromise
  const { body, head } = await renderApp()

  return `<!doctype html>
<html class="govuk-template" lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#1d70b8">
    <title>GOV.UK Design MD Svelte fixture</title>
    <link rel="icon" sizes="48x48" href="/assets/images/favicon.ico">
    <link rel="stylesheet" href="/vendor/govuk/govuk-frontend.min.css">
    ${head}
  </head>
  <body class="govuk-template__body">
    <script>${bodyClassScript}</script>
    <svelte-fixture>${body}</svelte-fixture>
    <script type="module" src="/svelte/client.js"></script>
  </body>
</html>`
}
