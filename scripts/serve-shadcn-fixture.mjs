#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { access, mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, resolve, sep } from 'node:path'
import { build } from 'esbuild'
import {
  renderCancellationPage,
  renderCancelledPage,
  renderFixturePage
} from '../fixtures/shadcn/page.mjs'

const repositoryRoot = resolve(import.meta.dirname, '..')
const fixtureRoot = resolve(repositoryRoot, 'fixtures/shadcn')
const govukRoot = resolve(repositoryRoot, 'node_modules/govuk-frontend/dist/govuk')
const tailwindCli = resolve(repositoryRoot, 'node_modules/@tailwindcss/cli/dist/index.mjs')
const port = Number.parseInt(process.env.GOVUK_SHADCN_FIXTURE_PORT ?? '4179', 10)

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
  return candidate === root || candidate.startsWith(`${root}${sep}`)
}

function resolveRequest(pathname) {
  const routes = [
    ['/vendor/govuk/', govukRoot],
    ['/assets/', resolve(govukRoot, 'assets')]
  ]

  for (const [prefix, root] of routes) {
    if (!pathname.startsWith(prefix)) continue
    const decodedPath = decodeURIComponent(pathname.slice(prefix.length))
    const candidate = resolve(root, decodedPath)
    return within(root, candidate) ? candidate : null
  }

  return null
}

function sendBuffer(request, response, contents, contentType) {
  const body = Buffer.from(contents)
  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Length': body.byteLength,
    'Content-Type': contentType
  })
  response.end(request.method === 'HEAD' ? undefined : body)
}

async function serveFile(request, response, path) {
  try {
    await access(path)
    const fileStats = await stat(path)
    if (!fileStats.isFile()) throw new Error('Not a file')

    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Length': fileStats.size,
      'Content-Type': contentTypes.get(extname(path)) ?? 'application/octet-stream'
    })
    if (request.method === 'HEAD') response.end()
    else createReadStream(path).pipe(response)
  } catch {
    response.writeHead(404).end('Not found')
  }
}

async function compileTailwind() {
  const temporaryDirectory = await mkdtemp(resolve(tmpdir(), 'govuk-design-md-shadcn-fixture-'))
  const output = resolve(temporaryDirectory, 'shadcn.css')

  try {
    const result = spawnSync(
      process.execPath,
      [tailwindCli, '-i', resolve(fixtureRoot, 'input.css'), '-o', output, '--minify'],
      { cwd: repositoryRoot, encoding: 'utf8' }
    )
    if (result.status !== 0) throw new Error(result.stderr || result.stdout)
    return await readFile(output)
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true })
  }
}

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('GOVUK_SHADCN_FIXTURE_PORT must be an integer from 1 to 65535')
}

await access(resolve(govukRoot, 'govuk-frontend.min.css'))
await access(resolve(repositoryRoot, 'ui-frameworks/shadcn/govuk-theme.css'))

const [shadcnCss, bundle] = await Promise.all([
  compileTailwind(),
  build({
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
])
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
      sendBuffer(request, response, renderFixturePage(), 'text/html; charset=utf-8')
      return
    }

    if (pathname === '/cancel') {
      sendBuffer(request, response, renderCancellationPage(), 'text/html; charset=utf-8')
      return
    }

    if (pathname === '/cancelled') {
      sendBuffer(request, response, renderCancelledPage(), 'text/html; charset=utf-8')
      return
    }

    if (pathname === '/shadcn/client.js') {
      sendBuffer(request, response, clientJavaScript, 'text/javascript; charset=utf-8')
      return
    }

    if (pathname === '/vendor/shadcn.css') {
      sendBuffer(request, response, shadcnCss, 'text/css; charset=utf-8')
      return
    }

    const file = resolveRequest(pathname)
    if (!file) {
      response.writeHead(404).end('Not found')
      return
    }
    await serveFile(request, response, file)
  }).catch((error) => {
    console.error(error)
    if (!response.headersSent) response.writeHead(500)
    response.end('Internal server error')
  })
})

server.listen(port, '127.0.0.1', () => {
  console.log(`shadcn fixture available at http://127.0.0.1:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
