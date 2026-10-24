import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { makeBaseline, compareBaseline } from './baseline.mjs'

test('baseline seals contract, DTO and selected B materials; drift/missing files fail', () => {
  const baseline = makeBaseline()
  assert.equal(baseline.contractVersion, '1.0.0')
  for (const path of ['docs/api/treehole-openapi-v1.json', 'packages/api-contracts/treehole.d.ts', 'docs/prototypes/treehole/b.html', 'docs/prototypes/treehole/previews/b-feed.png']) assert.match(baseline.files[path], /^[a-f0-9]{64}$/)
  assert.deepEqual(compareBaseline(baseline), [])
  const changed = structuredClone(baseline)
  changed.files['docs/prototypes/treehole/b.html'] = '0'.repeat(64)
  delete changed.files['packages/api-contracts/treehole.d.ts']
  assert.equal(compareBaseline(changed).length, 2)
  assert.deepEqual(JSON.parse(readFileSync(new URL('../../docs/api/treehole-baseline-v1.json', import.meta.url))), baseline)
})
