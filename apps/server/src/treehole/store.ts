import type { PoolClient } from 'pg'
import { pool } from '../database.js'
import { TreeholeError, quotaWindow } from './rules.js'
export type Json = null | boolean | number | string | Json[] | {[key:string]:Json}
export interface Row {
 id:bigint;user_id:bigint;post_id:bigint|null;comment_id:bigint|null;reply_to_comment_id:bigint|null;reporter_user_id:bigint;
 penalty_id:bigint;review_id:bigint|null;previous_review_id:bigint|null;counted_violation_id:bigint|null;trigger_violation_id:bigint|null;supersedes_penalty_id:bigint|null;
 content:string|null;nickname:string;ttl_hours:number;moderation_status:number;review_version:number;submitted_at:string;published_at:string|null;expires_at:string|null;
 deleted_at:string|null;purged_at:string|null;hidden:boolean;parent_visible:boolean;visible:boolean;request_hash:string;client_request_id:string;content_fingerprint:string;dedupe_window_started_at:string;
 created_at:string;updated_at:string;notified_at:string|null;starts_at:string|null;ends_at:string|null;revoked_at:string|null;revoke_reason:string|null;
 status:number;source:number;reviewer_type:number;decision:number|null;reason:string;description:string|null;decision_reason:string|null;resolved_at:string|null;completed_at:string|null;
 tier:number;basis:number;score_snapshot:number;rule_version:string;model:string|null;points:number;violation_code:string;confirmed_at:string;
 content_snapshot:string|null;context_snapshot:Json|null;evidence_quotes:string[]|null;target_review_version:number;
 attempt_count:number;next_attempt_at:string;locked_until:string|null;lease_token:string|null;dedupe_key:string;
 decision_request_id:string|null;decision_request_hash:string|null;decision_result:Json|null;revoke_request_id:string|null;revoke_request_hash:string|null;revoke_result:Json|null;
 operator_id:number|null;quota_date:string;post_count:number;comment_count:number;last_post_submitted_at:string|null;last_comment_submitted_at:string|null;last_enforced_tier:number;
 now:string;count:number;total:number;score:number;pending:boolean;liked:boolean;like_count:number;comment_count_visible:number;op_user_id:bigint;
}
const integerIds=new Set(['id','user_id','post_id','comment_id','reply_to_comment_id','reporter_user_id','penalty_id','review_id','previous_review_id','counted_violation_id','trigger_violation_id','supersedes_penalty_id','op_user_id'])
export async function query<T=Row>(client:PoolClient, text:string, values:unknown[]=[]):Promise<T[]> {
 const result=await client.query(text,values)
 return result.rows.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v instanceof Date?(k==='quota_date'?`${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`:v.toISOString()):v!==null&&integerIds.has(k)?BigInt(v as string):v]))) as T[]
}
export async function transaction<T>(fn:(client:PoolClient)=>Promise<T>,readOnly=false):Promise<T> {
 const client=await pool.connect()
 try { await client.query(readOnly?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN');const value=await fn(client);await client.query('COMMIT');return value }
 catch(error){ await client.query('ROLLBACK');throw error } finally {client.release()}
}
export async function clock(client:PoolClient):Promise<string> { return (await query(client,'SELECT clock_timestamp() AS now'))[0]!.now }
export async function lockUsers(client:PoolClient,ids:bigint[]):Promise<void> {
 for(const id of [...new Set(ids)].sort((a,b)=>a<b?-1:1)) {
  await query(client,"INSERT INTO treehole_user_states(user_id,quota_date) VALUES($1,(clock_timestamp() AT TIME ZONE 'Asia/Shanghai')::date) ON CONFLICT DO NOTHING",[id.toString()])
  await query(client,'SELECT user_id FROM treehole_user_states WHERE user_id=$1 FOR UPDATE',[id.toString()])
 }
}
export function activeRestriction(alias:string):string { return `EXISTS(SELECT 1 FROM treehole_penalties tp WHERE tp.user_id=${alias}.user_id AND tp.status=1 AND tp.tier>0 AND tp.starts_at<=coalesce(nullif(current_setting('treehole.now',true),'')::timestamptz,clock_timestamp()) AND (tp.tier=5 OR tp.ends_at>coalesce(nullif(current_setting('treehole.now',true),'')::timestamptz,clock_timestamp())))` }
export function visible(alias:string,comment=false):string {
 return `${alias}.moderation_status=1 AND ${alias}.published_at IS NOT NULL AND ${alias}.deleted_at IS NULL AND ${alias}.purged_at IS NULL ${comment?'':`AND ${alias}.expires_at>coalesce(nullif(current_setting('treehole.now',true),'')::timestamptz,clock_timestamp())`} AND EXISTS(SELECT 1 FROM miniapp_users mu WHERE mu.id=${alias}.user_id AND mu.status=1) AND NOT ${activeRestriction(alias)} AND NOT EXISTS(SELECT 1 FROM treehole_penalty_contents h WHERE h.${comment?'comment':'post'}_id=${alias}.id AND h.released_at IS NULL)`
}
export async function content(client:PoolClient,kind:'post'|'comment',id:bigint,lock=false):Promise<Row|null> {
 const t=kind==='post'?'treehole_posts':'treehole_comments'
 const [r]=await query(client,`SELECT c.*,${kind==='post'?'NULL::bigint AS post_id,NULL::bigint AS reply_to_comment_id,c.user_id AS op_user_id, true AS parent_visible':`p.expires_at,p.user_id AS op_user_id,(${visible('p')}) AS parent_visible`},(${visible('c',kind==='comment')}) AS visible,EXISTS(SELECT 1 FROM treehole_penalty_contents h WHERE h.${kind}_id=c.id AND h.released_at IS NULL) AS hidden FROM ${t} c ${kind==='comment'?'JOIN treehole_posts p ON p.id=c.post_id':''} WHERE c.id=$1 ${lock?'FOR UPDATE OF c':''}`,[id.toString()])
 return r??null
}
export function unavailable(r:Row,now:string):boolean { return !!r.deleted_at||!!r.hidden||!!r.purged_at||(r.expires_at!==null&&Date.parse(r.expires_at)<=Date.parse(now))||!r.parent_visible }
export function fail(code:string,status=409):never {throw new TreeholeError(status,code)}
export async function quota(client:PoolClient,userId:bigint,kind:'post'|'comment',now:string) {
 const s=(await query(client,'SELECT * FROM treehole_user_states WHERE user_id=$1',[userId.toString()]))[0]!
 const day=quotaWindow(now)
 const count=s.quota_date===day.date?(kind==='post'?s.post_count:s.comment_count):0
 if(count>=(kind==='post'?5:50))throw new TreeholeError(429,'TREEHOLE_DAILY_LIMIT_REACHED','今日投稿次数已用完',{retryAt:day.retryAt})
 const last=kind==='post'?s.last_post_submitted_at:s.last_comment_submitted_at
 const retry=last?new Date(Date.parse(last)+(kind==='post'?60_000:10_000)).toISOString():null
 if(retry&&Date.parse(retry)>Date.parse(now))throw new TreeholeError(429,'TREEHOLE_SUBMIT_TOO_FAST','提交过于频繁',{retryAt:retry})
 await query(client,`UPDATE treehole_user_states SET post_count=CASE WHEN quota_date=$2 THEN post_count ELSE 0 END,comment_count=CASE WHEN quota_date=$2 THEN comment_count ELSE 0 END,quota_date=$2,updated_at=$3 WHERE user_id=$1`,[userId.toString(),day.date,now])
 await query(client,`UPDATE treehole_user_states SET ${kind}_count=${kind}_count+1,last_${kind}_submitted_at=$2 WHERE user_id=$1`,[userId.toString(),now])
}
