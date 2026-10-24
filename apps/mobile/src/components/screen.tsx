import { colors, spacing } from "@/theme/tokens";
import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, Text, View, type ScrollViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function Screen({ children, scroll = true, refreshControl }: PropsWithChildren<{ scroll?: boolean; refreshControl?: ScrollViewProps["refreshControl"] }>) {
  return <SafeAreaView edges={["top"]} style={styles.safe}>{scroll ? <ScrollView refreshControl={refreshControl} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>{children}</ScrollView> : <View style={styles.content}>{children}</View>}</SafeAreaView>;
}

export function PageHeader({ kicker, title, copy }: { kicker: string; title: string; copy?: string }) {
  return <View style={styles.header}><Text style={styles.kicker}>{kicker}</Text><Text style={styles.title}>{title}</Text>{copy ? <Text style={styles.copy}>{copy}</Text> : null}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 120, gap: spacing.md },
  header: { paddingTop: spacing.sm, paddingBottom: spacing.sm }, kicker: { color: colors.orange, fontSize: 11, fontWeight: "900", letterSpacing: 2 }, title: { color: colors.green, fontSize: 34, lineHeight: 42, fontWeight: "900", letterSpacing: -1.5, marginTop: 3 }, copy: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 6 },
});
