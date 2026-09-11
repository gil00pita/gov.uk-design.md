import { resolve } from 'node:path'
import { defineConfig } from 'astro/config'

const configuredOutDir = process.env.GOVUK_ASTRO_FIXTURE_OUT_DIR
const repositoryRoot = resolve(import.meta.dirname, '../..')

export default defineConfig({
  devToolbar: {
    enabled: false
  },
  outDir: configuredOutDir
    ? resolve(configuredOutDir)
    : resolve(import.meta.dirname, 'dist'),
  publicDir: resolve(repositoryRoot, 'node_modules/govuk-frontend/dist/govuk'),
  vite: {
    build: {
      cssMinify: 'esbuild'
    }
  }
})
