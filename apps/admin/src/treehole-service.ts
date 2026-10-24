import type { AdminAppealDetail, AdminAppealPage, AdminPenaltyDetail, AdminPenaltyPage, AdminReportDetail, AdminReportPage, AdminReviewDetail, AdminReviewPage, Error as TreeholeError, AppealDecision, PenaltyDecision, ReportDecision, ReviewDecision, RevokePenalty } from "@cangqiong/api-contracts/treehole"

export type CaseKind = "reviews" | "reports" | "penalties" | "appeals"
type Pages = { reviews: AdminReviewPage; reports: AdminReportPage; penalties: AdminPenaltyPage; appeals: AdminAppealPage }
type Details = { reviews: AdminReviewDetail; reports: AdminReportDetail; penalties: AdminPenaltyDetail; appeals: AdminAppealDetail }
export type CaseDetail = { [K in CaseKind]: { kind: K; data: Details[K] } }[CaseKind]
export type CasePage = Pages[CaseKind]
export type Attempt = { key: string; body: string }
export type DecisionBody = AppealDecision | PenaltyDecision | ReportDecision | ReviewDecision | RevokePenalty

export class TreeholeApiError extends Error {
  readonly code?: TreeholeError["error"]["code"]
  readonly details?: TreeholeError["error"]["details"]
  readonly requestId?: string
  constructor(readonly status: number, payload: Partial<TreeholeError>, readonly serverDate: string | null) {
    super(payload.error?.message ?? `请求失败（HTTP ${status}）`)
    this.name = "TreeholeApiError"
    this.code = payload.error?.code
    this.details = payload.error?.details
    this.requestId = payload.error?.requestId
  }
}

export function createAttemptKeeper(uuid: () => string = () => crypto.randomUUID()) {
  let previous: { fingerprint: string; attempt: Attempt } | undefined
  return (path: string, body: DecisionBody): Attempt => {
    const serialized = JSON.stringify(body)
    const fingerprint = `${path}:${serialized}`
    if (previous?.fingerprint !== fingerprint) previous = { fingerprint, attempt: { key: uuid(), body: serialized } }
    return previous.attempt
  }
}

export function createTreeholeService(config: { baseUrl?: string; token: () => string | null; fetch?: typeof fetch }) {
  let serverDate: string | null = null
  const attempts = new Map<string, ReturnType<typeof createAttemptKeeper>>()
  async function request<T>(path: string, attempt?: Attempt): Promise<T> {
    const headers = new Headers({ Accept: "application/json" })
    const token = config.token()
    if (token) headers.set("Authorization", `Bearer ${token}`)
    if (attempt) {
      headers.set("Content-Type", "application/json")
      headers.set("Idempotency-Key", attempt.key)
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20_000)
    try {
      const response = await (config.fetch ?? fetch)(`${(config.baseUrl ?? "").replace(/\/$/, "")}/admin-api/treehole${path}`, {
        method: attempt ? "POST" : "GET", headers, cache: "no-store", signal: controller.signal, ...(attempt ? { body: attempt.body } : {}),
      })
      serverDate = response.headers.get("Date")
      let body: unknown
      try { body = await response.json() } catch {
        throw new TreeholeApiError(response.status, {}, serverDate)
      }
      if (!response.ok) throw new TreeholeApiError(response.status, body && typeof body === "object" ? body as TreeholeError : {}, serverDate)
      return body as T
    } catch (cause) {
      if (controller.signal.aborted) throw new Error("请求超时，请保持原参数重试以确认处理结果。")
      throw cause
    } finally {
      clearTimeout(timer)
    }
  }
  return {
    get serverDate() { return serverDate },
    attempt(path: string, body: DecisionBody) {
      let keep = attempts.get(path)
      if (!keep) { keep = createAttemptKeeper(); attempts.set(path, keep) }
      return keep(path, body)
    },
    list<K extends CaseKind>(kind: K, page: number, filters: { status?: string; reviewerType?: string } = {}) {
      const query = new URLSearchParams({ page: String(page), pageSize: "10" })
      if (filters.status) query.set("status", filters.status)
      if (kind === "reviews" && filters.reviewerType) query.set("reviewerType", filters.reviewerType)
      return request<Pages[K]>(`/${kind}?${query}`)
    },
    get<K extends CaseKind>(kind: K, id: string) { return request<Details[K]>(`/${kind}/${id}`) },
    mutate(path: string, attempt: Attempt) { return request<unknown>(path, attempt) },
  }
}

export type TreeholeService = ReturnType<typeof createTreeholeService>
