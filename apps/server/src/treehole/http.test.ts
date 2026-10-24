import assert from 'node:assert/strict'
import { test } from 'node:test'
import Fastify from 'fastify'
import { registerTreeholeRoutes } from './routes.js'
test('identity precedes content validation and errors are never cached',async()=>{
 const app=Fastify()
 await registerTreeholeRoutes(app,{miniapp:async(_r,reply)=>{reply.code(401).send({error:{code:'UNAUTHORIZED',message:'请先登录'}});return null},admin:async()=>null})
 const r=await app.inject({method:'POST',url:'/api/miniapp/treehole/posts',payload:{userId:'1'}})
 assert.equal(r.statusCode,401)
 assert.equal(r.headers['cache-control'],'private, no-store')
 assert.ok(r.headers.date)
 assert.ok(r.json().error.requestId)
 const malformed=await app.inject({method:'POST',url:'/api/miniapp/treehole/posts',headers:{'content-type':'application/json'},payload:'{invalid'})
 assert.equal(malformed.statusCode,401)
 await app.close()
})
