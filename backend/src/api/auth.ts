import express from "express";
import { AuthController } from "../controllers/AuthController";
import { authSchema } from "@/validation/authSchema";

const router = express.Router();

router.post("/login", async (req, res) => {
  const parseResult = authSchema.safeParse(req.body ?? {});
  if (!parseResult.success) {
    return res.status(400).json({ error: "Validation failed", details: parseResult.error.errors });
  }
  req.body = parseResult.data;
  return AuthController.login(req, res);
});

router.post("/register", async (req, res) => {
  const parseResult = authSchema.safeParse(req.body ?? {});
  if (!parseResult.success) {
    return res.status(400).json({ error: "Validation failed", details: parseResult.error.errors });
  }
  req.body = parseResult.data;
  return AuthController.register(req, res);
});

export default router;
