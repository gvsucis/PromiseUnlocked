export type AppAuthMode = "loading" | "authenticated" | "signed_out";

export interface AppAuthSession {
  uid: string | null;
  mode: AppAuthMode;
  email: string | null;
  displayName: string | null;
}

export type PassportEntry = {
  category: string;
  categoryId: string;
  justification: string;
  dateIdentified: string;
  timesMapped: number;
  unlockedStamps: StampEntry[] | undefined;
};

export type StampEntry = {
  name: string;
  category: string;
  categoryId: string;
  timesUnlocked: number;
  tier?: number;
};
