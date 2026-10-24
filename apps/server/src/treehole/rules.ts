import { createHash } from 'node:crypto'
import type * as Contract from '@cangqiong/api-contracts/treehole'
export const RULE_VERSION = 'treehole-v1'
export const DAY = 86_400_000
export class TreeholeError extends Error {
 constructor(public status: number, public code: string, message = '请求无法处理', public details?: unknown) { super(message) }
}
export function invalid(path: string, issue = 'invalid_format'): never { throw new TreeholeError(400,'VALIDATION_ERROR','参数不合法',{fields:[{path,issue}]}) }
export function parseId(value: unknown, path = 'path.id'): bigint {
 if(typeof value!=='string'||! /^[1-9]\d{0,18}$/.test(value)||BigInt(value)>9223372036854775807n) invalid(path)
 return BigInt(value)
}
export function parsePage(value: unknown = '1'): number {
 if(typeof value!=='string'||! /^[1-9]\d*$/.test(value)||BigInt(value)>2147483647n) invalid('query.page')
 return Number(value)
}
export function normalizeText(value: unknown, max: number, path = 'body.content'): string {
 if(typeof value!=='string') invalid(path,value===undefined?'required':'invalid_type')
 const text=value.replace(/\r\n?/g,'\n').trim()
 if(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/u.test(text)) invalid(path)
 if([...text].length<1||[...text].length>max) invalid(path,'out_of_range')
 return text
}
export function fields(value: unknown, allowed: string[], path='body'): Record<string,unknown> {
 if(!value||typeof value!=='object'||Array.isArray(value)) invalid(path,'invalid_type')
 for(const key of Object.keys(value)) if(!allowed.includes(key)) invalid(`${path}.${key}`,'unknown_field')
 return value as Record<string,unknown>
}
export function key(value: unknown): string {
 if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) invalid('header.Idempotency-Key')
 return value.toLowerCase()
}
export function hash(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex') }
export function quotaWindow(now: string) {
 const date=new Date(Date.parse(now)+8*3600_000).toISOString().slice(0,10)
 return {date,retryAt:new Date(Date.parse(`${date}T16:00:00.000Z`)).toISOString()}
}
export function tierForScore(score:number): number { return score>=40?5:score>=30?4:score>=20?3:score>=10?2:score>=5?1:score>0?0:-1 }
export function endsAt(tier:number, startsAt:string):string|null { return tier===5?null:new Date(Date.parse(startsAt)+[0,3600_000,DAY,7*DAY,30*DAY][tier]!).toISOString() }
export function scoreCycleStart(confirmedAt:string[],now:string):string|null {
 const events=confirmedAt.filter(t=>Date.parse(t)<=Date.parse(now)).sort((a,b)=>Date.parse(a)-Date.parse(b))
 if(!events.length||Date.parse(now)-Date.parse(events.at(-1)!)>=90*DAY)return null
 let start=events[0]!
 for(let i=1;i<events.length;i++)if(Date.parse(events[i]!)-Date.parse(events[i-1]!)>=90*DAY)start=events[i]!
 return start
}
export function correctedTimeline(violations:{id:bigint;points:number;confirmedAt:string}[],penalties:{id:bigint;startsAt:string;tier:number}[],now:string) {
 const events=[...violations].sort((a,b)=>Date.parse(a.confirmedAt)-Date.parse(b.confirmedAt)||(a.id<b.id?-1:1))
 let cycle=0
 const cycles=events.map((event,index)=>{
  if(index&&Date.parse(event.confirmedAt)-Date.parse(events[index-1]!.confirmedAt)>=90*DAY)cycle++
  return {...event,cycle}
 })
 let highest=-1;let enforcedCycle=-1
 const result=[...penalties].sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)||(a.id<b.id?-1:1)).map(p=>{
  const preceding=cycles.filter(v=>Date.parse(v.confirmedAt)<=Date.parse(p.startsAt)&&Date.parse(v.confirmedAt)>Date.parse(p.startsAt)-90*DAY)
  const currentCycle=preceding.at(-1)?.cycle??-1
  if(currentCycle!==enforcedCycle){highest=-1;enforcedCycle=currentCycle}
  const total=preceding.reduce((s,v)=>s+v.points,0)
  // A correction can only reduce an original decision, including an operator's lower tier.
  const tier=Math.min(p.tier,tierForScore(total))
  if(tier<=highest) return {...p,tier:-1,endsAt:p.startsAt}
  highest=tier
  return {...p,tier,endsAt:tier<0?p.startsAt:endsAt(tier,p.startsAt)}
 })
 const current=cycles.filter(v=>Date.parse(v.confirmedAt)<=Date.parse(now)&&Date.parse(v.confirmedAt)>Date.parse(now)-90*DAY)
 return {penalties:result,lastEnforcedTier:current.length&&current.at(-1)!.cycle===enforcedCycle?highest:-1}
}
export const POINTS:Record<string,[number,number]>={minor_insult:[1,3],direct_insult:[4,9],harassment:[4,9],privacy_leak:[10,20],threat:[10,20],substantiated_defamation:[4,20]}
export function validateDecision(body:unknown):Contract.ReviewDecision {
 const b=fields(body,['decision','violationCode','points','reason'])
 const reason=normalizeText(b.reason,1000,'body.reason')
 if(b.decision==='approve') { if('points'in b||'violationCode'in b) invalid('body','unknown_field');return {decision:'approve',reason} }
 const range=POINTS[String(b.violationCode)]
 if(b.decision!=='violation'||!range) invalid('body.decision')
 if(!Number.isInteger(b.points)||Number(b.points)<range[0]||Number(b.points)>range[1]) invalid('body.points','out_of_range')
 return {decision:'violation',violationCode:b.violationCode as Contract.ViolationCode,points:b.points as number,reason}
}
export interface AiResult {decision:'approve'|'violation'|'needs_human';violationCode:Contract.ViolationCode|null;points:number|null;reason:string;evidenceQuotes:string[]}
export function validateAiResult(value:unknown,content:string):AiResult {
 const b=fields(value,['decision','violationCode','points','reason','evidenceQuotes'],'ai')
 if(!['approve','violation','needs_human'].includes(String(b.decision))) throw new Error('Invalid AI decision')
 const reason=normalizeText(b.reason,1000,'ai.reason')
 if(!Array.isArray(b.evidenceQuotes)||b.evidenceQuotes.length>10||b.evidenceQuotes.some(q=>typeof q!=='string'||!q||[...q].length>1000||!content.includes(q))) throw new Error('Invalid AI evidence')
 if(b.decision==='violation'||b.decision==='needs_human'&&(b.violationCode!==null||b.points!==null)) validateDecision({decision:'violation',violationCode:b.violationCode,points:b.points,reason})
 else if(b.violationCode!==null||b.points!==null) throw new Error('Unexpected AI score')
 if((b.decision==='violation'||b.violationCode!==null)&&b.evidenceQuotes.length===0) throw new Error('Missing AI evidence')
 return {decision:b.decision==='violation'&&['privacy_leak','threat','substantiated_defamation'].includes(String(b.violationCode))?'needs_human':b.decision as AiResult['decision'],violationCode:b.violationCode as AiResult['violationCode'],points:b.points as number|null,reason,evidenceQuotes:b.evidenceQuotes as string[]}
}
export function routeContent(content:string):'rule'|'ai' {
 if(!process.env.TREEHOLE_RULE_VERSION || !process.env.TREEHOLE_RISK_PATTERNS) return 'ai'
 const patterns=process.env.TREEHOLE_RISK_PATTERNS.split('|').map(p=>p.trim()).filter(Boolean)
 if(!process.env.TREEHOLE_RULE_VERSION.trim()||!patterns.length)return 'ai'
 return patterns.some(p=>content.includes(p))||/(?:\+?\d[\d -]{9,}\d)|https?:\/\//i.test(content)?'ai':'rule'
}
