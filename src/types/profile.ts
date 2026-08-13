export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  createdAt: number;
  updatedAt: number;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  schoolName?: string | null;
  schoolAddress?: string | null;
  phone?: string | null;
  address?: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  ethnicity?: string | null;
  pageUrl?: string | null;
  selectedPvaId?: string | null;
  selectedPvaName?: string | null;
  metadata: Record<string, unknown>;
}

export interface ProfileUpdatePayload {
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  pageUrl?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  schoolName?: string | null;
  schoolAddress?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  ethnicity?: string | null;
  selectedPvaId?: string | null;
  address?: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null;
  metadata?: Record<string, unknown>;
}
