const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync } = require('node:fs')
const { resolve, dirname } = require('node:path')
const { runInNewContext, Script } = require('node:vm')
const ts = require('typescript')

test('WXML conditions contain valid expressions before entity decoding', () => {
  const source = readFileSync(resolve(__dirname, '..', 'pages/treehole/index.wxml'), 'utf8')
  const conditions = [...source.matchAll(/wx:(?:if|elif)="\{\{([\s\S]*?)\}\}"/g)]
  assert.ok(conditions.length > 0)
  for (const [, expression] of conditions) {
    assert.doesNotThrow(() => new Script(`(${expression})`), expression)
  }
})

function load(file, wx = {}, extra = {}) {
  file = resolve(__dirname, '..', file)
  const exports = {}
  runInNewContext(ts.transpileModule(readFileSync(resolve(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, wx, console, ...extra, require(name) {
    if (extra.modules?.[name]) return extra.modules[name]
    return load(resolve(dirname(file), `${name}.ts`), wx, extra)
  } })
  return exports
}

test('Unicode and newline normalization follow the contract', () => {
  const rules = load('utils/treehole.ts')
  assert.equal(rules.normalizeText(' 你好\r\n🌙\r世界 '), '你好\n🌙\n世界')
  assert.equal(rules.textLength('🌙'.repeat(500)), 500)
  assert.equal(rules.validateText('🌙'.repeat(501), 500), '请控制在 500 字以内')
  assert.ok(rules.validateText('\u0000', 500))
  assert.equal(rules.validateText('  \n ', 500), '请先写下内容')
})

test('same failed request retains its UUID; changed fields and successful completion replace it', () => {
  const { SubmissionKey } = load('utils/treehole.ts')
  const key = new SubmissionKey()
  const first = key.forRequest('post', { content: '你好', ttlHours: 24 })
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.equal(key.forRequest('post', { content: '你好', ttlHours: 24 }), first)
  const edited = key.forRequest('post', { content: '你好', ttlHours: 6 })
  assert.notEqual(edited, first)
  key.clear()
  assert.notEqual(key.forRequest('post', { content: '你好', ttlHours: 6 }), edited)
})

test('expiry is a refresh hint, never an access grant or fabricated expired DTO', () => {
  const { remainingTime, needsRefresh } = load('utils/treehole.ts')
  assert.equal(remainingTime('2026-10-24T10:00:00Z', Date.parse('2026-10-24T09:00:00Z')), '还剩 1 小时')
  assert.equal(remainingTime('2026-10-24T10:00:00Z', Date.parse('2026-10-24T10:01:00Z')), '正在确认状态')
  assert.equal(needsRefresh('2026-10-24T10:00:00Z', Date.parse('2026-10-24T10:00:00Z')), true)
})

test('request preserves headers, structured errors, response Date, and empty 204', async () => {
  const sent = []
  const wx = { request(options) { sent.push(options) }, getStorageSync() { return 'real-token' } }
  const api = load('services/api.ts', wx)
  let date
  const failure = api.request('/x', { baseURL: 'http://127.0.0.1:4010', headers: { 'Idempotency-Key': 'key' }, onResponse(meta) { date = meta.serverDate } })
  assert.equal(sent[0].header['Idempotency-Key'], 'key')
  assert.equal(sent[0].header.Authorization, 'Bearer real-token')
  sent[0].success({ statusCode: 429, header: { Date: 'Sat, 24 Oct 2026 10:00:00 GMT' }, data: { error: { code: 'TREEHOLE_SUBMIT_TOO_FAST', message: '慢一点', details: { retryAt: '2026-10-24T10:00:10Z' }, requestId: 'req-1' } } })
  await assert.rejects(failure, e => e.code === 'TREEHOLE_SUBMIT_TOO_FAST' && e.requestId === 'req-1' && e.details.retryAt && e.serverDate === date)
  const deletion = api.request('/x', { baseURL: 'http://127.0.0.1:4010', method: 'DELETE' })
  assert.equal(sent[1].data, undefined)
  sent[1].success({ statusCode: 204, header: {}, data: '' })
  assert.equal(await deletion, undefined)
})


const emptyPage = () => ({ items: [], pagination: { page: 1, pageSize: 10, totalPages: 0 } })
function pageWith(api, now = Date.now()) {
  let page
  load('pages/treehole/index.ts', {}, {
    Page(value) { page = value },
    setInterval, clearInterval,
    modules: { '../../services/treehole': { treehole: api, treeholeNow: () => now, isTreeholeMock: () => false } },
  })
  page.setData = values => Object.assign(page.data, values)
  return page
}
const restricted = { canEnter: false, restriction: { reason: '限制', endsAt: null, appealDeadlineAt: null } }

test('restriction gates public feed while personal management remains accessible', async () => {
  let publicCalls = 0
  let personalCalls = 0
  const page = pageWith({ access: async () => restricted, posts: async () => { publicCalls++; return emptyPage() }, myPosts: async () => { personalCalls++; return emptyPage() } })
  await page.refresh()
  assert.equal(page.data.view, 'restricted')
  assert.equal(publicCalls, 0)
  page.setData({ view: 'mine' })
  await page.refresh()
  assert.equal(personalCalls, 1)
  assert.equal(page.data.view, 'mine')
})

test('late access and restricted-error probes cannot replace personal navigation', async () => {
  let finishAccess
  const page = pageWith({ access: () => new Promise(resolve => { finishAccess = resolve }), myPosts: async () => emptyPage() })
  const loading = page.refresh()
  page.setData({ view: 'mine' })
  await page.refresh()
  finishAccess(restricted)
  await loading
  assert.equal(page.data.view, 'mine')
  page.setData({ view: 'feed' })
  const error = page.handleError({ code: 'TREEHOLE_RESTRICTED', message: '限制' })
  page.setData({ view: 'mine' })
  await page.refresh()
  finishAccess(restricted)
  await error
  assert.equal(page.data.view, 'mine')
})

test('expiration clears visible content even during requests and ignores inactive lists', () => {
  const page = pageWith({}, Date.parse('2026-10-24T10:00:00Z'))
  const expired = { id: '9007199254740993', expiresAt: '2026-10-24T09:00:00Z', content: 'expired' }
  let refreshes = 0
  page.refresh = () => { refreshes++ }
  page.setData({ view: 'detail', post: expired, comments: [{ content: 'reply' }], busy: true })
  page.checkTimeBoundary()
  assert.equal(page.data.post, null)
  assert.equal(page.data.comments.length, 0)
  assert.equal(refreshes, 0)
  page.setData({ busy: false })
  page.checkTimeBoundary()
  assert.equal(refreshes, 1)
  page.setData({ view: 'mine', posts: [expired] })
  page.checkTimeBoundary()
  assert.equal(refreshes, 1)
})

test('failed composition retries retain key and pending receipt never fabricates a public post', async () => {
  const requests = []
  let fail = true
  const page = pageWith({ createPost: async (body, key) => {
    requests.push({ body, key })
    if (fail) throw new Error('offline')
    return { submissionId: '9007199254740993', status: 'pending_review' }
  } })
  page.setData({ sheet: 'compose', draft: '你好', ttl: 24 })
  await page.submitComposition()
  await page.submitComposition()
  assert.equal(requests[0].key, requests[1].key)
  page.setData({ ttl: 6 })
  fail = false
  await page.submitComposition()
  assert.notEqual(requests[1].key, requests[2].key)
  assert.equal(page.data.receipt.status, 'pending_review')
  assert.equal(page.data.posts.length, 0)
  assert.equal(page.data.sheet, 'receipt')
  page.setData({ sheet: 'compose', draft: '你好' })
  await page.submitComposition()
  assert.notEqual(requests[2].key, requests[3].key)
})

test('mock token is isolated to treehole develop builds without modifying storage', async () => {
  for (const envVersion of ['develop', 'release']) {
    const requests = []
    const wx = { getAccountInfoSync: () => ({ miniProgram: { envVersion } }), getStorageSync: () => 'real-token', request(options) { requests.push(options); options.success({ statusCode: 200, header: {}, data: {} }) } }
    const { treehole } = load('services/treehole.ts', wx, { modules: { './treehole-config': { TREEHOLE_MOCK: { enabled: true, baseURL: 'http://127.0.0.1:4010', token: 'fake-token' } } } })
    if (envVersion === 'develop') await treehole.access()
    else await assert.rejects(treehole.access(), e => e.message === '服务尚未配置，请联系管理员')
    const api = load('services/api.ts', wx)
    await api.request('/regular', { baseURL: 'https://real.test' })
    assert.equal(requests.at(-1).header.Authorization, 'Bearer real-token')
    assert.equal(requests[0].header.Authorization, envVersion === 'develop' ? 'Bearer fake-token' : 'Bearer real-token')
    assert.equal(requests[0].url.startsWith('http://127.0.0.1:4010'), envVersion === 'develop')
  }
})

test('elapsed restriction requests confirmation once and never grants access locally', () => {
  const page = pageWith({}, Date.parse('2026-10-24T10:00:00Z'))
  let confirmations = 0
  page.refresh = () => { confirmations++ }
  page.setData({ view: 'restricted', restriction: { endsAt: '2026-10-24T09:00:00Z' } })
  page.checkTimeBoundary()
  page.checkTimeBoundary()
  assert.equal(confirmations, 1)
  assert.equal(page.data.view, 'restricted')
})

test('backgrounding invalidates an outstanding access response', async () => {
  let resolveAccess
  const page = pageWith({ access: () => new Promise(resolve => { resolveAccess = resolve }) })
  const request = page.refresh()
  page.onHide()
  resolveAccess(restricted)
  await request
  assert.equal(page.data.view, 'feed')
  assert.equal(page.data.restriction, null)
})

test('opening a stale penalty card cannot invalidate an active list refresh', async () => {
  let finishPenalties
  let detailCalls = 0
  const page = pageWith({
    penalties: () => new Promise(resolve => { finishPenalties = resolve }),
    appeals: async () => emptyPage(),
    penalty: async () => { detailCalls++; return { id: '1' } },
  })
  page.setData({ view: 'penalties' })
  const loading = page.refresh()
  await page.openPenalty({ currentTarget: { dataset: { id: '1' } } })
  finishPenalties(emptyPage())
  await loading
  assert.equal(detailCalls, 0)
  assert.equal(page.data.loading, false)
  assert.equal(page.data.view, 'penalties')
})

test('late failures from every mutation and penalty read preserve the newly selected personal view', async () => {
  for (const [method, apiMethod] of [
    ['toggleLike', 'like'], ['submitComposition', 'createPost'], ['submitReport', 'reportPost'],
    ['deleteContent', 'deletePost'], ['submitAppeal', 'appeal'], ['openPenalty', 'penalty'],
  ]) {
    let rejectRequest
    const page = pageWith({ [apiMethod]: () => new Promise((resolve, reject) => { rejectRequest = reject }), myPosts: async () => emptyPage() })
    page.setData({ posts: [{ id: '1' }], draft: 'hello', reportId: '1', deleteId: '1', penalty: { id: '1' }, appealReason: 'reason' })
    const operation = page[method]({ currentTarget: { dataset: { id: '1' } } })
    page.setData({ view: 'mine', sheet: '' })
    await page.refresh()
    rejectRequest({ code: 'TREEHOLE_POST_NOT_FOUND', message: 'not found' })
    await operation
    assert.equal(page.data.view, 'mine', method)
    assert.equal(page.data.error, '', method)
    assert.equal(page.data.busy, false, method)
  }
})

test('successful old submission cannot open a receipt over another view', async () => {
  let finishSubmission
  const page = pageWith({ createPost: () => new Promise(resolve => { finishSubmission = resolve }), myPosts: async () => emptyPage() })
  page.setData({ draft: 'hello', sheet: 'compose' })
  const submission = page.submitComposition()
  page.setData({ view: 'mine', sheet: '' })
  await page.refresh()
  finishSubmission({ status: 'published' })
  await submission
  assert.equal(page.data.view, 'mine')
  assert.equal(page.data.sheet, '')
  assert.equal(page.data.receipt, null)
  assert.equal(page.data.busy, false)
})
