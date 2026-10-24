import { PageHeader, Screen } from "@/components/screen";
import { colors, radius, spacing } from "@/theme/tokens";
import { StyleSheet, Text, View } from "react-native";

export default function MessagesScreen() {
  return <Screen><PageHeader kicker="MESSAGE BOARD" title="消息留在路上" copy="互动通知将在真实接口准备好后接入。" />
    <View style={styles.board}><View style={styles.pin} /><Text style={styles.big}>建设中</Text><Text style={styles.copy}>这里未来会放点赞、评论和系统通知。黑客松版本不展示假未读数，也不伪造私信会话。</Text><View style={styles.rule} /><Text style={styles.note}>NEXT · 互动通知 / 已读状态 / 前台刷新</Text></View>
  </Screen>;
}
const styles = StyleSheet.create({ board: { marginTop: 36, backgroundColor: "#FFF1C9", borderRadius: radius.lg, padding: spacing.xl, minHeight: 310, justifyContent: "center", transform: [{ rotate: "-1deg" }], borderWidth: 1, borderColor: "#E6CB86" }, pin: { position: "absolute", top: 18, alignSelf: "center", width: 18, height: 18, borderRadius: 9, backgroundColor: colors.orange, borderWidth: 3, borderColor: colors.surface }, big: { color: colors.green, fontSize: 48, fontWeight: "900", letterSpacing: -3 }, copy: { color: colors.ink, fontSize: 15, lineHeight: 24, fontWeight: "600", marginTop: spacing.md }, rule: { height: 2, backgroundColor: colors.green, opacity: 0.2, marginVertical: spacing.lg }, note: { color: colors.orange, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 } });
