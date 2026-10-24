export const HOT_RANKING_WEIGHTS = { like: 1, favorite: 3, comment: 2 } as const

export type DailyInteractions = { likeCount: number; favoriteCount: number; commentCount: number }

export function formatHeat(value: number): string {
  return value >= 10000 ? `${(value / 10000).toFixed(1)}万` : String(value)
}

export function rankHotPosts<T extends { id: string; today: DailyInteractions }>(items: T[]) {
  return items.map((item) => ({
    ...item,
    score: item.today.likeCount * HOT_RANKING_WEIGHTS.like
      + item.today.favoriteCount * HOT_RANKING_WEIGHTS.favorite
      + item.today.commentCount * HOT_RANKING_WEIGHTS.comment,
  })).filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item, index) => ({ ...item, rank: index + 1, heatText: formatHeat(item.score) }))
}

export function getBeijingDate(now: Date): string {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, ".")
}
