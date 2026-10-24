import { config, isApiConfigured } from "@/config";
import { ApiError } from "@/services/api";
import { useSession } from "@/services/session";
import { colors, radius, spacing } from "@/theme/tokens";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const { enterDemo, enterPreview } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDemoLogin() {
    setLoading(true);
    setError("");
    try {
      await enterDemo();
      router.replace("/(tabs)");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "进入演示失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  function handlePreview() {
    enterPreview();
    router.replace("/(tabs)");
  }

  return <SafeAreaView style={styles.safe}>
    <View style={styles.sun} /><View style={styles.doodle}><Text style={styles.doodleText}>✦</Text></View>
    <View style={styles.hero}>
      <Text style={styles.eyebrow}>CAMPUS SOCIAL CLUB</Text><Text style={styles.logo}>开耍</Text><Text style={styles.partner}>PARTNER</Text>
      <Text style={styles.slogan}>同频的人，{`\n`}让日常更好玩。</Text>
      <View style={styles.passport}><Text style={styles.passportLabel}>今日通行证</Text><Text style={styles.passportCopy}>发现搭子 · 分享校园 · 现在出发</Text><View style={styles.stamp}><Text style={styles.stampText}>KS{`\n`}GO!</Text></View></View>
    </View>
    <View style={styles.actions}>
      {isApiConfigured() ? <Pressable disabled={loading} style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={handleDemoLogin}>{loading ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryText}>进入真实演示  →</Text>}</Pressable> : null}
      <Pressable style={styles.secondary} onPress={handlePreview}><Text style={styles.secondaryText}>{isApiConfigured() ? "先看离线预览" : "进入离线预览"}</Text></Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.hint}>{isApiConfigured() ? `服务端：${config.apiBaseUrl}` : "未配置 EXPO_PUBLIC_API_BASE_URL，离线预览不会写入服务端"}</Text>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg, overflow: "hidden" },
  sun: { position: "absolute", width: 260, height: 260, borderRadius: 130, backgroundColor: colors.yellow, opacity: 0.22, top: -90, right: -90 },
  doodle: { position: "absolute", right: 30, top: 140, width: 58, height: 58, borderRadius: 29, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center", transform: [{ rotate: "12deg" }] },
  doodleText: { color: colors.green, fontSize: 30, fontWeight: "900" },
  hero: { flex: 1, justifyContent: "center", paddingTop: 44 }, eyebrow: { color: colors.orange, fontSize: 11, fontWeight: "900", letterSpacing: 2.4 },
  logo: { color: colors.green, fontSize: 76, lineHeight: 84, fontWeight: "900", letterSpacing: -6 }, partner: { color: colors.orange, fontSize: 14, fontWeight: "900", letterSpacing: 8, marginLeft: 4 },
  slogan: { color: colors.ink, fontSize: 31, lineHeight: 41, fontWeight: "900", marginTop: spacing.lg, letterSpacing: -1 },
  passport: { marginTop: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.green, padding: spacing.lg, overflow: "hidden" }, passportLabel: { color: colors.yellow, fontSize: 13, fontWeight: "900", letterSpacing: 1 }, passportCopy: { color: colors.surface, fontSize: 15, fontWeight: "700", marginTop: 8, maxWidth: "70%" },
  stamp: { position: "absolute", right: 18, top: 14, width: 68, height: 68, borderRadius: 34, borderWidth: 3, borderColor: colors.orange, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-10deg" }] }, stampText: { color: colors.orange, textAlign: "center", fontSize: 16, lineHeight: 18, fontWeight: "900" },
  actions: { paddingBottom: spacing.lg, gap: spacing.sm }, primary: { height: 56, borderRadius: radius.pill, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center", shadowColor: colors.orange, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 }, primaryText: { color: colors.surface, fontSize: 16, fontWeight: "900" },
  secondary: { height: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.green, alignItems: "center", justifyContent: "center" }, secondaryText: { color: colors.green, fontSize: 14, fontWeight: "800" }, pressed: { transform: [{ scale: 0.98 }] }, error: { color: colors.red, textAlign: "center", fontSize: 13, fontWeight: "700" }, hint: { color: colors.muted, textAlign: "center", fontSize: 11, lineHeight: 16 },
});
