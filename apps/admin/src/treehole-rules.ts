import type { AdminReview, AdminReviewDetail, AdminReportDetail, AppealDecision, AppealStatus, PenaltyDecision, PenaltyStatus, ReportDecision, ReviewDecision, RevokePenalty, ViolationCode } from "@cangqiong/api-contracts/treehole"

export const violationOptions: Record<ViolationCode, { label: string; min: number; max: number }> = {
  minor_insult: { label: "轻度不友善", min: 1, max: 3 },
  direct_insult: { label: "直接侮辱", min: 4, max: 9 },
  harassment: { label: "骚扰", min: 4, max: 9 },
  privacy_leak: { label: "泄露隐私", min: 10, max: 20 },
  threat: { label: "明确威胁", min: 10, max: 20 },
  substantiated_defamation: { label: "有事实依据的诽谤", min: 4, max: 20 },
}

export function normalizeReason(value: string): string {
  const reason = value.replace(/\r\n?/g, "\n").trim()
  if (!reason || Array.from(reason).length > 1000 || /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/.test(reason)) throw new Error("处理原因须为 1–1000 个字符，仅允许普通文字和换行。")
  return reason
}

export function canReview(review: Pick<AdminReview, "status" | "isCurrent">) {
  return review.isCurrent && (review.status === "queued" || review.status === "processing")
}

export function reviewDecision(decision: "approve" | "violation", code: ViolationCode, value: string, text: string): ReviewDecision {
  const reason = normalizeReason(text)
  if (decision === "approve") return { decision, reason }
  const range = violationOptions[code]
  const points = Number(value)
  if (!/^[0-9]+$/.test(value) || !Number.isInteger(points) || points < range.min || points > range.max) throw new Error(`${range.label}分值须为 ${range.min}–${range.max} 的整数。`)
  return { decision, violationCode: code, points, reason }
}

export function reportDecision(report: AdminReportDetail, review: AdminReviewDetail | null, decision: ReportDecision["decision"], text: string): ReportDecision {
  if (report.status !== "pending") throw new Error("该举报已结案，请刷新详情。")
  if (!review || review.status !== "completed" || !review.isCurrent || review.target.id !== report.target.id || review.target.type !== report.target.type || review.target.postId !== report.target.postId || review.decision !== (decision === "upheld" ? "violation" : "approve")) throw new Error("请关联同一对象的当前已完成复查；举报成立须对应违规，举报不成立须对应审核通过。")
  return { decision, reviewId: review.id, reason: normalizeReason(text) }
}

export function penaltyDecision(status: PenaltyStatus, decision: "confirm" | "decline", value: string, text: string): PenaltyDecision {
  if (status !== "pending_confirmation") throw new Error("仅待确认处罚可确认或拒绝，请刷新详情。")
  const reason = normalizeReason(text)
  if (decision === "decline") return { decision, reason }
  if (!/^[1-5]$/.test(value)) throw new Error("确认处罚等级须为 1–5。")
  return { decision, tier: Number(value), reason }
}

export function revokeDecision(status: PenaltyStatus, text: string): RevokePenalty {
  if (!["active", "ended", "superseded"].includes(status)) throw new Error("当前处罚不可撤销，请刷新详情。")
  return { reason: normalizeReason(text) }
}

export function appealDecision(status: AppealStatus, decision: AppealDecision["decision"], text: string): AppealDecision {
  if (status !== "pending") throw new Error("该申诉已结案，请刷新详情。")
  return { decision, reason: normalizeReason(text) }
}
