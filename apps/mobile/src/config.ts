const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, "") ?? "";

export const config = {
  apiBaseUrl: configuredBaseUrl,
  demoCircleId: process.env.EXPO_PUBLIC_DEMO_CIRCLE_ID?.trim() ?? "",
  demoCategoryId: process.env.EXPO_PUBLIC_DEMO_CATEGORY_ID?.trim() ?? "",
};

export function isApiConfigured(): boolean {
  return /^https?:\/\//.test(config.apiBaseUrl);
}
