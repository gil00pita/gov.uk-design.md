import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, relative } from 'node:path'
import { expectedGeneratedFiles, projectRoot } from './lib/catalog.mjs'

const files = await expectedGeneratedFiles()

for (const [path, contents] of files) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, contents, 'utf8')
  process.stdout.write(`generated ${relative(projectRoot, path)}\n`)
}

