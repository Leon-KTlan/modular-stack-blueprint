import { SessionProvider } from "@/services/session";
import { colors } from "@/theme/tokens";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="post/[id]" options={{ animation: "slide_from_right" }} />
      </Stack>
    </SessionProvider>
  );
}
