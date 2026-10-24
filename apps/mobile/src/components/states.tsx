import { colors, radius, spacing } from "@/theme/tokens";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

export function LoadingState({ label = "正在加载" }: { label?: string }) {
  return <View style={styles.state}><ActivityIndicator color={colors.orange} /><Text style={styles.copy}>{label}</Text></View>;
}
export function EmptyState({ title, copy }: { title: string; copy: string }) {
  return <View style={styles.card}><Text style={styles.symbol}>◇</Text><Text style={styles.title}>{title}</Text><Text style={styles.copy}>{copy}</Text></View>;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <View style={styles.card}><Text style={styles.symbol}>!</Text><Text style={styles.title}>这次没连上</Text><Text style={styles.copy}>{message}</Text>{onRetry ? <Pressable style={styles.button} onPress={onRetry}><Text style={styles.buttonText}>重新试试</Text></Pressable> : null}</View>;
}
const styles = StyleSheet.create({
  state: { alignItems: "center", gap: spacing.sm, paddingVertical: 48 },
  card: { margin: spacing.md, padding: spacing.lg, alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  symbol: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.orangeSoft, color: colors.orange, textAlign: "center", lineHeight: 38, fontSize: 24, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center" },
  button: { marginTop: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.green, paddingHorizontal: 20, paddingVertical: 11 },
  buttonText: { color: colors.surface, fontWeight: "800" },
});
