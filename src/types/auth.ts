export type AppAuthMode = "loading" | "guest" | "authenticated" | "signed_out";

export interface AppAuthSession {
  uid: string | null;
  mode: AppAuthMode;
  isAnonymous: boolean;
  email: string | null;
  displayName: string | null;
}

export type PassportEntry = {
  category: string;
  justification: string;
  dateIdentified: string;
  timesMapped: number;
  unlockedStamps: StampEntry[] | undefined;
};

export type StampEntry = {
  name: string;
  timesUnlocked: number;
  tier?: number;
};
