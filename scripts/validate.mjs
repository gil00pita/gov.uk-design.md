import { access, readFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import {
  expectedGeneratedFiles,
  loadAiAdapters,
  loadComponents,
  loadFrameworkAdapters,
  loadPatterns,
  loadSourceManifest,
  loadStyles,
  loadTokens,
  projectRoot,
  tokenIds
} from './lib/catalog.mjs'

const errors = []
const [components, styles, patterns, sourceManifest, aiAdapterSource, frameworkAdapterSource, tokens, expectedFiles] = await Promise.all([
  loadComponents(),
  loadStyles(),
  loadPatterns(),
  loadSourceManifest(),
  loadAiAdapters(),
  loadFrameworkAdapters(),
  loadTokens(),
  expectedGeneratedFiles()
])

const ids = new Set()
const knownTokens = new Set(tokenIds(tokens))
const reviewedInventoryCounts = {
  styles: 13,
  components: 37,
  patterns: 30
}

if (aiAdapterSource.schemaVersion !== 1) errors.push('sources/ai-adapters.json: unsupported schemaVersion')
if (aiAdapterSource.reviewedAt !== sourceManifest.reviewedAt) {
  errors.push('sources/ai-adapters.json: reviewedAt does not match sources/govuk.json')
}
if (!Array.isArray(aiAdapterSource.adapters) || aiAdapterSource.adapters.length !== 5) {
  errors.push('sources/ai-adapters.json: expected 5 reviewed adapters')
} else {
  const adapterIds = new Set()
  const adapterOutputs = new Set()
  const adapterDestinations = new Set()
  for (const adapter of aiAdapterSource.adapters) {
    const label = `AI adapter ${adapter.id ?? '<missing id>'}`
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(adapter.id ?? '')) errors.push(`${label}: invalid id`)
    if (adapterIds.has(adapter.id)) errors.push(`${label}: duplicate id`)
    adapterIds.add(adapter.id)
    for (const field of ['name', 'sourceUrl', 'output', 'destination']) {
      if (typeof adapter[field] !== 'string' || adapter[field].length === 0) {
        errors.push(`${label}: ${field} must be a non-empty string`)
      }
    }
    try {
      new URL(adapter.sourceUrl)
    } catch {
      errors.push(`${label}: sourceUrl must be an absolute URL`)
    }
    if (!['file', 'managed-block'].includes(adapter.mode)) errors.push(`${label}: unsupported mode ${adapter.mode}`)
    for (const [field, paths] of [['output', adapterOutputs], ['destination', adapterDestinations]]) {
      const path = adapter[field] ?? ''
      const resolvedPath = resolve(projectRoot, '.adapter-path-check', path)
      const relativePath = relative(resolve(projectRoot, '.adapter-path-check'), resolvedPath)
      if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)) {
        errors.push(`${label}: ${field} must stay within its root`)
      }
      if (paths.has(path)) errors.push(`${label}: duplicate ${field} ${path}`)
      paths.add(path)
    }
  }
}

if (frameworkAdapterSource.schemaVersion !== 1) {
  errors.push('sources/framework-adapters.json: unsupported schemaVersion')
}
if (frameworkAdapterSource.reviewedAt !== sourceManifest.reviewedAt) {
  errors.push('sources/framework-adapters.json: reviewedAt does not match sources/govuk.json')
}
if (frameworkAdapterSource.govukFrontendVersion !== sourceManifest.upstreams.govukFrontend.version) {
  errors.push('sources/framework-adapters.json: govukFrontendVersion does not match sources/govuk.json')
}
if (!Array.isArray(frameworkAdapterSource.adapters) || frameworkAdapterSource.adapters.length === 0) {
  errors.push('sources/framework-adapters.json: expected at least one framework adapter')
} else {
  const adapterIds = new Set()
  const adapterOutputs = new Set()
  const adapterFixtures = new Set()
  const knownCompatibility = new Set(['guidance', 'token', 'markup', 'behaviour-tested'])
  const pageTemplateLanguages = new Set(['html', 'jsx', 'js', 'ts', 'tsx'])
  const dynamicExampleLanguages = new Set(['js', 'jsx', 'ts', 'tsx'])
  for (const adapter of frameworkAdapterSource.adapters) {
    const label = `framework adapter ${adapter.id ?? '<missing id>'}`
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(adapter.id ?? '')) errors.push(`${label}: invalid id`)
    if (adapterIds.has(adapter.id)) errors.push(`${label}: duplicate id`)
    adapterIds.add(adapter.id)
    for (const field of ['name', 'description', 'fixtureDescription', 'pageTemplateIntro', 'dynamicExampleIntro']) {
      if (typeof adapter[field] !== 'string' || adapter[field].length === 0) {
        errors.push(`${label}: ${field} must be a non-empty string`)
      }
    }
    if (!['reference', 'experimental', 'stable'].includes(adapter.status)) errors.push(`${label}: unsupported status ${adapter.status}`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(adapter.reviewedAt ?? '') || Number.isNaN(Date.parse(`${adapter.reviewedAt}T00:00:00Z`))) {
      errors.push(`${label}: reviewedAt must be a valid date`)
    }
    if (!pageTemplateLanguages.has(adapter.pageTemplateLanguage)) {
      errors.push(`${label}: unsupported pageTemplateLanguage ${adapter.pageTemplateLanguage}`)
    }
    if (!dynamicExampleLanguages.has(adapter.dynamicExampleLanguage)) {
      errors.push(`${label}: unsupported dynamicExampleLanguage ${adapter.dynamicExampleLanguage}`)
    }

    const output = adapter.output ?? ''
    const resolvedOutput = resolve(projectRoot, '.framework-path-check', output)
    const relativeOutput = relative(resolve(projectRoot, '.framework-path-check'), resolvedOutput)
    if (!relativeOutput || relativeOutput === '..' || relativeOutput.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)) {
      errors.push(`${label}: output must stay within the frameworks directory`)
    }
    if (adapterOutputs.has(output)) errors.push(`${label}: duplicate output ${output}`)
    adapterOutputs.add(output)

    if (!Array.isArray(adapter.compatibility) || adapter.compatibility.length === 0) {
      errors.push(`${label}: compatibility must be a non-empty array`)
    } else {
      const levels = new Set()
      for (const level of adapter.compatibility) {
        if (!knownCompatibility.has(level)) errors.push(`${label}: unsupported compatibility level ${level}`)
        if (levels.has(level)) errors.push(`${label}: duplicate compatibility level ${level}`)
        levels.add(level)
      }
      if (levels.has('behaviour-tested') && !levels.has('markup')) {
        errors.push(`${label}: behaviour-tested requires markup compatibility`)
      }
    }

    for (const field of ['requirements', 'assetSetup', 'rendering', 'progressiveEnhancement', 'lifecycle']) {
      if (!Array.isArray(adapter[field]) || adapter[field].length === 0 || adapter[field].some((item) => typeof item !== 'string' || item.length === 0)) {
        errors.push(`${label}: ${field} must be a non-empty string array`)
      }
    }
    for (const field of ['pageTemplate', 'dynamicExample']) {
      if (typeof adapter[field] !== 'string' || adapter[field].length === 0) errors.push(`${label}: ${field} must be a non-empty string`)
    }
    if (!`${adapter.pageTemplateIntro ?? ''}\n${adapter.pageTemplate ?? ''}`.includes('govuk-template')) {
      errors.push(`${label}: pageTemplate must include the GOV.UK page shell`)
    }
    if (
      !adapter.dynamicExample?.includes('initAll(') ||
      (
        !adapter.dynamicExample?.includes('initAll(container)') &&
        !adapter.dynamicExample?.includes('scope:') &&
        !/\bscope\s*,/.test(adapter.dynamicExample ?? '')
      )
    ) {
      errors.push(`${label}: dynamicExample must scope initialisation to inserted content`)
    }

    const fixturePath = resolve(projectRoot, adapter.fixture ?? '')
    const fixtureRelative = relative(projectRoot, fixturePath)
    if (!fixtureRelative || fixtureRelative === '..' || fixtureRelative.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)) {
      errors.push(`${label}: fixture must stay within the repository`)
    } else {
      await access(fixturePath).catch(() => errors.push(`${label}: fixture does not exist: ${adapter.fixture}`))
    }
    if (adapterFixtures.has(adapter.fixture)) errors.push(`${label}: duplicate fixture ${adapter.fixture}`)
    adapterFixtures.add(adapter.fixture)
    if (!Array.isArray(adapter.sourceUrls) || adapter.sourceUrls.length === 0) {
      errors.push(`${label}: sourceUrls must be a non-empty array`)
    } else {
      for (const source of adapter.sourceUrls) {
        if (typeof source.name !== 'string' || source.name.length === 0) errors.push(`${label}: source name must be non-empty`)
        try {
          new URL(source.url)
        } catch {
          errors.push(`${label}: source URL must be absolute`)
        }
      }
    }
  }
}

for (const [kind, reviewedCount] of Object.entries(reviewedInventoryCounts)) {
  const inventory = sourceManifest.inventories?.[kind]
  const label = `source inventory ${kind}`

  if (!inventory || !Array.isArray(inventory.items)) {
    errors.push(`${label}: missing items array`)
    continue
  }
  if (inventory.expectedCount !== reviewedCount) {
    errors.push(`${label}: expectedCount must be the reviewed count ${reviewedCount}`)
  }
  if (inventory.items.length !== inventory.expectedCount) {
    errors.push(`${label}: contains ${inventory.items.length} items, expected ${inventory.expectedCount}`)
  }

  const inventoryIds = new Set()
  const inventoryUrls = new Set()
  for (const item of inventory.items) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id ?? '')) {
      errors.push(`${label}: invalid item id ${item.id ?? '<missing>'}`)
    }
    if (typeof item.name !== 'string' || item.name.length === 0) {
      errors.push(`${label} ${item.id ?? '<missing>'}: name must be a non-empty string`)
    }
    if (inventoryIds.has(item.id)) errors.push(`${label}: duplicate item id ${item.id}`)
    inventoryIds.add(item.id)

    const expectedUrl = `${inventory.indexUrl}${item.id}/`
    if (item.url !== expectedUrl) {
      errors.push(`${label} ${item.id}: URL must be ${expectedUrl}`)
    }
    if (inventoryUrls.has(item.url)) errors.push(`${label}: duplicate URL ${item.url}`)
    inventoryUrls.add(item.url)
  }
}

const componentInventory = new Map(
  (sourceManifest.inventories?.components?.items ?? []).map((component) => [component.id, component])
)
const styleInventory = new Map(
  (sourceManifest.inventories?.styles?.items ?? []).map((style) => [style.id, style])
)
const patternInventory = new Map(
  (sourceManifest.inventories?.patterns?.items ?? []).map((pattern) => [pattern.id, pattern])
)

for (const item of componentInventory.values()) {
  if (!['stable', 'trial', 'deprecated'].includes(item.status)) {
    errors.push(`source inventory components ${item.id}: unsupported status ${item.status}`)
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.implementationId ?? '')) {
    errors.push(`source inventory components ${item.id}: invalid implementationId`)
    continue
  }
  const implementationPath = resolve(
    projectRoot,
    'node_modules',
    'govuk-frontend',
    'dist',
    'govuk',
    'components',
    item.implementationId
  )
  await access(implementationPath).catch(() => {
    errors.push(`source inventory components ${item.id}: implementation ${item.implementationId} is absent from the installed govuk-frontend release`)
  })
}

const installedGovukPackage = await readFile(
  resolve(projectRoot, 'node_modules', 'govuk-frontend', 'package.json'),
  'utf8'
).then(JSON.parse).catch(() => null)
if (!installedGovukPackage) {
  errors.push('govuk-frontend is not installed; run npm install')
} else if (installedGovukPackage.version !== sourceManifest.upstreams.govukFrontend.version) {
  errors.push(`installed govuk-frontend ${installedGovukPackage.version} does not match sources/govuk.json`)
}

const skillPath = resolve(projectRoot, 'agents', 'govuk-design-system', 'SKILL.md')
const skill = await readFile(skillPath, 'utf8').catch(() => '')
const frontmatterMatch = skill.match(/^---\n([\s\S]*?)\n---/)
if (!frontmatterMatch) {
  errors.push('agents/govuk-design-system/SKILL.md: invalid or missing YAML frontmatter')
} else {
  const frontmatter = Object.fromEntries(
    frontmatterMatch[1]
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf(':')
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()]
      })
  )
  const keys = Object.keys(frontmatter)
  const allowedKeys = new Set(['name', 'description', 'license', 'allowed-tools', 'metadata'])
  for (const key of keys) {
    if (!allowedKeys.has(key)) errors.push(`agents/govuk-design-system/SKILL.md: unexpected frontmatter key ${key}`)
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(frontmatter.name ?? '')) {
    errors.push('agents/govuk-design-system/SKILL.md: name must be lower-case hyphen-case')
  }
  if ((frontmatter.name ?? '').length > 64) {
    errors.push('agents/govuk-design-system/SKILL.md: name exceeds 64 characters')
  }
  if (!frontmatter.description || frontmatter.description.length > 1024 || /[<>]/.test(frontmatter.description)) {
    errors.push('agents/govuk-design-system/SKILL.md: description is missing or invalid')
  }
  if (/^\s*\[TODO:[^\n]*\]\s*$/m.test(skill.slice(frontmatterMatch[0].length))) {
    errors.push('agents/govuk-design-system/SKILL.md: unfinished TODO placeholder')
  }
}

for (const component of components) {
  const label = `component ${component.id ?? '<missing id>'}`
  const requiredStrings = ['id', 'name', 'category', 'status', 'summary']
  for (const field of requiredStrings) {
    if (typeof component[field] !== 'string' || component[field].length === 0) {
      errors.push(`${label}: ${field} must be a non-empty string`)
    }
  }
  if (component.category !== 'component') errors.push(`${label}: category must be component`)
  if (!['stable', 'trial', 'deprecated'].includes(component.status)) {
    errors.push(`${label}: unsupported status ${component.status}`)
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(component.id)) {
    errors.push(`${label}: id must be lower-case kebab-case`)
  }
  if (ids.has(component.id)) errors.push(`${label}: duplicate id`)
  ids.add(component.id)

  for (const field of ['whenToUse', 'whenNotToUse', 'anatomy', 'variants', 'behaviour', 'accessibility', 'content', 'htmlExamples']) {
    if (!Array.isArray(component[field]) || component[field].length === 0) {
      errors.push(`${label}: ${field} must be a non-empty array`)
    }
  }
  if (component.source?.govukFrontendVersion !== sourceManifest.upstreams.govukFrontend.version) {
    errors.push(`${label}: source version does not match sources/govuk.json`)
  }
  const inventoryItem = componentInventory.get(component.id)
  if (!inventoryItem) {
    errors.push(`${label}: not present in the reviewed component inventory`)
  } else {
    if (component.name !== inventoryItem.name) errors.push(`${label}: name does not match the reviewed inventory`)
    if (component.status !== inventoryItem.status) errors.push(`${label}: status does not match the reviewed inventory`)
    if (component.source?.guidanceUrl !== inventoryItem.url) {
      errors.push(`${label}: guidanceUrl does not match the reviewed inventory`)
    }
    const expectedImplementationUrl = `https://github.com/alphagov/govuk-frontend/tree/v${sourceManifest.upstreams.govukFrontend.version}/packages/govuk-frontend/src/govuk/components/${inventoryItem.implementationId}`
    if (component.source?.implementationUrl !== expectedImplementationUrl) {
      errors.push(`${label}: implementationUrl does not match the pinned inventory implementation`)
    }
  }
  for (const field of ['guidanceUrl', 'implementationUrl']) {
    try {
      new URL(component.source?.[field])
    } catch {
      errors.push(`${label}: ${field} must be an absolute URL`)
    }
  }
  for (const token of component.tokenRefs ?? []) {
    if (!knownTokens.has(token)) errors.push(`${label}: unknown token reference ${token}`)
  }
  for (const example of component.htmlExamples ?? []) {
    if (!example.html?.includes('govuk-')) errors.push(`${label}: HTML example lacks a GOV.UK class`)
  }
}

for (const id of componentInventory.keys()) {
  if (!ids.has(id)) errors.push(`component ${id}: reviewed inventory entry has no canonical record`)
}

const styleIds = new Set()
for (const style of styles) {
  const label = `style ${style.id ?? '<missing id>'}`
  for (const field of ['id', 'name', 'category', 'group', 'summary']) {
    if (typeof style[field] !== 'string' || style[field].length === 0) {
      errors.push(`${label}: ${field} must be a non-empty string`)
    }
  }
  if (style.category !== 'style') errors.push(`${label}: category must be style`)
  if (!['page-structure', 'typography', 'visual-elements'].includes(style.group)) {
    errors.push(`${label}: unsupported group ${style.group}`)
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(style.id)) errors.push(`${label}: id must be lower-case kebab-case`)
  if (styleIds.has(style.id)) errors.push(`${label}: duplicate id`)
  styleIds.add(style.id)

  for (const field of ['rules', 'accessibility', 'restrictions', 'examples']) {
    if (!Array.isArray(style[field]) || style[field].length === 0) {
      errors.push(`${label}: ${field} must be a non-empty array`)
    }
  }
  if (style.source?.govukFrontendVersion !== sourceManifest.upstreams.govukFrontend.version) {
    errors.push(`${label}: source version does not match sources/govuk.json`)
  }
  for (const field of ['guidanceUrl', 'implementationUrl']) {
    try {
      new URL(style.source?.[field])
    } catch {
      errors.push(`${label}: ${field} must be an absolute URL`)
    }
  }
  const inventoryItem = styleInventory.get(style.id)
  if (!inventoryItem) {
    errors.push(`${label}: not present in the reviewed style inventory`)
  } else {
    if (style.name !== inventoryItem.name) errors.push(`${label}: name does not match the reviewed inventory`)
    if (style.source?.guidanceUrl !== inventoryItem.url) {
      errors.push(`${label}: guidanceUrl does not match the reviewed inventory`)
    }
  }
  for (const token of style.tokenRefs ?? []) {
    if (!knownTokens.has(token)) errors.push(`${label}: unknown token reference ${token}`)
  }
  for (const example of style.examples ?? []) {
    if (!['html', 'css', 'scss'].includes(example.language)) errors.push(`${label}: unsupported example language`)
    if (typeof example.code !== 'string' || example.code.length === 0) errors.push(`${label}: example code is missing`)
  }
}

for (const id of styleInventory.keys()) {
  if (!styleIds.has(id)) errors.push(`style ${id}: reviewed inventory entry has no canonical record`)
}

const patternIds = new Set(patterns.map((pattern) => pattern.id))
const seenPatternIds = new Set()
for (const pattern of patterns) {
  const label = `pattern ${pattern.id ?? '<missing id>'}`
  for (const field of ['id', 'name', 'category', 'group', 'summary']) {
    if (typeof pattern[field] !== 'string' || pattern[field].length === 0) {
      errors.push(`${label}: ${field} must be a non-empty string`)
    }
  }
  if (pattern.category !== 'pattern') errors.push(`${label}: category must be pattern`)
  if (!['ask-users-for', 'help-users-to', 'pages'].includes(pattern.group)) {
    errors.push(`${label}: unsupported group ${pattern.group}`)
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pattern.id ?? '')) {
    errors.push(`${label}: id must be lower-case kebab-case`)
  }
  if (seenPatternIds.has(pattern.id)) errors.push(`${label}: duplicate id`)
  seenPatternIds.add(pattern.id)
  for (const field of ['whenToUse', 'whenNotToUse', 'rules', 'accessibility']) {
    if (!Array.isArray(pattern[field]) || pattern[field].length === 0) {
      errors.push(`${label}: ${field} must be a non-empty array`)
    }
  }
  for (const field of ['componentRefs', 'relatedPatterns']) {
    if (!Array.isArray(pattern[field])) errors.push(`${label}: ${field} must be an array`)
  }

  const inventoryItem = patternInventory.get(pattern.id)
  if (!inventoryItem) {
    errors.push(`${label}: not present in the reviewed pattern inventory`)
  } else {
    if (pattern.name !== inventoryItem.name) errors.push(`${label}: name does not match the reviewed inventory`)
    if (pattern.group !== inventoryItem.group) errors.push(`${label}: group does not match the reviewed inventory`)
    if (pattern.source?.guidanceUrl !== inventoryItem.url) {
      errors.push(`${label}: guidanceUrl does not match the reviewed inventory`)
    }
  }
  if (pattern.source?.reviewedAt !== sourceManifest.reviewedAt) {
    errors.push(`${label}: reviewedAt does not match sources/govuk.json`)
  }
  try {
    new URL(pattern.source?.guidanceUrl)
  } catch {
    errors.push(`${label}: guidanceUrl must be an absolute URL`)
  }
  for (const componentId of pattern.componentRefs ?? []) {
    if (!ids.has(componentId)) errors.push(`${label}: unknown component reference ${componentId}`)
  }
  for (const patternId of pattern.relatedPatterns ?? []) {
    if (!patternIds.has(patternId)) errors.push(`${label}: unknown related pattern ${patternId}`)
    if (patternId === pattern.id) errors.push(`${label}: must not reference itself`)
  }
}

for (const id of patternInventory.keys()) {
  if (!patternIds.has(id)) errors.push(`pattern ${id}: reviewed inventory entry has no canonical record`)
}

for (const [path, expected] of expectedFiles) {
  let actual
  try {
    actual = await readFile(path, 'utf8')
  } catch {
    errors.push(`${relative(projectRoot, path)} is missing; run npm run generate`)
    continue
  }
  if (actual !== expected) {
    errors.push(`${relative(projectRoot, path)} is stale; run npm run generate`)
  }
}

if (errors.length > 0) {
  for (const error of errors) process.stderr.write(`error: ${error}\n`)
  process.exitCode = 1
} else {
  const inventoryEntryCount = Object.values(reviewedInventoryCounts).reduce((total, count) => total + count, 0)
  const frameworkAdapterLabel = frameworkAdapterSource.adapters.length === 1 ? 'framework adapter' : 'framework adapters'
  process.stdout.write(`validated ${inventoryEntryCount} inventory entries, ${styles.length} style records, ${components.length} component records, ${patterns.length} pattern records, ${knownTokens.size} tokens, and ${frameworkAdapterSource.adapters.length} ${frameworkAdapterLabel}\n`)
}
