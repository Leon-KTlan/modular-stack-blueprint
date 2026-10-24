import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { after, before, beforeEach, test } from 'node:test'
import { createMockServer } from './mock-server.mjs'
import { operations, responseSchema, validate, examples } from './contract.mjs'

let server, base
const memoryTransport = process.env.TREEHOLE_MOCK_TEST_TRANSPORT === 'memory'
before(async () => {
  server = createMockServer({ now: () => Date.parse('2026-10-24T10:00:00Z') })
  if (memoryTransport) return
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  base = `http://127.0.0.1:${server.address().port}`
})
after(async () => { if (server?.listening) await new Promise(resolve => server.close(resolve)) })
async function call(path, { method = 'GET', body, token = 'treehole-miniapp-demo', key, headers = {} } = {}) {
  const r = await (memoryTransport ? memoryFetch : fetch)(base + path, { method, headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(key ? { 'Idempotency-Key': key } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const text = await r.text()
  return { status: r.status, body: text ? JSON.parse(text) : undefined, headers: r.headers }
}
// Use the same request listener without opening sockets when the execution sandbox forbids listen.
async function memoryFetch(url, options) {
  const request = Readable.from(options.body ? [Buffer.from(options.body)] : [])
  Object.assign(request, { url: url.replace(/^undefined/, ''), method: options.method, headers: Object.fromEntries(Object.entries(options.headers).map(([k, v]) => [k.toLowerCase(), v])) })
  const headers = new Headers()
  let status, body = ''
  const response = {
    setHeader: (key, value) => headers.set(key, value),
    writeHead(code, extra) { status = code; for (const [key, value] of Object.entries(extra)) headers.set(key, value) },
    end(value) { body = value ?? '' },
  }
  await server.listeners('request')[0](request, response)
  return { status, headers, text: async () => body }
}
const reset = scenario => call('/__mock/treehole/reset', { method: 'POST', body: { scenario } })
const advance = advanceSeconds => call('/__mock/treehole/clock', { method: 'POST', body: { advanceSeconds } })
const admin = (path, body, key = randomUUID()) => call(`/admin-api/treehole/${path}`, { method: 'POST', body, key, token: 'treehole-admin-demo' })
beforeEach(() => reset('normal'))

test('post submission, human approval and idempotent retry form one shared state', async () => {
  const key = randomUUID()
  const created = await call('/api/miniapp/treehole/posts', { method: 'POST', key, body: { content: '  一个新开始\r\n继续加油  ', ttlHours: 1 } })
  assert.equal(created.status, 201)
  assert.equal(created.body.status, 'pending_review')
  assert.equal(created.body.publishedAt, null)
  assert.equal('content' in created.body, false)
  assert.equal((await call(`/api/miniapp/treehole/posts/${created.body.id}`)).status, 404)
  const reviews = await call('/admin-api/treehole/reviews', { token: 'treehole-admin-demo' })
  const review = reviews.body.items.find(r => r.target.id === created.body.id)
  await advance(3600)
  const decisionKey = randomUUID()
  const approved = await admin(`reviews/${review.id}/decision`, { decision: 'approve', reason: '人工确认正常' }, decisionKey)
  assert.equal(approved.status, 200)
  const published = await call(`/api/miniapp/treehole/posts/${created.body.id}`)
  assert.equal(published.body.content, '一个新开始\n继续加油')
  assert.equal(published.body.publishedAt, '2026-10-24T11:00:00.000Z')
  assert.equal(published.body.expiresAt, '2026-10-24T12:00:00.000Z')
  const replay = await call('/api/miniapp/treehole/posts', { method: 'POST', key, body: { content: '一个新开始\n继续加油', ttlHours: 1 } })
  assert.equal(replay.body.id, created.body.id)
  assert.equal(replay.body.status, 'published')
  assert.deepEqual((await admin(`reviews/${review.id}/decision`, { decision: 'approve', reason: '人工确认正常' }, decisionKey)).body, approved.body)
  assert.equal((await admin(`reviews/${review.id}/decision`, { decision: 'approve', reason: '再次处理' })).body.error.code, 'TREEHOLE_CASE_ALREADY_RESOLVED')
  await advance(3600)
  assert.equal((await call(`/api/miniapp/me/treehole/posts/${created.body.id}`)).status, 404)
  const gone = await call('/api/miniapp/treehole/posts', { method: 'POST', key, body: { content: '一个新开始\n继续加油', ttlHours: 1 } })
  assert.equal(gone.body.status, 'unavailable')
  assert.equal('content' in gone.body, false)
})

test('strict inputs, normalization, quota and same-key conflict match the contract', async () => {
  for (const [body, key] of [[{ content: '正文' }, undefined], [{ content: '正文', userId: '123' }, randomUUID()], [{ content: '\u0001' }, randomUUID()], [{ content: '😀'.repeat(1001) }, randomUUID()]]) {
    assert.equal((await call('/api/miniapp/treehole/posts', { method: 'POST', body, key })).status, 400)
  }
  assert.equal((await call('/api/miniapp/treehole/posts?page=1e0')).status, 400)
  assert.equal((await call('/api/miniapp/treehole/posts?x=1')).status, 400)
  assert.equal((await call('/api/miniapp/treehole/posts/9223372036854775808')).status, 400)
  const key = randomUUID()
  const first = await call('/api/miniapp/treehole/posts', { method: 'POST', body: { content: '正文' }, key })
  assert.equal(first.status, 201)
  assert.equal((await call('/api/miniapp/treehole/posts', { method: 'POST', body: { content: '正文', ttlHours: 24 }, key })).body.id, first.body.id)
  assert.equal((await call('/api/miniapp/treehole/posts', { method: 'POST', body: { content: '改了正文' }, key })).body.error.code, 'IDEMPOTENCY_CONFLICT')
  assert.equal((await call('/api/miniapp/treehole/posts', { method: 'POST', body: { content: '新正文' }, key: randomUUID() })).body.error.code, 'TREEHOLE_SUBMIT_TOO_FAST')
  await reset('quota')
  const quota = await call('/api/miniapp/treehole/posts', { method: 'POST', body: { content: '正文' }, key: randomUUID() })
  assert.equal(quota.status, 429)
  assert.equal(quota.body.error.details.retryAt, '2026-10-24T16:00:00.000Z')
})

test('likes and reports are idempotent; report decisions require matching completed evidence', async () => {
  const like = () => call('/api/miniapp/treehole/posts/123/likes/me', { method: 'PUT' })
  assert.deepEqual((await like()).body, (await like()).body)
  const unlike = () => call('/api/miniapp/treehole/posts/123/likes/me', { method: 'DELETE' })
  assert.deepEqual((await unlike()).body, (await unlike()).body)
  const report = () => call('/api/miniapp/treehole/posts/123/reports', { method: 'POST', body: { reason: 'insult' } })
  const receipt = await report()
  assert.equal(receipt.status, 201)
  assert.equal((await report()).status, 200)
  const detail = await call(`/admin-api/treehole/reports/${receipt.body.id}`, { token: 'treehole-admin-demo' })
  const reviewId = detail.body.reviewId
  assert.equal((await admin(`reports/${receipt.body.id}/decision`, { decision: 'dismissed', reviewId, reason: '正常表达' })).body.error.code, 'TREEHOLE_CASE_NOT_ACTIONABLE')
  await admin(`reviews/${reviewId}/decision`, { decision: 'approve', reason: '正常表达' })
  assert.equal((await admin(`reports/${receipt.body.id}/decision`, { decision: 'dismissed', reviewId, reason: '正常表达' })).body.status, 'dismissed')
})

test('comment deletion retains a bodyless placeholder only while a visible descendant exists', async () => {
  const comments = await call('/api/miniapp/treehole/posts/123/comments')
  const placeholder = comments.body.items.find(c => c.status === 'deleted')
  assert.equal(placeholder.content, null)
  assert.equal(placeholder.author, null)
  assert.equal((await call('/api/miniapp/me/treehole/comments/127', { method: 'DELETE' })).status, 204)
  assert.equal((await call('/api/miniapp/treehole/posts/123/comments')).body.items.some(c => c.id === placeholder.id), false)
  const key = randomUUID()
  const created = await call('/api/miniapp/treehole/posts/123/comments', { method: 'POST', key, body: { content: '谢谢分享' } })
  assert.equal(created.status, 201)
  assert.equal(created.body.publishedAt, null)
  assert.notEqual(created.body.expiresAt, null)
  await advance(86400)
  assert.equal((await call('/api/miniapp/treehole/posts/123/comments', { method: 'POST', key, body: { content: '谢谢分享' } })).body.status, 'unavailable')
})

test('restriction blocks the whole treehole while personal appeals work; uphold refreshes both clients', async () => {
  const confirmed = await admin('penalties/901/decision', { decision: 'confirm', tier: 3, reason: '人工确认' })
  assert.equal(confirmed.status, 200)
  assert.equal((await call('/api/miniapp/treehole/posts')).status, 403)
  const penalties = await call('/api/miniapp/me/treehole/penalties')
  assert.equal('scoreSnapshot' in penalties.body.items[0], false)
  assert.equal((await call('/api/miniapp/me/treehole/posts')).body.items.length, 0)
  const key = randomUUID()
  const appeal = await call('/api/miniapp/me/treehole/penalties/901/appeals', { method: 'POST', key, body: { reason: '请复核上下文' } })
  assert.equal(appeal.status, 201)
  const decided = await admin(`appeals/${appeal.body.id}/decision`, { decision: 'uphold', reason: '复核确属误判' })
  assert.equal(decided.body.recomputed, true)
  assert.equal((await call('/api/miniapp/me/treehole/access')).body.canEnter, true)
  assert.equal((await call('/api/miniapp/treehole/posts')).status, 200)
  assert.equal((await call('/api/miniapp/me/treehole/penalties/901/appeals', { method: 'POST', key, body: { reason: '请复核上下文' } })).body.status, 'upheld')
})

test('authentication, fixture overrides and clock headers remain separate from production auth', async () => {
  assert.equal((await call('/admin-api/treehole/reviews')).status, 401)
  assert.equal((await call('/admin-api/treehole/reviews', { token: 'treehole-non-admin-demo' })).status, 403)
  assert.equal((await call('/api/miniapp/treehole/posts', { token: 'treehole-admin-demo' })).status, 401)
  await call('/__mock/treehole/example', { method: 'POST', body: { operationId: 'createTreeholePost', name: 'pending', httpStatus: 201 } })
  assert.equal((await call('/api/miniapp/treehole/posts', { method: 'POST', key: randomUUID(), body: { content: '用于演示' } })).body.status, 'pending_review')
  const r = await call('/api/miniapp/treehole/posts')
  assert.equal(r.headers.get('cache-control'), 'private, no-store')
  assert.equal(r.headers.get('date'), 'Sat, 24 Oct 2026 10:00:00 GMT')
  assert.equal(r.headers.get('access-control-expose-headers').includes('Date'), true)
})

test('all 33 operations dispatch declared fixtures and validate responses against OpenAPI', async () => {
  for (const op of operations) {
    await reset('normal')
    // Select an existing declared sample to exercise HTTP dispatch/schema/headers for every operation.
    const status = Number(Object.keys(op.responses).find(s => Number(s) < 300))
    const exampleName = examples.responses.find(e => e.operationId === op.operationId && e.httpStatus === status)?.name ?? 'noContent'
    assert.equal((await call('/__mock/treehole/example', { method: 'POST', body: { operationId: op.operationId, name: exampleName, httpStatus: status } })).status, 200)
    const ids = { postId: '123', commentId: '124', reviewId: '701', reportId: '801', penaltyId: '901', appealId: '1001' }
    const path = op.path.replace(/\{(\w+)\}/g, (_, name) => ids[name])
    const requestMedia = op.requestBody?.content['application/json']
    const body = requestMedia?.example
    const result = await call(path, { method: op.method, body, token: op.path.startsWith('/admin-api') ? 'treehole-admin-demo' : 'treehole-miniapp-demo', key: randomUUID() })
    assert.equal(result.status, status, op.operationId)
    assert.deepEqual(validate(responseSchema(op, status), result.body), [], op.operationId)
  }
})

test('ownership, cross-post replies, deletion and unavailable replay preserve privacy', async () => {
  assert.equal((await call('/api/miniapp/me/treehole/posts/123')).status, 404)
  assert.equal((await call('/api/miniapp/me/treehole/posts/123', { method: 'DELETE' })).status, 404)
  assert.equal((await call('/api/miniapp/me/treehole/comments/124', { method: 'DELETE' })).status, 404)
  assert.equal((await call('/api/miniapp/treehole/posts/123/comments', { method: 'POST', key: randomUUID(), body: { content: '回复', replyToCommentId: '126' } })).status, 404)
  const created = await call('/api/miniapp/treehole/posts', { method: 'POST', key: randomUUID(), body: { content: '另一个帖子' } })
  const reviews = await call('/admin-api/treehole/reviews', { token: 'treehole-admin-demo' })
  const r = reviews.body.items.find(r => r.target.id === created.body.id)
  await admin(`reviews/${r.id}/decision`, { decision: 'approve', reason: '通过' })
  assert.equal((await call(`/api/miniapp/treehole/posts/${created.body.id}/comments`, { method: 'POST', key: randomUUID(), body: { content: '跨帖', replyToCommentId: '124' } })).status, 404)
  const key = randomUUID()
  const comment = await call('/api/miniapp/treehole/posts/123/comments', { method: 'POST', key, body: { content: '自己的评论' } })
  assert.equal((await call(`/api/miniapp/me/treehole/comments/${comment.body.id}`)).body.content, '自己的评论')
  for (let i = 0; i < 2; i++) assert.equal((await call(`/api/miniapp/me/treehole/comments/${comment.body.id}`, { method: 'DELETE' })).status, 204)
  assert.equal((await call(`/api/miniapp/me/treehole/comments/${comment.body.id}`)).status, 404)
  assert.equal((await call('/api/miniapp/treehole/posts/123/comments', { method: 'POST', key, body: { content: '自己的评论' } })).body.status, 'unavailable')
})

test('real admin details, violation decisions and penalty decline use valid projections', async () => {
  const token = 'treehole-admin-demo'
  for (const route of ['reviews/701', 'reports/801', 'penalties/901', 'appeals']) assert.equal((await call(`/admin-api/treehole/${route}`, { token })).status, 200, route)
  const decided = await admin('reviews/701/decision', { decision: 'violation', violationCode: 'minor_insult', points: 2, reason: '模拟确认违规' })
  assert.match(decided.body.violationId, /^[1-9][0-9]*$/)
  assert.equal((await call('/admin-api/treehole/reviews?status=completed&reviewerType=human', { token })).body.items.length, 1)
  assert.equal((await admin('reports/801/decision', { decision: 'upheld', reviewId: '701', reason: '依据复核结果' })).body.status, 'upheld')
  assert.equal((await call('/admin-api/treehole/reports/801', { token })).body.review.points, 2)
  assert.equal((await call('/api/miniapp/me/treehole/posts/125')).body.content, null)
  assert.equal((await admin('penalties/901/decision', { decision: 'decline', reason: '不执行该候选处罚' })).body.status, 'declined')
  assert.equal((await call('/api/miniapp/me/treehole/access')).body.canEnter, true)
  assert.equal((await call('/api/miniapp/me/treehole/penalties/901')).status, 404)
})

test('appeal deadlines, pending uniqueness, reject/revoke and original decision replay', async () => {
  const key = randomUUID(), token = 'treehole-admin-demo'
  const confirmed = await admin('penalties/901/decision', { decision: 'confirm', tier: 5, reason: '模拟永久限制' }, key)
  assert.equal(confirmed.body.endsAt, null)
  assert.equal((await call('/api/miniapp/me/treehole/penalties/901')).body.type, 'permanent')
  const create = key => call('/api/miniapp/me/treehole/penalties/901/appeals', { method: 'POST', key, body: { reason: '请复核' } })
  const appealKey = randomUUID(), appeal = await create(appealKey)
  assert.equal((await create(randomUUID())).body.error.code, 'TREEHOLE_APPEAL_PENDING')
  await advance(72 * 3600)
  const detail = await call(`/admin-api/treehole/appeals/${appeal.body.id}`, { token })
  assert.equal(detail.body.overdue, true)
  assert.equal(detail.body.penalty.id, '901')
  assert.equal((await call('/admin-api/treehole/appeals?status=pending', { token })).body.items.length, 1)
  await admin(`appeals/${appeal.body.id}/decision`, { decision: 'reject', reason: '维持原决定' })
  assert.equal((await create(appealKey)).body.status, 'rejected')
  await advance(28 * 86400)
  assert.equal((await create(randomUUID())).body.error.code, 'TREEHOLE_APPEAL_WINDOW_CLOSED')
  const revokeKey = randomUUID()
  assert.equal((await admin('penalties/901/revoke', { reason: '后续复核撤销' }, revokeKey)).body.recomputed, true)
  assert.equal((await call('/api/miniapp/me/treehole/access')).body.canEnter, true)
  assert.deepEqual((await admin('penalties/901/decision', { decision: 'confirm', tier: 5, reason: '模拟永久限制' }, key)).body, confirmed.body)
  assert.equal((await admin('penalties/901/revoke', { reason: '后续复核撤销' }, revokeKey)).body.status, 'revoked')
})

test('normal restriction expiry keeps old content hidden; pending timeout cannot publish later', async () => {
  await reset('restricted')
  await advance(86400)
  assert.equal((await call('/api/miniapp/me/treehole/access')).body.canEnter, true)
  assert.equal((await call('/api/miniapp/me/treehole/posts')).body.items.length, 0)
  assert.equal((await call('/api/miniapp/me/treehole/penalties')).body.items[0].status, 'ended')
  await reset('pending')
  await advance(86400)
  assert.equal((await call('/api/miniapp/me/treehole/posts/125')).body.status, 'closed')
  assert.equal((await admin('reviews/701/decision', { decision: 'approve', reason: '过期后尝试通过' })).status, 409)
})


test('restriction precedes parameter/body validation; admin keys are scoped to individual cases', async () => {
  await reset('restricted')
  assert.equal((await call('/api/miniapp/treehole/posts?page=bad')).status, 403)
  assert.equal((await call('/api/miniapp/treehole/posts', { method: 'POST', body: { content: '正文' } })).status, 403)
  await reset('normal')
  const key = randomUUID()
  const body = { decision: 'approve', reason: '正常' }
  assert.equal((await admin('reviews/701/decision', body, key)).status, 200)
  const report = await call('/api/miniapp/treehole/posts/123/reports', { method: 'POST', body: { reason: 'insult' } })
  const detail = await call(`/admin-api/treehole/reports/${report.body.id}`, { token: 'treehole-admin-demo' })
  assert.equal((await admin(`reviews/${detail.body.reviewId}/decision`, body, key)).status, 200)
  await admin('penalties/901/decision', { decision: 'confirm', tier: 1, reason: '确认' })
  await admin('penalties/901/revoke', { reason: '撤销' })
  assert.equal((await admin('penalties/901/revoke', { reason: '再次撤销' })).body.error.code, 'TREEHOLE_CASE_ALREADY_RESOLVED')
})


test('extra idempotency headers cannot replace like/report resource idempotency', async () => {
  const key = randomUUID()
  const like = () => call('/api/miniapp/treehole/posts/123/likes/me', { method: 'PUT', key })
  await like()
  await call('/api/miniapp/treehole/posts/123/likes/me', { method: 'DELETE' })
  const again = await like()
  assert.equal(again.body.liked, true)
  assert.equal((await call('/api/miniapp/treehole/posts/123')).body.likedByMe, true)
  const report = () => call('/api/miniapp/treehole/posts/123/reports', { method: 'POST', key, body: { reason: 'insult' } })
  assert.equal((await report()).status, 201)
  assert.equal((await report()).status, 200)
})

test('demo includes paginated posts, responses and personal content within the contract', async () => {
  await reset('demo')
  const first = await call('/api/miniapp/treehole/posts?page=1')
  const second = await call('/api/miniapp/treehole/posts?page=2')
  assert.equal(first.status, 200)
  assert.equal(first.body.items.length, 10)
  assert.equal(first.body.pagination.total, 13)
  assert.equal(second.body.items.length, 3)
  const ids = [...first.body.items, ...second.body.items].map(post => post.id)
  assert.equal(new Set(ids).size, 13)
  const comments = await call('/api/miniapp/treehole/posts/203/comments')
  assert.equal(comments.status, 200)
  assert.ok(comments.body.items.length > 0)
  const mine = await call('/api/miniapp/me/treehole/posts')
  assert.ok(mine.body.items.some(post => post.status === 'published'))
  assert.ok(mine.body.items.some(post => post.status === 'pending_review'))
})
