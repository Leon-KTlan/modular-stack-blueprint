import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { spec, examples, operations, responseSchema, validate, resolveRef } from './contract.mjs'
import { createMockState, MockError } from './mock-state.mjs'

const routes = operations.map(op => ({ op, names: [...op.path.matchAll(/\{(\w+)\}/g)].map(m => m[1]), pattern: new RegExp(`^${op.path.replace(/\{\w+\}/g, '([^/]+)')}$`) }))
const invalid = fields => { throw new MockError(400, 'VALIDATION_ERROR', { fields }) }
function normalize(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body
  const result = { ...body }
  for (const key of ['content', 'reason', 'description']) if (typeof result[key] === 'string') {
    result[key] = result[key].replace(/\r\n?/g, '\n')
    if (/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/u.test(result[key])) invalid([{ path: `body.${key}`, issue: 'invalid_format' }])
    result[key] = result[key].trim()
  }
  return result
}
async function readBody(request) {
  let size = 0; const chunks = []
  for await (const chunk of request) {
    size += chunk.length
    if (size > 32768) invalid([{ path: 'body', issue: 'out_of_range' }])
    chunks.push(chunk)
  }
  if (!size) return undefined
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) invalid([{ path: 'headers.Content-Type', issue: 'invalid_format' }])
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { invalid([{ path: 'body', issue: 'invalid_format' }]) }
}
function inputs(op, request, url, params, rawBody) {
  const issues = [], query = {}
  const known = new Map((op.parameters ?? []).filter(p => p.in === 'query').map(p => [p.name, p]))
  for (const name of new Set(url.searchParams.keys())) {
    const p = known.get(name)
    if (!p) { issues.push({ path: `query.${name}`, issue: 'unknown_field' }); continue }
    const values = url.searchParams.getAll(name)
    if (values.length !== 1) { issues.push({ path: `query.${name}`, issue: 'invalid_format' }); continue }
    const schema = p.schema.$ref ? resolveRef(p.schema.$ref) : p.schema
    let value = values[0]
    if (schema.type === 'integer') {
      if (!/^[1-9][0-9]*$/.test(value)) { issues.push({ path: `query.${name}`, issue: 'invalid_format' }); continue }
      value = Number(value)
    }
    issues.push(...validate(p.schema, value, `query.${name}`)); query[name] = value
  }
  for (const p of op.parameters ?? []) {
    if (p.in === 'query') continue
    const value = p.in === 'path' ? params[p.name] : request.headers[p.name.toLowerCase()]
    if (value === undefined) { if (p.required) issues.push({ path: `${p.in}.${p.name}`, issue: 'required' }); continue }
    issues.push(...validate(p.schema, value, `${p.in}.${p.name}`))
  }
  const body = normalize(rawBody)
  issues.push(...validate(op.requestBody?.content['application/json'].schema, body))
  if (issues.length) invalid(issues)
  if (op.operationId === 'createTreeholePost') body.ttlHours ??= 24
  return { query, body }
}
function authenticate(op, request) {
  const token = request.headers.authorization
  if (op.path.startsWith('/admin-api/')) {
    if (token === 'Bearer treehole-non-admin-demo') throw new MockError(403, 'FORBIDDEN')
    if (token !== 'Bearer treehole-admin-demo') throw new MockError(401, 'UNAUTHORIZED')
    return 'admin'
  }
  const owner = new Map([['Bearer treehole-miniapp-demo', 'me'], ['Bearer treehole-miniapp-other', 'other']]).get(token)
  if (!owner) throw new MockError(401, 'UNAUTHORIZED')
  return owner
}
function shiftTimes(value, offset) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(Date.parse(value) + offset).toISOString()
  if (Array.isArray(value)) return value.map(v => shiftTimes(v, offset))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shiftTimes(v, offset)]))
  return value
}
export function createMockServer({ now = Date.now, scenario = 'normal' } = {}) {
  let advanceMs = 0, override
  const clock = () => now() + advanceMs
  const state = createMockState(clock)
  state.reset(scenario)
  return createServer(async (request, response) => {
    let op
    const send = (status, body, verify = true) => {
      if (verify && op) {
        const issues = validate(responseSchema(op, status), body)
        if (issues.length) throw new Error(`Invalid mock response ${op.operationId}: ${JSON.stringify(issues)}`)
      }
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', Date: new Date(clock()).toUTCString(), 'Access-Control-Expose-Headers': 'Date, Cache-Control' })
      response.end(body === undefined ? undefined : JSON.stringify(body))
    }
    try {
      const origin = request.headers.origin
      if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin')
      }
      if (request.method === 'OPTIONS') {
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key')
        send(204, undefined, false); return
      }
      const url = new URL(request.url, 'http://127.0.0.1')
      if (url.pathname.startsWith('/__mock/treehole/')) {
        if (request.method !== 'POST') { send(404, { message: 'Unknown mock control' }, false); return }
        const body = await readBody(request)
        if (url.pathname === '/__mock/treehole/reset') {
          const issues = validate({ type: 'object', required: ['scenario'], additionalProperties: false, properties: { scenario: { type: 'string' } } }, body)
          if (issues.length) invalid(issues)
          advanceMs = 0; override = undefined; state.reset(body.scenario)
        } else if (url.pathname === '/__mock/treehole/clock') {
          const issues = validate({ type: 'object', required: ['advanceSeconds'], additionalProperties: false, properties: { advanceSeconds: { type: 'integer', minimum: 0, maximum: 31536000 } } }, body)
          if (issues.length) invalid(issues)
          advanceMs += body.advanceSeconds * 1000
        } else if (url.pathname === '/__mock/treehole/example') {
          const issues = validate({ type: 'object', required: ['operationId', 'name', 'httpStatus'], additionalProperties: false, properties: { operationId: { type: 'string' }, name: { type: 'string' }, httpStatus: { type: 'integer' } } }, body)
          if (issues.length) invalid(issues)
          const example = examples.responses.find(e => e.operationId === body.operationId && e.name === body.name && e.httpStatus === body.httpStatus)
          // 204 has no sample body. It still supports one-shot dispatch testing.
          if (!example && !(body.httpStatus === 204 && operations.some(o => o.operationId === body.operationId && o.responses['204']))) invalid([{ path: 'body.name', issue: 'invalid_format' }])
          override = { ...body, response: example?.response }
        } else { send(404, { message: 'Unknown mock control' }, false); return }
        send(200, { ok: true, now: new Date(clock()).toISOString() }, false); return
      }
      const route = routes.find(r => r.op.method === request.method && r.pattern.test(url.pathname))
      if (!route) { send(404, { message: 'Unknown mock route' }, false); return }
      op = route.op
      const owner = authenticate(op, request)
      const params = Object.fromEntries(route.names.map((name, i) => [name, url.pathname.match(route.pattern)[i + 1]]))
      if (op.path.startsWith('/api/miniapp/treehole/')) {
        const access = state.access(owner)
        if (!access.canEnter) throw new MockError(403, 'TREEHOLE_RESTRICTED', access.restriction)
      }
      const { query, body } = inputs(op, request, url, params, await readBody(request))
      if (override?.operationId === op.operationId) {
        const fixture = override; override = undefined
        send(fixture.httpStatus, shiftTimes(fixture.response, clock() - Date.parse('2026-10-24T10:00:00Z'))); return
      }
      const result = state.handle(op, params, body, query, owner, request.headers['idempotency-key'])
      send(result.status, result.body)
    } catch (error) {
      const expected = error instanceof MockError
      if (!expected) console.error(error.message)
      const body = { error: { code: expected ? error.code : 'INTERNAL_ERROR', message: expected ? error.code : 'Mock response or handler failed', requestId: randomUUID(), ...(error.details ? { details: error.details } : {}) } }
      try { send(expected ? error.status : 500, body) }
      catch { send(500, { error: { code: 'INTERNAL_ERROR', message: 'Mock contract validation failed', requestId: randomUUID() } }, false) }
    }
  })
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.TREEHOLE_MOCK_PORT ?? 4010)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid TREEHOLE_MOCK_PORT')
  const server = createMockServer({ scenario: 'demo' })
  server.on('error', error => { console.error(error.message); process.exitCode = 1 })
  server.listen(port, '127.0.0.1', () => console.log(`Treehole Mock v${spec.info.version}: http://127.0.0.1:${port}`))
}
