export type Pagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type ApiRequest = <T>(path: string, options?: RequestInit) => Promise<T>

export function formatDate(value: string | null, emptyText = "从未登录") {
  if (!value) return emptyText
  return new Date(value).toLocaleString("zh-CN", { hour12: false })
}

export function buildPageItems(page: number, totalPages: number): Array<number | string> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)

  const visiblePages = [...new Set([1, totalPages, page - 1, page, page + 1])]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((left, right) => left - right)
  const items: Array<number | string> = []
  let previousPage = 0
  for (const visiblePage of visiblePages) {
    if (previousPage && visiblePage - previousPage > 1) items.push(`ellipsis-${visiblePage}`)
    items.push(visiblePage)
    previousPage = visiblePage
  }
  return items
}
