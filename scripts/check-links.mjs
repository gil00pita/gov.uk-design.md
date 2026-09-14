import { access, readFile, readdir, stat } from 'node:fs/promises'
import { dirname, extname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const roots = [
  'CHANGELOG.md',
  'DESIGN.md',
  'NOTICE.md',
  'PLAN.md',
  'README.md',
  'adapters',
  'agents',
  'design',
  'docs',
  'frameworks',
  'ui-frameworks'
]

function portable(path) {
  return path.split(sep).join('/')
}

async function markdownFiles(path) {
  const metadata = await stat(path)
  if (metadata.isFile()) return extname(path) === '.md' ? [path] : []

  const files = []
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = resolve(path, entry.name)
    if (entry.isDirectory()) files.push(...await markdownFiles(child))
    if (entry.isFile() && extname(child) === '.md') files.push(child)
  }
  return files
}

function localTarget(rawTarget) {
  const target = rawTarget.replace(/^<|>$/g, '')
  if (target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(target)) return null
  return decodeURIComponent(target.split('#', 1)[0].split('?', 1)[0])
}

const failures = []
const files = (await Promise.all(roots.map((path) => markdownFiles(resolve(projectRoot, path))))).flat()

for (const file of files) {
  const contents = await readFile(file, 'utf8')
  for (const match of contents.matchAll(/\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = localTarget(match[1])
    if (!target) continue

    const resolved = resolve(dirname(file), target)
    const fromRoot = relative(projectRoot, resolved)
    if (!fromRoot || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) {
      failures.push(`${portable(relative(projectRoot, file))}: link escapes repository: ${match[1]}`)
      continue
    }

    await access(resolved).catch(() => {
      failures.push(`${portable(relative(projectRoot, file))}: missing link target: ${match[1]}`)
    })
  }
}

if (failures.length > 0) {
  for (const failure of failures) process.stderr.write(`error: ${failure}\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`validated local links in ${files.length} Markdown files\n`)
}
