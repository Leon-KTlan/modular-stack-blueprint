import { demoProfile } from "../data/demo"
import type { MiniappProfile } from "../types/models"

export const PROFILE_CACHE_KEY = "miniapp_profile_cache"

export function getCachedProfile(): MiniappProfile {
  const cached = wx.getStorageSync(PROFILE_CACHE_KEY) as MiniappProfile | ""
  return cached && typeof cached === "object" ? cached : { ...demoProfile, stats: { ...demoProfile.stats } }
}

export function cacheProfile(profile: MiniappProfile): void {
  wx.setStorageSync(PROFILE_CACHE_KEY, profile)
}

export function clearProfileCache(): void {
  wx.removeStorageSync(PROFILE_CACHE_KEY)
}
