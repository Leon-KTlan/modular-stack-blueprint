const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { runInNewContext } = require('node:vm')
const ts = require('typescript')
const source = readFileSync(join(__dirname, '../utils/hot-ranking.ts'), 'utf8')
const moduleExports = {}
runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: moduleExports })
const { rankHotPosts, getBeijingDate, formatHeat } = moduleExports

test('weights daily likes, favorites and comments and does not mutate input', () => {
  const input = [
    { id: '1', today: { likeCount: 5, favoriteCount: 0, commentCount: 0 } },
    { id: '2', today: { likeCount: 1, favoriteCount: 1, commentCount: 1 } },
    { id: '3', today: { likeCount: 0, favoriteCount: 0, commentCount: 0 } },
  ]
  const ranked = rankHotPosts(input)
  assert.equal(ranked.length, 2)
  assert.equal(ranked[0].id, '2')
  assert.equal(ranked[0].score, 6)
  assert.equal(ranked[0].rank, 1)
  assert.equal(ranked[1].rank, 2)
  assert.equal(input[0].id, '1')
  assert.equal(input[0].rank, undefined)
})

test('equal heat preserves source order and large string IDs', () => {
  const ranked = rankHotPosts([
    { id: '9007199254740993', today: { likeCount: 2, favoriteCount: 0, commentCount: 0 } },
    { id: '9007199254740992', today: { likeCount: 0, favoriteCount: 0, commentCount: 1 } },
  ])
  assert.equal(ranked[0].id, '9007199254740993')
  assert.equal(rankHotPosts([]).length, 0)
})

test('date switches at Beijing midnight and heat stays readable', () => {
  assert.equal(getBeijingDate(new Date('2026-10-24T15:59:59Z')), '2026.10.24')
  assert.equal(getBeijingDate(new Date('2026-10-24T16:00:00Z')), '2026.10.25')
  assert.equal(formatHeat(284), '284')
  assert.equal(formatHeat(12500), '1.3万')
})
