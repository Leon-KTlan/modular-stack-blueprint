import type {
  Access, Post, Comment, MyPost, MyComment, Penalty, PenaltyDetail, Appeal, Restriction,
  Receipt, ReportReason, CreatePost, CreateComment,
} from '@cangqiong/api-contracts/treehole'
import { getErrorMessage } from '../../services/api'
import type { RequestError } from '../../services/api'
import { treehole, treeholeNow, isTreeholeMock } from '../../services/treehole'
import { SubmissionKey, normalizeText, textLength, validateText, remainingTime, formatTime, needsRefresh, submissionLabels } from '../../utils/treehole'

type View = 'feed' | 'detail' | 'mine' | 'penalties' | 'penalty' | 'restricted'
type PostView = Post & { remaining: string }
type MineView = (MyPost | MyComment) & { label: string; remaining: string; note: string }
type PenaltyView = Penalty & { endLabel: string; deadlineLabel: string; statusLabel: string }
const reasonOptions: Array<{ value: ReportReason; label: string }> = [
  { value: 'insult', label: '辱骂或人身攻击' }, { value: 'harassment', label: '骚扰' },
  { value: 'privacy', label: '泄露隐私' }, { value: 'threat', label: '威胁' },
  { value: 'disputed_accusation', label: '有争议的事实指控' }, { value: 'other', label: '其他' },
]
const penaltyLabels = { active: '限制中', ended: '已结束', revoked: '已撤销', superseded: '已被新处罚替代' }
const appealLabels = { pending: '申诉处理中', upheld: '申诉成立', rejected: '申诉未成立' }
const postView = (post: Post): PostView => ({ ...post, remaining: remainingTime(post.expiresAt, treeholeNow()) })
const mineView = (item: MyPost | MyComment): MineView => ({
  ...item, label: submissionLabels[item.status], remaining: item.expiresAt ? remainingTime(item.expiresAt, treeholeNow()) : 'ttlHours' in item ? `通过后展示 ${item.ttlHours} 小时` : '随原帖到期',
  note: item.status === 'pending_review' ? '等待审核 · 暂未公开' : item.status === 'rejected' ? '内容审核未通过' : item.status === 'closed' ? '超过 24 小时未通过，投稿已关闭' : '公开中 · 仅自己可管理',
})

Page({
  submissionKey: new SubmissionKey(),
  appealKey: new SubmissionKey(),
  refreshEpoch: 0,
  detailId: '',
  boundaryRefreshPending: false,
  lastBoundary: '',
  refreshTimer: undefined as ReturnType<typeof setInterval> | undefined,
  data: {
    view: 'feed' as View, navTop: 44, navHeight: 44, mock: false,
    loading: false, busy: false, error: '', errorCode: '', requestId: '',
    posts: [] as PostView[], post: null as PostView | null, comments: [] as Comment[],
    page: 1, totalPages: 0, mineTab: 'posts' as 'posts' | 'comments', mine: [] as MineView[],
    restriction: null as Restriction | null, restrictionEnd: '', restrictionDeadline: '',
    penalties: [] as PenaltyView[], penalty: null as (PenaltyDetail & { endLabel: string; deadlineLabel: string; statusLabel: string }) | null,
    appeals: [] as Array<Appeal & { label: string; createdLabel: string }>, appealPage: 1, appealTotalPages: 0,
    sheet: '' as '' | 'compose' | 'receipt' | 'report' | 'appeal' | 'delete', sheetError: '',
    draft: '', draftCount: 0, composeKind: 'post' as 'post' | 'comment', ttl: 24 as 1 | 6 | 12 | 24, ttls: [1, 6, 12, 24],
    replyId: '', replyName: '', receipt: null as Receipt | null, receiptTitle: '', receiptCopy: '',
    reportId: '', reportKind: 'post' as 'post' | 'comment', reasonOptions, reportReason: 'insult' as ReportReason,
    reportDescription: '', reportCount: 0, appealReason: '', appealCount: 0,
    deleteId: '', deleteKind: 'posts' as 'posts' | 'comments',
  },
  onLoad(options: Record<string, string | undefined>) {
    const capsule = wx.getMenuButtonBoundingClientRect()
    const info = wx.getWindowInfo()
    const navTop = info.statusBarHeight
    this.setData({ navTop, navHeight: Math.max(44, (capsule.bottom - navTop) + 8), view: options.view === 'mine' || options.view === 'penalties' ? options.view : 'feed', mock: isTreeholeMock() })
  },
  onShow() {
    this.clearTimer()
    this.setData({ loading: true })
    this.checkTimeBoundary()
    this.boundaryRefreshPending = false
    void this.refresh()
    this.refreshTimer = setInterval(() => this.checkTimeBoundary(), 1000)
  },
  onHide() { this.clearTimer(); this.refreshEpoch++ },
  onUnload() { this.clearTimer(); this.refreshEpoch++ },
  clearTimer() { if (this.refreshTimer) clearInterval(this.refreshTimer); this.refreshTimer = undefined },
  checkTimeBoundary() {
    const now = treeholeNow()
    const { view, posts, post, mine, restriction, penalties, penalty } = this.data
    const feedExpired = view === 'feed' && posts.some(p => needsRefresh(p.expiresAt, now))
    const detailExpired = view === 'detail' && !!post && needsRefresh(post.expiresAt, now)
    const mineExpired = view === 'mine' && mine.some(item => needsRefresh(item.expiresAt, now))
    const expired = feedExpired || detailExpired || mineExpired
      || view === 'restricted' && !!restriction && needsRefresh(restriction.endsAt, now)
      || view === 'penalties' && penalties.some(p => p.canAppeal && needsRefresh(p.appealDeadlineAt, now))
      || view === 'penalty' && !!penalty && penalty.canAppeal && needsRefresh(penalty.appealDeadlineAt, now)
    // Remove elapsed content immediately, including while another operation is in flight.
    if (view === 'feed') this.setData({ posts: posts.filter(p => !needsRefresh(p.expiresAt, now)).map(postView) })
    if (view === 'detail') this.setData({ post: detailExpired ? null : post ? postView(post) : null, ...(detailExpired ? { comments: [], sheet: '' as const } : {}) })
    if (view === 'mine') this.setData({ mine: mine.filter(item => !needsRefresh(item.expiresAt, now)).map(mineView) })
    const boundary = JSON.stringify([view, restriction?.endsAt, penalties.map(p => p.appealDeadlineAt), penalty?.appealDeadlineAt])
    if (expired && (feedExpired || detailExpired || mineExpired || boundary !== this.lastBoundary)) {
      this.lastBoundary = boundary
      this.boundaryRefreshPending = true
    }
    if (this.boundaryRefreshPending && !this.data.loading && !this.data.busy) {
      this.boundaryRefreshPending = false
      void this.refresh()
    }
  },
  setRestriction(restriction: Restriction) {
    this.setData({ view: 'restricted', restriction, restrictionEnd: formatTime(restriction.endsAt), restrictionDeadline: formatTime(restriction.appealDeadlineAt), posts: [], post: null, comments: [], sheet: '' })
  },
  async requireAccess(epoch: number): Promise<boolean> {
    const access: Access = await treehole.access()
    if (epoch !== this.refreshEpoch) return false
    if (!access.canEnter) { this.setRestriction(access.restriction); return false }
    this.setData({ restriction: null })
    return true
  },
  async refresh(): Promise<void> {
    const epoch = ++this.refreshEpoch
    const { view, page, mineTab } = this.data
    this.setData({ loading: true, error: '', errorCode: '', requestId: '' })
    try {
      if (view === 'feed' || view === 'detail' || view === 'restricted') {
        if (!await this.requireAccess(epoch) || epoch !== this.refreshEpoch) return
        if (view === 'restricted') { this.setData({ view: 'feed', page: 1 }); return await this.refresh() }
      }
      if (view === 'feed') {
        const result = await treehole.posts(page)
        if (epoch === this.refreshEpoch) this.setData({ posts: result.items.map(postView), totalPages: result.pagination.totalPages })
      } else if (view === 'detail' && this.detailId) {
        const [post, comments] = await Promise.all([treehole.post(this.detailId), treehole.comments(this.detailId, page)])
        if (epoch === this.refreshEpoch) this.setData({ post: postView(post), comments: comments.items, totalPages: comments.pagination.totalPages })
      } else if (view === 'mine') {
        const result = mineTab === 'posts' ? await treehole.myPosts(page) : await treehole.myComments(page)
        if (epoch === this.refreshEpoch) this.setData({ mine: result.items.map(mineView), totalPages: result.pagination.totalPages })
      } else if (view === 'penalties' || view === 'penalty') {
        const [penalties, appeals] = await Promise.all([treehole.penalties(page), treehole.appeals(this.data.appealPage)])
        if (epoch !== this.refreshEpoch) return
        this.setData({ penalties: penalties.items.map(p => ({ ...p, endLabel: formatTime(p.endsAt), deadlineLabel: formatTime(p.appealDeadlineAt), statusLabel: penaltyLabels[p.status] })), totalPages: penalties.pagination.totalPages, appeals: appeals.items.map(a => ({ ...a, label: appealLabels[a.status], createdLabel: formatTime(a.createdAt) })), appealTotalPages: appeals.pagination.totalPages })
        if (view === 'penalty' && this.data.penalty) {
          const penalty = await treehole.penalty(this.data.penalty.id)
          if (epoch === this.refreshEpoch) this.setData({ penalty: { ...penalty, endLabel: formatTime(penalty.endsAt), deadlineLabel: formatTime(penalty.appealDeadlineAt), statusLabel: penaltyLabels[penalty.status] } })
        }
      }
    } catch (error) { if (epoch === this.refreshEpoch) await this.handleError(error, epoch) }
    finally { if (epoch === this.refreshEpoch) this.setData({ loading: false }) }
  },
  async handleError(error: unknown, requestEpoch?: number) {
    const epoch = requestEpoch ?? this.refreshEpoch
    if (epoch !== this.refreshEpoch) return
    const err = error as RequestError
    const message = getErrorMessage(error, '暂时无法连接，请稍后重试')
    this.setData({ error: message, errorCode: err.code || '', requestId: err.requestId || '', sheetError: this.data.sheet ? message : '' })
    if (err.code === 'TREEHOLE_RESTRICTED') {
      // Server remains the authority even if a local restriction countdown has elapsed.
      this.setData({ posts: [], post: null, comments: [] })
      try {
        const access = await treehole.access()
        if (epoch === this.refreshEpoch && !access.canEnter) this.setRestriction(access.restriction)
      } catch { if (epoch === this.refreshEpoch) this.setData({ view: 'restricted', sheet: '' }) }
    } else if (err.code === 'TREEHOLE_POST_NOT_FOUND' || err.code === 'TREEHOLE_COMMENT_NOT_FOUND') {
      this.setData({ post: null, comments: [], sheet: '', view: 'feed', posts: [] })
    }
  },
  go(event: WechatMiniprogram.TouchEvent) {
    const view = event.currentTarget.dataset.view as View
    this.setData({ view, page: 1, sheet: '', error: '', mine: [], appeals: [], appealPage: 1 })
    void this.refresh()
  },
  back() {
    const view = this.data.view
    if (view === 'feed' || view === 'restricted' || view === 'mine' || view === 'penalties') { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/circles/circles' }) }); return }
    this.setData({ view: view === 'detail' ? 'feed' : 'penalties', page: 1, sheet: '' })
    void this.refresh()
  },
  openDetail(event: WechatMiniprogram.TouchEvent) {
    const post = this.data.posts.find(p => p.id === event.currentTarget.dataset.id)
    if (!post) return
    this.detailId = post.id
    this.setData({ view: 'detail', post, comments: [], page: 1, sheet: '' })
    void this.refresh()
  },
  openResponses(event: WechatMiniprogram.TouchEvent) {
    if (this.data.view === 'detail') this.openComposer(event)
    else this.openDetail(event)
  },
  async openPenalty(event: WechatMiniprogram.TouchEvent) {
    if (this.data.busy || this.data.loading) return
    const epoch = ++this.refreshEpoch
    this.setData({ busy: true, error: '' })
    try {
      const penalty = await treehole.penalty(event.currentTarget.dataset.id as string)
      if (epoch !== this.refreshEpoch) return
      this.setData({ view: 'penalty', penalty: { ...penalty, endLabel: formatTime(penalty.endsAt), deadlineLabel: formatTime(penalty.appealDeadlineAt), statusLabel: penaltyLabels[penalty.status] } })
    } catch (error) { await this.handleError(error, epoch) }
    finally { this.setData({ busy: false }) }
  },
  selectMineTab(event: WechatMiniprogram.TouchEvent) {
    this.setData({ mineTab: event.currentTarget.dataset.tab as 'posts' | 'comments', mine: [], page: 1 })
    void this.refresh()
  },
  changePage(event: WechatMiniprogram.TouchEvent) {
    const page = this.data.page + Number(event.currentTarget.dataset.step)
    if (this.data.loading || page < 1 || page > this.data.totalPages) return
    this.setData({ page }); void this.refresh()
  },
  changeAppealPage(event: WechatMiniprogram.TouchEvent) {
    const page = this.data.appealPage + Number(event.currentTarget.dataset.step)
    if (this.data.loading || page < 1 || page > this.data.appealTotalPages) return
    this.setData({ appealPage: page }); void this.refresh()
  },
  openComposer(event: WechatMiniprogram.TouchEvent) {
    if (this.data.loading || this.data.busy) return
    const isComment = this.data.view === 'detail'
    if (isComment && !this.data.post) return
    this.setData({ sheet: 'compose', sheetError: '', composeKind: isComment ? 'comment' : 'post', draft: '', draftCount: 0, ttl: 24, replyId: event.currentTarget.dataset.id || '', replyName: event.currentTarget.dataset.name || '' })
  },
  updateDraft(event: WechatMiniprogram.Input) { this.setData({ draft: event.detail.value, draftCount: textLength(event.detail.value), sheetError: '' }) },
  selectTtl(event: WechatMiniprogram.TouchEvent) { this.setData({ ttl: Number(event.currentTarget.dataset.ttl) as 1 | 6 | 12 | 24 }) },
  async submitComposition() {
    if (this.data.busy) return
    const { composeKind, draft, ttl, replyId, post } = this.data
    const error = validateText(draft, composeKind === 'post' ? 1000 : 500)
    if (error) { this.setData({ sheetError: error }); return }
    const content = normalizeText(draft)
    const epoch = this.refreshEpoch
    this.setData({ busy: true, sheetError: '', error: '' })
    try {
      let receipt: Receipt
      if (composeKind === 'post') {
        const body: CreatePost = { content, ttlHours: ttl }
        receipt = await treehole.createPost(body, this.submissionKey.forRequest('post', body))
      } else {
        if (!post) return
        const body: CreateComment = { content, ...(replyId ? { replyToCommentId: replyId } : {}) }
        receipt = await treehole.createComment(post.id, body, this.submissionKey.forRequest(`comment:${post.id}`, body))
      }
      this.submissionKey.clear()
      if (epoch !== this.refreshEpoch) return
      const title = { published: '你的文字已公开。', pending_review: '已收下，正在审核。', rejected: '这次投稿未通过审核。', closed: '这次投稿已关闭。', unavailable: '这段文字已不可用。' }[receipt.status]
      const copy = receipt.status === 'published' ? '文字已公开，可以刷新查看。到期后将从树洞和“我的”消失。' : receipt.status === 'pending_review' ? '现在只有你能看到这段文字。通过后才会公开；需要审核的内容不会提前出现在列表。' : receipt.status === 'unavailable' ? '文字已到期、删除或隐藏，不会重新恢复展示。' : '可在“我的”查看服务端返回的投稿状态。'
      this.setData({ receipt, receiptTitle: title, receiptCopy: copy, sheet: 'receipt', draft: '', draftCount: 0 })
    } catch (error) { await this.handleError(error, epoch) }
    finally { this.setData({ busy: false }) }
  },
  receiptMine() {
    this.setData({ view: 'mine', mineTab: this.data.composeKind === 'post' ? 'posts' : 'comments', mine: [], page: 1, sheet: '' })
    void this.refresh()
  },
  closeSheet() { if (this.data.busy) return; const receipt = this.data.sheet === 'receipt'; this.setData({ sheet: '', sheetError: '' }); if (receipt) void this.refresh() },
  async toggleLike(event: WechatMiniprogram.TouchEvent) {
    if (this.data.busy || this.data.loading) return
    const id = event.currentTarget.dataset.id as string
    const post = this.data.post?.id === id ? this.data.post : this.data.posts.find(p => p.id === id)
    if (!post) return
    const epoch = this.refreshEpoch
    this.setData({ busy: true })
    try {
      const result = await treehole.like(id, !post.likedByMe)
      if (epoch !== this.refreshEpoch) return
      const update = (p: PostView) => p.id === id ? { ...p, likedByMe: result.liked, likeCount: result.likeCount } : p
      this.setData({ posts: this.data.posts.map(update), post: this.data.post ? update(this.data.post) : null })
    } catch (error) { await this.handleError(error, epoch) }
    finally { this.setData({ busy: false }) }
  },
  openReport(event: WechatMiniprogram.TouchEvent) {
    this.setData({ sheet: 'report', reportId: event.currentTarget.dataset.id as string, reportKind: event.currentTarget.dataset.kind as 'post' | 'comment', reportReason: 'insult', reportDescription: '', reportCount: 0, sheetError: '' })
  },
  selectReportReason(event: WechatMiniprogram.TouchEvent) { this.setData({ reportReason: event.currentTarget.dataset.reason as ReportReason }) },
  updateReport(event: WechatMiniprogram.Input) { this.setData({ reportDescription: event.detail.value, reportCount: textLength(event.detail.value) }) },
  async submitReport() {
    if (this.data.busy) return
    const { reportDescription, reportReason, reportId, reportKind } = this.data
    const description = normalizeText(reportDescription)
    const error = description || reportReason === 'other' ? validateText(description, 500) : ''
    if (error) { this.setData({ sheetError: error }); return }
    const epoch = this.refreshEpoch
    this.setData({ busy: true, sheetError: '' })
    try {
      const body = { reason: reportReason, ...(description ? { description } : {}) }
      if (reportKind === 'post') await treehole.reportPost(reportId, body)
      else await treehole.reportComment(reportId, body)
      if (epoch !== this.refreshEpoch) return
      this.setData({ sheet: '' }); wx.showToast({ title: '举报已交给审核处理', icon: 'none' })
    } catch (error) { await this.handleError(error, epoch) }
    finally { this.setData({ busy: false }) }
  },
  confirmDelete(event: WechatMiniprogram.TouchEvent) {
    this.setData({ sheet: 'delete', deleteId: event.currentTarget.dataset.id as string, deleteKind: (event.currentTarget.dataset.kind || this.data.mineTab) as 'posts' | 'comments', sheetError: '' })
  },
  async deleteContent() {
    if (this.data.busy) return
    const epoch = this.refreshEpoch
    this.setData({ busy: true, sheetError: '' })
    try {
      if (this.data.deleteKind === 'posts') await treehole.deletePost(this.data.deleteId)
      else await treehole.deleteComment(this.data.deleteId)
      if (epoch !== this.refreshEpoch) return
      const deletedPost = this.data.view === 'detail' && this.data.deleteKind === 'posts'
      this.setData({ sheet: '', ...(deletedPost ? { view: 'feed' as View, post: null, page: 1 } : {}) })
      await this.refresh()
    } catch (error) { await this.handleError(error, epoch) }
    finally { this.setData({ busy: false }) }
  },
  openAppeal() { if (this.data.penalty?.canAppeal) this.setData({ sheet: 'appeal', appealReason: '', appealCount: 0, sheetError: '' }) },
  updateAppeal(event: WechatMiniprogram.Input) { this.setData({ appealReason: event.detail.value, appealCount: textLength(event.detail.value) }) },
  async submitAppeal() {
    if (this.data.busy || !this.data.penalty) return
    const error = validateText(this.data.appealReason, 1000)
    if (error) { this.setData({ sheetError: error }); return }
    const body = { reason: normalizeText(this.data.appealReason) }
    const id = this.data.penalty.id
    const epoch = this.refreshEpoch
    this.setData({ busy: true, sheetError: '' })
    try {
      await treehole.appeal(id, body, this.appealKey.forRequest(`appeal:${id}`, body))
      this.appealKey.clear()
      if (epoch !== this.refreshEpoch) return
      this.setData({ sheet: '', appealPage: 1 }); await this.refresh()
      wx.showToast({ title: '申诉已提交，请等待处理', icon: 'none' })
    } catch (error) {
      await this.handleError(error, epoch)
      if (epoch !== this.refreshEpoch) return
      const code = (error as RequestError).code
      if (code === 'TREEHOLE_APPEAL_PENDING' || code === 'TREEHOLE_APPEAL_WINDOW_CLOSED' || code === 'TREEHOLE_APPEAL_NOT_ALLOWED') {
        this.setData({ sheet: '' }); await this.refresh()
      }
    } finally { this.setData({ busy: false }) }
  },
  stopPropagation() {},
})
