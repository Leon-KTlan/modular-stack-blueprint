import type { SubmissionStatus } from '@cangqiong/api-contracts/treehole'

export function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, '\n').trim()
}
export function textLength(value: string): number { return Array.from(normalizeText(value)).length }
export function validateText(value: string, max: number): string {
  const text = normalizeText(value)
  if (!text) return '请先写下内容'
  if (/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/.test(text)) return '请移除不支持的控制字符'
  return textLength(text) > max ? `请控制在 ${max} 字以内` : ''
}

// Keep a failed submission's key until its request changes or succeeds.
export class SubmissionKey {
  private fingerprint = ''
  private key = ''
  forRequest(scope: string, body: object): string {
    const fingerprint = `${scope}:${JSON.stringify(body)}`
    if (fingerprint !== this.fingerprint) {
      this.fingerprint = fingerprint
      this.key = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const n = Math.floor(Math.random() * 16)
        return (c === 'x' ? n : (n & 3) | 8).toString(16)
      })
    }
    return this.key
  }
  clear(): void { this.fingerprint = ''; this.key = '' }
}
export function needsRefresh(time: string | null, now: number): boolean {
  return time !== null && Date.parse(time) <= now
}
export function remainingTime(time: string | null, now: number): string {
  if (!time) return '通过后开始计时'
  const minutes = Math.ceil((Date.parse(time) - now) / 60000)
  if (minutes <= 0) return '正在确认状态'
  return minutes >= 60 ? `还剩 ${Math.ceil(minutes / 60)} 小时` : `还剩 ${minutes} 分钟`
}
export function formatTime(time: string | null): string {
  if (!time) return '长期限制'
  const date = new Date(time)
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
export const submissionLabels: Record<SubmissionStatus, string> = {
  published: '公开中', pending_review: '待审核', rejected: '审核未通过', closed: '审核超时关闭', unavailable: '内容已不可用',
}
