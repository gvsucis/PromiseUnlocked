import express from "express";
import { admin } from "../services/firestore";

const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  try {
    // Here, we only create a custom token for an existing user.
    const user = await admin.auth().getUserByEmail(email);
    const customToken = await admin.auth().createCustomToken(user.uid);
    return res.json({ customToken });
  } catch (error: any) {
    if (error.code === "auth/user-not-found") {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    return res.status(500).json({ error: "Login failed", details: error.message });
  }
});

export default router;
