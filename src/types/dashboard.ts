export interface Stamp {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  unlocked: boolean;
  dateUnlocked?: string;
}

export interface TranscriptSummary {
  institution?: number;
  studentName?: string;
  degree?: string;
  graduationDate?: number;
  gpa?: number;
  totalCredits?: number;
  coursesBySubject: { [key: string]: number };
  topGrades: string[];
  achievements: string[];
}

export interface UserProgress {
  totalScans: number;
  stamps: Stamp[];
  achievements: string[];
  transcriptData?: TranscriptSummary;
  lastScanDate?: string;
}

export interface CourseAnalysis {
  subjects: { [key: string]: number };
  advancedCourses: number;
  diversityScore: number;
  totalCourses: number;
}
