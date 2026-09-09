#!/usr/bin/env node

import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const fixtureRoot = resolve(repositoryRoot, 'fixtures/vertical-slice');
const govukRoot = resolve(repositoryRoot, 'node_modules/govuk-frontend/dist/govuk');
const port = Number.parseInt(process.env.GOVUK_FIXTURE_PORT ?? '4173', 10);

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
]);

function within(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

function resolveRequest(pathname) {
  if (pathname === '/' || pathname === '/index.html') {
    return resolve(fixtureRoot, 'index.html');
  }

  const routes = [
    ['/vendor/govuk/', govukRoot],
    ['/assets/', resolve(govukRoot, 'assets')]
  ];

  for (const [prefix, root] of routes) {
    if (!pathname.startsWith(prefix)) continue;

    const decodedPath = decodeURIComponent(pathname.slice(prefix.length));
    const candidate = resolve(root, decodedPath);
    return within(root, candidate) ? candidate : null;
  }

  return null;
}

async function serveFile(request, response) {
  let pathname;

  try {
    pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }

  const file = resolveRequest(pathname);

  if (!file) {
    response.writeHead(404).end('Not found');
    return;
  }

  try {
    await access(file);
    const fileStats = await stat(file);
    if (!fileStats.isFile()) throw new Error('Not a file');
  } catch {
    response.writeHead(404).end('Not found');
    return;
  }

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Length': (await stat(file)).size,
    'Content-Type': contentTypes.get(extname(file)) ?? 'application/octet-stream'
  });
  createReadStream(file).pipe(response);
}

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('GOVUK_FIXTURE_PORT must be an integer from 1 to 65535.');
}

await access(resolve(govukRoot, 'govuk-frontend.min.css'));

const server = createServer((request, response) => {
  serveFile(request, response).catch((error) => {
    console.error(error);
    if (!response.headersSent) response.writeHead(500);
    response.end('Internal server error');
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Fixture available at http://127.0.0.1:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
