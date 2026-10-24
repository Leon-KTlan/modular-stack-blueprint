import { readFileSync } from 'node:fs'

export const spec = JSON.parse(readFileSync(new URL('../../docs/api/treehole-openapi-v1.json', import.meta.url)))
export const examples = JSON.parse(readFileSync(new URL('../../docs/api/treehole-examples-v1.json', import.meta.url)))
export const operations = Object.entries(spec.paths).flatMap(([path, methods]) =>
  Object.entries(methods).map(([method, op]) => ({ ...op, method: method.toUpperCase(), path })))

export function resolveRef(ref, document = spec) {
  if (!ref.startsWith('#/')) throw new Error(`Only local refs supported: ${ref}`)
  const value = ref.slice(2).split('/').reduce((node, key) => node?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], document)
  if (!value) throw new Error(`Missing ref: ${ref}`)
  return value
}

export function responseSchema(operation, status) {
  let response = operation.responses[String(status)]
  if (!response) throw new Error(`Undeclared response: ${operation.operationId} ${status}`)
  if (response.$ref) response = resolveRef(response.$ref)
  return response.content?.['application/json']?.schema
}

const supported = new Set(['$ref', 'type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'const',
  'anyOf', 'oneOf', 'allOf', 'not', 'if', 'then', 'else', 'minimum', 'maximum', 'minLength', 'maxLength',
  'minItems', 'maxItems', 'pattern', 'format', 'description', 'default', 'title'])

// This is deliberately a validator for this contract's subset, not a general JSON Schema engine.
export function assertSupportedSchema(schema) {
  if (!schema || typeof schema !== 'object') throw new Error('Expected a schema object')
  for (const key of Object.keys(schema)) if (!supported.has(key)) throw new Error(`Unsupported schema keyword: ${key}`)
  if ('additionalProperties' in schema && typeof schema.additionalProperties !== 'boolean') throw new Error('Unsupported additionalProperties schema: only boolean supported')
  if (schema.format && !['date-time', 'uuid'].includes(schema.format)) throw new Error(`Unsupported format: ${schema.format}`)
  for (const key of ['anyOf', 'oneOf', 'allOf']) schema[key]?.forEach(assertSupportedSchema)
  for (const key of ['items', 'not', 'if', 'then', 'else']) if (schema[key]) assertSupportedSchema(schema[key])
  Object.values(schema.properties ?? {}).forEach(assertSupportedSchema)
}

export function validate(schema, value, path = 'body') {
  if (!schema) return value === undefined ? [] : [{ path, issue: 'unknown_field' }]
  const errors = []
  const fail = (issue = 'invalid_format', at = path) => errors.push({ path: at, issue })
  if (schema.$ref) {
    errors.push(...validate(resolveRef(schema.$ref), value, path))
    if (schema.$ref === '#/components/schemas/Id' && typeof value === 'string' && /^[1-9][0-9]*$/.test(value)
      && BigInt(value) > 9223372036854775807n) fail('out_of_range')
  }
  if (schema.type) {
    const valid = { null: value === null, object: value !== null && typeof value === 'object' && !Array.isArray(value),
      array: Array.isArray(value), string: typeof value === 'string', boolean: typeof value === 'boolean',
      number: typeof value === 'number' && Number.isFinite(value), integer: Number.isSafeInteger(value) }[schema.type]
    if (!valid) { fail('invalid_type'); return errors }
  }
  if ('const' in schema && value !== schema.const) fail()
  if (schema.enum && !schema.enum.includes(value)) fail()
  if (schema.anyOf && !schema.anyOf.some(s => validate(s, value, path).length === 0)) fail()
  if (schema.oneOf && schema.oneOf.filter(s => validate(s, value, path).length === 0).length !== 1) fail()
  for (const s of schema.allOf ?? []) errors.push(...validate(s, value, path))
  if (schema.not && validate(schema.not, value, path).length === 0) fail()
  if (schema.if) {
    const branch = validate(schema.if, value, path).length === 0 ? schema.then : schema.else
    if (branch) errors.push(...validate(branch, value, path))
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required ?? []) if (!(key in value)) fail('required', `${path}.${key}`)
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, key)) errors.push(...validate(child, value[key], `${path}.${key}`))
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!Object.hasOwn(schema.properties ?? {}, key)) fail('unknown_field', `${path}.${key}`)
    }
  }
  if (typeof value === 'string') {
    const length = Array.from(value).length
    if (length < (schema.minLength ?? 0) || length > (schema.maxLength ?? Infinity)) fail('out_of_range')
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) fail()
    if (schema.format === 'date-time' && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) || !Number.isFinite(Date.parse(value)))) fail()
    if (schema.format === 'uuid' && !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)) fail()
  }
  if (typeof value === 'number' && (value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity))) fail('out_of_range')
  if (Array.isArray(value)) {
    if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) fail('out_of_range')
    if (schema.items) value.forEach((v, i) => errors.push(...validate(schema.items, v, `${path}.${i}`)))
  }
  return errors
}

for (const schema of Object.values(spec.components.schemas)) assertSupportedSchema(schema)
