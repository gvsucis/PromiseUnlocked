import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AppAuthSession } from "../types/auth";
import {
  bootstrapAuthSession,
  continueAsGuest,
  getCurrentAuthSession,
  logoutToGuest,
  resetPassword,
  signInWithEmail,
  signUpWithEmail,
  subscribeToAuthSession,
} from "../services/auth/authSessionService";

interface AuthContextValue {
  session: AppAuthSession;
  isReady: boolean;
  continueAsGuest: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<unknown>;
  signUpWithEmail: (email: string, password: string) => Promise<unknown>;
  resetPassword: (email: string) => Promise<void>;
  logoutToGuest: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [session, setSession] = useState<AppAuthSession>(getCurrentAuthSession());
  const [isReady, setIsReady] = useState(session.mode !== "loading");

  useEffect(() => {
    const unsubscribe = subscribeToAuthSession((nextSession) => {
      setSession(nextSession);
      setIsReady(nextSession.mode !== "loading");
    });

    void bootstrapAuthSession().then(() => {
      setIsReady(true);
    });

    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isReady,
      continueAsGuest,
      signInWithEmail,
      signUpWithEmail,
      resetPassword,
      logoutToGuest,
    }),
    [isReady, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
