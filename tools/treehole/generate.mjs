import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { spec, assertSupportedSchema, resolveRef } from './contract.mjs'

function schemaType(s) {
  assertSupportedSchema(s)
  if (s.$ref) return s.$ref.split('/').at(-1)
  const pieces = []
  if ('const' in s) pieces.push(JSON.stringify(s.const))
  else if (s.enum) pieces.push(s.enum.map(v => JSON.stringify(v)).join(' | '))
  else if (s.properties || s.type === 'object') {
    const props = Object.entries(s.properties ?? {}).map(([key, value]) => `${JSON.stringify(key)}${s.required?.includes(key) ? '' : '?'}: ${schemaType(value)}`)
    pieces.push(props.length ? `{ ${props.join('; ')} }` : s.additionalProperties === false ? 'Record<string, never>' : 'Record<string, unknown>')
  } else if (s.type === 'array') pieces.push(`Array<${schemaType(s.items)}>`)
  else if (s.type) pieces.push(({ integer: 'number', null: 'null' })[s.type] ?? s.type)
  for (const key of ['anyOf', 'oneOf']) if (s[key]) pieces.push(`(${s[key].map(schemaType).join(' | ')})`)
  if (s.allOf) pieces.push(...s.allOf.map(schemaType).filter(t => t !== 'unknown'))
  // Numeric/text limits and if/then/not are validated at runtime, not encoded as TS brands.
  return pieces.length ? pieces.map(p => `(${p})`).join(' & ') : 'unknown'
}

export function generateTypes(document) {
  const lines = ['// Generated from docs/api/treehole-openapi-v1.json. DO NOT EDIT.',
    '// Run: pnpm treehole:generate. Limits and conditional constraints require runtime validation.',
    `export type TreeholeContractVersion = ${JSON.stringify(document.info.version)}`, '']
  for (const [name, schema] of Object.entries(document.components.schemas)) lines.push(`export type ${name} = ${schemaType(schema)}`, '')
  lines.push('export interface TreeholeSchemas {')
  for (const name of Object.keys(document.components.schemas)) lines.push(`  ${name}: ${name}`)
  lines.push('}', '', 'export interface TreeholeOperations {')
  for (const [path, methods] of Object.entries(document.paths)) for (const [method, op] of Object.entries(methods)) {
    const fields = []
    for (const [where, name] of [['path', 'pathParams'], ['query', 'query'], ['header', 'headers']]) {
      const params = (op.parameters ?? []).map(p => p.$ref ? resolveRef(p.$ref, document) : p).filter(p => p.in === where)
      if (params.length) fields.push(`${name}${params.some(p => p.required) ? '' : '?'}: { ${params.map(p => `${JSON.stringify(p.name)}${p.required ? '' : '?'}: ${schemaType(p.schema)}`).join('; ')} }`)
    }
    if (op.requestBody) fields.push(`body${op.requestBody.required ? '' : '?'}: ${schemaType(op.requestBody.content['application/json'].schema)}`)
    lines.push(`  ${op.operationId}: {`, `    method: ${JSON.stringify(method.toUpperCase())}`, `    path: ${JSON.stringify(path)}`,
      `    request: ${fields.length ? `{ ${fields.join('; ')} }` : 'Record<string, never>'}`, '    responses: {')
    for (const [status, raw] of Object.entries(op.responses)) {
      const response = raw.$ref ? resolveRef(raw.$ref, document) : raw
      const s = response.content?.['application/json']?.schema
      lines.push(`      ${status}: ${s ? schemaType(s) : 'undefined'}`)
    }
    lines.push('    }', '  }')
  }
  lines.push('}', '', 'export type TreeholeOperationId = keyof TreeholeOperations',
    'export type TreeholeRequest<K extends TreeholeOperationId> = TreeholeOperations[K]["request"]',
    'export type TreeholeResponse<K extends TreeholeOperationId, S extends keyof TreeholeOperations[K]["responses"]> = TreeholeOperations[K]["responses"][S]', '')
  return lines.join('\n')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = new URL('../../packages/api-contracts/treehole.d.ts', import.meta.url)
  const generated = generateTypes(spec)
  if (process.argv.includes('--check')) {
    if (readFileSync(output, 'utf8') !== generated) throw new Error('DTO drift: run pnpm treehole:generate')
    console.log('DTO matches OpenAPI 1.0.0')
  } else writeFileSync(output, generated)
}
