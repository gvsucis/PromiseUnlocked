import { FieldValue, Timestamp } from "firebase/firestore";

export type InteractionMappingOutcome = "mapped" | "already_mapped" | "weak_fit" | "invalid";

export interface UserDocument {
  email: string | null;
  displayName: string | null;
  createdAt: Timestamp | FieldValue;
  lastActiveAt: Timestamp | FieldValue;
  isAnonymous: boolean;
}

export interface SessionDocument {
  startedAt: Timestamp;
  completedAt: Timestamp | null;
  status: "in_progress" | "completed" | "abandoned";
  totalInteractions: number;
  weakFitCount: number;
  alreadyMappedCount: number;
  categoriesMappedCount: number;
  categoriesMapped: string[];
}

export interface InteractionDocument {
  sequenceIndex: number;
  question: string;
  answer: string;
  inputMethod: "text" | "voice" | "image";
  mappingOutcome: InteractionMappingOutcome;
  mappedCategory: string | null;
  isWeakFit: boolean;
  isAlreadyMapped: boolean;
  justification: string;
  specificStamp?: string | null;
  matchedToCategory: string | null;
  matchedToSequenceIndex: number | null;
  timestamp: Timestamp;
}

export interface PassportCategoryMapping {
  sessionId: string;
  interactionId: string;
  justification: string;
  specificStamp?: string | null;
  timestamp: Timestamp;
}

export interface UnlockedStampEntry {
  timesUnlocked: number;
  firstUnlockedAt: Timestamp;
  lastUnlockedAt: Timestamp;
}

export interface SkillPassportDocument {
  category: string;
  firstMappedAt: Timestamp;
  lastMappedAt: Timestamp;
  totalMappings: number;
  mappings: PassportCategoryMapping[];
  unlockedStamps?: Record<string, UnlockedStampEntry>;
}

export interface IdentifiedSkillDocument {
  skill: string;
  category: string;
  source: "text" | "voice" | "image";
  confidence: number | null;
  dateIdentified: Timestamp;
  sessionId: string | null;
}
