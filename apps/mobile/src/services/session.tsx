import { fallbackProfile } from "@/data/fallback-demo";
import { apiRequest } from "@/services/api";
import { sessionStorage } from "@/services/session-storage";
import type { DemoLoginResponse, MiniappProfile } from "@/types/models";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

type SessionState = "loading" | "signed-out" | "signed-in" | "preview";
type SessionContextValue = {
  state: SessionState;
  profile: MiniappProfile | null;
  enterDemo: () => Promise<void>;
  enterPreview: () => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<SessionState>("loading");
  const [profile, setProfile] = useState<MiniappProfile | null>(null);

  const refreshProfile = useCallback(async () => {
    const nextProfile = await apiRequest<MiniappProfile>("/api/miniapp/users/me");
    setProfile(nextProfile);
    setState("signed-in");
  }, []);

  useEffect(() => {
    void (async () => {
      const token = await sessionStorage.getToken();
      if (!token) return setState("signed-out");
      try {
        await refreshProfile();
      } catch {
        await sessionStorage.clearToken();
        setState("signed-out");
      }
    })();
  }, [refreshProfile]);

  const enterDemo = useCallback(async () => {
    const result = await apiRequest<DemoLoginResponse>("/api/mobile/auth/demo", { method: "POST", authenticated: false });
    await sessionStorage.setToken(result.accessToken);
    await refreshProfile();
  }, [refreshProfile]);

  const enterPreview = useCallback(() => {
    setProfile(fallbackProfile);
    setState("preview");
  }, []);

  const signOut = useCallback(async () => {
    await sessionStorage.clearToken();
    setProfile(null);
    setState("signed-out");
  }, []);

  const value = useMemo(() => ({ state, profile, enterDemo, enterPreview, signOut, refreshProfile }), [state, profile, enterDemo, enterPreview, signOut, refreshProfile]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
