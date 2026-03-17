import type { Request, Response, NextFunction } from "express";
import { admin } from "../services/firestore";
import type { AuthenticatedRequest } from "../types/firestore";

export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;
  if (!idToken) {
    return res.status(401).json({ error: "No token provided" });
  }
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    (req as AuthenticatedRequest).user = decodedToken;
    next();
  } catch (error) {
    // Intentionally catching token verification errors to return 401 Unauthorized
    console.error("Token verification failed:", error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
