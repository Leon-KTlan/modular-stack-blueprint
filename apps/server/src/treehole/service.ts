import { randomBytes, randomInt } from 'node:crypto'
import type { PoolClient } from 'pg'
import type * as Contract from '@cangqiong/api-contracts/treehole'
import { DAY, TreeholeError, fields, hash, invalid, normalizeText, parseId, validateDecision, routeContent } from './rules.js'
import { clock, content, fail, lockUsers, query, quota, transaction, unavailable, visible, type Row } from './store.js'
import { APPEAL_STATUS, PENALTY_STATUS, REASONS, REPORT_STATUS, REVIEW_STATUS, access, adminPenalty, appealView, commentView, evidence, own, page, penaltyDetail, penaltyView, postView, receipt, reportView, reviewDetail, reviewView } from './views.js'
import { activate, audit, finishReview, newReview, remember, replay, revokeAndRecompute, type Operator } from './governance.js'
export interface Input {ids:Record<string,bigint>;page:number;query:Record<string,unknown>;body:Record<string,unknown>;key:string|null}
export type Actor={kind:'miniapp';id:bigint}|{kind:'admin';id:number;role:number;requestId:string}
export interface Result {status:number;body?:unknown}
export async function getAccess(userId:bigint):Promise<Contract.Access> {return transaction(async c=>access(c,userId,await clock(c)),true)}
function need(c:Row|null,kind:'post'|'comment'|'case'):Row { if(!c)fail(kind==='post'?'TREEHOLE_POST_NOT_FOUND':kind==='comment'?'TREEHOLE_COMMENT_NOT_FOUND':'TREEHOLE_CASE_NOT_FOUND',404);return c }
function accessible(c:Row|null,kind:'post'|'comment',now:string,owner?:bigint):Row {
 const r=need(c,kind)
 if(owner!==undefined ? r.user_id!==owner||unavailable(r,now) : !r.visible||!r.parent_visible)fail(kind==='post'?'TREEHOLE_POST_NOT_FOUND':'TREEHOLE_COMMENT_NOT_FOUND',404)
 return r
}
export function validateBody(op:string,value:unknown):Record<string,unknown> {
 if(op==='createTreeholePost') {
  const b=fields(value,['content','ttlHours']);const ttl=b.ttlHours??24
  if(![1,6,12,24].includes(ttl as number)||b.ttlHours===null)invalid('body.ttlHours')
  return {content:normalizeText(b.content,1000),ttlHours:ttl}
 }
 if(op==='createTreeholeComment') {const b=fields(value,['content','replyToCommentId']);return {content:normalizeText(b.content,500),...(b.replyToCommentId===undefined?{}:{replyToCommentId:parseId(b.replyToCommentId,'body.replyToCommentId').toString()})}}
 if(op.startsWith('reportTreehole')) {const b=fields(value,['reason','description']);if(!REASONS.includes(b.reason as Contract.ReportReason))invalid('body.reason');if(b.reason==='other'&&b.description===undefined)invalid('body.description','required');return {reason:b.reason,description:b.description===undefined?null:normalizeText(b.description,500,'body.description')}}
 if(op==='decideAdminReview')return validateDecision(value)
 if(op==='decideAdminReport') {const b=fields(value,['decision','reviewId','reason']);if(!['upheld','dismissed'].includes(String(b.decision)))invalid('body.decision');return {decision:b.decision,reviewId:parseId(b.reviewId,'body.reviewId').toString(),reason:normalizeText(b.reason,1000,'body.reason')}}
 if(op==='decideAdminPenalty') {const b=fields(value,['decision','tier','reason']);if(!['confirm','decline'].includes(String(b.decision)))invalid('body.decision');if(b.decision==='confirm'&&(!Number.isInteger(b.tier)||Number(b.tier)<1||Number(b.tier)>5))invalid('body.tier');if(b.decision==='decline'&&'tier'in b)invalid('body.tier','unknown_field');return {decision:b.decision,...(b.decision==='confirm'?{tier:b.tier}:{}),reason:normalizeText(b.reason,1000,'body.reason')}}
 if(op==='decideAdminAppeal'){const b=fields(value,['decision','reason']);if(!['uphold','reject'].includes(String(b.decision)))invalid('body.decision');return {decision:b.decision,reason:normalizeText(b.reason,1000,'body.reason')}}
 if(op==='createMyTreeholeAppeal'||op==='revokeAdminPenalty'){const b=fields(value,['reason']);return {reason:normalizeText(b.reason,1000,'body.reason')}}
 if(value!==undefined) invalid('body','unknown_field')
 return {}
}
async function participant(c:PoolClient,postId:bigint,userId:bigint) {
 for(let attempt=0;attempt<8;attempt++) {
  await query(c,'INSERT INTO treehole_participants(post_id,user_id,nickname) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[postId.toString(),userId.toString(),`夜航${randomBytes(6).toString('hex')}`])
  if((await query(c,'SELECT id FROM treehole_participants WHERE post_id=$1 AND user_id=$2',[postId.toString(),userId.toString()])).length)return
 }
 throw new Error('Unable to allocate anonymous nickname')
}
async function submit(c:PoolClient,kind:'post'|'comment',input:Input,userId:bigint,now:string):Promise<Result> {
 const table=`treehole_${kind==='post'?'posts':'comments'}`;const body=input.body
 const requestHash=hash(kind==='post'?body:{postId:input.ids.postId!.toString(),...body})
 const [existing]=await query(c,`SELECT id,request_hash FROM ${table} WHERE user_id=$1 AND client_request_id=$2`,[userId.toString(),input.key])
 if(existing) {if(existing.request_hash!==requestHash)fail('IDEMPOTENCY_CONFLICT');return {status:201,body:receipt(need(await content(c,kind,existing.id),kind),now)}}
 if(kind==='comment') {
  accessible(await content(c,'post',input.ids.postId!,true),'post',now)
  if(body.replyToCommentId) {
   const reply=accessible(await content(c,'comment',BigInt(body.replyToCommentId as string),true),'comment',now)
   if(reply.post_id!==input.ids.postId)fail('TREEHOLE_COMMENT_NOT_FOUND',404)
  }
 }
 await quota(c,userId,kind,now)
 const fingerprint=hash({kind,userId:userId.toString(),content:body.content})
 const [batch]=await query(c,`SELECT dedupe_window_started_at FROM ${table} WHERE user_id=$1 AND content_fingerprint=$2 ORDER BY dedupe_window_started_at DESC LIMIT 1`,[userId.toString(),fingerprint])
 const start=batch&&Date.parse(now)<Date.parse(batch.dedupe_window_started_at)+DAY?batch.dedupe_window_started_at:now
 const columns=kind==='post'?'ttl_hours':'post_id,reply_to_comment_id'
 const values=kind==='post'?[body.ttlHours]:[input.ids.postId!.toString(),body.replyToCommentId??null]
 const placeholders=values.map((_,i)=>`$${i+9}`).join(',')
 const [created]=await query(c,`INSERT INTO ${table}(user_id,content,client_request_id,request_hash,content_fingerprint,dedupe_window_started_at,submitted_at,updated_at,${columns}) VALUES($1,$2,$3,$4,$5,$6,$7,$8,${placeholders}) RETURNING id`,[userId.toString(),body.content,input.key,requestHash,fingerprint,start,now,now,...values])
 await participant(c,kind==='post'?created!.id:input.ids.postId!,userId)
 const fresh=need(await content(c,kind,created!.id,true),kind)
 const route=routeContent(body.content as string)
 const review=await newReview(c,fresh,kind,0,route==='rule'?0:1,now)
 if(route==='rule') {
  await finishReview(c,review,{decision:'approve',violationCode:null,points:null,reason:'配置的版本化代码规则检查通过',evidenceQuotes:[]},now)
  const sampleRate=Number(process.env.TREEHOLE_SAMPLE_RATE??0)
  if(sampleRate>0&&sampleRate<=1&&randomInt(1000000)<sampleRate*1000000)await newReview(c,need(await content(c,kind,created!.id,true),kind),kind,1,1,now)
 }
 return {status:201,body:receipt(need(await content(c,kind,created!.id),kind),now)}
}
async function listContents(c:PoolClient,kind:'post'|'comment',mine:boolean,input:Input,userId:bigint,now:string):Promise<Result> {
 const table=`treehole_${kind==='post'?'posts':'comments'}`
 if(!mine&&kind==='comment')accessible(await content(c,'post',input.ids.postId!),'post',now)
 const where=mine?`t.user_id=$1 AND t.deleted_at IS NULL AND t.purged_at IS NULL AND NOT EXISTS(SELECT 1 FROM treehole_penalty_contents h WHERE h.${kind}_id=t.id AND h.released_at IS NULL) ${kind==='post'?`AND (t.expires_at IS NULL OR t.expires_at>current_setting('treehole.now')::timestamptz)`:`AND EXISTS(SELECT 1 FROM treehole_posts p WHERE p.id=t.post_id AND ${visible('p')})`}`:kind==='post'?visible('t'):`t.post_id=$1 AND ${visible('t',true)}`
 const val=mine?userId:kind==='comment'?input.ids.postId!:undefined
 let rows:Row[];let total:number
 if(!mine&&kind==='comment') {
  // Include only ancestors necessary to retain normal replies, at any reply depth.
  const nodes=`WITH RECURSIVE nodes AS (SELECT t.id,t.reply_to_comment_id FROM ${table} t WHERE ${where} UNION SELECT parent.id,parent.reply_to_comment_id FROM ${table} parent JOIN nodes child ON child.reply_to_comment_id=parent.id WHERE parent.post_id=$1 AND parent.published_at IS NOT NULL)`
  total=(await query(c,`${nodes} SELECT count(*)::int AS count FROM nodes`,[val!.toString()]))[0]!.count
  rows=await query(c,`${nodes} SELECT t.id FROM ${table} t JOIN nodes n ON n.id=t.id ORDER BY t.published_at,t.id LIMIT 10 OFFSET $2`,[val!.toString(),(input.page-1)*10])
 } else {
  const values=val===undefined?[]:[val.toString()]
  total=(await query(c,`SELECT count(*)::int AS count FROM ${table} t WHERE ${where}`,values))[0]!.count
  rows=await query(c,`SELECT t.id FROM ${table} t WHERE ${where} ORDER BY ${mine?'t.submitted_at DESC,t.id DESC':'t.published_at DESC,t.id DESC'} LIMIT 10 OFFSET $${values.length+1}`,[...values,(input.page-1)*10])
 }
 const items=await Promise.all(rows.map(async r=>{const row=need(await content(c,kind,r.id),kind);return mine?own(row,now,kind):kind==='post'?postView(c,row,userId):commentView(c,row,userId)}))
 return {status:200,body:page(items,total,input.page)}
}
async function report(c:PoolClient,kind:'post'|'comment',input:Input,userId:bigint,now:string):Promise<Result> {
 const id=input.ids[kind==='post'?'postId':'commentId']!
 const target=accessible(await content(c,kind,id,true),kind,now)
 const [old]=await query(c,`SELECT * FROM treehole_reports WHERE reporter_user_id=$1 AND ${kind}_id=$2`,[userId.toString(),id.toString()])
 if(old)return {status:200,body:{id:old.id.toString(),status:REPORT_STATUS[old.status]!,createdAt:old.created_at}}
 let [review]=await query(c,`SELECT * FROM treehole_reviews WHERE ${kind}_id=$1 AND status IN(0,1) AND target_review_version=$2`,[id.toString(),target.review_version])
 if(!review)review=await newReview(c,target,kind,2,1,now)
 const [r]=await query(c,`INSERT INTO treehole_reports(reporter_user_id,${kind}_id,reason,description,review_id,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$6) RETURNING *`,[userId.toString(),id.toString(),REASONS.indexOf(input.body.reason as Contract.ReportReason),input.body.description,review.id.toString(),now])
 return {status:201,body:{id:r!.id.toString(),status:'pending',createdAt:r!.created_at}}
}
async function createAppeal(c:PoolClient,input:Input,userId:bigint,now:string):Promise<Result> {
 const penalty=need((await query(c,'SELECT * FROM treehole_penalties WHERE id=$1 AND user_id=$2 AND notified_at IS NOT NULL FOR UPDATE',[input.ids.penaltyId!.toString(),userId.toString()]))[0]??null,'case')
 const requestHash=hash({penaltyId:penalty.id.toString(),reason:input.body.reason})
 const [existing]=await query(c,'SELECT * FROM treehole_appeals WHERE user_id=$1 AND client_request_id=$2',[userId.toString(),input.key])
 if(existing){if(existing.request_hash!==requestHash)fail('IDEMPOTENCY_CONFLICT');return {status:201,body:appealView(existing,now)}}
 if(penalty.status===3)fail('TREEHOLE_APPEAL_NOT_ALLOWED')
 if(Date.parse(now)>=Date.parse(penalty.notified_at!)+30*DAY)fail('TREEHOLE_APPEAL_WINDOW_CLOSED')
 if((await query(c,'SELECT id FROM treehole_appeals WHERE penalty_id=$1 AND status=0',[penalty.id.toString()])).length)fail('TREEHOLE_APPEAL_PENDING')
 if((await query(c,'SELECT id FROM treehole_appeals WHERE penalty_id=$1 AND reason=$2',[penalty.id.toString(),input.body.reason])).length)fail('TREEHOLE_APPEAL_NOT_ALLOWED')
 const [appeal]=await query(c,'INSERT INTO treehole_appeals(penalty_id,user_id,reason,client_request_id,request_hash,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$6) RETURNING *',[penalty.id.toString(),userId.toString(),input.body.reason,input.key,requestHash,now])
 return {status:201,body:appealView(appeal!,now)}
}
async function adminDetail(c:PoolClient,kind:string,r:Row,now:string):Promise<unknown> {
 if(kind==='reviews')return reviewDetail(c,r,now)
 if(kind==='reports'){const review=r.review_id?(await query(c,'SELECT * FROM treehole_reviews WHERE id=$1',[r.review_id.toString()]))[0]:null;return {...await reportView(c,r,now),decisionReason:r.decision_reason,review:review?await reviewDetail(c,review,now):null}}
 if(kind==='penalties')return penaltyDetail(c,r,now)
 const p=need((await query(c,'SELECT * FROM treehole_penalties WHERE id=$1',[r.penalty_id.toString()]))[0]??null,'case')
 return {...appealView(r,now),penalty:await penaltyDetail(c,p,now)}
}
async function adminAction(c:PoolClient,op:string,kind:string,r:Row,input:Input,actor:Operator,now:string):Promise<Result> {
 const isRevoke=op==='revokeAdminPenalty';const requestHash=hash(input.body);const old=replay(r,input.key!,requestHash,isRevoke)
 if(old!==undefined)return {status:200,body:old}
 const b=input.body;let result:unknown
 if(kind==='reviews') {
  if(r.status>=2)fail('TREEHOLE_CASE_ALREADY_RESOLVED')
  const d=b as Contract.ReviewDecision
  const finished=await finishReview(c,r,{decision:d.decision,violationCode:d.decision==='violation'?d.violationCode:null,points:d.decision==='violation'?d.points:null,reason:d.reason,evidenceQuotes:[]},now,actor)
  result={id:r.id.toString(),status:'completed',decision:d.decision,violationId:finished.violationId?.toString()??null,penaltyIds:finished.penaltyIds.map(id=>id.toString()),decidedAt:now}
 } else if(kind==='reports') {
  if(r.status!==0)fail('TREEHOLE_CASE_ALREADY_RESOLVED')
  const review=need((await query(c,'SELECT * FROM treehole_reviews WHERE id=$1',[b.reviewId]))[0]??null,'case')
  const target=need(await content(c,r.post_id?'post':'comment',(r.post_id??r.comment_id)!),'case')
  if(review.status!==2||review.decision==null||review.decision===2||review.post_id!==r.post_id||review.comment_id!==r.comment_id||review.target_review_version!==target.review_version||review.decision!==(b.decision==='upheld'?1:0))fail('TREEHOLE_CASE_NOT_ACTIONABLE')
  await query(c,'UPDATE treehole_reports SET status=$2,review_id=$3,decision_reason=$4,operator_id=$5,resolved_at=$6 WHERE id=$1',[r.id.toString(),b.decision==='upheld'?1:2,b.reviewId,b.reason,actor.id,now])
  result={id:r.id.toString(),status:b.decision,reviewId:b.reviewId,decidedAt:now}
 } else if(kind==='penalties'&&isRevoke) {
  await revokeAndRecompute(c,r,b.reason as string,actor,now)
  result={id:r.id.toString(),status:'revoked',decidedAt:now,recomputed:true}
 } else if(kind==='penalties') {
  if(r.status!==0)fail('TREEHOLE_CASE_ALREADY_RESOLVED')
  if(b.decision==='confirm') {
   const p=await activate(c,r,b.tier as number,b.reason as string,actor.id,now)
   result={id:r.id.toString(),status:'active',tier:p.tier,startsAt:p.starts_at,endsAt:p.ends_at,decidedAt:now}
  } else {
   await query(c,'UPDATE treehole_penalties SET status=5,reason=$2,operator_id=$3 WHERE id=$1',[r.id.toString(),b.reason,actor.id])
   result={id:r.id.toString(),status:'declined',tier:r.tier,startsAt:null,endsAt:null,decidedAt:now}
  }
 } else {
  if(r.status!==0)fail('TREEHOLE_CASE_ALREADY_RESOLVED')
  if(b.decision==='uphold') {
   const p=need((await query(c,'SELECT * FROM treehole_penalties WHERE id=$1 FOR UPDATE',[r.penalty_id.toString()]))[0]??null,'case')
   await revokeAndRecompute(c,p,b.reason as string,actor,now)
  }
  await query(c,'UPDATE treehole_appeals SET status=$2,decision_reason=$3,operator_id=$4,resolved_at=$5 WHERE id=$1',[r.id.toString(),b.decision==='uphold'?1:2,b.reason,actor.id,now])
  result={id:r.id.toString(),penaltyId:r.penalty_id.toString(),status:b.decision==='uphold'?'upheld':'rejected',decidedAt:now,recomputed:b.decision==='uphold'}
 }
 await remember(c,`treehole_${kind}`,r.id,input.key!,requestHash,result,now,isRevoke)
 if(kind!=='reviews')await audit(c,actor,kind.replace(/s$/,''),r.id,isRevoke?'revoke':'decision')
 return {status:200,body:result}
}
export async function execute(op:string,input:Input,actor:Actor):Promise<Result> {
 const write=!op.startsWith('list')&&!op.startsWith('get')
 return transaction(async c=>{
  // Resolve owner IDs without taking case locks; all mutations then acquire user locks in ascending order.
  if(write) {
   const ids:bigint[]=actor.kind==='miniapp'?[actor.id]:[]
   const adminKind=op.includes('Review')?'reviews':op.includes('Report')?'reports':op.includes('Penalty')?'penalties':'appeals'
   if(actor.kind==='admin') {
    const caseId=Object.values(input.ids)[0]!
    const [r]=await query(c,adminKind==='reviews'||adminKind==='reports'?`SELECT coalesce(p.user_id,cc.user_id) AS user_id FROM treehole_${adminKind} r LEFT JOIN treehole_posts p ON p.id=r.post_id LEFT JOIN treehole_comments cc ON cc.id=r.comment_id WHERE r.id=$1`:`SELECT user_id FROM treehole_${adminKind} WHERE id=$1`,[caseId.toString()])
    if(r)ids.push(r.user_id)
   } else if(input.ids.postId) {
    const [p]=await query(c,'SELECT user_id FROM treehole_posts WHERE id=$1',[input.ids.postId.toString()]);if(p)ids.push(p.user_id)
   } else if(input.ids.commentId) {
    const [cc]=await query(c,'SELECT c.user_id,p.user_id AS op_user_id FROM treehole_comments c JOIN treehole_posts p ON p.id=c.post_id WHERE c.id=$1',[input.ids.commentId.toString()]);if(cc)ids.push(cc.user_id,cc.op_user_id)
   }
   await lockUsers(c,ids)
  }
  const now=await clock(c)
  await query(c,"SELECT set_config('treehole.now',$1,true)",[now])
  if(actor.kind==='miniapp') {
   const userId=actor.id
   if(!op.includes('My')) {const a=await access(c,userId,now);if(!a.canEnter)throw new TreeholeError(403,'TREEHOLE_RESTRICTED','当前暂时无法进入树洞',a.restriction)}
   if(op==='getMyTreeholeAccess')return {status:200,body:await access(c,userId,now)}
   if(op==='createTreeholePost'||op==='createTreeholeComment')return submit(c,op==='createTreeholePost'?'post':'comment',input,userId,now)
   if(op.startsWith('reportTreehole'))return report(c,op.endsWith('Post')?'post':'comment',input,userId,now)
   if(op==='listTreeholePosts'||op==='listTreeholeComments'||op==='listMyPosts'||op==='listMyComments')return listContents(c,op.endsWith('Posts')?'post':'comment',op.includes('My'),input,userId,now)
   if(op==='getTreeholePost')return {status:200,body:await postView(c,accessible(await content(c,'post',input.ids.postId!),'post',now),userId)}
   if(op==='getMyPost'||op==='getMyComment') {const kind=op==='getMyPost'?'post':'comment';return {status:200,body:own(accessible(await content(c,kind,input.ids[kind==='post'?'postId':'commentId']!),kind,now,userId),now,kind)}}
   if(op==='deleteMyPost'||op==='deleteMyComment') {
    const kind=op==='deleteMyPost'?'post':'comment';const id=input.ids[kind==='post'?'postId':'commentId']!;const r=need(await content(c,kind,id,true),kind)
    if(r.user_id!==userId)fail(kind==='post'?'TREEHOLE_POST_NOT_FOUND':'TREEHOLE_COMMENT_NOT_FOUND',404)
    await query(c,`UPDATE treehole_${kind==='post'?'posts':'comments'} SET deleted_at=coalesce(deleted_at,$2),updated_at=$2 WHERE id=$1`,[id.toString(),now]);return {status:204}
   }
   if(op==='likeTreeholePost'||op==='unlikeTreeholePost') {
    accessible(await content(c,'post',input.ids.postId!,true),'post',now)
    if(op==='likeTreeholePost')await query(c,'INSERT INTO treehole_post_likes(post_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[input.ids.postId!.toString(),userId.toString()])
    else await query(c,'DELETE FROM treehole_post_likes WHERE post_id=$1 AND user_id=$2',[input.ids.postId!.toString(),userId.toString()])
    const [count]=await query(c,'SELECT count(*)::int AS count FROM treehole_post_likes WHERE post_id=$1',[input.ids.postId!.toString()])
    return {status:200,body:{liked:op==='likeTreeholePost',likeCount:count!.count}}
   }
   if(op==='createMyTreeholeAppeal')return createAppeal(c,input,userId,now)
   if(op==='getMyTreeholePenalty') {
    const p=need((await query(c,'SELECT * FROM treehole_penalties WHERE id=$1 AND user_id=$2 AND notified_at IS NOT NULL',[input.ids.penaltyId!.toString(),userId.toString()]))[0]??null,'case')
    return {status:200,body:{...await penaltyView(c,p,now),evidence:await evidence(c,p)}}
   }
   const kind=op==='listMyTreeholePenalties'?'penalties':'appeals'
   const where=`user_id=$1 ${kind==='penalties'?'AND notified_at IS NOT NULL':''}`
   const total=(await query(c,`SELECT count(*)::int AS count FROM treehole_${kind} WHERE ${where}`,[userId.toString()]))[0]!.count
   const rows=await query(c,`SELECT * FROM treehole_${kind} WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT 10 OFFSET $2`,[userId.toString(),(input.page-1)*10])
   const items=await Promise.all(rows.map(r=>kind==='penalties'?penaltyView(c,r,now):appealView(r,now)))
   return {status:200,body:page(items,total,input.page)}
  }
  const kind=op.includes('Review')?'reviews':op.includes('Report')?'reports':op.includes('Penalt')?'penalties':'appeals'
  if(op.startsWith('list')) {
   const statuses=kind==='reviews'?REVIEW_STATUS:kind==='reports'?REPORT_STATUS:kind==='penalties'?PENALTY_STATUS:APPEAL_STATUS
   const conditions:string[]=[];const values:unknown[]=[]
   if(input.query.status!==undefined){
    if(kind==='penalties'&&input.query.status==='active')conditions.push(`status=1 AND (ends_at IS NULL OR ends_at>current_setting('treehole.now')::timestamptz)`)
    else if(kind==='penalties'&&input.query.status==='ended')conditions.push(`(status=2 OR status=1 AND ends_at<=current_setting('treehole.now')::timestamptz)`)
    else {values.push(statuses.indexOf(input.query.status as never));conditions.push(`status=$${values.length}`)}
   }
   if(input.query.reviewerType!==undefined){values.push(['rule','ai','human'].indexOf(input.query.reviewerType as string));conditions.push(`reviewer_type=$${values.length}`)}
   const order=kind==='appeals'?`(status=0 AND created_at<=current_setting('treehole.now')::timestamptz-interval '72 hours') DESC,created_at,id`:'created_at,id'
   const where=conditions.length?'WHERE '+conditions.join(' AND '):''
   const total=(await query(c,`SELECT count(*)::int AS count FROM treehole_${kind} ${where}`,values))[0]!.count
   const rows=await query(c,`SELECT * FROM treehole_${kind} ${where} ORDER BY ${order} LIMIT 10 OFFSET $${values.length+1}`,[...values,(input.page-1)*10])
   const items=await Promise.all(rows.map(r=>kind==='reviews'?reviewView(c,r,now):kind==='reports'?reportView(c,r,now):kind==='penalties'?adminPenalty(r,now):appealView(r,now)))
   return {status:200,body:page(items,total,input.page)}
  }
  const id=Object.values(input.ids)[0]!
  const r=need((await query(c,`SELECT * FROM treehole_${kind} WHERE id=$1 ${write?'FOR UPDATE':''}`,[id.toString()]))[0]??null,'case')
  if(!write)return {status:200,body:await adminDetail(c,kind,r,now)}
  return adminAction(c,op,kind,r,input,actor,now)
 },!write)
}
