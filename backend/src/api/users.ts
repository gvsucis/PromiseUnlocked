import express from "express";
import { authenticateToken } from "@/middleware/auth";
import { admin, usersCollection } from "@/services/firestore";
import type { AuthenticatedRequest, UserProfile } from "@/types/firestore";

const router = express.Router();

const buildProfileFromRecord = (
  userRecord: admin.auth.UserRecord,
  metadata: Record<string, unknown> = {}
): UserProfile => {
  const now = Date.now();
  return {
    uid: userRecord.uid,
    email: userRecord.email ?? "",
    displayName: userRecord.displayName ?? null,
    photoURL: userRecord.photoURL ?? null,
    createdAt: now,
    updatedAt: now,
    metadata,
  };
};

const fetchOrCreateProfile = async (uid: string): Promise<UserProfile> => {
  const snapshot = await usersCollection.doc(uid).get();
  if (snapshot.exists) {
    const data = snapshot.data();
    if (data) {
      return data;
    }
  }
  const userRecord = await admin.auth().getUser(uid);
  const profile = buildProfileFromRecord(userRecord);
  await usersCollection.doc(uid).set(profile);
  return profile;
};

router.post("/", async (req, res) => {
  const { email, password, displayName, photoURL, metadata = {} } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
      photoURL,
    });
    const baseProfile = buildProfileFromRecord(userRecord, metadata);
    const profile: UserProfile = {
      ...baseProfile,
      displayName: typeof displayName !== "undefined" ? displayName : baseProfile.displayName,
      photoURL: typeof photoURL !== "undefined" ? photoURL : baseProfile.photoURL,
    };
    await usersCollection.doc(userRecord.uid).set(profile);
    return res.status(201).json({ user: profile });
  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({ error: "Failed to create user" });
  }
});

router.get("/me", authenticateToken, async (req, res) => {
  const { uid } = (req as AuthenticatedRequest).user;
  try {
    const profile = await fetchOrCreateProfile(uid);
    return res.json({ user: profile });
  } catch (error) {
    console.error("Error fetching authenticated user:", error);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.patch("/me", authenticateToken, async (req, res) => {
  const { uid } = (req as AuthenticatedRequest).user;
  const { displayName, photoURL, metadata } = req.body ?? {};
  if (displayName === undefined && photoURL === undefined && metadata === undefined) {
    return res.status(400).json({ error: "No fields supplied for update" });
  }
  const authUpdates: admin.auth.UpdateRequest = {};
  if (displayName !== undefined) {
    authUpdates.displayName = displayName;
  }
  if (photoURL !== "undefined") {
    authUpdates.photoURL = photoURL;
  }
  try {
    if (Object.keys(authUpdates).length > 0) {
      await admin.auth().updateUser(uid, authUpdates);
    }
    const updates: Partial<UserProfile> = { updatedAt: Date.now() };
    if (displayName !== "undefined") {
      updates.displayName = displayName;
    }
    if (photoURL !== "undefined") {
      updates.photoURL = photoURL;
    }
    if (metadata !== "undefined") {
      updates.metadata = metadata;
    }
    await usersCollection.doc(uid).set(updates, { merge: true });
    const profile = await fetchOrCreateProfile(uid);
    return res.json({ user: profile });
  } catch (error) {
    console.error("Error updating profile:", error);
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

router.get("/:uid", authenticateToken, async (req, res) => {
  const requester = (req as AuthenticatedRequest).user;
  const { uid } = req.params;
  if (requester.uid !== uid) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const profile = await fetchOrCreateProfile(uid);
    return res.json({ user: profile });
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.delete("/:uid", authenticateToken, async (req, res) => {
  const requester = (req as AuthenticatedRequest).user;
  const { uid } = req.params;
  if (requester.uid !== uid) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    await Promise.all([admin.auth().deleteUser(uid), usersCollection.doc(uid).delete()]);
    return res.status(204).send();
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
