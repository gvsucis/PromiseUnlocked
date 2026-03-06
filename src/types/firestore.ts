import { Timestamp } from "firebase/firestore";

export interface UserDocument {
  email: string | null;
  displayName: string | null;
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
  isAnonymous: boolean;
}

export interface SessionDocument {
  startedAt: Timestamp;
  completedAt: Timestamp | null;
  status: "in_progress" | "completed" | "abandoned";
  totalInteractions: number;
  weakFitCount: number;
  categoriesMappedCount: number;
  categoriesMapped: string[];
}

export interface InteractionDocument {
  sequenceIndex: number;
  question: string;
  answer: string;
  inputMethod: "text" | "voice" | "image";
  mappedCategory: string | null;
  isWeakFit: boolean;
  isAlreadyMapped: boolean;
  justification: string;
  timestamp: Timestamp;
}

export interface PassportCategoryMapping {
  sessionId: string;
  interactionId: string;
  justification: string;
  timestamp: Timestamp;
}

export interface SkillPassportDocument {
  category: string;
  firstMappedAt: Timestamp;
  lastMappedAt: Timestamp;
  totalMappings: number;
  mappings: PassportCategoryMapping[];
}

export interface IdentifiedSkillDocument {
  skill: string;
  category: string;
  source: "text" | "voice" | "image";
  confidence: number | null;
  dateIdentified: Timestamp;
  sessionId: string | null;
}
