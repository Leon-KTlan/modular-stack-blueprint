// This harness can reset only an explicitly configured, isolated local test database.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { Pool } from 'pg'
const url=process.env.TREEHOLE_TEST_DATABASE_URL
if(!url)throw new Error('Set TREEHOLE_TEST_DATABASE_URL to an isolated local treehole_test database')
const target=new URL(url)
if(!['127.0.0.1','localhost'].includes(target.hostname)||target.pathname!=='/treehole_test'||!target.port)throw new Error('Refusing to reset a non-isolated treehole_test database')
process.env.DATABASE_URL=url
process.env.JWT_SECRET='integration-admin-key-only-for-isolated-test'
process.env.MINIAPP_JWT_SECRET='integration-miniapp-key-only-for-isolated-test'
delete process.env.TREEHOLE_RULE_VERSION
delete process.env.TREEHOLE_RISK_PATTERNS
delete process.env.TREEHOLE_SAMPLE_RATE
delete process.env.TREEHOLE_AI_CHAT_COMPLETIONS_URL
const bootstrap=new Pool({connectionString:url})
await bootstrap.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
const migrations=new URL('../../../../database/migrations/',import.meta.url)
for(const name of (await readdir(migrations)).filter(n=>n.endsWith('.sql')).sort())await bootstrap.query(await readFile(new URL(name,migrations),'utf8'))
await bootstrap.query("INSERT INTO users(id,username,password_hash,role) VALUES(1,'treehole_test_admin','test-only',1),(2,'treehole_test_member','test-only',0)")
await bootstrap.query("INSERT INTO miniapp_users(wx_openid,nickname) SELECT 'treehole_test_'||i,'测试'||i FROM generate_series(1,12) i")
await bootstrap.end()
const {app}=await import('../server.js')
app.log.level='silent'
const {pool}=await import('../database.js')
const {claimReview,completeClaim,runWorkerCycle}=await import('./worker.js')
const {aiConfig}=await import('./ai.js')
// Shared frozen HTTP validator is used only by this test, never by production persistence.
// @ts-expect-error JavaScript contract utility has no declaration file.
const contract=await import('../../../../tools/treehole/contract.mjs')
const tokens=new Map<number,string>()
for(let i=1;i<=12;i++)tokens.set(i,app.jwt.sign({sub:String(i),actorType:'MINIAPP_USER',aud:'miniapp',tokenVersion:0},{key:process.env.MINIAPP_JWT_SECRET}))
const admin=app.jwt.sign({userId:1,tokenVersion:0})
let requests=0
const hit=new Set<string>()
async function http(method:'GET'|'POST'|'DELETE'|'PUT',path:string,status=200,body?:unknown,user:number|'admin'|null=1,key?:string) {
 const headers:Record<string,string>={}
 if(user)headers.authorization=`Bearer ${user==='admin'?admin:tokens.get(user)}`
 if(key)headers['idempotency-key']=key
 const r=await app.inject({method,url:path,headers,...(body===undefined?{}:{payload:JSON.stringify(body),headers:{...headers,'content-type':'application/json'}})})
 assert.equal(r.statusCode,status,`${method} ${path}: ${r.body}`)
 assert.equal(r.headers['cache-control'],'private, no-store')
 assert.ok(r.headers.date)
 const op=contract.operations.find((o:{method:string;path:string})=>o.method===method&&new RegExp('^'+o.path.replace(/\{\w+\}/g,'[^/]+')+'$').test(path.split('?')[0]!))
 assert.ok(op,`Unknown operation ${method} ${path}`)
 hit.add(op.operationId)
 const result=status===204?undefined:r.json()
 assert.deepEqual(contract.validate(contract.responseSchema(op,status),result),[],`${op.operationId}: response schema`)
 requests++
 return result
}
async function sql(text:string,values:unknown[]=[]) {return (await pool.query(text,values)).rows}
async function cooldown(user:number) {await sql('UPDATE treehole_user_states SET last_post_submitted_at=NULL,last_comment_submitted_at=NULL WHERE user_id=$1',[user])}
// Advance only isolated fixtures past finite restrictions; keep executed threshold history intact.
async function expireRestrictions(user:number) {await sql("UPDATE treehole_penalties SET starts_at=statement_timestamp()-interval '31 days',ends_at=statement_timestamp()-interval '31 days'+CASE tier WHEN 1 THEN interval '1 hour' WHEN 2 THEN interval '24 hours' WHEN 3 THEN interval '7 days' WHEN 4 THEN interval '30 days' END,notified_at=statement_timestamp()-interval '31 days' WHERE user_id=$1 AND status=1 AND tier BETWEEN 1 AND 4",[user])}
async function post(content:string,user=1,ttlHours=24,key=randomUUID()) {await cooldown(user);return http('POST','/api/miniapp/treehole/posts',201,{content,ttlHours},user,key)}
async function comment(postId:string,content:string,user=2,replyToCommentId?:string,key=randomUUID()) {await cooldown(user);return http('POST',`/api/miniapp/treehole/posts/${postId}/comments`,201,{content,...(replyToCommentId?{replyToCommentId}:{})},user,key)}
async function reviewFor(kind:'post'|'comment',id:string) {return (await sql(`SELECT * FROM treehole_reviews WHERE ${kind}_id=$1 ORDER BY id DESC LIMIT 1`,[id]))[0]!}
async function decide(reviewId:string,decision:unknown,key=randomUUID()) {return http('POST',`/admin-api/treehole/reviews/${reviewId}/decision`,200,decision,'admin',key)}
try {
 await http('POST','/api/miniapp/treehole/posts',401,{bad:true},null)
 await http('GET','/api/miniapp/treehole/posts?page=01',400)
 const pendingKey=randomUUID()
 const concurrent=await Promise.all(Array.from({length:8},()=>http('POST','/api/miniapp/treehole/posts',201,{content:'缺省配置保持待审',ttlHours:24},1,pendingKey)))
 assert.ok(concurrent.every((r:{id:string;status:string})=>r.id===concurrent[0].id&&r.status==='pending_review'))
 assert.equal((await sql('SELECT post_count FROM treehole_user_states WHERE user_id=1'))[0].post_count,1)
 assert.equal((await sql('SELECT count(*)::int AS n FROM treehole_reviews'))[0].n,1)
 await http('POST','/api/miniapp/treehole/posts',409,{content:'变更请求正文'},1,pendingKey)
 assert.equal((await runWorkerCycle()).claimed,false)
 const pendingReview=await reviewFor('post',concurrent[0].id)
 await http('GET',`/admin-api/treehole/reviews/${pendingReview.id}`,200,undefined,'admin')
 const adminKey=randomUUID()
 const approved=await decide(pendingReview.id,{decision:'approve',reason:'人工确认无违规'},adminKey)
 assert.deepEqual(await decide(pendingReview.id,{decision:'approve',reason:'人工确认无违规'},adminKey),approved)
 assert.equal((await sql("SELECT count(*)::int AS n FROM audit_logs WHERE resource_type='treehole_review'"))[0].n,1)
 await http('GET','/admin-api/treehole/reviews?status=completed&reviewerType=human',200,undefined,'admin')
 process.env.TREEHOLE_RULE_VERSION='integration-rules-v1'
 process.env.TREEHOLE_RISK_PATTERNS='风险待审核'
 const p=await post('第一篇公开树洞',2)
 assert.equal(p.status,'published')
 await http('GET','/api/miniapp/treehole/posts')
 await http('GET',`/api/miniapp/treehole/posts/${p.id}`,200,undefined,3)
 await http('PUT',`/api/miniapp/treehole/posts/${p.id}/likes/me`,200,undefined,3)
 await http('DELETE',`/api/miniapp/treehole/posts/${p.id}/likes/me`,200,undefined,3)
 const a=await comment(p.id,'第一层评论',3)
 const b=await comment(p.id,'第二层回复',4,a.id)
 const c=await comment(p.id,'第三层回复',5,b.id)
 await http('DELETE',`/api/miniapp/me/treehole/comments/${a.id}`,204,undefined,3)
 await http('DELETE',`/api/miniapp/me/treehole/comments/${b.id}`,204,undefined,4)
 const thread=await http('GET',`/api/miniapp/treehole/posts/${p.id}/comments`,200,undefined,6)
 assert.deepEqual(thread.items.map((v:{status:string})=>v.status),['deleted','deleted','published'])
 assert.equal(thread.items[0].author,null)
 const foreign=await post('另一个帖子',6)
 await http('POST',`/api/miniapp/treehole/posts/${foreign.id}/comments`,404,{content:'不允许跨帖回复',replyToCommentId:c.id},6,randomUUID())
 const detail=await http('GET',`/admin-api/treehole/reviews/${(await reviewFor('comment',c.id)).id}`,200,undefined,'admin')
 assert.equal(detail.context.length,2)
 assert.ok(!JSON.stringify(detail).includes('wx_openid'))
 await http('GET','/api/miniapp/me/treehole/posts',200,undefined,2)
 await http('GET',`/api/miniapp/me/treehole/posts/${p.id}`,200,undefined,2)
 await http('GET','/api/miniapp/me/treehole/comments',200,undefined,5)
 await http('GET',`/api/miniapp/me/treehole/comments/${c.id}`,200,undefined,5)
 // Repeat replay precedes expired parent checks, and never reveals original content.
 const replayKey=randomUUID()
 const replayComment=await comment(foreign.id,'幂等评论',7,undefined,replayKey)
 await http('DELETE',`/api/miniapp/me/treehole/posts/${foreign.id}`,204,undefined,6)
 const replay=await http('POST',`/api/miniapp/treehole/posts/${foreign.id}/comments`,201,{content:'幂等评论'},7,replayKey)
 assert.equal(replay.id,replayComment.id);assert.equal(replay.status,'unavailable')
 const expiredKey=randomUUID()
 const expired=await post('到期后不可再公开',8,1,expiredKey)
 await sql("UPDATE treehole_posts SET published_at=statement_timestamp()-interval '2 hours',expires_at=statement_timestamp()-interval '2 hours'+ttl_hours*interval '1 hour' WHERE id=$1",[expired.id])
 await http('GET',`/api/miniapp/treehole/posts/${expired.id}`,404,undefined,8)
 const expiredReplay=await http('POST','/api/miniapp/treehole/posts',201,{content:'到期后不可再公开',ttlHours:1},8,expiredKey)
 assert.equal(expiredReplay.status,'unavailable')
 // Exact Shanghai-day quota: resetting only the rate-limit timestamp cannot bypass the cap.
 for(let i=0;i<5;i++)await post(`日限额 ${i}`,9)
 await cooldown(9)
 await http('POST','/api/miniapp/treehole/posts',429,{content:'第六篇'},9,randomUUID())
 for(let i=0;i<50;i++)await comment(p.id,`评论配额 ${i}`,10)
 await cooldown(10)
 await http('POST',`/api/miniapp/treehole/posts/${p.id}/comments`,429,{content:'第五十一条'},10,randomUUID())
 const commentReport=await http('POST',`/api/miniapp/treehole/comments/${c.id}/reports`,201,{reason:'other',description:'测试评论举报'},6)
 const commentReview=await reviewFor('comment',c.id)
 await decide(commentReview.id,{decision:'approve',reason:'评论正常'})
 await http('POST',`/admin-api/treehole/reports/${commentReport.id}/decision`,200,{decision:'dismissed',reviewId:commentReview.id,reason:'评论正常'},'admin',randomUUID())
 // Report -> human decision -> reporter case settlement; creates a genuine restriction.
 const report=await http('POST',`/api/miniapp/treehole/posts/${p.id}/reports`,201,{reason:'insult'},3)
 const review=await reviewFor('post',p.id)
 const finding=await decide(review.id,{decision:'violation',violationCode:'direct_insult',points:5,reason:'测试明确辱骂违规'})
 const penaltyId=finding.penaltyIds[0]
 await http('GET','/admin-api/treehole/reports?status=pending',200,undefined,'admin')
 await http('GET',`/admin-api/treehole/reports/${report.id}`,200,undefined,'admin')
 await http('POST',`/admin-api/treehole/reports/${report.id}/decision`,200,{decision:'upheld',reviewId:review.id,reason:'人工审核已确认'},'admin',randomUUID())
 await http('GET','/api/miniapp/treehole/posts',403,undefined,2)
 await http('GET','/api/miniapp/me/treehole/access',200,undefined,2)
 await http('GET','/api/miniapp/me/treehole/penalties',200,undefined,2)
 await http('GET',`/api/miniapp/me/treehole/penalties/${penaltyId}`,200,undefined,2)
 const appeal=await http('POST',`/api/miniapp/me/treehole/penalties/${penaltyId}/appeals`,201,{reason:'请重新审核'},2,randomUUID())
 await http('GET','/api/miniapp/me/treehole/appeals',200,undefined,2)
 await http('GET','/admin-api/treehole/appeals?status=pending',200,undefined,'admin')
 await http('GET',`/admin-api/treehole/appeals/${appeal.id}`,200,undefined,'admin')
 await http('GET','/admin-api/treehole/penalties?status=active',200,undefined,'admin')
 await http('GET',`/admin-api/treehole/penalties/${penaltyId}`,200,undefined,'admin')
 await http('POST',`/admin-api/treehole/appeals/${appeal.id}/decision`,200,{decision:'uphold',reason:'原判断错误'},'admin',randomUUID())
 assert.equal((await http('GET','/api/miniapp/me/treehole/access',200,undefined,2)).canEnter,true)
 // A permanent threshold reviewed by a human is not repeatedly queued in the same cycle.
 for(let i=0;i<3;i++) {
  const item=await post(`风险待审核 永久审查 ${i}`,1)
  const result=await decide((await reviewFor('post',item.id)).id,{decision:'violation',violationCode:'direct_insult',points:9,reason:'测试累计违规'})
  if(i===2)await http('POST',`/admin-api/treehole/penalties/${result.penaltyIds[0]}/decision`,200,{decision:'decline',reason:'本次不批准七日限制'},'admin',randomUUID())
  await expireRestrictions(1)
 }
 // Reuse user 1 after three accepted posts; post cap still permits the two threshold events.
 const threshold=await post('风险待审核 永久阈值',1)
 const thresholdResult=await decide((await reviewFor('post',threshold.id)).id,{decision:'violation',violationCode:'threat',points:15,reason:'人工判断严重威胁'})
 const thresholdPenalty=thresholdResult.penaltyIds[0]
 await http('POST',`/admin-api/treehole/penalties/${thresholdPenalty}/decision`,200,{decision:'confirm',tier:1,reason:'人工将永久候选降为一小时'},'admin',randomUUID())
 assert.equal((await sql('SELECT basis FROM treehole_penalties WHERE id=$1',[thresholdPenalty]))[0].basis,1)
 await expireRestrictions(1)
 const permanentCount=(await sql('SELECT count(*)::int AS n FROM treehole_penalties WHERE user_id=1 AND score_snapshot>=40'))[0].n
 // Reset only the isolated fixture quota to exercise a later scoring event after human review.
 await sql('UPDATE treehole_user_states SET post_count=0 WHERE user_id=1')
 const later=await post('风险待审核 永久阈值已处置',1)
 await decide((await reviewFor('post',later.id)).id,{decision:'violation',violationCode:'minor_insult',points:1,reason:'后续轻微不文明'})
 assert.equal((await sql('SELECT count(*)::int AS n FROM treehole_penalties WHERE user_id=1 AND score_snapshot>=40'))[0].n,permanentCount)
 // Revoking that human decision allows a new permanent review on a later valid violation.
 await http('POST',`/admin-api/treehole/penalties/${thresholdPenalty}/revoke`,200,{reason:'撤销该次违规依据'},'admin',randomUUID())
 for(const candidate of await sql('SELECT id FROM treehole_penalties WHERE user_id=1 AND status=0'))await http('POST',`/admin-api/treehole/penalties/${candidate.id}/decision`,200,{decision:'decline',reason:'本次不执行有限限制'},'admin',randomUUID())
 await sql('UPDATE treehole_user_states SET post_count=0 WHERE user_id=1')
 const reconsidered=await post('风险待审核 撤销后允许重新送审',1)
 const reconsideredResult=await decide((await reviewFor('post',reconsidered.id)).id,{decision:'violation',violationCode:'threat',points:15,reason:'新的威胁证据'})
 const reconsideredPenalty=reconsideredResult.penaltyIds[0]
 assert.equal((await sql('SELECT tier FROM treehole_penalties WHERE id=$1',[reconsideredPenalty]))[0].tier,5)
 await http('POST',`/admin-api/treehole/penalties/${reconsideredPenalty}/decision`,200,{decision:'decline',reason:'本周期人工拒绝永久限制'},'admin',randomUUID())
 const declinedCount=(await sql('SELECT count(*)::int AS n FROM treehole_penalties WHERE user_id=1 AND score_snapshot>=40'))[0].n
 const afterDecline=await post('风险待审核 已拒绝永久候选',1)
 await decide((await reviewFor('post',afterDecline.id)).id,{decision:'violation',violationCode:'minor_insult',points:1,reason:'轻微不文明'})
 assert.equal((await sql('SELECT count(*)::int AS n FROM treehole_penalties WHERE user_id=1 AND score_snapshot>=40'))[0].n,declinedCount)
 // Old decisions updated today must not suppress a new cycle after a >=90-day clean gap.
 await sql("UPDATE treehole_violations SET confirmed_at=statement_timestamp()-interval '100 days' WHERE user_id=1")
 await sql("UPDATE treehole_penalties SET created_at=statement_timestamp()-interval '100 days',updated_at=statement_timestamp() WHERE user_id=1")
 await sql('UPDATE treehole_user_states SET post_count=0 WHERE user_id=1')
 for(let i=0;i<2;i++) {
  const item=await post(`风险待审核 新评分周期 ${i}`,1)
  const result=await decide((await reviewFor('post',item.id)).id,{decision:'violation',violationCode:'privacy_leak',points:20,reason:'新周期独立隐私证据'})
  assert.equal((await sql('SELECT tier FROM treehole_penalties WHERE id=$1',[result.penaltyIds[0]]))[0].tier,i===0?3:5)
  await http('POST',`/admin-api/treehole/penalties/${result.penaltyIds[0]}/decision`,200,{decision:'decline',reason:'人工处置新周期候选'},'admin',randomUUID())
 }
 assert.equal((await sql('SELECT count(*)::int AS n FROM treehole_penalties WHERE user_id=1 AND score_snapshot>=40'))[0].n,declinedCount+1)
 // A declined record also becomes irrelevant when its underlying violation is revoked.
 await sql("UPDATE treehole_violations SET revoked_at=statement_timestamp(),revoke_reason='隔离测试撤销违规依据' WHERE id=(SELECT trigger_violation_id FROM treehole_penalties WHERE user_id=1 AND tier=5 ORDER BY id DESC LIMIT 1)")
 const corrected=await post('风险待审核 旧拒绝依据撤销',1)
 const correctedResult=await decide((await reviewFor('post',corrected.id)).id,{decision:'violation',violationCode:'privacy_leak',points:20,reason:'后续独立违规依据'})
 assert.equal((await sql('SELECT tier FROM treehole_penalties WHERE id=$1',[correctedResult.penaltyIds[0]]))[0].tier,5)
 await http('POST',`/admin-api/treehole/penalties/${correctedResult.penaltyIds[0]}/decision`,200,{decision:'decline',reason:'处置后续永久候选'},'admin',randomUUID())
 // Deferred high-tier candidates require explicit human confirmation.
 const serious=await post('风险待审核 严重案例',11)
 const seriousReview=await reviewFor('post',serious.id)
 const severe=await decide(seriousReview.id,{decision:'violation',violationCode:'privacy_leak',points:20,reason:'人工确认严重违规'})
 await http('POST',`/admin-api/treehole/penalties/${severe.penaltyIds[0]}/decision`,200,{decision:'confirm',tier:3,reason:'人工确认七日限制'},'admin',randomUUID())
 await http('POST',`/admin-api/treehole/penalties/${severe.penaltyIds[0]}/revoke`,200,{reason:'复核证据不成立'},'admin',randomUUID())
 // Durable AI leases: claim races, provider failure, budget and human takeover.
 process.env.TREEHOLE_AI_CHAT_COMPLETIONS_URL='http://127.0.0.1:1/test-only'
 process.env.TREEHOLE_AI_MODEL='integration-only'
 process.env.TREEHOLE_AI_API_KEY='integration-only'
 process.env.TREEHOLE_AI_DAILY_REQUEST_LIMIT='2'
 const ai=await post('风险待审核 AI',12)
 const config=aiConfig()!
 const claims=await Promise.all([claimReview(config),claimReview(config)])
 const claim=claims.find(Boolean)!
 assert.equal(claims.filter(Boolean).length,1)
 await decide(claim.id.toString(),{decision:'approve',reason:'人工接管'})
 assert.equal(await completeClaim(claim,{decision:'violation',violationCode:'minor_insult',points:1,reason:'过期AI不得覆盖',evidenceQuotes:[]}),false)
 assert.equal((await sql('SELECT moderation_status FROM treehole_posts WHERE id=$1',[ai.id]))[0].moderation_status,1)
 const failed=await post('风险待审核 故障',12)
 const failure=await runWorkerCycle(async()=>{throw new Error('synthetic failure')})
 assert.equal(failure.completed,false)
 assert.equal((await reviewFor('post',failed.id)).status,0)
 assert.equal((await claimReview(config)),null)
 await sql("UPDATE treehole_posts SET submitted_at=statement_timestamp()-interval '25 hours',dedupe_window_started_at=statement_timestamp()-interval '25 hours' WHERE id=$1",[failed.id])
 await runWorkerCycle()
 assert.equal((await sql('SELECT moderation_status FROM treehole_posts WHERE id=$1',[failed.id]))[0].moderation_status,3)
 assert.equal((await sql('SELECT count(*)::int AS n FROM treehole_violations WHERE user_id=12'))[0].n,0)
 assert.equal(hit.size,33,`Unexercised: ${contract.operations.filter((o:{operationId:string})=>!hit.has(o.operationId)).map((o:{operationId:string})=>o.operationId)}`)
 console.log(`Treehole integration passed: 001–009 migrations, ${requests} validated HTTP responses, ${hit.size} operations, quotas, replay, governance and worker leases`)
} finally {await app.close()}
