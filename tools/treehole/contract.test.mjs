import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { spec, examples, operations, validate, responseSchema } from './contract.mjs'
import { generateTypes } from './generate.mjs'

test('all frozen request and response examples satisfy their operation schemas', () => {
  assert.equal(operations.length, 33)
  for (const example of examples.responses) {
    const op = operations.find(o => o.operationId === example.operationId)
    assert.deepEqual(validate(responseSchema(op, example.httpStatus), example.response), [], example.name)
  }
  for (const op of operations) {
    const media = op.requestBody?.content['application/json']
    if (media?.example) assert.deepEqual(validate(media.schema, media.example), [], op.operationId)
    for (const example of Object.values(media?.examples ?? {})) {
      assert.deepEqual(validate(media.schema, example.value), [], op.operationId)
    }
  }
})

test('runtime validation rejects bad inputs, conditional mismatches and out-of-range BIGINT', () => {
  const check = (name, value) => validate({ $ref: `#/components/schemas/${name}` }, value)
  assert.deepEqual(check('Id', '9223372036854775807'), [])
  assert.notDeepEqual(check('Id', '9223372036854775808'), [])
  assert.notDeepEqual(check('CreatePost', { content: '正常正文', userId: '123' }), [])
  assert.notDeepEqual(check('CreatePost', { content: '正文', ttlHours: 2 }), [])
  assert.notDeepEqual(check('CreateReport', { reason: 'other' }), [])
  assert.notDeepEqual(check('PenaltyDecision', { decision: 'decline', reason: '依据不足', tier: 3 }), [])
  assert.notDeepEqual(check('ReviewDecision', { decision: 'violation', reason: '说明', violationCode: 'minor_insult', points: 20 }), [])
  assert.deepEqual(check('CreatePost', { content: '😀'.repeat(1000) }), [])
  assert.notDeepEqual(check('CreatePost', { content: '😀'.repeat(1001) }), [])
  assert.notDeepEqual(check('Error', { error: { code: 'UNAUTHORIZED', message: '请登录', requestId: 'test', details: { retryAt: '2026-10-24T10:00:00Z' } } }), [])
})

test('generated declarations match the committed artifact; unsupported schema changes fail loudly', () => {
  assert.equal(generateTypes(spec), readFileSync(new URL('../../packages/api-contracts/treehole.d.ts', import.meta.url), 'utf8'))
  const changed = structuredClone(spec)
  changed.components.schemas.NewShape = { type: 'object', patternProperties: { '.*': { type: 'string' } } }
  assert.throws(() => generateTypes(changed), /patternProperties/)
})


test('unsupported dictionary schemas cannot silently bypass validator/generator', () => {
  const changed = structuredClone(spec)
  changed.components.schemas.Dictionary = { type: 'object', additionalProperties: { type: 'string' } }
  assert.throws(() => generateTypes(changed), /additionalProperties/)
})
