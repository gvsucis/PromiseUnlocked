import type { UserProfile } from "../services/profileService";

export const REQUIRED_DEMOGRAPHIC_FIELDS = [
  "dateOfBirth",
  "gender",
  "ethnicity",
  "phone",
  "street",
  "city",
  "state",
  "postalCode",
  "country",
  "schoolName",
] as const;

function isFilled(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

export function getDemographicsProgress(profile: UserProfile | null | undefined) {
  const total = REQUIRED_DEMOGRAPHIC_FIELDS.length;
  if (!profile) return { completed: 0, total, isComplete: false };

  const values: Record<(typeof REQUIRED_DEMOGRAPHIC_FIELDS)[number], unknown> = {
    dateOfBirth: profile.dateOfBirth,
    gender: profile.gender,
    ethnicity: profile.ethnicity,
    phone: profile.phone,
    street: profile.address?.street,
    city: profile.address?.city,
    state: profile.address?.state,
    postalCode: profile.address?.postalCode,
    country: profile.address?.country,
    schoolName: profile.schoolName,
  };

  const completed = REQUIRED_DEMOGRAPHIC_FIELDS.filter((key) => isFilled(values[key])).length;

  return { completed, total, isComplete: completed === total };
}
