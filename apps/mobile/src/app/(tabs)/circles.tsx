import { PageHeader, Screen } from "@/components/screen";
import { colors, radius, spacing } from "@/theme/tokens";
import { StyleSheet, Text, View } from "react-native";

const circles = [
  { glyph: "学", name: "学习搭子", copy: "自习、备考与技能交换", tone: colors.greenSoft, note: "今晚 7 点组队" },
  { glyph: "动", name: "运动搭子", copy: "夜跑、球类与新手训练", tone: colors.blueSoft, note: "新手友好" },
  { glyph: "校", name: "校园生活", copy: "食堂测评与校园见闻", tone: "#FFF1C9", note: "本周活跃" },
  { glyph: "集", name: "二手闲置", copy: "让好东西继续被使用", tone: colors.orangeSoft, note: "当面交易" },
];

export default function CirclesScreen() {
  return <Screen><PageHeader kicker="CAMPUS CIRCLES" title="找到你的圈" copy="黑客松阶段先展示圈子方向；加入与退出接口将在后续接入。" />
    <View style={styles.note}><Text style={styles.noteTitle}>阶段说明</Text><Text style={styles.noteCopy}>当前页面是明确标记的演示内容，不会伪造成员数或加入结果。</Text></View>
    {circles.map((circle, index) => <View key={circle.name} style={styles.card}><View style={[styles.glyph, { backgroundColor: circle.tone }]}><Text style={styles.glyphText}>{circle.glyph}</Text></View><View style={styles.body}><Text style={styles.index}>0{index + 1} / CIRCLE</Text><Text style={styles.name}>{circle.name}</Text><Text style={styles.copy}>{circle.copy}</Text></View><View style={styles.badge}><Text style={styles.badgeText}>{circle.note}</Text></View></View>)}
  </Screen>;
}

const styles = StyleSheet.create({
  note: { backgroundColor: colors.green, borderRadius: radius.md, padding: spacing.md }, noteTitle: { color: colors.yellow, fontSize: 12, fontWeight: "900", letterSpacing: 1 }, noteCopy: { color: colors.surface, fontSize: 13, lineHeight: 20, marginTop: 5 },
  card: { minHeight: 118, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }, glyph: { width: 64, height: 64, borderRadius: 22, alignItems: "center", justifyContent: "center" }, glyphText: { color: colors.green, fontSize: 23, fontWeight: "900" }, body: { flex: 1 }, index: { color: colors.orange, fontSize: 9, fontWeight: "900", letterSpacing: 1.3 }, name: { color: colors.ink, fontSize: 20, fontWeight: "900", marginTop: 4 }, copy: { color: colors.muted, fontSize: 12, marginTop: 5 }, badge: { position: "absolute", right: 12, top: 12, backgroundColor: colors.background, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 5 }, badgeText: { color: colors.green, fontSize: 9, fontWeight: "800" },
});
