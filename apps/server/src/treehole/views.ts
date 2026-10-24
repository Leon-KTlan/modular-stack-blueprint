import type { PoolClient } from 'pg'
import type * as Contract from '@cangqiong/api-contracts/treehole'
import { DAY } from './rules.js'
import { content, query, unavailable, visible, type Row } from './store.js'
export const REVIEW_STATUS=['queued','processing','completed','cancelled'] as const
export const PENALTY_STATUS=['pending_confirmation','active','ended','revoked','superseded','declined'] as const
export const REPORT_STATUS=['pending','upheld','dismissed'] as const
export const APPEAL_STATUS=['pending','upheld','rejected'] as const
export const REASONS=['insult','harassment','privacy','threat','disputed_accusation','other'] as const
export function receipt(r:Row,now:string):Contract.Receipt {
 const expired=unavailable(r,now)
 const closed=r.moderation_status===3||r.moderation_status===0&&!r.published_at&&Date.parse(now)>=Date.parse(r.submitted_at)+DAY
 const status=expired?'unavailable':closed?'closed':r.moderation_status===2?'rejected':r.moderation_status===1?'published':'pending_review'
 return {id:r.id.toString(),status,submittedAt:r.submitted_at,publishedAt:r.published_at,expiresAt:r.expires_at,reasonCode:expired?'content_unavailable':closed?'review_timeout':status==='rejected'?'content_violation':null}
}
export function own(r:Row,now:string,kind:'post'|'comment'):Contract.MyPost|Contract.MyComment {
 const base=receipt(r,now) as Omit<Contract.MyPost,'content'|'ttlHours'|'canDelete'>
 return kind==='post'?{...base,content:r.content,ttlHours:r.ttl_hours as Contract.MyPost['ttlHours'],canDelete:true}:{...base,content:r.content,postId:r.post_id!.toString(),replyToCommentId:r.reply_to_comment_id?.toString()??null,canDelete:true}
}
export async function author(client:PoolClient,r:Row,viewer:bigint):Promise<Contract.AnonymousAuthor> {
 const [p]=await query(client,'SELECT nickname FROM treehole_participants WHERE post_id=$1 AND user_id=$2',[(r.post_id??r.id).toString(),r.user_id.toString()])
 if(!p) throw new Error('Missing treehole anonymous participant')
 return {nickname:p.nickname,isOp:r.user_id===r.op_user_id,isMe:r.user_id===viewer}
}
export async function postView(client:PoolClient,r:Row,viewer:bigint):Promise<Contract.Post> {
 const [counts]=await query(client,`SELECT (SELECT count(*)::int FROM treehole_post_likes WHERE post_id=$1) AS like_count,(SELECT count(*)::int FROM treehole_comments c WHERE c.post_id=$1 AND ${visible('c',true)}) AS comment_count_visible,EXISTS(SELECT 1 FROM treehole_post_likes WHERE post_id=$1 AND user_id=$2) AS liked`,[r.id.toString(),viewer.toString()])
 return {id:r.id.toString(),content:r.content!,author:{...await author(client,r,viewer),isOp:true},status:'published',publishedAt:r.published_at!,expiresAt:r.expires_at!,likeCount:counts!.like_count,commentCount:counts!.comment_count_visible,likedByMe:counts!.liked,canDelete:r.user_id===viewer}
}
export async function commentView(client:PoolClient,r:Row,viewer:bigint):Promise<Contract.Comment> {
 const base={id:r.id.toString(),replyToCommentId:r.reply_to_comment_id?.toString()??null,publishedAt:r.published_at!}
 return r.visible?{...base,status:'published',content:r.content!,author:await author(client,r,viewer),canDelete:r.user_id===viewer}:{...base,status:'deleted',content:null,author:null,canDelete:false}
}
export function appealView(r:Row,now:string):Contract.Appeal {
 return {id:r.id.toString(),penaltyId:r.penalty_id.toString(),status:APPEAL_STATUS[r.status]!,reason:r.reason,createdAt:r.created_at,decisionReason:r.decision_reason,resolvedAt:r.resolved_at,overdue:r.status===0&&Date.parse(now)>=Date.parse(r.created_at)+3*DAY}
}
export async function penaltyView(client:PoolClient,r:Row,now:string):Promise<Contract.Penalty> {
 const [p]=await query(client,'SELECT EXISTS(SELECT 1 FROM treehole_appeals WHERE penalty_id=$1 AND status=0) AS pending',[r.id.toString()])
 const deadline=new Date(Date.parse(r.notified_at!)+30*DAY).toISOString()
 return {id:r.id.toString(),type:r.tier===0?'warning':r.tier===5?'permanent':'temporary',status:(r.status===1&&r.ends_at&&Date.parse(r.ends_at)<=Date.parse(now)?'ended':PENALTY_STATUS[r.status]) as Contract.Penalty['status'],reason:r.reason,restrictedCapabilities:r.tier===0?[]:['treehole_access'],startsAt:r.starts_at!,endsAt:r.ends_at,notifiedAt:r.notified_at!,appealDeadlineAt:deadline,canAppeal:r.status!==3&&Date.parse(now)<Date.parse(deadline)&&!p!.pending}
}
export async function access(client:PoolClient,userId:bigint,now:string):Promise<Contract.Access> {
 const [p]=await query(client,'SELECT * FROM treehole_penalties WHERE user_id=$1 AND status=1 AND tier>0 AND starts_at<=$2 AND (tier=5 OR ends_at>$2) ORDER BY (tier=5) DESC,ends_at DESC NULLS FIRST,id DESC LIMIT 1',[userId.toString(),now])
 if(!p)return {canEnter:true,restriction:null}
 const v=await penaltyView(client,p,now)
 return {canEnter:false,restriction:{penaltyId:v.id,type:p.tier===5?'permanent':'temporary',reason:v.reason,restrictedCapabilities:['treehole_access'],endsAt:v.endsAt,appealDeadlineAt:v.appealDeadlineAt,canAppeal:v.canAppeal}}
}
export async function targetView(client:PoolClient,r:Row,now:string):Promise<Contract.Target> {
 const kind=r.post_id?'post':'comment';const c=await content(client,kind,(r.post_id??r.comment_id)!)
 return {type:kind,id:(r.post_id??r.comment_id)!.toString(),postId:(r.post_id??c!.post_id)!.toString(),availability:c?.visible&&c.parent_visible?'published':c&&!unavailable(c,now)&&c.moderation_status===0?'pending_review':'unavailable'}
}
export async function reviewView(client:PoolClient,r:Row,now:string):Promise<Contract.AdminReview> {
 const c=await content(client,r.post_id?'post':'comment',(r.post_id??r.comment_id)!)
 return {id:r.id.toString(),target:await targetView(client,r,now),source:(['submission','sample','report','appeal','manual'] as const)[r.source]!,reviewerType:(['rule','ai','human'] as const)[r.reviewer_type]!,status:REVIEW_STATUS[r.status]!,decision:r.decision===null?null:(['approve','violation','needs_human'] as const)[r.decision]!,violationCode:r.violation_code as Contract.ViolationCode|null,points:r.points,reason:r.reason,targetReviewVersion:r.target_review_version,isCurrent:c?.review_version===r.target_review_version,previousReviewId:r.previous_review_id?.toString()??null,countedViolationId:r.counted_violation_id?.toString()??null,createdAt:r.created_at,completedAt:r.completed_at}
}
export async function reviewDetail(client:PoolClient,r:Row,now:string):Promise<Contract.AdminReviewDetail> {
 const history=await query(client,`SELECT * FROM treehole_reviews WHERE ${r.post_id?'post_id':'comment_id'}=$1 ORDER BY target_review_version,id`,[(r.post_id??r.comment_id)!.toString()])
 return {...await reviewView(client,r,now),content:r.content_snapshot,context:(r.context_snapshot??[]) as Contract.ContextItem[],evidenceQuotes:r.evidence_quotes??[],ruleVersion:r.rule_version,history:await Promise.all(history.map(h=>reviewView(client,h,now)))}
}
export async function evidence(client:PoolClient,r:Row):Promise<Contract.Evidence[]> {
 if(!r.review_id)return []
 const [review]=await query(client,'SELECT * FROM treehole_reviews WHERE id=$1',[r.review_id.toString()])
 return review?[{content:review.content_snapshot,quotes:review.evidence_quotes??[],explanation:review.reason||r.reason}]:[]
}
export function adminPenalty(r:Row,now:string):Contract.AdminPenalty {
 return {id:r.id.toString(),type:r.tier===0?'warning':r.tier===5?'permanent':'temporary',status:r.status===1&&r.ends_at&&Date.parse(r.ends_at)<=Date.parse(now)?'ended':PENALTY_STATUS[r.status]!,tier:r.tier,basis:(['accumulated_score','manual_severity','provisional'] as const)[r.basis]!,scoreSnapshot:r.score_snapshot,ruleVersion:r.rule_version,reviewId:r.review_id?.toString()??null,triggerViolationId:r.trigger_violation_id?.toString()??null,supersedesPenaltyId:r.supersedes_penalty_id?.toString()??null,reason:r.reason,startsAt:r.starts_at,endsAt:r.ends_at,notifiedAt:r.notified_at,createdAt:r.created_at,revokedAt:r.revoked_at,revokeReason:r.revoke_reason}
}
export async function penaltyDetail(client:PoolClient,r:Row,now:string):Promise<Contract.AdminPenaltyDetail> {
 const appeals=await query(client,'SELECT id FROM treehole_appeals WHERE penalty_id=$1 ORDER BY id',[r.id.toString()])
 return {...adminPenalty(r,now),evidence:await evidence(client,r),relatedReviewIds:r.review_id?[r.review_id.toString()]:[],relatedAppealIds:appeals.map(a=>a.id.toString())}
}
export async function reportView(client:PoolClient,r:Row,now:string):Promise<Contract.AdminReport> {
 return {id:r.id.toString(),target:await targetView(client,r,now),reason:REASONS[Number(r.reason)]!,description:r.description,status:REPORT_STATUS[r.status]!,reviewId:r.review_id?.toString()??null,createdAt:r.created_at,resolvedAt:r.resolved_at}
}
export function page<T>(items:T[],total:number,page:number) {return {items,pagination:{page,pageSize:10 as const,total,totalPages:Math.ceil(total/10)}}}
