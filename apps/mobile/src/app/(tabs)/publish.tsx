import { PageHeader, Screen } from "@/components/screen";
import { config } from "@/config";
import { apiRequest, ApiError } from "@/services/api";
import { useSession } from "@/services/session";
import { colors, radius, spacing } from "@/theme/tokens";
import type { Category, Post } from "@/types/models";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const previewCategories: Category[] = [{ id: "301", name: "学习", code: "study", sortOrder: 1 }, { id: "302", name: "校园生活", code: "campus-life", sortOrder: 2 }, { id: "303", name: "运动", code: "sport", sortOrder: 3 }];

export default function PublishScreen() {
  const { state } = useSession();
  const [content, setContent] = useState("");
  const [categories, setCategories] = useState<Category[]>(state === "preview" ? previewCategories : []);
  const [categoryId, setCategoryId] = useState(config.demoCategoryId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useFocusEffect(useCallback(() => {
    if (state === "preview") return;
    void apiRequest<{ items: Category[] }>("/api/miniapp/categories", { authenticated: false }).then(({ items }) => {
      setCategories(items); setCategoryId((current: string) => current || items[0]?.id || "");
    }).catch((caught) => setError(caught instanceof ApiError ? caught.message : "分类加载失败"));
  }, [state]));

  async function submit() {
    if (!content.trim()) return setError("先写点想分享的吧");
    if (state === "preview") return Alert.alert("离线预览", "文字已经准备好，但离线预览不会伪造发布成功。配置服务端后可验证真实写入。");
    if (!config.demoCircleId || !categoryId) return setError("请配置 EXPO_PUBLIC_DEMO_CIRCLE_ID，并确认服务端存在启用分类");
    setSubmitting(true); setError("");
    try {
      const post = await apiRequest<Post>("/api/miniapp/posts", { method: "POST", body: { circleId: config.demoCircleId, categoryId, contentType: "TEXT", content: content.trim() } });
      setContent("");
      router.push({ pathname: "/post/[id]", params: { id: post.id } });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "发布失败，请稍后重试");
    } finally { setSubmitting(false); }
  }

  return <Screen><PageHeader kicker="MAKE A MOVE" title="发起一次开耍" copy="先从纯文字开始：真实、直接、能约到人。" />
    <View style={styles.ticket}><Text style={styles.ticketLabel}>发布到</Text><Text style={styles.ticketValue}>{config.demoCircleId ? `演示圈子 #${config.demoCircleId}` : "尚未配置演示圈子"}</Text><View style={styles.cutLeft} /><View style={styles.cutRight} /></View>
    <Text style={styles.label}>选择主题</Text><View style={styles.chips}>{categories.map((category) => <Pressable key={category.id} onPress={() => setCategoryId(category.id)} style={[styles.chip, category.id === categoryId && styles.chipActive]}><Text style={[styles.chipText, category.id === categoryId && styles.chipTextActive]}>{category.name}</Text></Pressable>)}</View>
    <View style={styles.editor}><TextInput multiline maxLength={500} value={content} onChangeText={setContent} placeholder="今晚想找什么搭子？把时间、地点和期待说清楚……" placeholderTextColor="#9A9D98" style={styles.input} textAlignVertical="top" /><Text style={styles.count}>{content.length}/500</Text></View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Pressable disabled={submitting} onPress={() => void submit()} style={({ pressed }) => [styles.submit, pressed && styles.pressed]}>{submitting ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.submitText}>发布邀约  ↗</Text>}</Pressable>
    <Text style={styles.footnote}>图片入口、定位和活动报名不在本次黑客松范围内。</Text>
  </Screen>;
}

const styles = StyleSheet.create({
  ticket: { backgroundColor: colors.green, borderRadius: radius.md, padding: spacing.md, overflow: "hidden" }, ticketLabel: { color: colors.yellow, fontSize: 11, fontWeight: "900", letterSpacing: 1 }, ticketValue: { color: colors.surface, fontSize: 18, fontWeight: "900", marginTop: 6 }, cutLeft: { position: "absolute", left: -9, top: 29, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.background }, cutRight: { position: "absolute", right: -9, top: 29, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.background },
  label: { color: colors.ink, fontSize: 14, fontWeight: "900", marginTop: spacing.sm }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, chip: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 15, paddingVertical: 9 }, chipActive: { backgroundColor: colors.orange, borderColor: colors.orange }, chipText: { color: colors.muted, fontSize: 13, fontWeight: "800" }, chipTextActive: { color: colors.surface },
  editor: { minHeight: 235, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md }, input: { minHeight: 180, color: colors.ink, fontSize: 17, lineHeight: 27, fontWeight: "600" }, count: { color: colors.muted, fontSize: 11, textAlign: "right" },
  error: { color: colors.red, fontSize: 13, lineHeight: 20, fontWeight: "700" }, submit: { height: 56, backgroundColor: colors.orange, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" }, submitText: { color: colors.surface, fontSize: 16, fontWeight: "900" }, pressed: { transform: [{ scale: 0.985 }] }, footnote: { color: colors.muted, textAlign: "center", fontSize: 11, lineHeight: 17 },
});
