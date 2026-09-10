import '@angular/compiler'
import { bootstrapApplication } from '@angular/platform-browser'
import { GovukFixtureComponent } from './app.mjs'
import { appConfig } from './config.mjs'

async function initialise() {
  const application = await bootstrapApplication(GovukFixtureComponent, appConfig)
  await application.whenStable()
  await new Promise((resolve) => requestAnimationFrame(resolve))

  const scope = document.querySelector('govuk-fixture')
  if (!scope) throw new Error('Angular fixture root was not found')

  const { initAll } = await import('govuk-frontend')
  initAll({
    scope,
    onError(error) {
      throw error
    }
  })

  window.__govukAngularFixtureReady = true
}

initialise().catch((error) => {
  console.error(error)
  queueMicrotask(() => {
    throw error
  })
})
