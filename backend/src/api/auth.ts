import express from "express";
import axios from "axios";

const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  try {
    // Use Firebase Auth REST API to verify password
    const apiKey = process.env.FIREBASE_API_KEY || "AIzaSyD9KKN0M--DKCwdi5WkLn6dLkycRlHqva8";
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
    const response = await axios.post(url, {
      email,
      password,
      returnSecureToken: true,
    });
    // response.data contains idToken, refreshToken, localId, etc.
    return res.json({
      idToken: response.data.idToken,
      refreshToken: response.data.refreshToken,
      userId: response.data.localId,
    });
  } catch (error: any) {
    if (error.response?.data?.error) {
      const code = error.response.data.error.message;
      if (code === "EMAIL_NOT_FOUND" || code === "INVALID_PASSWORD") {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      return res.status(400).json({ error: code });
    }
    return res.status(500).json({ error: "Login failed", details: error.message });
  }
});

export default router;
