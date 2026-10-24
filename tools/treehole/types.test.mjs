import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const source = `
import type { CreatePost, TreeholeRequest, TreeholeResponse, TreeholeContractVersion } from '@cangqiong/api-contracts/treehole'
const version: TreeholeContractVersion = '1.0.0'
const post: CreatePost = { content: '晚安', ttlHours: 6 }
const request: TreeholeRequest<'createTreeholePost'> = { headers: { 'Idempotency-Key': 'demo-uuid' }, body: post }
const id: TreeholeRequest<'getTreeholePost'> = { pathParams: { postId: '9007199254742000' } }
const deleted: TreeholeResponse<'deleteMyPost', 204> = undefined
// @ts-expect-error API ID must remain a decimal string
const badId: TreeholeRequest<'getTreeholePost'> = { pathParams: { postId: 123 } }
// @ts-expect-error unsupported TTL
const badTtl: CreatePost = { content: '晚安', ttlHours: 2 }
// @ts-expect-error authentication identity is not a request body field
const injected: CreatePost = { content: '晚安', userId: '1' }
// @ts-expect-error permanent penalty requires a tier confirmation
const decision: TreeholeRequest<'decideAdminPenalty'>['body'] = { decision: 'confirm', reason: '确认' }
// @ts-expect-error unavailable is a receipt status, never a public post
const status: TreeholeResponse<'getTreeholePost', 200>['status'] = 'unavailable'
void [version, request, id, deleted, badId, badTtl, injected, decision, status]
`
for (const [app, resolution, module] of [['miniapp', 'Node10', 'ESNext'], ['admin', 'Bundler', 'ESNext'], ['server', 'NodeNext', 'NodeNext']]) {
  test(`${app} resolves shared DTO with its module resolution and rejects invalid consumers`, () => {
    const root = fileURLToPath(new URL(`../../apps/${app}/`, import.meta.url))
    const require = createRequire(root + 'package.json')
    const ts = require('typescript')
    const file = root + '__treehole_typecheck__.ts'
    const options = { strict: true, noEmit: true, skipLibCheck: false, target: ts.ScriptTarget.ES2022, types: [], moduleResolution: ts.ModuleResolutionKind[resolution], module: ts.ModuleKind[module] }
    const host = ts.createCompilerHost(options)
    const original = host.getSourceFile.bind(host)
    host.getSourceFile = (path, version, onError, createNew) => path === file ? ts.createSourceFile(path, source, version) : original(path, version, onError, createNew)
    const program = ts.createProgram([file], options, host)
    const diagnostics = ts.getPreEmitDiagnostics(program)
    assert.deepEqual(diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), [])
  })
}
