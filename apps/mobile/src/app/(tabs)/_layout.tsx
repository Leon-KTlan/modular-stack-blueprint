import { colors } from "@/theme/tokens";
import { Tabs } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

const glyphs: Record<string, string> = { index: "⌂", circles: "◎", publish: "+", messages: "✦", profile: "人" };

export default function TabsLayout() {
  return <Tabs screenOptions={({ route }) => ({
    headerShown: false,
    tabBarActiveTintColor: colors.orange,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: styles.bar,
    tabBarLabelStyle: styles.label,
    tabBarIcon: ({ color, focused }) => <View style={[styles.icon, route.name === "publish" && styles.publishIcon, focused && route.name !== "publish" && styles.activeIcon]}><Text style={[styles.glyph, { color: route.name === "publish" ? colors.surface : color }]}>{glyphs[route.name] ?? "·"}</Text></View>,
  })}>
    <Tabs.Screen name="index" options={{ title: "首页" }} />
    <Tabs.Screen name="circles" options={{ title: "圈子" }} />
    <Tabs.Screen name="publish" options={{ title: "发布" }} />
    <Tabs.Screen name="messages" options={{ title: "消息" }} />
    <Tabs.Screen name="profile" options={{ title: "我的" }} />
  </Tabs>;
}

const styles = StyleSheet.create({
  bar: { height: 78, paddingTop: 7, paddingBottom: 9, backgroundColor: "#FFFDF8", borderTopColor: colors.border },
  label: { fontSize: 11, fontWeight: "800" }, icon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" }, activeIcon: { backgroundColor: colors.orangeSoft }, publishIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.orange, marginTop: -16, borderWidth: 4, borderColor: colors.background }, glyph: { fontSize: 18, lineHeight: 21, fontWeight: "900" },
});
