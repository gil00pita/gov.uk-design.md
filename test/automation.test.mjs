import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'
import { compareUpstream, checkUpstream, parseInventoryHtml } from '../scripts/check-upstream.mjs'
import { renderGeneratedChangeReport } from '../scripts/generated-change-report.mjs'
import { buildProvenance, enforcePackageLimits, findChangelogEntry } from '../scripts/release-provenance.mjs'

const fixtureManifest = {
  reviewedAt: '2026-09-09',
  upstreams: {
    govukFrontend: {
      package: 'govuk-frontend',
      version: '6.5.0'
    }
  },
  inventories: {
    styles: {
      indexUrl: 'https://design-system.service.gov.uk/styles/',
      expectedCount: 1,
      items: [{ id: 'layout', url: 'https://design-system.service.gov.uk/styles/layout/' }]
    },
    components: {
      indexUrl: 'https://design-system.service.gov.uk/components/',
      expectedCount: 1,
      items: [{ id: 'button', url: 'https://design-system.service.gov.uk/components/button/' }]
    },
    patterns: {
      indexUrl: 'https://design-system.service.gov.uk/patterns/',
      expectedCount: 1,
      items: [{ id: 'addresses', url: 'https://design-system.service.gov.uk/patterns/addresses/' }]
    }
  }
}

test('inventory extraction keeps only direct official inventory links and is deterministic', () => {
  const html = `
    <a href="/components/text-input/">Text input</a>
    <a href='https://design-system.service.gov.uk/components/button'>Button</a>
    <a href="/components/text-input/?example=1">Duplicate</a>
    <a href="/components/button/example/">Nested example</a>
    <a href="https://example.test/components/radios/">Foreign host</a>
  `
  assert.deepEqual(parseInventoryHtml(html, 'components', fixtureManifest.inventories.components.indexUrl), [
    { id: 'button', url: 'https://design-system.service.gov.uk/components/button/' },
    { id: 'text-input', url: 'https://design-system.service.gov.uk/components/text-input/' }
  ])
})

test('upstream comparison reports release, additions, removals and count drift', () => {
  const baseline = {
    govukFrontendVersion: '6.5.0',
    inventories: {
      styles: { expectedCount: 1, items: [{ id: 'layout' }] },
      components: { expectedCount: 1, items: [{ id: 'button' }] },
      patterns: { expectedCount: 1, items: [{ id: 'addresses' }] }
    }
  }
  const observed = {
    govukFrontendVersion: '6.6.0',
    inventories: {
      styles: { items: [{ id: 'layout' }] },
      components: { items: [{ id: 'button' }, { id: 'dialog' }] },
      patterns: { items: [{ id: 'confirmation-pages' }] }
    }
  }
  const changes = compareUpstream(baseline, observed)
  assert.equal(changes.hasChanges, true)
  assert.deepEqual(changes.release, { baseline: '6.5.0', observed: '6.6.0', changed: true })
  assert.deepEqual(changes.inventories.components.added, ['dialog'])
  assert.deepEqual(changes.inventories.patterns.removed, ['addresses'])
  assert.equal(changes.inventories.components.observedCount, 2)
})

test('upstream check can be reproduced with an injected fetch implementation and clock', async () => {
  const responses = new Map([
    ['https://registry.npmjs.org/govuk-frontend/latest', JSON.stringify({ version: '6.5.0' })],
    ['https://design-system.service.gov.uk/styles/', '<a href="/styles/layout/">Layout</a>'],
    ['https://design-system.service.gov.uk/components/', '<a href="/components/button/">Button</a>'],
    ['https://design-system.service.gov.uk/patterns/', '<a href="/patterns/addresses/">Addresses</a>']
  ])
  const fetchImpl = async (url) => {
    const body = responses.get(String(url))
    return body === undefined ? new Response('', { status: 404 }) : new Response(body, { status: 200 })
  }
  const report = await checkUpstream({
    fetchImpl,
    now: () => new Date('2026-09-11T10:00:00.000Z'),
    sourceManifest: fixtureManifest
  })
  assert.equal(report.checkedAt, '2026-09-11T10:00:00.000Z')
  assert.equal(report.changes.hasChanges, false)
  assert.deepEqual(report.observed.inventories.components.items, [
    { id: 'button', url: 'https://design-system.service.gov.uk/components/button/' }
  ])
})

test('generated change report is deterministic and excludes observation timestamps', () => {
  const upstream = {
    checkedAt: '2026-09-11T10:00:00.000Z',
    changes: {
      hasChanges: true,
      release: { baseline: '6.5.0', observed: '6.6.0', changed: true },
      inventories: {
        styles: { expectedCount: 13, observedCount: 13, added: [], removed: [] },
        components: { expectedCount: 37, observedCount: 38, added: ['dialog'], removed: [] },
        patterns: { expectedCount: 30, observedCount: 30, added: [], removed: [] }
      }
    }
  }
  const changes = [{
    path: 'catalog.json',
    status: 'M',
    beforeSha256: 'a'.repeat(64),
    afterSha256: 'b'.repeat(64),
    beforeLines: 10,
    afterLines: 11,
    patch: '@@ -1 +1 @@\n-old\n+new',
    omittedPatchLines: 0
  }]
  const first = renderGeneratedChangeReport({ upstream, changes })
  const second = renderGeneratedChangeReport({ upstream, changes })
  assert.equal(first, second)
  assert.match(first, /Human review required: \*\*yes\*\*/)
  assert.match(first, /`dialog`/)
  assert.match(first, /```diff/)
  assert.doesNotMatch(first, /2026-09-11T10:00/)
})

test('release gate requires a dated changelog entry and enforces package byte limits', () => {
  const entry = findChangelogEntry(
    '# Changelog\n\n## [Unreleased]\n\n## [0.4.0] - 2026-09-11\n\n- Stable candidate.\n',
    '0.4.0'
  )
  assert.deepEqual(entry, { heading: '## [0.4.0] - 2026-09-11', date: '2026-09-11' })
  assert.throws(() => findChangelogEntry('## [Unreleased]\n', '0.4.0'), /dated/)
  assert.deepEqual(
    enforcePackageLimits({ size: 100, unpackedSize: 500, entryCount: 3 }, { packedBytes: 200, unpackedBytes: 600 }),
    { packedBytes: 100, packedLimitBytes: 200, unpackedBytes: 500, unpackedLimitBytes: 600, fileCount: 3 }
  )
  assert.throws(
    () => enforcePackageLimits({ size: 201, unpackedSize: 500, entryCount: 3 }, { packedBytes: 200, unpackedBytes: 600 }),
    /packed size 201 exceeds 200/
  )
})

test('release provenance binds package identity, commit, reviewed upstream and source digests', () => {
  const provenance = buildProvenance({
    packageMetadata: {
      name: 'govuk-design-md',
      version: '0.4.0',
      repository: { url: 'https://github.com/gil00pita/gov.uk-design.md.git' }
    },
    sourceManifest: fixtureManifest,
    packageLock: {
      packages: {
        'node_modules/govuk-frontend': {
          version: '6.5.0',
          resolved: 'https://registry.npmjs.org/govuk-frontend/-/govuk-frontend-6.5.0.tgz',
          integrity: 'sha512-upstream'
        }
      }
    },
    packReport: {
      name: 'govuk-design-md',
      version: '0.4.0',
      filename: 'govuk-design-md-0.4.0.tgz',
      shasum: '1'.repeat(40),
      integrity: `sha512-${Buffer.alloc(64, 7).toString('base64')}`
    },
    changelogEntry: { heading: '## [0.4.0] - 2026-09-11', date: '2026-09-11' },
    commit: 'a'.repeat(40),
    treeState: 'clean',
    sourceManifestSha256: 'b'.repeat(64),
    packageLockSha256: 'c'.repeat(64),
    packageLimits: { packedBytes: 100, packedLimitBytes: 200, unpackedBytes: 500, unpackedLimitBytes: 600, fileCount: 3 },
    environment: { GITHUB_ACTIONS: 'false' }
  })
  assert.equal(provenance.subject.name, 'govuk-design-md@0.4.0')
  assert.equal(provenance.source.commit, 'a'.repeat(40))
  assert.equal(provenance.subject.digest.sha512, Buffer.alloc(64, 7).toString('hex'))
  assert.equal(provenance.reviewedUpstream.version, '6.5.0')
  assert.equal(provenance.materials[0].digest.sha256, 'b'.repeat(64))
  assert.match(provenance.note, /Unsigned release-candidate evidence/)
})

test('automation workflows retain evidence and restrict writes to upstream review pull requests', async () => {
  const quality = await readFile(new URL('../.github/workflows/quality-gates.yml', import.meta.url), 'utf8')
  const upstream = await readFile(new URL('../.github/workflows/upstream-monitor.yml', import.meta.url), 'utf8')
  const release = await readFile(new URL('../.github/workflows/stable-release-gates.yml', import.meta.url), 'utf8')

  for (const workflow of [quality, release]) {
    assert.match(workflow, /permissions:\n  contents: read/)
    assert.doesNotMatch(workflow, /npm publish|gh release|contents: write/)
  }
  assert.match(upstream, /permissions:\n  contents: write\n  pull-requests: write/)
  assert.match(upstream, /gh pr create/)
  assert.match(upstream, /reports\/upstream-change-report\.md/)
  assert.doesNotMatch(upstream, /npm publish|gh release/)
  assert.match(quality, /npm run check/)
  assert.match(quality, /npx playwright install --with-deps chromium/)
  assert.match(quality, /npm run visual:check/)
  assert.match(quality, /output\/playwright\/\*\.png/)
  assert.match(upstream, /schedule:/)
  assert.match(upstream, /generated-change-report\.mjs/)
  assert.match(release, /GOVUK_EXPECTED_RELEASE_TAG/)
  assert.match(release, /release-provenance\.mjs/)
  assert.match(release, /npx playwright install --with-deps chromium/)
  assert.match(release, /npm run visual:check/)
})

test('package scripts expose the automation entry points', async () => {
  const packageMetadata = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(packageMetadata.scripts['upstream:check'], 'node scripts/check-upstream.mjs --fail-on-change')
  assert.equal(packageMetadata.scripts['changes:report'], 'node scripts/generated-change-report.mjs')
  assert.equal(packageMetadata.scripts['release:provenance'], 'node scripts/release-provenance.mjs')
})

test('committed visual evidence contains valid non-empty PNG baselines', async () => {
  const evidenceDirectory = new URL('../output/playwright/', import.meta.url)
  const images = (await readdir(evidenceDirectory)).filter((path) => path.endsWith('.png')).sort()
  assert.ok(images.length >= 6, 'expected the framework visual evidence set')

  for (const image of images) {
    const contents = await readFile(new URL(image, evidenceDirectory))
    assert.deepEqual([...contents.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${image} must be a PNG`)
    assert.ok(contents.readUInt32BE(16) >= 320, `${image} width is unexpectedly small`)
    assert.ok(contents.readUInt32BE(20) >= 320, `${image} height is unexpectedly small`)
    assert.ok(contents.length > 1_000, `${image} is unexpectedly empty`)
  }
})
