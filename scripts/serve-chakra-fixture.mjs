#!/usr/bin/env node

import { createReadStream } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { build } from 'esbuild'
import { renderFixturePage } from '../fixtures/chakra/page.mjs'

const repositoryRoot = resolve(import.meta.dirname, '..')
const fixtureRoot = resolve(repositoryRoot, 'fixtures/chakra')
const govukRoot = resolve(repositoryRoot, 'node_modules/govuk-frontend/dist/govuk')
const govukDesignRoot = resolve(repositoryRoot, 'design/govuk')
const port = Number.parseInt(process.env.GOVUK_CHAKRA_FIXTURE_PORT ?? '4180', 10)

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2']
])

function within(root, candidate) {
  return candidate === root || candidate.startsWith(root + sep)
}

function resolveRequest(pathname) {
  const routes = [
    ['/vendor/govuk/', govukRoot],
    ['/assets/', resolve(govukRoot, 'assets')],
    ['/govuk-design/', govukDesignRoot],
    ['/chakra/', fixtureRoot]
  ]

  for (const [prefix, root] of routes) {
    if (!pathname.startsWith(prefix)) continue

    const decodedPath = decodeURIComponent(pathname.slice(prefix.length))
    const candidate = resolve(root, decodedPath)
    return within(root, candidate) ? candidate : null
  }

  return null
}

function sendBuffer(response, contents, contentType) {
  const body = Buffer.from(contents)
  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Length': body.byteLength,
    'Content-Type': contentType
  })
  response.end(body)
}

async function serveFile(path, response) {
  try {
    await access(path)
    const fileStats = await stat(path)
    if (!fileStats.isFile()) throw new Error('Not a file')

    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Length': fileStats.size,
      'Content-Type': contentTypes.get(extname(path)) ?? 'application/octet-stream'
    })
    createReadStream(path).pipe(response)
  } catch {
    response.writeHead(404).end('Not found')
  }
}

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('GOVUK_CHAKRA_FIXTURE_PORT must be an integer from 1 to 65535.')
}

await Promise.all([
  access(resolve(govukRoot, 'govuk-frontend.min.css')),
  access(resolve(govukDesignRoot, 'tokens/govuk.css')),
  access(resolve(repositoryRoot, 'ui-frameworks/chakra/govuk-system.mjs'))
])

const bundle = await build({
  bundle: true,
  define: {
    'process.env.NODE_ENV': '"development"'
  },
  entryPoints: [resolve(fixtureRoot, 'client.mjs')],
  format: 'esm',
  logLevel: 'silent',
  platform: 'browser',
  sourcemap: 'inline',
  target: ['es2022'],
  write: false
})
const clientJavaScript = bundle.outputFiles[0].contents

const server = createServer((request, response) => {
  Promise.resolve().then(async () => {
    let pathname

    try {
      pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
    } catch {
      response.writeHead(400).end('Bad request')
      return
    }

    if (pathname === '/' || pathname === '/index.html') {
      sendBuffer(response, renderFixturePage(), 'text/html; charset=utf-8')
      return
    }

    if (pathname === '/chakra/client.js') {
      sendBuffer(response, clientJavaScript, 'text/javascript; charset=utf-8')
      return
    }

    const file = resolveRequest(pathname)
    if (!file) {
      response.writeHead(404).end('Not found')
      return
    }
    await serveFile(file, response)
  }).catch((error) => {
    console.error(error)
    if (!response.headersSent) response.writeHead(500)
    response.end('Internal server error')
  })
})

server.listen(port, '127.0.0.1', () => {
  console.log('Chakra UI fixture available at http://127.0.0.1:' + port)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
