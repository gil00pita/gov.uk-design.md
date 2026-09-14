#!/usr/bin/env node

import { createReadStream } from 'node:fs'
import { access, mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'

const repositoryRoot = resolve(import.meta.dirname, '..')
const fixtureRoot = resolve(repositoryRoot, 'fixtures/tailwind')
const govukRoot = resolve(repositoryRoot, 'node_modules/govuk-frontend/dist/govuk')
const tailwindCli = resolve(repositoryRoot, 'node_modules/@tailwindcss/cli/dist/index.mjs')
const port = Number.parseInt(process.env.GOVUK_TAILWIND_FIXTURE_PORT ?? '4178', 10)

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2']
])

function within(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${sep}`)
}

function resolveRequest(pathname) {
  if (pathname === '/' || pathname === '/index.html') {
    return resolve(fixtureRoot, 'index.html')
  }

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

async function compileTailwind() {
  const temporaryDirectory = await mkdtemp(resolve(tmpdir(), 'govuk-design-md-tailwind-fixture-'))
  const output = resolve(temporaryDirectory, 'tailwind.css')

  try {
    const build = spawnSync(
      process.execPath,
      [tailwindCli, '-i', resolve(fixtureRoot, 'input.css'), '-o', output, '--minify'],
      { cwd: repositoryRoot, encoding: 'utf8' }
    )
    if (build.status !== 0) throw new Error(build.stderr || build.stdout)
    return await readFile(output)
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true })
  }
}

async function serveFile(request, response, tailwindCss) {
  let pathname

  try {
    pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
  } catch {
    response.writeHead(400).end('Bad request')
    return
  }

  if (pathname === '/vendor/tailwind.css') {
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Length': tailwindCss.length,
      'Content-Type': 'text/css; charset=utf-8'
    })
    response.end(request.method === 'HEAD' ? undefined : tailwindCss)
    return
  }

  const file = resolveRequest(pathname)
  if (!file) {
    response.writeHead(404).end('Not found')
    return
  }

  let fileStats
  try {
    await access(file)
    fileStats = await stat(file)
    if (!fileStats.isFile()) throw new Error('Not a file')
  } catch {
    response.writeHead(404).end('Not found')
    return
  }

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Length': fileStats.size,
    'Content-Type': contentTypes.get(extname(file)) ?? 'application/octet-stream'
  })
  if (request.method === 'HEAD') {
    response.end()
  } else {
    createReadStream(file).pipe(response)
  }
}

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('GOVUK_TAILWIND_FIXTURE_PORT must be an integer from 1 to 65535')
}

await access(resolve(govukRoot, 'govuk-frontend.min.css'))
const tailwindCss = await compileTailwind()
const server = createServer((request, response) => {
  serveFile(request, response, tailwindCss).catch((error) => {
    console.error(error)
    if (!response.headersSent) response.writeHead(500)
    response.end('Internal server error')
  })
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Tailwind fixture available at http://127.0.0.1:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
