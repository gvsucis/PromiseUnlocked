export type AppAuthMode = "loading" | "guest" | "authenticated" | "signed_out";

export interface AppAuthSession {
  uid: string | null;
  mode: AppAuthMode;
  isAnonymous: boolean;
  email: string | null;
  displayName: string | null;
}
