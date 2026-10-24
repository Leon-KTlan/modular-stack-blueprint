import type {
  Access, Post, PostPage, CommentPage, CreatePost, CreateComment, Receipt,
  LikeResult, CreateReport, ReportReceipt, MyPost, MyComment, MyPostPage, MyCommentPage,
  PenaltyPage, PenaltyDetail, CreateAppeal, Appeal, AppealPage,
} from '@cangqiong/api-contracts/treehole'
import { request } from './api'
import { TREEHOLE_MOCK } from './treehole-config'

let serverOffset = 0
export function treeholeNow(): number { return Date.now() + serverOffset }
export function isTreeholeMock(): boolean {
  return TREEHOLE_MOCK.enabled && wx.getAccountInfoSync().miniProgram.envVersion === 'develop'
}
function call<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', data?: object, key?: string): Promise<T> {
  const mock = isTreeholeMock()
  return request<T>(path, {
    method, data,
    ...(key ? { headers: { 'Idempotency-Key': key } } : {}),
    ...(mock ? { baseURL: TREEHOLE_MOCK.baseURL, token: TREEHOLE_MOCK.token } : {}),
    onResponse({ serverDate }) {
      if (serverDate && Number.isFinite(Date.parse(serverDate))) serverOffset = Date.parse(serverDate) - Date.now()
    },
  })
}
const publicPath = '/api/miniapp/treehole'
const personalPath = '/api/miniapp/me/treehole'
const pageQuery = (page: number) => `?page=${page}&pageSize=10`
export const treehole = {
  access: () => call<Access>(`${personalPath}/access`),
  posts: (page = 1) => call<PostPage>(`${publicPath}/posts${pageQuery(page)}`),
  post: (id: string) => call<Post>(`${publicPath}/posts/${id}`),
  createPost: (body: CreatePost, key: string) => call<Receipt>(`${publicPath}/posts`, 'POST', body, key),
  comments: (id: string, page = 1) => call<CommentPage>(`${publicPath}/posts/${id}/comments${pageQuery(page)}`),
  createComment: (id: string, body: CreateComment, key: string) => call<Receipt>(`${publicPath}/posts/${id}/comments`, 'POST', body, key),
  like: (id: string, liked: boolean) => call<LikeResult>(`${publicPath}/posts/${id}/likes/me`, liked ? 'PUT' : 'DELETE'),
  reportPost: (id: string, body: CreateReport) => call<ReportReceipt>(`${publicPath}/posts/${id}/reports`, 'POST', body),
  reportComment: (id: string, body: CreateReport) => call<ReportReceipt>(`${publicPath}/comments/${id}/reports`, 'POST', body),
  myPosts: (page = 1) => call<MyPostPage>(`${personalPath}/posts${pageQuery(page)}`),
  myPost: (id: string) => call<MyPost>(`${personalPath}/posts/${id}`),
  deletePost: (id: string) => call<void>(`${personalPath}/posts/${id}`, 'DELETE'),
  myComments: (page = 1) => call<MyCommentPage>(`${personalPath}/comments${pageQuery(page)}`),
  myComment: (id: string) => call<MyComment>(`${personalPath}/comments/${id}`),
  deleteComment: (id: string) => call<void>(`${personalPath}/comments/${id}`, 'DELETE'),
  penalties: (page = 1) => call<PenaltyPage>(`${personalPath}/penalties${pageQuery(page)}`),
  penalty: (id: string) => call<PenaltyDetail>(`${personalPath}/penalties/${id}`),
  appeal: (id: string, body: CreateAppeal, key: string) => call<Appeal>(`${personalPath}/penalties/${id}/appeals`, 'POST', body, key),
  appeals: (page = 1) => call<AppealPage>(`${personalPath}/appeals${pageQuery(page)}`),
}
