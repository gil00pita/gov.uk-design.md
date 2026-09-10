import { readFile } from 'node:fs/promises'
import { compile } from 'svelte/compiler'

export function sveltePlugin(generate) {
  return {
    name: `svelte-${generate}`,
    setup(build) {
      build.onLoad({ filter: /\.svelte$/ }, async ({ path }) => {
        const source = await readFile(path, 'utf8')
        const compiled = compile(source, {
          filename: path,
          generate
        })

        return {
          contents: compiled.js.code,
          loader: 'js',
          watchFiles: [path]
        }
      })
    }
  }
}
