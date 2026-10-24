import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { closeDatabase } from '../database.js'
import { aiConfig, moderate, type AiConfig } from './ai.js'
import { DAY, quotaWindow, type AiResult } from './rules.js'
import { finishReview } from './governance.js'
import { clock, content, lockUsers, query, transaction, type Row } from './store.js'
export async function closeExpiredSubmissions():Promise<number> {
 return transaction(async client=>{
  const candidates=await query(client,`SELECT user_id FROM treehole_posts WHERE published_at IS NULL AND moderation_status=0 AND submitted_at<=clock_timestamp()-interval '24 hours' UNION SELECT user_id FROM treehole_comments WHERE published_at IS NULL AND moderation_status=0 AND submitted_at<=clock_timestamp()-interval '24 hours' LIMIT 100`)
  if(!candidates.length)return 0
  await lockUsers(client,candidates.map(r=>r.user_id))
  const now=await clock(client);let count=0
  for(const kind of ['post','comment'] as const) {
   const closed=await query(client,`UPDATE treehole_${kind==='post'?'posts':'comments'} SET moderation_status=3,updated_at=$2 WHERE user_id=ANY($1::bigint[]) AND published_at IS NULL AND moderation_status=0 AND submitted_at<=$2::timestamptz-interval '24 hours' RETURNING id`,[candidates.map(r=>r.user_id.toString()),now])
   count+=closed.length
   await query(client,`UPDATE treehole_reviews SET status=3,locked_until=NULL,lease_token=NULL,updated_at=$2 WHERE ${kind}_id=ANY($1::bigint[]) AND status IN(0,1) AND source=0`,[closed.map(r=>r.id.toString()),now])
  }
  return count
 })
}
export async function claimReview(config:AiConfig):Promise<Row|null> {
 return transaction(async client=>{
  // Global transaction lock serializes budget reservations across worker processes.
  await query(client,"SELECT pg_advisory_xact_lock(1952998516,1)")
  const now=await clock(client);const {date}=quotaWindow(now)
  const [budget]=await query(client,'SELECT coalesce(sum(budget_attempts),0)::int AS count FROM treehole_reviews WHERE budget_day=$1',[date])
  if(budget!.count>=config.dailyRequestLimit)return null
  const [candidate]=await query(client,`SELECT r.* FROM treehole_reviews r LEFT JOIN treehole_posts p ON p.id=r.post_id LEFT JOIN treehole_comments c ON c.id=r.comment_id WHERE r.reviewer_type=1 AND (r.status=0 OR r.status=1 AND r.locked_until<=$1) AND r.next_attempt_at<=$1 AND r.target_review_version=coalesce(p.review_version,c.review_version) AND r.content_snapshot IS NOT NULL AND coalesce(p.deleted_at,c.deleted_at) IS NULL AND (coalesce(p.published_at,c.published_at) IS NOT NULL OR coalesce(p.submitted_at,c.submitted_at)>$1::timestamptz-interval '24 hours') ORDER BY r.next_attempt_at,r.id FOR UPDATE OF r SKIP LOCKED LIMIT 1`,[now])
  if(!candidate)return null
  const [claimed]=await query(client,`UPDATE treehole_reviews SET status=1,attempt_count=attempt_count+1,budget_attempts=CASE WHEN budget_day=$2 THEN budget_attempts+1 ELSE 1 END,budget_day=$2,lease_token=$3,locked_until=$4,model=$5,updated_at=$6 WHERE id=$1 RETURNING *`,[candidate.id.toString(),date,randomUUID(),new Date(Date.parse(now)+config.timeoutMs+30000).toISOString(),config.model,now])
  return claimed!
 })
}
export async function completeClaim(claim:Row,result:AiResult|null):Promise<boolean> {
 return transaction(async client=>{
  const kind=claim.post_id?'post':'comment';const id=(claim.post_id??claim.comment_id)!
  const initial=await content(client,kind,id)
  if(!initial)return false
  await lockUsers(client,[initial.user_id,initial.op_user_id])
  const c=await content(client,kind,id,true)
  const [r]=await query(client,'SELECT * FROM treehole_reviews WHERE id=$1 FOR UPDATE',[claim.id.toString()])
  const now=await clock(client)
  await query(client,"SELECT set_config('treehole.now',$1,true)",[now])
  if(!r||r.status!==1||r.lease_token!==claim.lease_token||!r.locked_until||Date.parse(r.locked_until)<=Date.parse(now)||c?.review_version!==r.target_review_version)return false
  if(!result) {
   const retryAt=new Date(Date.parse(now)+Math.min(3600000,30000*2**Math.min(r.attempt_count-1,7))).toISOString()
   await query(client,'UPDATE treehole_reviews SET status=0,locked_until=NULL,lease_token=NULL,next_attempt_at=$2,updated_at=$3 WHERE id=$1',[r.id.toString(),retryAt,now]);return false
  }
  await finishReview(client,r,result,now)
  return true
 })
}
export async function runWorkerCycle(adapter=moderate):Promise<{closed:number;claimed:boolean;completed:boolean}> {
 const closed=await closeExpiredSubmissions()
 const config=aiConfig()
 if(!config)return {closed,claimed:false,completed:false}
 const claim=await claimReview(config)
 if(!claim)return {closed,claimed:false,completed:false}
 let result:AiResult|null=null
 try {result=await adapter(claim,config)}catch{/* Provider errors and output never enter logs or a violation record. */}
 return {closed,claimed:true,completed:await completeClaim(claim,result)}
}
async function main() {
 const controller=new AbortController()
 for(const signal of ['SIGTERM','SIGINT'] as const)process.once(signal,()=>controller.abort())
 try {
  while(!controller.signal.aborted) {
   try {const result=await runWorkerCycle();if(result.claimed)continue}catch{process.stderr.write('树洞审核 Worker 数据库操作失败\n')}
   await delay(5000,undefined,{signal:controller.signal}).catch(()=>{})
  }
 } finally {await closeDatabase()}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main()
