import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { projectRoot } from './lib/catalog.mjs'

const suite = JSON.parse(await readFile(resolve(projectRoot, 'evals', 'tasks.json'), 'utf8'))
const catalog = JSON.parse(await readFile(resolve(projectRoot, 'catalog.json'), 'utf8'))
const sourceManifest = JSON.parse(await readFile(resolve(projectRoot, 'sources', 'govuk.json'), 'utf8'))
const errors = []
const allowedDimensions = new Set([
  'record-selection',
  'markup-fidelity',
  'progressive-enhancement',
  'accessibility',
  'non-invention'
])
const records = {
  style: new Set(catalog.styles.map(({ id }) => id)),
  component: new Set(catalog.components.map(({ id }) => id)),
  pattern: new Set(catalog.patterns.map(({ id }) => id))
}

if (suite.schemaVersion !== 1) errors.push('unsupported eval schemaVersion')
if (suite.reviewedAt !== sourceManifest.reviewedAt) errors.push('eval reviewedAt does not match the source manifest')
if (!Array.isArray(suite.cases) || suite.cases.length === 0) errors.push('eval suite must contain cases')

const caseIds = new Set()
const coveredDimensions = new Set()
for (const item of suite.cases ?? []) {
  const label = `eval ${item.id ?? '<missing id>'}`
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id ?? '')) errors.push(`${label}: invalid id`)
  if (caseIds.has(item.id)) errors.push(`${label}: duplicate id`)
  caseIds.add(item.id)
  if (typeof item.prompt !== 'string' || item.prompt.length === 0) errors.push(`${label}: prompt is required`)
  if (!Array.isArray(item.dimensions) || item.dimensions.length === 0) errors.push(`${label}: dimensions are required`)
  for (const dimension of item.dimensions ?? []) {
    if (!allowedDimensions.has(dimension)) errors.push(`${label}: unsupported dimension ${dimension}`)
    if (coveredDimensions.has(`${item.id}:${dimension}`)) errors.push(`${label}: duplicate dimension ${dimension}`)
    coveredDimensions.add(dimension)
    coveredDimensions.add(`${item.id}:${dimension}`)
  }
  if (!Array.isArray(item.expectedRecords) || item.expectedRecords.length === 0) {
    errors.push(`${label}: expectedRecords are required`)
  }
  for (const record of item.expectedRecords ?? []) {
    if (!records[record.kind]?.has(record.id)) {
      errors.push(`${label}: unknown ${record.kind ?? '<missing kind>'} record ${record.id ?? '<missing id>'}`)
    }
  }
  for (const field of ['must', 'mustNot']) {
    if (!Array.isArray(item.rubric?.[field]) || item.rubric[field].length === 0) {
      errors.push(`${label}: rubric.${field} is required`)
    }
  }
}

for (const dimension of allowedDimensions) {
  if (!coveredDimensions.has(dimension)) errors.push(`evaluation dimension has no case: ${dimension}`)
}

if (errors.length > 0) {
  for (const error of errors) process.stderr.write(`error: ${error}\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`validated ${suite.cases.length} agent evaluation cases across ${allowedDimensions.size} dimensions\n`)
}
