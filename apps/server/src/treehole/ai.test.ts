import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aiConfig, moderate } from './ai.js'
import type { Row } from './store.js'
const review={rule_version:'test-v1',content_snapshot:'目标正文',context_snapshot:[{target:{type:'post',id:'1',postId:'1',availability:'published'},content:'上下文'}]} as unknown as Row
const config={url:'https://example.invalid/chat/completions',key:'test-only',model:'operator-configured',timeoutMs:50,maxOutputTokens:100,dailyRequestLimit:2}
test('missing provider and budget never imply publication',()=>{
 assert.equal(aiConfig(),null)
})
test('AI adapter sends anonymous minimal data and validates exact JSON evidence',async()=>{
 const original=globalThis.fetch
 let payload:Record<string,unknown>|undefined
 try {
  globalThis.fetch=async(_url,options)=>{
   payload=JSON.parse(options!.body as string)
   return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({decision:'approve',violationCode:null,points:null,reason:'正常',evidenceQuotes:[]})}}]}))
  }
  assert.equal((await moderate(review,config)).decision,'approve')
  const serialized=JSON.stringify(payload)
  assert.ok(!serialized.includes('user_id'));assert.ok(!serialized.includes('wx_openid'));assert.ok(!serialized.includes('nickname'))
  assert.ok(serialized.includes('test-v1'))
  globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({decision:'violation',violationCode:'minor_insult',points:1,reason:'无效引用',evidenceQuotes:['并非原文']})}}]}))
  await assert.rejects(()=>moderate(review,config))
  globalThis.fetch=async()=>new Response('provider private diagnostics',{status:503})
  await assert.rejects(()=>moderate(review,config),/AI provider unavailable/)
 } finally {globalThis.fetch=original}
})
