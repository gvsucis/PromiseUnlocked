// This file has been renamed from users.ts to participants.ts as part of the RESTful API refactor.
// All routes and variable names have been updated to use 'participant' instead of 'user'.

import express from "express";
import { authenticateToken } from "@/middleware/auth";
import { admin, participantsCollection, participantSessionsCollection } from "@/services/firestore";
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

// Create participant
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
    return res.status(201).json({ participant: profile });
  } catch (error) {
    console.error("Error creating participant:", error);
    return res.status(500).json({ error: "Failed to create participant" });
  }
});

// Get all participants
router.get("/", authenticateToken, async (_req, res) => {
  try {
    const snapshot = await participantsCollection.get();
    const participants = snapshot.docs.map((doc) => doc.data());
    return res.json({ participants });
  } catch (error) {
    console.error("Error fetching participants:", error);
    return res.status(500).json({ error: "Failed to fetch participants" });
  }
});

// Get individual participant
router.get(":uid", authenticateToken, async (req, res) => {
  const { uid } = req.params;
  if (typeof uid !== "string") {
    return res.status(400).json({ error: "Invalid participant id" });
  }
  try {
    const participantSnapshot = await participantsCollection.doc(uid).get();
    if (!participantSnapshot.exists) {
      return res.status(404).json({ error: "Participant not found" });
    }
    return res.json({ participant: participantSnapshot.data() });
  } catch (error) {
    console.error("Error fetching participant:", error);
    return res.status(500).json({ error: "Failed to fetch participant" });
  }
});

// Get sessions for a participant
router.get(":uid/sessions", authenticateToken, async (req, res) => {
  const { uid } = req.params as { uid: string };
  try {
    const sessionsSnapshot = await participantSessionsCollection(uid).get();
    const sessions = sessionsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return res.json({ sessions });
  } catch (error) {
    console.error("Error fetching sessions for participant:", error);
    return res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

// Delete participant
router.delete(":uid", authenticateToken, async (req, res) => {
  const requester = (req as AuthenticatedRequest).user;
  const { uid } = req.params;
  if (requester.uid !== uid) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    await Promise.all([admin.auth().deleteUser(uid), participantsCollection.doc(uid).delete()]);
    return res.status(204).send();
  } catch (error) {
    console.error("Error deleting participant:", error);
    return res.status(500).json({ error: "Failed to delete participant" });
  }
});

export default router;
