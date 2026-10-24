import { PageHeader, Screen } from "@/components/screen";
import { useSession } from "@/services/session";
import { colors, radius, spacing } from "@/theme/tokens";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function ProfileScreen() {
  const { profile, state, signOut } = useSession();
  if (!profile) return null;
  return <Screen><PageHeader kicker="MY CAMPUS PASSPORT" title="我的通行证" />
    <View style={styles.passport}><View style={styles.avatar}><Text style={styles.avatarText}>{[...profile.nickname][0] ?? "游"}</Text></View><View style={styles.identity}><Text style={styles.name}>{profile.nickname}</Text><Text style={styles.id}>NO. {profile.id}</Text><Text style={styles.bio}>{profile.bio || "还没有写个人简介"}</Text></View><View style={styles.stamp}><Text style={styles.stampText}>{state === "preview" ? "PREVIEW" : "VERIFIED"}</Text></View></View>
    <View style={styles.stats}><View style={styles.stat}><Text style={styles.value}>{profile.stats.followingCount}</Text><Text style={styles.key}>关注</Text></View><View style={styles.divider} /><View style={styles.stat}><Text style={styles.value}>{profile.stats.followerCount}</Text><Text style={styles.key}>粉丝</Text></View><View style={styles.divider} /><View style={styles.stat}><Text style={styles.value}>{profile.stats.receivedLikeCount}</Text><Text style={styles.key}>获赞</Text></View></View>
    <View style={styles.list}><View style={styles.row}><Text style={styles.rowIcon}>帖</Text><View><Text style={styles.rowTitle}>我的帖子</Text><Text style={styles.rowCopy}>真实列表将在专用接口补齐后接入</Text></View><Text style={styles.rowArrow}>›</Text></View><View style={styles.row}><Text style={styles.rowIcon}>圈</Text><View><Text style={styles.rowTitle}>我的圈子</Text><Text style={styles.rowCopy}>当前不伪造加入状态</Text></View><Text style={styles.rowArrow}>›</Text></View></View>
    <Pressable style={styles.logout} onPress={() => void signOut().then(() => router.replace("/login"))}><Text style={styles.logoutText}>{state === "preview" ? "退出离线预览" : "退出当前设备"}</Text></Pressable>
  </Screen>;
}

const styles = StyleSheet.create({
  passport: { backgroundColor: colors.green, borderRadius: radius.lg, padding: spacing.lg, minHeight: 188, flexDirection: "row", gap: spacing.md, overflow: "hidden" }, avatar: { width: 76, height: 92, borderRadius: 17, backgroundColor: colors.yellow, borderWidth: 4, borderColor: colors.surface, alignItems: "center", justifyContent: "center" }, avatarText: { color: colors.green, fontSize: 32, fontWeight: "900" }, identity: { flex: 1 }, name: { color: colors.surface, fontSize: 23, fontWeight: "900" }, id: { color: colors.yellow, fontSize: 10, fontWeight: "900", letterSpacing: 1.4, marginTop: 4 }, bio: { color: "#DCEADF", fontSize: 13, lineHeight: 20, marginTop: 14 }, stamp: { position: "absolute", right: -13, bottom: -13, width: 94, height: 94, borderRadius: 47, borderWidth: 3, borderColor: colors.orange, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-12deg" }] }, stampText: { color: colors.orange, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  stats: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md }, stat: { flex: 1, alignItems: "center" }, value: { color: colors.ink, fontSize: 22, fontWeight: "900" }, key: { color: colors.muted, fontSize: 11, marginTop: 3 }, divider: { width: 1, height: 28, backgroundColor: colors.border },
  list: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }, row: { minHeight: 78, flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, rowIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.orangeSoft, color: colors.orange, textAlign: "center", lineHeight: 36, fontWeight: "900" }, rowTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" }, rowCopy: { color: colors.muted, fontSize: 11, marginTop: 3 }, rowArrow: { marginLeft: "auto", color: colors.green, fontSize: 26 },
  logout: { height: 50, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.green, alignItems: "center", justifyContent: "center" }, logoutText: { color: colors.green, fontSize: 14, fontWeight: "900" },
});
