import express from "express";
import { firebaseLogin, firebaseRegister } from "@/services/firebaseAuthService";
import { authSchema } from "@/validation/authSchema";

const router = express.Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Invalid credentials
 */
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

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: User registration
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthRequest'
 *     responses:
 *       200:
 *         description: Registration successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation failed
 *       409:
 *         description: Email already in use
 */
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

/**
 * @swagger
 * components:
 *   schemas:
 *     AuthRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           minLength: 6
 *     AuthResponse:
 *       type: object
 *       properties:
 *         idToken:
 *           type: string
 *         refreshToken:
 *           type: string
 *         userId:
 *           type: string
 */

export default router;
