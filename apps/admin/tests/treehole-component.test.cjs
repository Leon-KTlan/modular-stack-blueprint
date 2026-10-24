const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { runInNewContext } = require('node:vm')
const ts = require('typescript')

function deferred() {
  let resolve
  const promise = new Promise((complete) => { resolve = complete })
  return { promise, resolve }
}

// Exercise the component's handlers without installing a DOM or a renderer.
function inspectorHarness(service) {
  const states = [], refs = [], effects = [], modules = new Map()
  let stateIndex, refIndex, effectIndex, tree
  const react = {
    useState(initial) {
      const index = stateIndex++
      if (!(index in states)) states[index] = initial
      return [states[index], (value) => { states[index] = typeof value === 'function' ? value(states[index]) : value }]
    },
    useRef(initial) { return refs[refIndex++] ??= { current: initial } },
    useEffect(callback) { effects[effectIndex++] ??= { callback, mounted: false } },
  }
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'fragment' }
  function load(name) {
    if (modules.has(name)) return modules.get(name)
    const exports = {}
    const source = readFileSync(resolve(__dirname, '../src', name), 'utf8')
      + (name === 'TreeholePage.tsx' ? '\nexport { CaseInspector };' : '')
    runInNewContext(ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, {
      exports, Headers, URLSearchParams, crypto: require('node:crypto').webcrypto,
      document: { activeElement: null, body: { style: { overflow: '' } } }, HTMLElement: class {},
      require: (name) => name === 'react' ? react : name === 'react/jsx-runtime' ? jsx
        : name === './shared' ? { formatDate: (value) => value ?? '—', buildPageItems: () => [] }
          : name.endsWith('.css') ? {} : load(`${name.slice(2)}.ts`),
    })
    modules.set(name, exports)
    return exports
  }
  const { CaseInspector } = load('TreeholePage.tsx')
  const props = { kind: 'reports', id: '501', service, onClose() {}, onChanged() {}, onUnauthorized() {}, onNavigate() {} }
  function render() {
    stateIndex = refIndex = effectIndex = 0
    tree = CaseInspector(props)
    for (const effect of effects) if (!effect.mounted) { effect.mounted = true; effect.callback() }
  }
  function find(predicate, node) {
    if (!node || typeof node !== 'object') return undefined
    if (predicate(node)) return node
    for (const child of [node.props?.children].flat(Infinity)) {
      const result = find(predicate, child)
      if (result) return result
    }
  }
  return {
    render,
    button: (text) => find((node) => node.type === 'button' && node.props.children === text, tree),
    input: () => find((node) => node.type === 'input' && node.props['aria-label'] === '关联复查编号', tree),
    reason: () => find((node) => node.type === 'textarea', tree),
    form: () => find((node) => node.type === 'form', tree),
    evidence: () => find((node) => node.type.name === 'ReviewEvidence', tree),
  }
}

const tick = () => new Promise((resolve) => setImmediate(resolve))
const target = { type: 'post', id: '9007199254740993', postId: '9007199254740993', availability: 'published' }
const review = (id) => ({ id, target, status: 'completed', isCurrent: true, decision: 'approve' })
const report = (id) => ({ id: '501', target, status: 'pending', reviewId: id, review: review(id) })

async function setup() {
  const evidenceRequest = deferred(), refreshRequest = deferred(), mutations = []
  let reportReads = 0
  const service = {
    serverDate: null,
    get(kind) { return kind === 'reviews' ? evidenceRequest.promise : ++reportReads === 1 ? Promise.resolve(report('701')) : refreshRequest.promise },
    attempt(_path, body) { return { body } },
    async mutate(_path, attempt) { mutations.push(attempt.body) },
  }
  const inspector = inspectorHarness(service)
  inspector.render()
  await tick()
  inspector.render()
  inspector.reason().props.onChange({ target: { value: '核对复查事实' } })
  inspector.render()
  const queuedRefresh = inspector.button('刷新详情').props.onClick
  inspector.input().props.onChange({ target: { value: '702' } })
  inspector.render()
  inspector.button('读取复查证据').props.onClick()
  inspector.render()
  return { inspector, evidenceRequest, refreshRequest, queuedRefresh, mutations }
}

test('report detail refresh is disabled while linked evidence is loading', async () => {
  const { inspector } = await setup()
  assert.equal(inspector.button('刷新详情').props.disabled, true)
})

test('a late evidence response cannot replace a newer report detail or change the submitted review ID', async () => {
  const { inspector, evidenceRequest, refreshRequest, queuedRefresh, mutations } = await setup()
  // Also cover a refresh event queued before the loading state was rendered.
  queuedRefresh()
  refreshRequest.resolve(report('703'))
  await tick()
  inspector.render()
  evidenceRequest.resolve(review('702'))
  await tick()
  inspector.render()
  const displayedId = inspector.input().props.value
  const evidenceId = inspector.evidence().props.review.id
  const submission = inspector.form().props.onSubmit({ preventDefault() {} })
  await submission
  assert.equal(displayedId, '703')
  assert.equal(evidenceId, '703')
  assert.equal(mutations.length, 1)
  assert.equal(mutations[0].reviewId, displayedId)
})
