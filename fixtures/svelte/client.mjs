import { hydrate } from 'svelte'
import App from './App.svelte'

const target = document.querySelector('svelte-fixture')
if (!target) throw new Error('Svelte fixture root was not found')

const serverRenderedMain = target.querySelector('#main-content')
hydrate(App, { target, recover: false })

window.__govukSvelteHydratedExistingDom = (
  serverRenderedMain !== null &&
  serverRenderedMain === target.querySelector('#main-content')
)
