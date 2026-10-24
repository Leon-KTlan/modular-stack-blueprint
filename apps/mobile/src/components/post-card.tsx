import { colors, radius, spacing } from "@/theme/tokens";
import type { Post } from "@/types/models";
import { Pressable, StyleSheet, Text, View } from "react-native";

function relativeTime(value: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} 小时前` : `${Math.floor(hours / 24)} 天前`;
}

export function PostCard({ post, onPress }: { post: Post; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <View style={styles.topline}><View style={styles.avatar}><Text style={styles.avatarText}>{[...post.user.nickname][0] ?? "游"}</Text></View><View style={styles.identity}><Text style={styles.name}>{post.user.nickname}</Text><Text style={styles.meta}>{post.circle.name} · {relativeTime(post.createdAt)}</Text></View><View style={styles.tag}><Text style={styles.tagText}>{post.category.name}</Text></View></View>
    <Text style={styles.content} numberOfLines={4}>{post.content}</Text>
    <View style={styles.footer}><Text style={styles.metric}>♡ {post.likeCount}</Text><Text style={styles.metric}>◌ {post.commentCount}</Text><Text style={styles.metric}>◎ {post.viewCount}</Text><Text style={styles.open}>查看 →</Text></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 14, shadowColor: colors.green, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  topline: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.green },
  avatarText: { color: colors.green, fontSize: 17, fontWeight: "900" },
  identity: { flex: 1 }, name: { color: colors.ink, fontSize: 15, fontWeight: "800" }, meta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  tag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.orangeSoft }, tagText: { color: colors.orange, fontSize: 11, fontWeight: "800" },
  content: { color: colors.ink, fontSize: 16, lineHeight: 25, fontWeight: "600" },
  footer: { flexDirection: "row", alignItems: "center", gap: 14, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }, metric: { color: colors.muted, fontSize: 12, fontWeight: "700" }, open: { marginLeft: "auto", color: colors.green, fontSize: 12, fontWeight: "900" },
});
