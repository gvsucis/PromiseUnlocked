import express from "express";
import { authenticateToken } from "@/middleware/auth";
import {
  admin,
  normalizeSession,
  normalizeUser,
  participantSessionDoc,
  participantSessionsCollection,
  participantsCollection,
} from "@/services/firestore";
import type { AuthenticatedRequest, UserProfile } from "@/types/firestore";
import { canAccessParticipant, isAdminUser } from "@/utils/authz";

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

const parseLimit = (value?: string | string[]) => {
  const asString = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(asString ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 20;
  }
  return Math.min(parsed, 100);
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
    return res.status(201).json({ participant: normalizeUser(profile) });
  } catch (error) {
    console.error("Error creating participant:", error);
    return res.status(500).json({ error: "Failed to create participant" });
  }
});

// Get all participants
router.get("/", authenticateToken, async (req, res) => {
  const requester = (req as AuthenticatedRequest).user;
  try {
    if (isAdminUser(requester)) {
      const snapshot = await participantsCollection.get();
      const participants = snapshot.docs.map((doc) => normalizeUser(doc));
      return res.json({ participants });
    }

    const profile = await fetchOrCreateProfile(requester.uid);
    const participants = [normalizeUser(profile)];
    return res.json({ participants });
  } catch (error) {
    console.error("Error fetching participants:", error);
    return res.status(500).json({ error: "Failed to fetch participants" });
  }
});

router.get("/me", authenticateToken, async (req, res) => {
  const requester = (req as AuthenticatedRequest).user;
  try {
    const profile = await fetchOrCreateProfile(requester.uid);
    return res.json({ participant: normalizeUser(profile) });
  } catch (error) {
    console.error("Error fetching authenticated participant:", error);
    return res.status(500).json({ error: "Failed to fetch participant profile" });
  }
});

router.get("/me/sessions", authenticateToken, async (req, res) => {
  const requester = (req as AuthenticatedRequest).user;
  const { status, limit } = req.query;
  let query = participantSessionsCollection(requester.uid).orderBy("startedAt", "desc");

  if (typeof status === "string" && ["active", "completed", "cancelled"].includes(status)) {
    query = query.where("status", "==", status);
  }

  try {
    const snapshot = await query.limit(parseLimit(limit as string | undefined)).get();
    const sessions = snapshot.docs.map((doc) => normalizeSession(doc));
    return res.json({ sessions });
  } catch (error) {
    console.error("Error fetching authenticated participant sessions:", error);
    return res.status(500).json({ error: "Failed to fetch participant sessions" });
  }
});

router.get("/me/sessions/:sessionId", authenticateToken, async (req, res) => {
  const requester = (req as AuthenticatedRequest).user;
  const { sessionId } = req.params as { sessionId: string };

  try {
    const sessionSnapshot = await participantSessionDoc(requester.uid, sessionId).get();
    if (!sessionSnapshot.exists) {
      return res.status(404).json({ error: "Session not found" });
    }
    return res.json({ session: normalizeSession(sessionSnapshot) });
  } catch (error) {
    console.error("Error fetching authenticated participant session:", error);
    return res.status(500).json({ error: "Failed to fetch participant session" });
  }
});

// Get individual participant
router.get("/:uid", authenticateToken, async (req, res) => {
  const requester = (req as AuthenticatedRequest).user;
  const { uid } = req.params;
  if (typeof uid !== "string") {
    return res.status(400).json({ error: "Invalid participant id" });
  }
  try {
    if (!(await canAccessParticipant(requester, uid))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const participantSnapshot = await participantsCollection.doc(uid).get();
    if (!participantSnapshot.exists) {
      return res.status(404).json({ error: "Participant not found" });
    }
    return res.json({ participant: normalizeUser(participantSnapshot) });
  } catch (error) {
    console.error("Error fetching participant:", error);
    return res.status(500).json({ error: "Failed to fetch participant" });
  }
});

// Delete participant
router.delete("/:uid", authenticateToken, async (req, res) => {
  const requester = (req as AuthenticatedRequest).user;
  const { uid } = req.params as { uid: string };
  if (requester.uid !== uid && !isAdminUser(requester)) {
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
