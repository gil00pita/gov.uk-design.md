import { createElement as h, StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { FixtureDocument } from './app.mjs'

export function renderFixturePage() {
  return '<!doctype html>' + renderToString(h(StrictMode, null, h(FixtureDocument)))
}
