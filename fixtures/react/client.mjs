import { createElement as h, StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { FixtureDocument } from './app.mjs'

hydrateRoot(document, h(StrictMode, null, h(FixtureDocument)), {
  onRecoverableError(error) {
    console.error(error)
  }
})
