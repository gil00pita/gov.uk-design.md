#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '..')
const astroCli = resolve(repositoryRoot, 'node_modules/astro/bin/astro.mjs')
const child = spawn(
  process.execPath,
  [astroCli, 'dev', '--root', resolve(repositoryRoot, 'fixtures/astro'), '--host', '127.0.0.1', '--port', '4177'],
  {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      ASTRO_TELEMETRY_DISABLED: '1'
    },
    stdio: 'inherit'
  }
)

child.on('error', (error) => {
  console.error(error)
  process.exitCode = 1
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exitCode = code ?? 1
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}
