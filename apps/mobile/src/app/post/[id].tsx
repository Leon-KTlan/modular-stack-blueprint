import { ErrorState, LoadingState } from "@/components/states";
import { fallbackPosts } from "@/data/fallback-demo";
import { apiRequest, ApiError } from "@/services/api";
import { useSession } from "@/services/session";
import { colors, radius, spacing } from "@/theme/tokens";
import type { Comment, Paginated, Post } from "@/types/models";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useSession();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liked, setLiked] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!id) return setError("帖子 ID 不合法");
    if (state === "preview") { setPost(fallbackPosts.find((item) => item.id === id) ?? fallbackPosts[0]!); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const [nextPost, nextComments] = await Promise.all([apiRequest<Post>(`/api/miniapp/posts/${id}`), apiRequest<Paginated<Comment>>(`/api/miniapp/posts/${id}/comments?page=1&pageSize=20`)]);
      setPost(nextPost); setComments(nextComments.items);
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "帖子加载失败"); }
    finally { setLoading(false); }
  }, [id, state]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function toggleLike() {
    if (!post) return;
    if (state === "preview") { setLiked((value) => !value); setPost({ ...post, likeCount: post.likeCount + (liked ? -1 : 1) }); return; }
    try {
      const result = await apiRequest<{ liked: boolean; likeCount: number }>(`/api/miniapp/posts/${post.id}/likes/me`, { method: liked ? "DELETE" : "PUT" });
      setLiked(result.liked); setPost({ ...post, likeCount: result.likeCount });
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "点赞失败"); }
  }

  async function sendComment() {
    if (!post || !draft.trim()) return;
    if (state === "preview") return setError("离线预览不会伪造评论写入；连接服务端后可真实验证");
    setSending(true); setError("");
    try {
      const comment = await apiRequest<Comment>(`/api/miniapp/posts/${post.id}/comments`, { method: "POST", body: { content: draft.trim() } });
      setComments((items) => [comment, ...items]); setDraft(""); setPost({ ...post, commentCount: post.commentCount + 1 });
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "评论失败"); }
    finally { setSending(false); }
  }

  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <View style={styles.nav}><Pressable style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>‹</Text></Pressable><Text style={styles.navTitle}>帖子详情</Text><View style={styles.back} /></View>
    {loading ? <LoadingState label="正在打开帖子" /> : error && !post ? <ErrorState message={error} onRetry={() => void load()} /> : post ? <>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {state === "preview" ? <Text style={styles.preview}>离线预览</Text> : null}
        <View style={styles.author}><View style={styles.avatar}><Text style={styles.avatarText}>{[...post.user.nickname][0]}</Text></View><View><Text style={styles.name}>{post.user.nickname}</Text><Text style={styles.meta}>{post.circle.name} · {post.category.name}</Text></View></View>
        <Text style={styles.postCopy}>{post.content}</Text>
        <View style={styles.metrics}><Pressable onPress={() => void toggleLike()} style={[styles.like, liked && styles.likeActive]}><Text style={[styles.likeText, liked && styles.likeTextActive]}>{liked ? "♥" : "♡"} {post.likeCount}</Text></Pressable><Text style={styles.metric}>◌ {post.commentCount}</Text><Text style={styles.metric}>◎ {post.viewCount}</Text></View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.section}><Text style={styles.sectionTitle}>评论现场</Text><Text style={styles.sectionCount}>{comments.length} 条</Text></View>
        {comments.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>还没人接话</Text><Text style={styles.emptyCopy}>成为第一个认真回应的人。</Text></View> : comments.map((comment) => <View key={comment.id} style={styles.comment}><View style={styles.commentAvatar}><Text style={styles.commentAvatarText}>{[...comment.user.nickname][0]}</Text></View><View style={styles.commentBody}><Text style={styles.commentName}>{comment.user.nickname}</Text><Text style={styles.commentCopy}>{comment.content}</Text></View></View>)}
      </ScrollView>
      <View style={styles.composer}><TextInput value={draft} onChangeText={setDraft} maxLength={2000} placeholder="认真接一句……" placeholderTextColor="#979B95" style={styles.input} /><Pressable disabled={sending} onPress={() => void sendComment()} style={styles.send}>{sending ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.sendText}>发送</Text>}</Pressable></View>
    </> : null}
  </KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, nav: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md }, back: { width: 42, height: 42, alignItems: "center", justifyContent: "center" }, backText: { color: colors.green, fontSize: 38, lineHeight: 40, fontWeight: "300" }, navTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  content: { padding: spacing.md, paddingBottom: 42 }, preview: { alignSelf: "flex-start", color: colors.orange, backgroundColor: colors.orangeSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, fontSize: 10, fontWeight: "900", marginBottom: spacing.md },
  author: { flexDirection: "row", alignItems: "center", gap: 12 }, avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.greenSoft, borderWidth: 2, borderColor: colors.green, alignItems: "center", justifyContent: "center" }, avatarText: { color: colors.green, fontSize: 18, fontWeight: "900" }, name: { color: colors.ink, fontSize: 16, fontWeight: "900" }, meta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  postCopy: { color: colors.ink, fontSize: 22, lineHeight: 34, fontWeight: "700", marginTop: spacing.lg }, metrics: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: spacing.lg, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }, like: { borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 15, paddingVertical: 9 }, likeActive: { backgroundColor: colors.orange, borderColor: colors.orange }, likeText: { color: colors.orange, fontWeight: "900" }, likeTextActive: { color: colors.surface }, metric: { color: colors.muted, fontSize: 13, fontWeight: "800" }, error: { color: colors.red, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
  section: { flexDirection: "row", alignItems: "center", marginTop: spacing.lg, marginBottom: spacing.md }, sectionTitle: { color: colors.green, fontSize: 21, fontWeight: "900", flex: 1 }, sectionCount: { color: colors.muted, fontSize: 11, fontWeight: "700" }, empty: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, alignItems: "center" }, emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" }, emptyCopy: { color: colors.muted, fontSize: 12, marginTop: 6 },
  comment: { flexDirection: "row", gap: 11, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, commentAvatar: { width: 36, height: 36, borderRadius: 13, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" }, commentAvatarText: { color: colors.green, fontWeight: "900" }, commentBody: { flex: 1 }, commentName: { color: colors.green, fontSize: 12, fontWeight: "900" }, commentCopy: { color: colors.ink, fontSize: 14, lineHeight: 22, marginTop: 5 },
  composer: { flexDirection: "row", gap: 9, alignItems: "center", backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 10 }, input: { flex: 1, height: 44, borderRadius: radius.pill, backgroundColor: colors.background, paddingHorizontal: 16, color: colors.ink }, send: { height: 44, minWidth: 68, borderRadius: radius.pill, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center" }, sendText: { color: colors.surface, fontSize: 13, fontWeight: "900" },
});
