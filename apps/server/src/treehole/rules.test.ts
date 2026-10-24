import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeText, parseId, parsePage, quotaWindow, tierForScore, validateAiResult, correctedTimeline, routeContent, scoreCycleStart } from './rules.js'
test('normalization uses code points and rejects controls and overlong emoji', () => {
 assert.equal(normalizeText('  难过\r\n也可以说  ', 1000), '难过\n也可以说')
 assert.equal(normalizeText('😀'.repeat(500),500).length,1000)
 assert.throws(()=>normalizeText('😀'.repeat(501),500))
 assert.throws(()=>normalizeText('a\u0085b',500))
})
test('IDs and pages reject coercion and overflow',()=>{
 assert.equal(parseId('9223372036854775807'),9223372036854775807n)
 for(const v of ['9223372036854775808','01','1e3','0']) assert.throws(()=>parseId(v))
 for(const v of ['1e2','1.0','2147483648','']) assert.throws(()=>parsePage(v))
})
test('quota day uses Shanghai midnight',()=>{
 assert.deepEqual(quotaWindow('2026-10-24T16:00:00.000Z'),{date:'2026-10-25',retryAt:'2026-10-25T16:00:00.000Z'})
})
test('score thresholds and original timeline downgrade never restart punishment',()=>{
 assert.deepEqual([0,1,4,5,9,10,19,20,30,40].map(tierForScore),[-1,0,0,1,1,2,2,3,4,5])
 const r=correctedTimeline([{id:1n,points:5,confirmedAt:'2026-10-24T09:10:00.000Z'}],[{id:2n,startsAt:'2026-10-24T09:10:00.000Z',tier:2}], '2026-10-24T11:00:00.000Z')
 assert.equal(r.penalties[0]?.tier,1)
 assert.equal(r.penalties[0]?.endsAt,'2026-10-24T10:10:00.000Z')
})
test('AI cannot invent evidence, fields, scores or factual findings',()=>{
 assert.throws(()=>validateAiResult({decision:'violation',violationCode:'minor_insult',points:20,reason:'辱骂',evidenceQuotes:['坏人']},'坏人'))
 assert.throws(()=>validateAiResult({decision:'approve',violationCode:null,points:null,reason:'正常',evidenceQuotes:['假的']},'原文'))
 assert.equal(validateAiResult({decision:'violation',violationCode:'threat',points:15,reason:'明确威胁',evidenceQuotes:['杀了你']},'我要杀了你').decision,'needs_human')
})
test('corrected timeline resets at a 90-day gap, uses same-time events, and never raises a manual tier',()=>{
 const r=correctedTimeline([
  {id:1n,points:40,confirmedAt:'2026-01-01T00:00:00.000Z'},
  {id:2n,points:40,confirmedAt:'2026-05-01T00:00:00.000Z'}
 ],[
  {id:1n,startsAt:'2026-01-01T00:00:00.000Z',tier:4},
  {id:2n,startsAt:'2026-05-01T00:00:00.000Z',tier:1},
  {id:3n,startsAt:'2026-05-01T00:00:00.000Z',tier:2}
 ],'2026-05-01T00:00:00.000Z')
 assert.deepEqual(r.penalties.map(p=>p.tier),[4,1,2])
 assert.equal(r.lastEnforcedTier,2)
 assert.equal(correctedTimeline([{id:1n,points:40,confirmedAt:'2026-01-01T00:00:00.000Z'}],[{id:1n,startsAt:'2026-01-01T00:00:00.000Z',tier:5}],'2026-05-01T00:00:00.000Z').lastEnforcedTier,-1)
})
test('severe needs_human retains validated advisory evidence without becoming an automatic finding',()=>{
 const result=validateAiResult({decision:'needs_human',violationCode:'privacy_leak',points:12,reason:'建议人工复核',evidenceQuotes:['目标隐私']},'暴露目标隐私')
 assert.equal(result.decision,'needs_human');assert.equal(result.points,12)
 assert.throws(()=>validateAiResult({decision:'needs_human',violationCode:'privacy_leak',points:1,reason:'无效分数',evidenceQuotes:['目标隐私']},'目标隐私'))
 assert.throws(()=>validateAiResult({decision:'needs_human',violationCode:'privacy_leak',points:12,reason:'没有证据',evidenceQuotes:[]},'目标隐私'))
})
test('empty configured risk phrases cannot auto-publish',()=>{
 const version=process.env.TREEHOLE_RULE_VERSION,patterns=process.env.TREEHOLE_RISK_PATTERNS
 try {
  process.env.TREEHOLE_RULE_VERSION='test-v1'
  for(const value of ['|','  |  ','   ']) {process.env.TREEHOLE_RISK_PATTERNS=value;assert.equal(routeContent('普通正文'),'ai')}
 } finally {
  if(version===undefined)delete process.env.TREEHOLE_RULE_VERSION;else process.env.TREEHOLE_RULE_VERSION=version
  if(patterns===undefined)delete process.env.TREEHOLE_RISK_PATTERNS;else process.env.TREEHOLE_RISK_PATTERNS=patterns
 }
})
test('permanent-review dedupe uses the current valid scoring cycle, independent of executed tiers',()=>{
 assert.equal(scoreCycleStart(['2026-01-01T00:00:00Z','2026-05-01T00:00:00Z','2026-05-02T00:00:00Z'],'2026-05-03T00:00:00Z'),'2026-05-01T00:00:00Z')
 assert.equal(scoreCycleStart(['2026-01-01T00:00:00Z'],'2026-05-03T00:00:00Z'),null)
 assert.equal(scoreCycleStart(['2027-01-01T00:00:00Z'],'2026-05-03T00:00:00Z'),null)
 assert.equal(scoreCycleStart(['2026-01-01T00:00:00.000Z'],'2026-04-01T00:00:00.000Z'),null)
 assert.equal(scoreCycleStart(['2026-01-01T00:00:00.000Z'],'2026-03-31T23:59:59.999Z'),'2026-01-01T00:00:00.000Z')
 assert.equal(scoreCycleStart(['2026-01-01T00:00:00.000Z','2026-04-01T00:00:00.000Z'],'2026-04-01T00:00:00.000Z'),'2026-04-01T00:00:00.000Z')
 assert.equal(scoreCycleStart(['2026-01-01T00:00:00.000Z','2026-03-31T23:59:59.999Z'],'2026-04-01T00:00:00.000Z'),'2026-01-01T00:00:00.000Z')
})
