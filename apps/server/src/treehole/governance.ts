import type { PoolClient } from 'pg'
import type * as Contract from '@cangqiong/api-contracts/treehole'
import { DAY, RULE_VERSION, correctedTimeline, endsAt, scoreCycleStart, tierForScore, type AiResult } from './rules.js'
import { access } from './views.js'
import { content, fail, query, unavailable, type Row, type Json } from './store.js'
export interface Operator {id:number;role:number;requestId:string}
export async function audit(client:PoolClient,operator:Operator,kind:string,id:bigint,action:string):Promise<void> {
 // Decision reasons and content stay in the access-controlled case, never in audit logs.
 await query(client,'INSERT INTO audit_logs(operator_id,operator_role,action,resource_type,resource_id,reason,request_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[operator.id,operator.role,`treehole.${kind}.${action}`,`treehole_${kind}`,id.toString(),'树洞案件管理决定',operator.requestId])
}
export async function newReview(client:PoolClient,c:Row,kind:'post'|'comment',source:number,reviewer:number,now:string):Promise<Row> {
 const target=`${kind}_id`;const table=`treehole_${kind==='post'?'posts':'comments'}`
 const [previous]=await query(client,`SELECT * FROM treehole_reviews WHERE ${target}=$1 ORDER BY target_review_version DESC LIMIT 1`,[c.id.toString()])
 if(previous&&previous.status<2)await query(client,'UPDATE treehole_reviews SET status=3,locked_until=NULL,lease_token=NULL,updated_at=$2 WHERE id=$1',[previous.id.toString(),now])
 const version=c.review_version+1
 await query(client,`UPDATE ${table} SET review_version=$2,moderation_status=CASE WHEN moderation_status=3 THEN 3 ELSE 0 END,updated_at=$3 WHERE id=$1`,[c.id.toString(),version,now])
 const context:Contract.ContextItem[]=[]
 if(kind==='comment') {
  const p=await content(client,'post',c.post_id!)
  if(p?.visible)context.push({target:{type:'post',id:p.id.toString(),postId:p.id.toString(),availability:'published'},content:p.content})
  if(c.reply_to_comment_id) {
   const reply=await content(client,'comment',c.reply_to_comment_id)
   if(reply?.visible&&reply.parent_visible)context.push({target:{type:'comment',id:reply.id.toString(),postId:c.post_id!.toString(),availability:'published'},content:reply.content})
  }
 }
 const [r]=await query(client,`INSERT INTO treehole_reviews(${target},previous_review_id,target_review_version,source,reviewer_type,rule_version,content_snapshot,context_snapshot,dedupe_key,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$10) RETURNING *`,[c.id.toString(),previous?.id.toString()??null,version,source,reviewer,process.env.TREEHOLE_RULE_VERSION||RULE_VERSION,c.content,JSON.stringify(context),`${kind}:${c.id}:v${version}`,now])
 return r!
}
export async function hideContents(client:PoolClient,penaltyId:bigint,userId:bigint,now:string):Promise<void> {
 for(const kind of ['post','comment'] as const)await query(client,`INSERT INTO treehole_penalty_contents(penalty_id,${kind}_id,hidden_at) SELECT $1,id,$3 FROM treehole_${kind==='post'?'posts':'comments'} WHERE user_id=$2 ON CONFLICT DO NOTHING`,[penaltyId.toString(),userId.toString(),now])
}
export async function activate(client:PoolClient,p:Row,tier:number,reason:string,operator:number|null,now:string):Promise<Row> {
 let basis=p.basis
 if(operator&&p.basis===0) {
  const [review]=await query(client,'SELECT violation_code FROM treehole_reviews WHERE id=$1',[p.review_id?.toString()??null])
  if(tier>p.tier||review&&['privacy_leak','threat','substantiated_defamation'].includes(review.violation_code))basis=1
 }
 // Only accumulated upgrades replace prior accumulated/provisional restrictions; independent severity cases remain.
 const prior=await query(client,'SELECT * FROM treehole_penalties WHERE user_id=$1 AND status=1 AND basis IN(0,2) AND tier<=$2 AND id<>$3 ORDER BY tier DESC,id DESC',[p.user_id.toString(),tier,p.id.toString()])
 if(basis===0)await query(client,'UPDATE treehole_penalties SET status=4,updated_at=$2 WHERE id=ANY($1::bigint[])',[prior.map(x=>x.id.toString()),now])
 let supersedes=basis===0?prior[0]?.id.toString()??null:null
 if(operator&&p.review_id) {
  const provisional=await query(client,`UPDATE treehole_penalties old SET status=4,updated_at=$2 FROM treehole_reviews r,treehole_reviews current WHERE old.review_id=r.id AND current.id=$1 AND old.basis=2 AND old.status IN(1,2) AND (r.post_id=current.post_id OR r.comment_id=current.comment_id) RETURNING old.id`,[p.review_id.toString(),now])
  await query(client,'INSERT INTO treehole_penalty_contents(penalty_id,post_id,comment_id,hidden_at) SELECT $2,post_id,comment_id,hidden_at FROM treehole_penalty_contents WHERE penalty_id=ANY($1::bigint[]) ON CONFLICT DO NOTHING',[provisional.map(p=>p.id.toString()),p.id.toString()])
  await query(client,'UPDATE treehole_penalty_contents SET released_at=$2 WHERE penalty_id=ANY($1::bigint[]) AND released_at IS NULL',[provisional.map(p=>p.id.toString()),now])
  if(basis===1)supersedes=provisional[0]?.id.toString()??null
 }
 const [updated]=await query(client,'UPDATE treehole_penalties SET tier=$2,status=$3,reason=$4,operator_id=$5,starts_at=$6,ends_at=$7,notified_at=$6,supersedes_penalty_id=$8,basis=$9,updated_at=$6 WHERE id=$1 RETURNING *',[p.id.toString(),tier,tier===0?2:1,reason,operator,now,endsAt(tier,now),supersedes,basis])
 if(tier>0)await hideContents(client,p.id,p.user_id,now)
 if(basis===0)await query(client,'UPDATE treehole_user_states SET last_enforced_tier=greatest(last_enforced_tier,$2),updated_at=$3 WHERE user_id=$1',[p.user_id.toString(),tier,now])
 return updated!
}
async function score(client:PoolClient,userId:bigint,now:string):Promise<number> {
 const [r]=await query(client,"SELECT coalesce(sum(points),0)::int AS score FROM treehole_violations WHERE user_id=$1 AND revoked_at IS NULL AND confirmed_at>$2::timestamptz-interval '90 days' AND confirmed_at<=$2",[userId.toString(),now]);return r!.score
}
export async function enforce(client:PoolClient,userId:bigint,violationId:bigint,reviewId:bigint,now:string,priorScore:number):Promise<bigint[]> {
 const total=await score(client,userId,now)
 const [state]=await query(client,'SELECT * FROM treehole_user_states WHERE user_id=$1',[userId.toString()])
 const highest=priorScore===0?-1:state!.last_enforced_tier
 if(priorScore===0)await query(client,'UPDATE treehole_user_states SET last_enforced_tier=-1,updated_at=$2 WHERE user_id=$1',[userId.toString(),now])
 const tier=tierForScore(total)
 if(tier<=highest)return []
 if(tier===5) {
  const events=await query(client,'SELECT confirmed_at FROM treehole_violations WHERE user_id=$1 AND revoked_at IS NULL AND confirmed_at<=$2 ORDER BY confirmed_at,id',[userId.toString(),now])
  const cycleStart=scoreCycleStart(events.map(v=>v.confirmed_at),now)
  // Human review of a permanent threshold is a separate dedupe fact, never an executed tier.
  if(cycleStart&&(await query(client,'SELECT p.id FROM treehole_penalties p JOIN treehole_violations v ON v.id=p.trigger_violation_id AND v.revoked_at IS NULL WHERE p.user_id=$1 AND p.basis IN(0,1) AND p.score_snapshot>=40 AND p.decision_request_id IS NOT NULL AND p.status NOT IN(0,3) AND p.created_at>=$2 LIMIT 1',[userId.toString(),cycleStart])).length)return []
 }
 if((await query(client,'SELECT id FROM treehole_penalties WHERE user_id=$1 AND basis=0 AND status=0 AND tier>=$2',[userId.toString(),tier])).length)return []
 const [p]=await query(client,'INSERT INTO treehole_penalties(user_id,trigger_violation_id,review_id,tier,status,basis,score_snapshot,rule_version,reason) VALUES($1,$2,$3,$4,0,0,$5,$6,$7) RETURNING *',[userId.toString(),violationId.toString(),reviewId.toString(),tier,total,RULE_VERSION,'经审核确认违反树洞交流规则'])
 if(tier<=2)await activate(client,p!,tier,p!.reason,null,now)
 return [p!.id]
}
export async function finishReview(client:PoolClient,r:Row,result:AiResult,now:string,operator?:Operator):Promise<{violationId:bigint|null;penaltyIds:bigint[]}> {
 const kind=r.post_id?'post':'comment';const id=(r.post_id??r.comment_id)!
 const c=await content(client,kind,id,true)
 if(!c||c.review_version!==r.target_review_version||r.status>=2)fail('TREEHOLE_CASE_NOT_ACTIONABLE')
 if(!r.content_snapshot)fail('TREEHOLE_CASE_NOT_ACTIONABLE')
 let violationId:bigint|null=null;let penaltyIds:bigint[]=[]
 const priorScore=await score(client,c.user_id,now)
 const decision=result.decision==='approve'?0:result.decision==='violation'?1:2
 await query(client,'UPDATE treehole_reviews SET status=2,decision=$2,violation_code=$3,points=$4,reason=$5,evidence_quotes=$6::jsonb,reviewer_type=CASE WHEN $7::integer IS NULL THEN reviewer_type ELSE 2 END,operator_id=$7,completed_at=$8,locked_until=NULL,lease_token=NULL,updated_at=$8 WHERE id=$1',[r.id.toString(),decision,result.violationCode,result.points,result.reason,JSON.stringify(result.evidenceQuotes),operator?.id??null,now])
 if(decision===1) {
  const [v]=await query(client,`INSERT INTO treehole_violations(user_id,${kind}_id,review_id,violation_code,points,rule_version,dedupe_fingerprint,dedupe_window_started_at,confirmed_at,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$9) ON CONFLICT(user_id,dedupe_fingerprint,dedupe_window_started_at) DO UPDATE SET points=greatest(treehole_violations.points,excluded.points),violation_code=CASE WHEN excluded.points>treehole_violations.points THEN excluded.violation_code ELSE treehole_violations.violation_code END,revoked_at=NULL,revoke_reason=NULL,updated_at=excluded.updated_at RETURNING *`,[c.user_id.toString(),c.id.toString(),r.id.toString(),result.violationCode,result.points,r.rule_version,c.content_fingerprint,c.dedupe_window_started_at,now])
  violationId=v!.id
  await query(client,'UPDATE treehole_reviews SET counted_violation_id=$2 WHERE id=$1',[r.id.toString(),violationId.toString()])
  penaltyIds=await enforce(client,c.user_id,violationId,r.id,now,priorScore)
 }
 const table=`treehole_${kind==='post'?'posts':'comments'}`
 if(decision===0) {
  // A human reversal invalidates only severity/provisional restrictions from this content chain.
  if(operator) {
   const invalid=await query(client,`UPDATE treehole_penalties p SET status=CASE WHEN p.status=0 THEN 5 ELSE 3 END,revoked_at=CASE WHEN p.status=0 THEN NULL ELSE $2::timestamptz END,revoke_reason=$3,revoke_operator_id=$4,updated_at=$2 FROM treehole_reviews old WHERE old.id=p.review_id AND old.${kind}_id=$1 AND p.basis IN(1,2) AND p.status IN(0,1,2,4) RETURNING p.id`,[id.toString(),now,result.reason,operator.id])
   await query(client,'UPDATE treehole_penalty_contents SET released_at=$2 WHERE penalty_id=ANY($1::bigint[]) AND released_at IS NULL',[invalid.map(p=>p.id.toString()),now])
   // Refresh visibility flags after releasing the same-case hiding associations.
   Object.assign(c,(await content(client,kind,id,true))!)
  }
  const a=await access(client,c.user_id,now)
  const canPublish=!unavailable(c,now)&&a.canEnter&&c.moderation_status!==3&&(!!c.published_at||Date.parse(now)<Date.parse(c.submitted_at)+DAY)
  if(canPublish) await query(client,`UPDATE ${table} SET moderation_status=1,published_at=coalesce(published_at,$2)${kind==='post'?',expires_at=coalesce(expires_at,$2::timestamptz+ttl_hours*interval \'1 hour\')':''},updated_at=$2 WHERE id=$1`,[id.toString(),now])
  else if(!c.published_at&&Date.parse(now)>=Date.parse(c.submitted_at)+DAY)await query(client,`UPDATE ${table} SET moderation_status=3,updated_at=$2 WHERE id=$1`,[id.toString(),now])
  else await query(client,`UPDATE ${table} SET moderation_status=1,updated_at=$2 WHERE id=$1`,[id.toString(),now])
 } else if(decision===1)await query(client,`UPDATE ${table} SET moderation_status=2,updated_at=$2 WHERE id=$1`,[id.toString(),now])
 else {
  const current=await content(client,kind,id,true)
  const next=await newReview(client,current!,kind,r.source,2,now)
  await query(client,`UPDATE treehole_reports SET review_id=$2,updated_at=$3 WHERE ${kind}_id=$1 AND status=0`,[id.toString(),next.id.toString(),now])
  if(result.violationCode&&['privacy_leak','threat'].includes(result.violationCode)) {
   // One provisional case per content chain; never roll its expiry forward on retries.
   const [prior]=await query(client,`SELECT p.id FROM treehole_penalties p JOIN treehole_reviews r ON r.id=p.review_id WHERE p.user_id=$1 AND p.basis=2 AND r.${kind}_id=$2 LIMIT 1`,[c.user_id.toString(),id.toString()])
   if(!prior) {
    const [p]=await query(client,'INSERT INTO treehole_penalties(user_id,review_id,tier,status,basis,score_snapshot,rule_version,reason,starts_at,ends_at,notified_at) VALUES($1,$2,2,1,2,$3,$4,$5,$6,$7,$6) RETURNING *',[c.user_id.toString(),next.id.toString(),priorScore,RULE_VERSION,'内容涉及较高风险，正在等待人工复核',now,endsAt(2,now)])
    await hideContents(client,p!.id,c.user_id,now);penaltyIds.push(p!.id)
   }
  }
 }
 if(decision===1&&operator&&['privacy_leak','threat','substantiated_defamation'].includes(result.violationCode??'')&&!(await query(client,'SELECT id FROM treehole_penalties WHERE id=ANY($1::bigint[]) AND status=0',[penaltyIds.map(id=>id.toString())])).length) {
  const [candidate]=await query(client,'INSERT INTO treehole_penalties(user_id,review_id,trigger_violation_id,tier,status,basis,score_snapshot,rule_version,reason,operator_id) VALUES($1,$2,$3,3,0,1,$4,$5,$6,$7) RETURNING id',[c.user_id.toString(),r.id.toString(),violationId!.toString(),await score(client,c.user_id,now),r.rule_version,result.reason,operator.id])
  penaltyIds.push(candidate!.id)
 }
 if(operator)await audit(client,operator,'review',r.id,'decision')
 return {violationId,penaltyIds}
}
export function replay(r:Row,requestId:string,requestHash:string,revoke=false):Json|undefined {
 const k=revoke?r.revoke_request_id:r.decision_request_id
 if(k!==requestId)return undefined
 if((revoke?r.revoke_request_hash:r.decision_request_hash)!==requestHash)fail('IDEMPOTENCY_CONFLICT')
 return (revoke?r.revoke_result:r.decision_result)!
}
export async function remember(client:PoolClient,table:string,id:bigint,key:string,hash:string,result:unknown,now:string,revoke=false):Promise<void> {
 const p=revoke?'revoke':'decision'
 await query(client,`UPDATE ${table} SET ${p}_request_id=$2,${p}_request_hash=$3,${p}_result=$4::jsonb,updated_at=$5 WHERE id=$1`,[id.toString(),key,hash,JSON.stringify(result),now])
}
export async function revokeAndRecompute(client:PoolClient,p:Row,reason:string,operator:Operator,now:string):Promise<void> {
 if(p.status===3||p.status===5)fail('TREEHOLE_CASE_ALREADY_RESOLVED')
 if(p.status===0)fail('TREEHOLE_CASE_NOT_ACTIONABLE')
 // Correct the content through a new immutable review round; preserve all old findings.
 if(p.review_id) {
  const [old]=await query(client,'SELECT * FROM treehole_reviews WHERE id=$1',[p.review_id.toString()])
  if(old) {
   const kind=old.post_id?'post':'comment';const c=await content(client,kind,(old.post_id??old.comment_id)!,true)
   if(!c||!old.content_snapshot)fail('TREEHOLE_CASE_NOT_ACTIONABLE')
   const next=await newReview(client,c,kind,3,2,now)
   await finishReview(client,next,{decision:'approve',violationCode:null,points:null,reason,evidenceQuotes:[]},now,operator)
  }
 }
 await query(client,'UPDATE treehole_penalties SET status=3,revoked_at=$2,revoke_reason=$3,revoke_operator_id=$4,updated_at=$2 WHERE id=$1',[p.id.toString(),now,reason,operator.id])
 await query(client,'UPDATE treehole_penalty_contents SET released_at=$2 WHERE penalty_id=$1 AND released_at IS NULL',[p.id.toString(),now])
 const violations=await query(client,'SELECT * FROM treehole_violations WHERE user_id=$1 ORDER BY confirmed_at,id',[p.user_id.toString()])
 for(const v of violations) {
  const [best]=await query(client,`SELECT r.* FROM treehole_reviews r LEFT JOIN treehole_posts p ON p.id=r.post_id LEFT JOIN treehole_comments c ON c.id=r.comment_id WHERE r.counted_violation_id=$1 AND r.status=2 AND r.decision=1 AND r.target_review_version=coalesce(p.review_version,c.review_version) ORDER BY r.points DESC,r.id LIMIT 1`,[v.id.toString()])
  if(best)await query(client,'UPDATE treehole_violations SET points=$2,violation_code=$3,revoked_at=NULL,revoke_reason=NULL,updated_at=$4 WHERE id=$1',[v.id.toString(),best.points,best.violation_code,now])
  else await query(client,'UPDATE treehole_violations SET revoked_at=coalesce(revoked_at,$2),revoke_reason=$3,updated_at=$2 WHERE id=$1',[v.id.toString(),now,reason])
 }
 const valid=await query(client,'SELECT * FROM treehole_violations WHERE user_id=$1 AND revoked_at IS NULL ORDER BY confirmed_at,id',[p.user_id.toString()])
 const penalties=await query(client,'SELECT * FROM treehole_penalties WHERE user_id=$1 AND basis=0 AND status IN(1,2,4) AND starts_at IS NOT NULL ORDER BY starts_at,id',[p.user_id.toString()])
 const timeline=correctedTimeline(valid.map(v=>({id:v.id,points:v.points,confirmedAt:v.confirmed_at})),penalties.map(p=>({id:p.id,tier:p.tier,startsAt:p.starts_at!})),now)
 for(const original of penalties) {
  const start=original.starts_at!
  const prior=valid.filter(v=>Date.parse(v.confirmed_at)<=Date.parse(start)&&Date.parse(v.confirmed_at)>Date.parse(start)-90*DAY)
  const total=prior.reduce((sum,v)=>sum+v.points,0)
  const effective=timeline.penalties.find(p=>p.id===original.id)!.tier
  if(effective===original.tier)continue
  await query(client,'UPDATE treehole_penalties SET status=3,revoked_at=$2,revoke_reason=$3,revoke_operator_id=$4,updated_at=$2 WHERE id=$1',[original.id.toString(),now,reason,operator.id])
  await query(client,'UPDATE treehole_penalty_contents SET released_at=$2 WHERE penalty_id=$1 AND released_at IS NULL',[original.id.toString(),now])
  if(effective<0||!original.starts_at)continue
  const end=endsAt(effective,start)
  const [replacement]=await query(client,'INSERT INTO treehole_penalties(user_id,trigger_violation_id,review_id,tier,status,basis,score_snapshot,rule_version,reason,starts_at,ends_at,notified_at,operator_id,supersedes_penalty_id) VALUES($1,$2,$3,$4,$5,0,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *',[p.user_id.toString(),original.trigger_violation_id?.toString()??null,original.review_id?.toString()??null,effective,effective===0||end&&Date.parse(end)<=Date.parse(now)?2:1,total,original.rule_version,'复核后调整处罚',start,end,original.notified_at,operator.id,original.id.toString()])
  if(effective>0)await query(client,'INSERT INTO treehole_penalty_contents(penalty_id,post_id,comment_id,hidden_at) SELECT $2,post_id,comment_id,hidden_at FROM treehole_penalty_contents WHERE penalty_id=$1',[original.id.toString(),replacement!.id.toString()])
 }
 // Pending candidates have no executed threshold. Recreate them after correcting their score basis.
 const pending=await query(client,'SELECT * FROM treehole_penalties WHERE user_id=$1 AND basis=0 AND status=0',[p.user_id.toString()])
 const total=await score(client,p.user_id,now)
 for(const candidate of pending) {
  if(candidate.score_snapshot===total)continue
  await query(client,'UPDATE treehole_penalties SET status=5,revoke_reason=$3,revoke_operator_id=$4,updated_at=$2 WHERE id=$1',[candidate.id.toString(),now,reason,operator.id])
 }
 await query(client,'UPDATE treehole_user_states SET last_enforced_tier=$2,updated_at=$3 WHERE user_id=$1',[p.user_id.toString(),timeline.lastEnforcedTier,now])
 const latest=valid.at(-1)
 if(latest&&tierForScore(total)>timeline.lastEnforcedTier)await enforce(client,p.user_id,latest.id,latest.review_id!,now,total)
 // The corrected approval may have remained hidden while its penalty was still active.
 if(p.review_id) {
  const [r]=await query(client,'SELECT * FROM treehole_reviews WHERE id=$1',[p.review_id.toString()])
  if(r) {
   const kind=r.post_id?'post':'comment';const c=await content(client,kind,(r.post_id??r.comment_id)!,true)
   if(c&&c.moderation_status===1&&!unavailable(c,now)&&(await access(client,c.user_id,now)).canEnter&&!c.published_at&&Date.parse(now)<Date.parse(c.submitted_at)+DAY)await query(client,`UPDATE treehole_${kind==='post'?'posts':'comments'} SET published_at=$2${kind==='post'?',expires_at=$2::timestamptz+ttl_hours*interval \'1 hour\'':''},updated_at=$2 WHERE id=$1`,[c.id.toString(),now])
  }
 }
}
