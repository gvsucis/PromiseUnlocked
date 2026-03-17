import express from "express";
import { firebaseLogin, firebaseRegister } from "@/services/firebaseAuthService";
import { authSchema } from "@/validation/authSchema";

const router = express.Router();

router.post("/login", async (req, res) => {
  const parseResult = authSchema.safeParse(req.body ?? {});
  if (!parseResult.success) {
    return res.status(400).json({ error: "Validation failed", details: parseResult.error.errors });
  }
  const { email, password } = parseResult.data;
  const result = await firebaseLogin(email, password);
  if (result.success) {
    return res.json(result.data);
  }
  return res.status(result.status ?? 500).json({ error: result.message, details: result.details });
});

router.post("/register", async (req, res) => {
  const parseResult = authSchema.safeParse(req.body ?? {});
  if (!parseResult.success) {
    return res.status(400).json({ error: "Validation failed", details: parseResult.error.errors });
  }
  const { email, password } = parseResult.data;
  const result = await firebaseRegister(email, password);
  if (result.success) {
    return res.json(result.data);
  }
  return res.status(result.status ?? 500).json({ error: result.message, details: result.details });
});

export default router;
