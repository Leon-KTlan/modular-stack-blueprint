import { PostCard } from "@/components/post-card";
import { ErrorState, LoadingState } from "@/components/states";
import { PageHeader, Screen } from "@/components/screen";
import { fallbackPosts } from "@/data/fallback-demo";
import { apiRequest, ApiError } from "@/services/api";
import { useSession } from "@/services/session";
import { colors, radius, spacing } from "@/theme/tokens";
import type { Paginated, Post } from "@/types/models";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";

const quickActions = [{ glyph: "学", label: "学习搭子", color: colors.greenSoft }, { glyph: "动", label: "运动搭子", color: colors.blueSoft }, { glyph: "校", label: "校园生活", color: "#FFF1C9" }, { glyph: "集", label: "二手闲置", color: colors.orangeSoft }];

export default function HomeScreen() {
  const { state } = useSession();
  const [posts, setPosts] = useState<Post[]>(state === "preview" ? fallbackPosts : []);
  const [loading, setLoading] = useState(state !== "preview");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    if (state === "preview") return setPosts(fallbackPosts);
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const result = await apiRequest<Paginated<Post>>("/api/miniapp/posts?page=1&pageSize=20");
      setPosts(result.items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "帖子加载失败");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [state]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.orange} />}>
    <PageHeader kicker="KAISHUA · PARTNER" title="今天，开耍什么？" copy="从一条帖子开始，找到同频的人。" />
    {state === "preview" ? <View style={styles.preview}><Text style={styles.previewText}>离线预览 · 所有互动只在本次界面中展示</Text></View> : null}
    <View style={styles.hero}><View style={styles.heroBadge}><Text style={styles.heroBadgeText}>今日提案</Text></View><Text style={styles.heroTitle}>别等“下次”，{`\n`}现在就找个搭子。</Text><Text style={styles.heroArrow}>↗</Text></View>
    <View style={styles.actions}>{quickActions.map((item) => <View key={item.label} style={styles.action}><View style={[styles.actionGlyph, { backgroundColor: item.color }]}><Text style={styles.actionGlyphText}>{item.glyph}</Text></View><Text style={styles.actionLabel}>{item.label}</Text></View>)}</View>
    <View style={styles.sectionLine}><Text style={styles.sectionTitle}>校园正在发生</Text><Text style={styles.sectionMark}>LIVE</Text></View>
    {loading ? <LoadingState label="正在看看大家玩什么" /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : posts.map((post) => <PostCard key={post.id} post={post} onPress={() => router.push({ pathname: "/post/[id]", params: { id: post.id } })} />)}
  </Screen>;
}

const styles = StyleSheet.create({
  preview: { borderRadius: radius.pill, backgroundColor: colors.orangeSoft, paddingHorizontal: 13, paddingVertical: 8, alignSelf: "flex-start" }, previewText: { color: colors.orange, fontSize: 11, fontWeight: "800" },
  hero: { minHeight: 155, backgroundColor: colors.green, borderRadius: radius.lg, padding: spacing.lg, overflow: "hidden" }, heroBadge: { alignSelf: "flex-start", backgroundColor: colors.yellow, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 }, heroBadgeText: { color: colors.green, fontSize: 11, fontWeight: "900" }, heroTitle: { color: colors.surface, fontSize: 25, lineHeight: 34, fontWeight: "900", marginTop: 16 }, heroArrow: { position: "absolute", color: colors.orange, fontSize: 76, fontWeight: "300", right: 16, bottom: -10, transform: [{ rotate: "6deg" }] },
  actions: { flexDirection: "row", justifyContent: "space-between", gap: 8 }, action: { flex: 1, alignItems: "center", gap: 7 }, actionGlyph: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-3deg" }] }, actionGlyphText: { color: colors.green, fontSize: 19, fontWeight: "900" }, actionLabel: { color: colors.ink, fontSize: 11, fontWeight: "800", textAlign: "center" },
  sectionLine: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm }, sectionTitle: { color: colors.ink, fontSize: 21, fontWeight: "900", flex: 1 }, sectionMark: { color: colors.red, fontSize: 10, fontWeight: "900", letterSpacing: 2 },
});
