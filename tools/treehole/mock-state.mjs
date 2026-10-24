// Local development model only. Production moderation/scoring belongs to the server implementation.
export class MockError extends Error {
  constructor(status, code, details) { super(code); Object.assign(this, { status, code, details }) }
}
const fail = (status, code, details) => { throw new MockError(status, code, details) }
const DAY = 86400000
const pick = (value, keys) => Object.fromEntries(keys.map(key => [key, value[key]]))
const receiptKeys = ['id', 'status', 'submittedAt', 'publishedAt', 'expiresAt', 'reasonCode']
const reviewKeys = ['id', 'target', 'source', 'reviewerType', 'status', 'decision', 'violationCode', 'points', 'reason', 'targetReviewVersion', 'isCurrent', 'previousReviewId', 'countedViolationId', 'createdAt', 'completedAt']
const reportKeys = ['id', 'target', 'reason', 'description', 'status', 'reviewId', 'createdAt', 'resolvedAt']
const penaltyKeys = ['id', 'type', 'status', 'tier', 'basis', 'scoreSnapshot', 'ruleVersion', 'reviewId', 'triggerViolationId', 'supersedesPenaltyId', 'reason', 'startsAt', 'endsAt', 'notifiedAt', 'createdAt', 'revokedAt', 'revokeReason']
const appealKeys = ['id', 'penaltyId', 'status', 'reason', 'createdAt', 'decisionReason', 'resolvedAt', 'overdue']

export function createMockState(now) {
  let posts, comments, reviews, reports, penalties, appeals, replays, submissions, sequence
  const time = () => new Date(now()).toISOString()
  const id = () => (++sequence).toString()
  const values = map => [...map.values()]
  const get = (map, key, code = 'TREEHOLE_CASE_NOT_FOUND') => map.get(key) ?? fail(404, code)
  const page = (items, query) => ({ items: items.slice(((query.page ?? 1) - 1) * 10, (query.page ?? 1) * 10), pagination: { page: query.page ?? 1, pageSize: 10, total: items.length, totalPages: Math.ceil(items.length / 10) } })
  const ordered = (items, field, descending = false) => items.sort((a, b) => {
    const timeDiff = Date.parse(a[field]) - Date.parse(b[field])
    const diff = timeDiff || (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0)
    return descending ? -diff : diff
  })
  const future = ms => new Date(now() + ms).toISOString()
  function gone(item) {
    return item.deleted || item.restricted || (item.expiresAt !== null && Date.parse(item.expiresAt) <= now()) || (item.postId && !visible(posts.get(item.postId)))
  }
  const visible = item => item && !gone(item) && item.status === 'published'
  function refresh() {
    for (const item of [...values(posts), ...values(comments)]) {
      if (item.status === 'pending_review' && now() - Date.parse(item.submittedAt) >= DAY) {
        item.status = 'closed'; item.reasonCode = 'review_timeout'
        for (const review of values(reviews)) if (review.target.id === item.id && ['queued', 'processing'].includes(review.status)) review.status = 'cancelled'
      }
    }
    for (const p of values(penalties)) if (p.status === 'active' && p.endsAt && Date.parse(p.endsAt) <= now()) p.status = 'ended'
  }
  function target(item) { return { type: item.postId ? 'comment' : 'post', id: item.id, postId: item.postId ?? item.id, availability: gone(item) ? 'unavailable' : visible(item) ? 'published' : item.status === 'pending_review' ? 'pending_review' : 'unavailable' } }
  const targetItem = t => (t.type === 'post' ? posts : comments).get(t.id)
  function reviewView(r, detail = false) {
    const result = { ...pick(r, reviewKeys), target: target(targetItem(r.target)) }
    return detail ? { ...result, content: gone(targetItem(r.target)) ? null : targetItem(r.target).content, context: [], evidenceQuotes: [], ruleVersion: 'mock-v1', history: values(reviews).filter(old => old.target.id === r.target.id && old.id !== r.id).map(old => reviewView(old)) } : result
  }
  function enqueue(item, source = 'submission', forcedId) {
    const old = values(reviews).filter(r => r.target.id === item.id && r.isCurrent).at(-1)
    if (old && ['queued', 'processing'].includes(old.status)) return old
    if (old) old.isCurrent = false
    const r = { id: forcedId ?? id(), target: target(item), source, reviewerType: 'human', status: 'queued', decision: null, violationCode: null, points: null, reason: null, targetReviewVersion: (old?.targetReviewVersion ?? 0) + 1, isCurrent: true, previousReviewId: old?.id ?? null, countedViolationId: null, createdAt: time(), completedAt: null }
    reviews.set(r.id, r); return r
  }
  function seed(scenario = 'normal') {
    if (!['normal', 'demo', 'empty', 'restricted', 'permanent', 'quota', 'pending'].includes(scenario)) fail(400, 'VALIDATION_ERROR', { fields: [{ path: 'body.scenario', issue: 'invalid_format' }] })
    posts = new Map(); comments = new Map(); reviews = new Map(); reports = new Map(); penalties = new Map(); appeals = new Map(); replays = new Map(); submissions = []; sequence = 9007199254741999n
    const item = (key, owner, content, extra = {}) => ({ id: key, owner, content, status: 'published', submittedAt: time(), publishedAt: time(), expiresAt: future(DAY), reasonCode: null, deleted: false, restricted: false, ...extra })
    if (scenario === 'empty') return
    posts.set('123', item('123', 'other', '今天终于完成了拖了很久的事情。', { ttlHours: 24, likes: new Set(['seed-a', 'seed-b', 'seed-c']) }))
    posts.set('125', item('125', 'me', '给明天的自己留一句加油。', { status: 'pending_review', publishedAt: null, expiresAt: null, ttlHours: 24, likes: new Set() }))
    comments.set('124', item('124', 'other', '慢慢来，也很好。', { postId: '123', replyToCommentId: null }))
    comments.set('126', item('126', 'other', '已删除正文', { postId: '123', replyToCommentId: null, deleted: true }))
    comments.set('127', item('127', 'me', '愿你明天也有好心情。', { postId: '123', replyToCommentId: '126' }))
    if (scenario === 'demo') {
      const samples = [
        '今天在图书馆坐到闭馆，终于把最难的那章看懂了。\n原来进步有时候真的很安静。',
        '食堂阿姨记住了我不吃香菜。只是很小的一件事，但今天突然觉得，被记住的感觉真好。',
        '最近复习有点累，看着周围的人好像都很有方向。\n今晚决定先睡个好觉，明天只完成一件小事也可以。',
        '操场的晚风真的能把脑袋里的杂音吹走一点。今天跑得很慢，但我跑完了。',
        '有没有人也会把喜欢的歌循环一整晚？今晚的背景音是窗外的雨，和室友轻轻翻书的声音。',
        '面试没有通过，有一点失落。\n不过认真准备过的那几天没有白费，至少我比上周更了解自己想做什么了。',
        '想对那个在楼梯口帮我捡起一地资料的同学说声谢谢。你可能已经忘记了，但我今天一直记得。',
        '周末准备一个人去看展。以前总觉得一定要有人陪，现在想试试，把时间完整地留给自己。',
        '给正在赶作业的大家：喝口水，看看远处，肩膀放松一点。\n这一页写完就休息五分钟吧。',
        '和朋友有了一点误会，今天终于坐下来聊开了。原来一句“我当时有点难过”，比憋着猜好多了。',
        '今天拍到的晚霞不能发在这里，那就用文字记一下：天空像一杯被慢慢搅开的橘子汽水。',
        '这周的小小记录：按时吃了早餐，给家里打了电话，把桌面收拾干净了。\n没有什么大事发生，但生活好像一点点变得有秩序。\n如果你也觉得最近没什么值得夸奖自己的，不妨想想，有没有哪一刻，你照顾好了自己。',
      ]
      const replies = ['听见你啦，慢慢来。', '谢谢你分享这一刻，今晚也要好好休息。', '我也有过这样的心情，愿明天轻松一点。']
      samples.forEach((content, n) => {
        const key = String(200 + n)
        const publishedAt = new Date(now() - (n + 1) * 300000).toISOString()
        posts.set(key, item(key, n === 3 ? 'me' : `demo-${n}`, content, {
          submittedAt: publishedAt, publishedAt, expiresAt: future((n % 4 + 1) * 3600000), ttlHours: 24,
          likes: new Set(Array.from({ length: [12, 36, 8, 105, 0, 24][n % 6] }, (_, i) => `demo-like-${i}`)),
        }))
        replies.slice(0, n % 3 + 1).forEach((reply, i) => {
          const commentId = String(300 + n * 10 + i)
          comments.set(commentId, item(commentId, i === 0 ? `demo-${n}` : 'me', reply, {
            postId: key, replyToCommentId: null, expiresAt: posts.get(key).expiresAt,
          }))
        })
      })
    }
    const r = enqueue(posts.get('125'), 'submission', '701')
    reports.set('801', { id: '801', owner: 'other', target: r.target, reason: 'other', description: '请结合上下文核实', status: 'pending', reviewId: r.id, createdAt: time(), resolvedAt: null, decisionReason: null })
    penalties.set('901', { id: '901', owner: 'me', type: 'temporary', status: 'pending_confirmation', tier: 3, basis: 'manual_severity', scoreSnapshot: 12, ruleVersion: 'mock-v1', reviewId: r.id, triggerViolationId: null, supersedesPenaltyId: null, reason: '模拟待确认处罚', startsAt: null, endsAt: null, notifiedAt: null, createdAt: time(), revokedAt: null, revokeReason: null, evidence: [{ content: null, quotes: [], explanation: '仅供开发演示的脱敏证据' }] })
    if (scenario === 'restricted' || scenario === 'permanent') activate(penalties.get('901'), scenario === 'permanent' ? 5 : 2, '模拟访问限制')
    if (scenario === 'quota') for (let n = 0; n < 5; n++) submissions.push({ owner: 'me', kind: 'post', at: now() - 100000 })
  }
  const deadline = p => new Date(Date.parse(p.notifiedAt) + 30 * DAY).toISOString()
  const canAppeal = p => p.notifiedAt !== null && !['revoked', 'declined', 'pending_confirmation'].includes(p.status) && now() < Date.parse(deadline(p)) && !values(appeals).some(a => a.penaltyId === p.id && a.status === 'pending')
  function personalPenalty(p, detail = false) {
    return { ...pick(p, ['id', 'type', 'status', 'reason', 'startsAt', 'endsAt', 'notifiedAt']), restrictedCapabilities: p.type === 'warning' ? [] : ['treehole_access'], appealDeadlineAt: deadline(p), canAppeal: canAppeal(p), ...(detail ? { evidence: p.evidence } : {}) }
  }
  function access(owner) {
    refresh()
    const p = values(penalties).find(p => p.owner === owner && p.status === 'active' && p.type !== 'warning')
    return p ? { canEnter: false, restriction: { penaltyId: p.id, type: p.type, reason: p.reason, restrictedCapabilities: ['treehole_access'], endsAt: p.endsAt, appealDeadlineAt: deadline(p), canAppeal: canAppeal(p) } } : { canEnter: true, restriction: null }
  }
  function activate(p, tier, reason) {
    Object.assign(p, { tier, type: tier === 5 ? 'permanent' : 'temporary', status: 'active', reason, startsAt: time(), notifiedAt: time(), endsAt: tier === 5 ? null : future([0, 3600000, DAY, 7 * DAY, 30 * DAY][tier]) })
    for (const item of [...values(posts), ...values(comments)]) if (item.owner === p.owner) item.restricted = true
  }
  function revoke(p, reason) {
    Object.assign(p, { status: 'revoked', revokedAt: time(), revokeReason: reason })
    if (access(p.owner).canEnter) for (const item of [...values(posts), ...values(comments)]) if (item.owner === p.owner) item.restricted = false
  }
  function adminPenalty(p, detail = false) {
    return { ...pick(p, penaltyKeys), ...(detail ? { evidence: p.evidence, relatedReviewIds: p.reviewId ? [p.reviewId] : [], relatedAppealIds: values(appeals).filter(a => a.penaltyId === p.id).map(a => a.id) } : {}) }
  }
  function appealView(a) { return { ...pick(a, appealKeys), overdue: a.status === 'pending' && now() - Date.parse(a.createdAt) >= 72 * 3600000 } }
  function reportView(r, detail = false) { return { ...pick(r, reportKeys), target: target(targetItem(r.target)), ...(detail ? { decisionReason: r.decisionReason, review: r.reviewId ? reviewView(reviews.get(r.reviewId), true) : null } : {}) } }
  function receipt(item) { return { ...pick(item, receiptKeys), ...(gone(item) ? { status: 'unavailable', reasonCode: 'content_unavailable' } : {}) } }
  function myItem(item) {
    return { ...pick(item, receiptKeys), content: ['rejected', 'closed'].includes(item.status) ? null : item.content, canDelete: true, ...(item.postId ? { postId: item.postId, replyToCommentId: item.replyToCommentId } : { ttlHours: item.ttlHours }) }
  }
  function author(item, owner) { return { nickname: item.owner === 'me' ? `晚风${item.postId ?? item.id}` : `星光${item.postId ?? item.id}`, isOp: !item.postId || posts.get(item.postId).owner === item.owner, isMe: item.owner === owner } }
  function publicPost(p, owner) { return { ...pick(p, ['id', 'content', 'status', 'publishedAt', 'expiresAt']), author: author(p, owner), likeCount: p.likes.size, commentCount: values(comments).filter(c => c.postId === p.id && visible(c)).length, likedByMe: p.likes.has(owner), canDelete: p.owner === owner } }
  function publicComments(postId, owner) {
    const all = values(comments).filter(c => c.postId === postId)
    const included = new Set(all.filter(visible).map(c => c.id))
    for (const c of all.filter(visible)) {
      let parent = c.replyToCommentId
      const visited = new Set()
      while (parent && !visited.has(parent)) { visited.add(parent); included.add(parent); parent = comments.get(parent)?.replyToCommentId }
    }
    return ordered(all.filter(c => included.has(c.id)), 'publishedAt').map(c => ({ ...pick(c, ['id', 'replyToCommentId', 'publishedAt']), ...(visible(c) ? { content: c.content, author: author(c, owner), status: 'published', canDelete: c.owner === owner } : { content: null, author: null, status: 'deleted', canDelete: false }) }))
  }
  function quota(owner, kind) {
    const day = Math.floor((now() + 8 * 3600000) / DAY)
    const entries = submissions.filter(s => s.owner === owner && s.kind === kind)
    if (entries.filter(s => Math.floor((s.at + 8 * 3600000) / DAY) === day).length >= (kind === 'post' ? 5 : 50)) fail(429, 'TREEHOLE_DAILY_LIMIT_REACHED', { retryAt: new Date((day + 1) * DAY - 8 * 3600000).toISOString() })
    const last = entries.at(-1)?.at
    const interval = kind === 'post' ? 60000 : 10000
    if (last !== undefined && now() < last + interval) fail(429, 'TREEHOLE_SUBMIT_TOO_FAST', { retryAt: new Date(last + interval).toISOString() })
    submissions.push({ owner, kind, at: now() })
  }
  function handle(op, params, body, query, owner, key) {
    refresh()
    if (op.path.startsWith('/api/miniapp/treehole/')) { const a = access(owner); if (!a.canEnter) fail(403, 'TREEHOLE_RESTRICTED', a.restriction) }
    const fingerprint = JSON.stringify([params, Object.entries(body ?? {}).sort(([a], [b]) => a.localeCompare(b))])
    const usesKey = op.parameters?.some(p => p.in === 'header' && p.name === 'Idempotency-Key')
    const scope = op.path.startsWith('/admin-api/') ? `${op.operationId}:${Object.values(params)[0]}` : `${owner}:${op.operationId}`
    const replayKey = usesKey && key ? `${scope}:${key.toLowerCase()}` : undefined
    const replay = replays.get(replayKey)
    if (replay) {
      if (replay.fingerprint !== fingerprint) fail(409, 'IDEMPOTENCY_CONFLICT')
      return replay.current ? { status: replay.status, body: replay.current() } : structuredClone(replay.response)
    }
    let current
    const result = (data, status = 200) => ({ status, body: data })
    const publishedPost = () => { const p = posts.get(params.postId); if (!visible(p)) fail(404, 'TREEHOLE_POST_NOT_FOUND'); return p }
    const own = (map, itemId, code) => { const item = map.get(itemId); if (!item || item.owner !== owner) fail(404, code); return item }
    const actionable = r => { if (!['queued', 'processing', 'pending', 'pending_confirmation'].includes(r.status)) fail(409, 'TREEHOLE_CASE_ALREADY_RESOLVED') }
    const decide = () => {
      const p = params
      if (op.operationId === 'getMyTreeholeAccess') return result(access(owner))
      if (op.operationId === 'listTreeholePosts') return result(page(ordered(values(posts).filter(visible), 'publishedAt', true).map(p => publicPost(p, owner)), query))
      if (op.operationId === 'getTreeholePost') return result(publicPost(publishedPost(), owner))
      if (op.operationId === 'listTreeholeComments') { publishedPost(); return result(page(publicComments(p.postId, owner), query)) }
      if (['createTreeholePost', 'createTreeholeComment'].includes(op.operationId)) {
        const isComment = op.operationId === 'createTreeholeComment'
        const parent = isComment ? publishedPost() : null
        if (body.replyToCommentId) { const reply = comments.get(body.replyToCommentId); if (!visible(reply) || reply.postId !== parent.id) fail(404, 'TREEHOLE_COMMENT_NOT_FOUND') }
        quota(owner, isComment ? 'comment' : 'post')
        const item = { id: id(), owner, content: body.content, status: 'pending_review', submittedAt: time(), publishedAt: null, expiresAt: parent?.expiresAt ?? null, reasonCode: null, deleted: false, restricted: false, ...(parent ? { postId: parent.id, replyToCommentId: body.replyToCommentId ?? null } : { ttlHours: body.ttlHours, likes: new Set() }) }
        ;(isComment ? comments : posts).set(item.id, item); enqueue(item)
        current = () => receipt(item)
        return result(current(), 201)
      }
      if (['likeTreeholePost', 'unlikeTreeholePost'].includes(op.operationId)) { const post = publishedPost(); if (op.method === 'PUT') post.likes.add(owner); else post.likes.delete(owner); return result({ liked: post.likes.has(owner), likeCount: post.likes.size }) }
      if (['reportTreeholePost', 'reportTreeholeComment'].includes(op.operationId)) {
        let item = p.commentId ? comments.get(p.commentId) : publishedPost()
        if (!visible(item)) fail(404, 'TREEHOLE_COMMENT_NOT_FOUND')
        const old = values(reports).find(r => r.owner === owner && r.target.id === item.id)
        const receipt = r => pick(r, ['id', 'status', 'createdAt'])
        if (old) return result(receipt(old))
        const review = enqueue(item, 'report')
        const report = { id: id(), owner, target: target(item), reason: body.reason, description: body.description ?? null, status: 'pending', reviewId: review.id, createdAt: time(), resolvedAt: null, decisionReason: null }
        reports.set(report.id, report); return result(receipt(report), 201)
      }
      if (/^(listMyPosts|listMyComments|getMyPost|getMyComment|deleteMyPost|deleteMyComment)$/.test(op.operationId)) {
        const isComment = /Comment/.test(op.operationId); const map = isComment ? comments : posts
        const code = isComment ? 'TREEHOLE_COMMENT_NOT_FOUND' : 'TREEHOLE_POST_NOT_FOUND'
        if (op.operationId.startsWith('list')) return result(page(ordered(values(map).filter(i => i.owner === owner && !gone(i)), 'submittedAt', true).map(myItem), query))
        const item = own(map, p.postId ?? p.commentId, code)
        if (op.method === 'DELETE') { item.deleted = true; return result(undefined, 204) }
        if (gone(item)) fail(404, code)
        return result(myItem(item))
      }
      if (op.operationId === 'listMyTreeholePenalties') return result(page(ordered(values(penalties).filter(p => p.owner === owner && p.notifiedAt !== null), 'createdAt', true).map(p => personalPenalty(p)), query))
      if (op.operationId === 'getMyTreeholePenalty') { const penalty = own(penalties, p.penaltyId, 'TREEHOLE_CASE_NOT_FOUND'); if (!penalty.notifiedAt) fail(404, 'TREEHOLE_CASE_NOT_FOUND'); return result(personalPenalty(penalty, true)) }
      if (op.operationId === 'listMyTreeholeAppeals') return result(page(ordered(values(appeals).filter(a => a.owner === owner), 'createdAt', true).map(appealView), query))
      if (op.operationId === 'createMyTreeholeAppeal') {
        const penalty = own(penalties, p.penaltyId, 'TREEHOLE_CASE_NOT_FOUND')
        if (!penalty.notifiedAt) fail(404, 'TREEHOLE_CASE_NOT_FOUND')
        if (values(appeals).some(a => a.penaltyId === p.penaltyId && a.status === 'pending')) fail(409, 'TREEHOLE_APPEAL_PENDING')
        if (now() >= Date.parse(deadline(penalty))) fail(409, 'TREEHOLE_APPEAL_WINDOW_CLOSED')
        if (values(appeals).some(a => a.penaltyId === p.penaltyId && a.status === 'rejected' && a.reason === body.reason)) fail(409, 'TREEHOLE_APPEAL_NOT_ALLOWED')
        if (!canAppeal(penalty)) fail(409, 'TREEHOLE_APPEAL_NOT_ALLOWED')
        const a = { id: id(), owner, penaltyId: p.penaltyId, status: 'pending', reason: body.reason, createdAt: time(), decisionReason: null, resolvedAt: null, overdue: false }
        appeals.set(a.id, a); current = () => appealView(a); return result(current(), 201)
      }
      const adminCollections = { reviews: [reviews, reviewView], reports: [reports, reportView], penalties: [penalties, adminPenalty], appeals: [appeals, (a, detail) => ({ ...appealView(a), ...(detail ? { penalty: adminPenalty(penalties.get(a.penaltyId), true) } : {}) })] }
      if (op.path.startsWith('/admin-api/')) {
        const kind = op.path.split('/')[3]; const [map, view] = adminCollections[kind]
        const entityId = Object.values(p)[0]
        if (op.method === 'GET') {
          if (entityId) return result(view(get(map, entityId), true))
          const items = ordered(values(map).filter(item => Object.entries(query).every(([k, v]) => ['page', 'pageSize'].includes(k) || item[k] === v)), 'createdAt')
          if (kind === 'appeals') items.sort((a, b) => Number(appealView(b).overdue) - Number(appealView(a).overdue))
          return result(page(items.map(item => view(item)), query))
        }
        const item = get(map, entityId)
        if (op.operationId === 'revokeAdminPenalty') {
          if (item.status === 'revoked') fail(409, 'TREEHOLE_CASE_ALREADY_RESOLVED')
          if (['pending_confirmation', 'declined'].includes(item.status)) fail(409, 'TREEHOLE_CASE_NOT_ACTIONABLE')
          revoke(item, body.reason); return result({ id: item.id, status: 'revoked', decidedAt: time(), recomputed: true })
        }
        actionable(item)
        if (kind === 'reviews') {
          const content = targetItem(item.target)
          if (!item.isCurrent || gone(content) || (content.postId && !visible(posts.get(content.postId)))) fail(409, 'TREEHOLE_CASE_NOT_ACTIONABLE')
          Object.assign(item, { status: 'completed', decision: body.decision, reason: body.reason, completedAt: time(), violationCode: body.violationCode ?? null, points: body.points ?? null, countedViolationId: body.decision === 'violation' ? id() : null })
          content.status = body.decision === 'approve' ? 'published' : 'rejected'; content.reasonCode = body.decision === 'approve' ? null : 'content_violation'
          if (body.decision === 'approve' && !content.publishedAt) { content.publishedAt = time(); if (!content.postId) content.expiresAt = future(content.ttlHours * 3600000) }
          return result({ id: item.id, status: item.status, decision: item.decision, violationId: item.countedViolationId, penaltyIds: [], decidedAt: time() })
        }
        if (kind === 'reports') {
          const r = reviews.get(body.reviewId)
          if (!r || item.reviewId !== r.id || !r.isCurrent || r.status !== 'completed' || r.target.id !== item.target.id || r.decision !== (body.decision === 'upheld' ? 'violation' : 'approve')) fail(409, 'TREEHOLE_CASE_NOT_ACTIONABLE')
          Object.assign(item, { status: body.decision, resolvedAt: time(), decisionReason: body.reason }); return result({ id: item.id, status: item.status, reviewId: r.id, decidedAt: time() })
        }
        if (kind === 'penalties') {
          if (body.decision === 'confirm') activate(item, body.tier, body.reason)
          else Object.assign(item, { status: 'declined', reason: body.reason })
          return result({ ...pick(item, ['id', 'status', 'tier', 'startsAt', 'endsAt']), decidedAt: time() })
        }
        if (kind === 'appeals') {
          Object.assign(item, { status: body.decision === 'uphold' ? 'upheld' : 'rejected', decisionReason: body.reason, resolvedAt: time() })
          if (body.decision === 'uphold') revoke(penalties.get(item.penaltyId), body.reason)
          return result({ id: item.id, penaltyId: item.penaltyId, status: item.status, decidedAt: time(), recomputed: body.decision === 'uphold' })
        }
      }
      throw new Error(`Unimplemented mock operation: ${op.operationId}`)
    }
    const response = decide()
    if (replayKey) replays.set(replayKey, { fingerprint, current, status: response.status, response: structuredClone(response) })
    return response
  }
  seed()
  return { reset: seed, handle, access }
}
