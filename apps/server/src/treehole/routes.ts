import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { TreeholeError, fields, invalid, key, parseId, parsePage } from './rules.js'
import { execute, getAccess, validateBody } from './service.js'
import { operations } from './operations.js'
interface Guards {
 miniapp:(request:FastifyRequest,reply:FastifyReply)=>Promise<{id:bigint}|null>
 admin:(request:FastifyRequest,reply:FastifyReply)=>Promise<{id:number;role:number}|null>
}
export async function registerTreeholeRoutes(app:FastifyInstance,guards:Guards):Promise<void> {
 await app.register(async scope=>{
  scope.addHook('onRequest',async(_request,reply)=>{reply.header('Cache-Control','private, no-store')})
  scope.addHook('onSend',async(request,_reply,payload)=>{
   if(typeof payload!=='string')return payload
   try {const body=JSON.parse(payload);if(body.error){body.error.requestId=request.id;return JSON.stringify(body)}}catch{/* non-JSON responses are unchanged */}
   return payload
  })
  scope.setErrorHandler((error,request,reply)=>{
   const e=error instanceof TreeholeError?error:new TreeholeError((error as {statusCode?:number}).statusCode===400?400:500,(error as {statusCode?:number}).statusCode===400?'VALIDATION_ERROR':'INTERNAL_ERROR','请求无法处理',(error as {statusCode?:number}).statusCode===400?{fields:[{path:'body',issue:'invalid_format'}]}:undefined)
   // Do not log incoming content, raw SQL values, tokens, or provider responses.
   if(e.status===500)request.log.error({requestId:request.id,code:'TREEHOLE_INTERNAL_ERROR'},'树洞请求失败')
   reply.code(e.status).send({error:{code:e.code,message:e.message,requestId:request.id,...(e.details===undefined?{}:{details:e.details})}})
  })
  const actors=new WeakMap<FastifyRequest,{id:bigint}|{id:number;role:number}>()
  for(const route of operations) {
   scope.route({method:route.method,url:route.path.replace(/\{(\w+)\}/g,':$1'),onRequest:async(request,reply)=>{
    const isAdmin=route.path.startsWith('/admin-api/')
    const user=isAdmin?await guards.admin(request,reply):await guards.miniapp(request,reply)
    if(!user)return
    if(!isAdmin&&route.path.startsWith('/api/miniapp/treehole/')) {
     const a=await getAccess(user.id as bigint)
     if(!a.canEnter)throw new TreeholeError(403,'TREEHOLE_RESTRICTED','当前暂时无法进入树洞',a.restriction)
    }
    actors.set(request,user)
   },handler:async(request,reply)=>{
    const isAdmin=route.path.startsWith('/admin-api/')
    const user=actors.get(request)!
    const queryParams=route.params.filter(p=>p.in==='query')
    const q=fields(request.query??{},queryParams.map(p=>p.name),'query')
    const ids:Record<string,bigint>={}
    for(const [name,value] of Object.entries(request.params as Record<string,unknown>))ids[name]=parseId(value,`path.${name}`)
    for(const parameter of queryParams) {
     const value=q[parameter.name]
     if(value===undefined)continue
     if(parameter.name==='page'){parsePage(value);continue}
     if(parameter.name==='pageSize'){if(value!=='10')invalid('query.pageSize');continue}
     const schema=parameter.schema as {enum?:readonly string[]}
     if(typeof value!=='string'||!schema.enum?.includes(value))invalid(`query.${parameter.name}`)
    }
    const idempotency=route.params.some(p=>p.in==='header'&&p.name==='Idempotency-Key')?key(request.headers['idempotency-key']):null
    const body=validateBody(route.operation,request.body)
    const result=await execute(route.operation,{ids,page:parsePage(q.page),query:q,body,key:idempotency},isAdmin?{kind:'admin',id:user.id as number,role:(user as {role:number}).role,requestId:request.id}:{kind:'miniapp',id:user.id as bigint})
    return reply.code(result.status).send(result.body)
   }})
  }
 })
}
