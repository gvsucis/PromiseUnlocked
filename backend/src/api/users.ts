import express from "express";
import { authenticateToken } from "@/middleware/auth";
import {
  admin,
  normalizeSession,
  normalizeUser,
  participantsCollection,
  participantSessionsCollection,
} from "@/services/firestore";
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
  const snapshot = await participantsCollection.doc(uid).get();
  if (snapshot.exists) {
    const data = snapshot.data();
    if (data) {
      return data;
    }
  }
  const userRecord = await admin.auth().getUser(uid);
  const profile = buildProfileFromRecord(userRecord);
  await participantsCollection.doc(uid).set(profile);
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
      displayName: displayName === "undefined" ? baseProfile.displayName : displayName,
      photoURL: photoURL === "undefined" ? baseProfile.photoURL : photoURL,
    };
    await participantsCollection.doc(userRecord.uid).set(profile);
    return res.status(201).json({ user: normalizeUser(profile) });
  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({ error: "Failed to create user" });
  }
});

router.get("/me", authenticateToken, async (req, res) => {
  const { uid } = (req as AuthenticatedRequest).user;
  try {
    const profile = await fetchOrCreateProfile(uid);
    return res.json({ user: normalizeUser(profile) });
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
    await participantsCollection.doc(uid).set(updates, { merge: true });
    const profile = await fetchOrCreateProfile(uid);
    return res.json({ user: normalizeUser(profile) });
  } catch (error) {
    console.error("Error updating profile:", error);
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

router.get("/all", authenticateToken, async (_req, res) => {
  try {
    const snapshot = await participantsCollection.get();
    const users = snapshot.docs.map((doc) => normalizeUser(doc));
    console.log("Fetched users:", users);
    return res.json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.get("/:uid", authenticateToken, async (req, res) => {
  const { uid } = req.params;
  if (typeof uid !== "string") {
    return res.status(400).json({ error: "Invalid user id" });
  }
  try {
    const sessionSnapshot = await participantsCollection.doc(uid).get();
    if (!sessionSnapshot.exists) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json({ user: normalizeUser(sessionSnapshot) });
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.get("/:uid/sessions", authenticateToken, async (req, res) => {
  const { uid } = req.params as { uid: string };
  try {
    const sessionsSnapshot = await participantSessionsCollection(uid).get();
    const sessions = sessionsSnapshot.docs.map((doc) => normalizeSession(doc));
    return res.json({ sessions });
  } catch (error) {
    console.error("Error fetching sessions for user:", error);
    return res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

router.get("/", authenticateToken, async (req, res) => {
  const { uid } = (req as AuthenticatedRequest).user;
  try {
    const snapshot = await participantsCollection.get();
    const users = snapshot.docs
      .map((doc) => normalizeUser(doc) as UserProfile)
      .filter((user) => user.uid === uid);
    return res.json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ error: "Failed to fetch users" });
  }
});

export default router;
