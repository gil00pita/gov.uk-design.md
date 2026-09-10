import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const cache = resolve(tmpdir(), 'govuk-design-md-npm-cache')
await mkdir(cache, { recursive: true })

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const result = spawnSync(npm, ['pack', '--dry-run', '--json'], {
  encoding: 'utf8',
  env: { ...process.env, npm_config_cache: cache }
})

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout)
  process.exit(result.status ?? 1)
}

const report = JSON.parse(result.stdout)[0]
const paths = report.files.map((file) => file.path)
const forbiddenPrefixes = ['fixtures/', 'output/', 'src/', 'scripts/', 'test/']
const forbidden = paths.filter((path) => forbiddenPrefixes.some((prefix) => path.startsWith(prefix)))
const required = [
  'DESIGN.md',
  'catalog.json',
  'bin/govuk-design-md.js',
  'adapters/manifest.json',
  'adapters/ai/AGENTS.md',
  'frameworks/manifest.json',
  'frameworks/html-css/DESIGN.md',
  'frameworks/react/DESIGN.md',
  'frameworks/angular/DESIGN.md',
  'frameworks/svelte/DESIGN.md',
  'design/govuk/catalog.json',
  'design/govuk/NOTICE.md',
  'design/govuk/LICENSE-CONTENT.md',
  'agents/govuk-design-system/SKILL.md'
]
const missing = required.filter((path) => !paths.includes(path))

if (forbidden.length > 0 || missing.length > 0) {
  for (const path of forbidden) process.stderr.write(`forbidden package file: ${path}\n`)
  for (const path of missing) process.stderr.write(`missing package file: ${path}\n`)
  process.exit(1)
}

process.stdout.write(`package contains ${paths.length} files (${report.unpackedSize} bytes unpacked); extraction evidence excluded\n`)
