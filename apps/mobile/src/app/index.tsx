import { LoadingState } from "@/components/states";
import { useSession } from "@/services/session";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function EntryScreen() {
  const { state } = useSession();
  if (state === "loading") return <SafeAreaView style={{ flex: 1 }}><LoadingState label="正在打开校园通行证" /></SafeAreaView>;
  return <Redirect href={state === "signed-out" ? "/login" : "/(tabs)"} />;
}
