const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { runInNewContext } = require('node:vm')
const ts = require('typescript')

function load(name, globals = {}) {
  const exports = {}
  runInNewContext(ts.transpileModule(readFileSync(resolve(__dirname, '../src', name), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, URLSearchParams, Headers, AbortController, setTimeout, clearTimeout, crypto: require('node:crypto').webcrypto, ...globals })
  return exports
}

test('reason normalization counts Unicode code points and rejects empty/control text', () => {
  const { normalizeReason } = load('treehole-rules.ts')
  assert.equal(normalizeReason('  事实\r\n说明  '), '事实\n说明')
  assert.equal(normalizeReason('😀'.repeat(1000)), '😀'.repeat(1000))
  for (const value of ['', ' \r\n ', '😀'.repeat(1001), '原因\u0000']) assert.throws(() => normalizeReason(value))
})

test('review decisions enforce category ranges and omit violation fields for approval', () => {
  const { reviewDecision } = load('treehole-rules.ts')
  for (const [code, min, max] of [['minor_insult', 1, 3], ['direct_insult', 4, 9], ['harassment', 4, 9], ['privacy_leak', 10, 20], ['threat', 10, 20], ['substantiated_defamation', 4, 20]]) {
    assert.equal(reviewDecision('violation', code, String(min), '事实依据').points, min)
    assert.equal(reviewDecision('violation', code, String(max), '事实依据').points, max)
    for (const points of [String(min - 1), String(max + 1), '4.5', '1e1', '']) assert.throws(() => reviewDecision('violation', code, points, '事实依据'))
  }
  assert.deepEqual(Object.keys(reviewDecision('approve', 'threat', '20', ' 正常 ')), ['decision', 'reason'])
})

test('report decisions require matching current completed evidence and compatible conclusion', () => {
  const { reportDecision } = load('treehole-rules.ts')
  const target = { type: 'post', id: '9007199254740993', postId: '9007199254740993' }
  const report = { status: 'pending', target }
  const review = { id: '702', status: 'completed', isCurrent: true, target, decision: 'violation' }
  assert.equal(reportDecision(report, review, 'upheld', '复查确认').reviewId, '702')
  for (const changed of [{ target: { ...target, id: '2' } }, { isCurrent: false }, { status: 'processing' }, { decision: 'needs_human' }, { decision: 'approve' }]) {
    assert.throws(() => reportDecision(report, { ...review, ...changed }, 'upheld', '说明'))
  }
  assert.throws(() => reportDecision({ ...report, status: 'upheld' }, review, 'upheld', '说明'))
})

test('penalty/appeal actions reject terminal states and tier outside 1..5', () => {
  const { penaltyDecision, appealDecision, revokeDecision, canReview } = load('treehole-rules.ts')
  for (const tier of ['0', '6', '1.5', '1e0', '']) assert.throws(() => penaltyDecision('pending_confirmation', 'confirm', tier, '依据'))
  assert.equal(penaltyDecision('pending_confirmation', 'confirm', '5', '依据').tier, 5)
  assert.equal('tier' in penaltyDecision('pending_confirmation', 'decline', '5', '依据'), false)
  assert.throws(() => penaltyDecision('active', 'confirm', '3', '依据'))
  assert.throws(() => appealDecision('upheld', 'reject', '依据'))
  for (const status of ['pending_confirmation', 'declined', 'revoked']) assert.throws(() => revokeDecision(status, '依据'))
  assert.equal(revokeDecision('ended', '依据').reason, '依据')
  assert.equal(canReview({ isCurrent: true, status: 'processing' }), true)
  assert.equal(canReview({ isCurrent: false, status: 'queued' }), false)
  assert.equal(canReview({ isCurrent: true, status: 'completed' }), false)
})

test('uncertain retries keep key and exact payload, changed request or operation gets a new key', () => {
  const { createAttemptKeeper } = load('treehole-service.ts')
  let count = 0
  const attempt = createAttemptKeeper(() => `key-${++count}`)
  const first = attempt('/reviews/701/decision', { decision: 'approve', reason: '正常' })
  assert.equal(attempt('/reviews/701/decision', { decision: 'approve', reason: '正常' }).key, first.key)
  assert.equal(first.body, '{"decision":"approve","reason":"正常"}')
  assert.notEqual(attempt('/reviews/701/decision', { decision: 'approve', reason: '新依据' }).key, first.key)
  assert.notEqual(attempt('/penalties/701/revoke', { reason: '新依据' }).key, first.key)
})

test('service retains uncertain attempts when an inspector is reopened, independently per case', () => {
  const { createTreeholeService } = load('treehole-service.ts')
  const service = createTreeholeService({ token: () => 'token' })
  const first = service.attempt('/reviews/701/decision', { decision: 'approve', reason: '正常' })
  service.attempt('/reviews/702/decision', { decision: 'approve', reason: '其他案件' })
  assert.equal(service.attempt('/reviews/701/decision', { decision: 'approve', reason: '正常' }).key, first.key)
  assert.notEqual(service.attempt('/reviews/701/decision', { decision: 'approve', reason: '补充依据' }).key, first.key)
})

test('a stalled decision times out without discarding its idempotency key', async () => {
  let expire
  let timerCleared = false
  const { createTreeholeService } = load('treehole-service.ts', {
    setTimeout(callback) { expire = callback; return 1 },
    clearTimeout() { timerCleared = true },
  })
  const service = createTreeholeService({ token: () => 'token', fetch: async (_url, options) => {
    return new Promise((_resolve, reject) => options.signal?.addEventListener('abort', () => reject(new Error('aborted'))))
  } })
  const body = { decision: 'approve', reason: '人工确认' }
  const first = service.attempt('/reviews/701/decision', body)
  const pending = service.mutate('/reviews/701/decision', first)
  assert.equal(typeof expire, 'function', 'every request needs a bounded timeout')
  expire()
  await assert.rejects(pending, /超时/)
  assert.equal(timerCleared, true)
  assert.equal(service.attempt('/reviews/701/decision', body).key, first.key)
})

test('service preserves structured errors/server Date and only uses the dedicated configured token', async () => {
  let request
  const date = 'Sat, 24 Oct 2026 12:00:00 GMT'
  const { createTreeholeService } = load('treehole-service.ts')
  const service = createTreeholeService({ baseUrl: 'http://127.0.0.1:4010', token: () => 'treehole-admin-demo', fetch: async (url, options) => {
    request = { url, options }
    return { ok: false, status: 409, headers: new Headers({ Date: date }), json: async () => ({ error: { code: 'TREEHOLE_CASE_ALREADY_RESOLVED', message: '案件已结案', details: { field: 'state' }, requestId: 'request-1' } }) }
  } })
  await assert.rejects(service.get('reviews', '9007199254740993'), (error) => {
    assert.equal(error.status, 409)
    assert.equal(error.code, 'TREEHOLE_CASE_ALREADY_RESOLVED')
    assert.equal(error.requestId, 'request-1')
    assert.equal(error.details.field, 'state')
    assert.equal(error.serverDate, date)
    return true
  })
  assert.equal(request.url, 'http://127.0.0.1:4010/admin-api/treehole/reviews/9007199254740993')
  assert.equal(request.options.headers.get('Authorization'), 'Bearer treehole-admin-demo')
  assert.equal(service.serverDate, date)
})

test('service list omits empty filters and mutation sends the preserved key/body', async () => {
  const calls = []
  const { createTreeholeService } = load('treehole-service.ts')
  const service = createTreeholeService({ token: () => 'real-token', fetch: async (url, options) => {
    calls.push({ url, options })
    return { ok: true, status: 200, headers: new Headers(), json: async () => ({ items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }) }
  } })
  await service.list('reviews', 2, { status: '', reviewerType: 'human' })
  assert.equal(calls[0].url, '/admin-api/treehole/reviews?page=2&pageSize=10&reviewerType=human')
  await service.mutate('/reviews/701/decision', { key: 'same-key', body: '{"decision":"approve","reason":"正常"}' })
  assert.equal(calls[1].options.headers.get('Idempotency-Key'), 'same-key')
  assert.equal(calls[1].options.body, '{"decision":"approve","reason":"正常"}')
})

test('all thirteen admin operations use the dedicated treehole paths without changing IDs', async () => {
  const calls = []
  const { createTreeholeService } = load('treehole-service.ts')
  const service = createTreeholeService({ token: () => 'test-admin-token', fetch: async (url, options) => {
    calls.push({ url, method: options.method, cache: options.cache })
    return { ok: true, status: 200, headers: new Headers(), json: async () => ({}) }
  } })
  const id = '9223372036854775807'
  for (const kind of ['reviews', 'reports', 'penalties', 'appeals']) {
    await service.list(kind, 1)
    await service.get(kind, id)
    await service.mutate(`/${kind}/${id}/decision`, { key: 'uuid', body: '{}' })
  }
  await service.mutate(`/penalties/${id}/revoke`, { key: 'other-uuid', body: '{}' })
  assert.equal(calls.length, 13)
  assert.equal(new Set(calls.map((call) => call.url)).size, 13)
  assert.equal(calls.filter((call) => call.method === 'GET').length, 8)
  assert.equal(calls.filter((call) => call.method === 'POST').length, 5)
  assert.ok(calls.every((call) => call.url.startsWith('/admin-api/treehole/') && call.cache === 'no-store'))
  assert.ok(calls.filter((call) => !call.url.includes('?')).every((call) => call.url.includes(id)))
})
