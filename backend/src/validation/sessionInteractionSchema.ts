import { z } from "zod";

export const sessionInteractionSchema = z.object({
  sessionId: z.string().min(1, { message: "sessionId is required" }),
  type: z.string().min(1, { message: "type is required" }),
  payload: z.record(z.any()).optional(),
});
