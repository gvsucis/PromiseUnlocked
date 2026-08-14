import { z } from "zod";

const addressSchema = z.object({
  street: z.string().or(z.literal("")).nullable().optional(),
  city: z.string().or(z.literal("")).nullable().optional(),
  state: z.string().or(z.literal("")).nullable().optional(),
  postalCode: z.string().or(z.literal("")).nullable().optional(),
  country: z.string().or(z.literal("")).nullable().optional(),
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
  displayName: z.string().nullable().optional(),
  photoURL: z.string().optional(),
  pageUrl: z.string().or(z.literal("")).nullable().optional(),
  fullName: z.string().nullable().optional(),
  firstName: z.string().or(z.literal("")).nullable().optional(),
  lastName: z.string().or(z.literal("")).nullable().optional(),
  schoolName: z.string().or(z.literal("")).nullable().optional(),
  schoolAddress: z.string().or(z.literal("")).nullable().optional(),
  phone: z.string().or(z.literal("")).nullable().optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .or(z.literal(""))
    .nullable()
    .optional(),
  gender: z.enum(genderValues).nullable().optional(),
  ethnicity: z.enum(ethnicityValues).nullable().optional(),
  address: addressSchema.nullable().optional(),
  selectedPvaId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
