import { z } from "zod";

const addressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

const genderValues = ["male", "female", "non-binary", "prefer-not-to-say", "other"] as const;

const ethnicityValues = [
  "american-indian-alaska-native",
  "asian",
  "black-african-american",
  "hispanic-latino",
  "native-hawaiian-pacific-islander",
  "white",
  "two-or-more",
  "prefer-not-to-say",
  "other",
] as const;

export const profileUpdateSchema = z.object({
  email: z.email().optional(),
  displayName: z.string().optional(),
  photoURL: z.string().optional(),
  pageUrl: z.string().optional(),
  fullName: z.string().optional(),
  schoolName: z.string().optional(),
  schoolAddress: z.string().optional(),
  phone: z.string().optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .optional(),
  gender: z.enum(genderValues).optional(),
  ethnicity: z.enum(ethnicityValues).optional(),
  address: addressSchema.optional(),
  selectedPvaId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
