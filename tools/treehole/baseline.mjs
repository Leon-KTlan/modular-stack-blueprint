import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { spec } from './contract.mjs'
const root = new URL('../../', import.meta.url)
const output = new URL('docs/api/treehole-baseline-v1.json', root)
const files = [
  'docs/api/treehole-openapi-v1.json', 'docs/api/treehole-api-contract-v1.md', 'docs/api/treehole-examples-v1.json',
  'docs/architecture/treehole-design-v1.md', 'docs/development/treehole-frontend-b-spec-v1.md',
  'packages/api-contracts/package.json', 'packages/api-contracts/treehole.d.ts',
]
function directoryFiles(path) {
  return readdirSync(new URL(path, root), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? directoryFiles(`${path}/${entry.name}`) : [`${path}/${entry.name}`])
}
export function makeBaseline() {
  return { contractVersion: spec.info.version, visualBaseline: 'B「午夜电台」', algorithm: 'sha256', files: Object.fromEntries([...files, ...directoryFiles('docs/prototypes/treehole')].sort().map(path => [path, createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex')])) }
}
export function compareBaseline(baseline) {
  const current = makeBaseline(), errors = []
  for (const key of ['contractVersion', 'visualBaseline', 'algorithm']) if (baseline[key] !== current[key]) errors.push(key)
  for (const path of new Set([...Object.keys(baseline.files ?? {}), ...Object.keys(current.files)])) if (baseline.files?.[path] !== current.files[path]) errors.push(path)
  return errors
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--check')) {
    const differences = compareBaseline(JSON.parse(readFileSync(output, 'utf8')))
    if (differences.length) throw new Error(`Treehole baseline drift:\n${differences.join('\n')}\nCoordinate contract/design changes before running pnpm treehole:baseline.`)
    console.log('Contract, DTO and B design match baseline 1.0.0')
  } else writeFileSync(output, JSON.stringify(makeBaseline(), null, 2) + '\n')
}
