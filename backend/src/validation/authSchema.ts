import { z } from "zod";

export const authSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  firstName: z.string().min(2, { message: "First name must be at least 2 characters" }).optional(),
  lastName: z.string().min(2, { message: "Last name must be at least 2 characters" }).optional(),
});
