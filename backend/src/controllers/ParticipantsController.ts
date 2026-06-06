import type { Request, Response } from "express";
import {
  admin,
  normalizeSession,
  normalizeUser,
  participantSessionDoc,
  participantSessionsCollection,
  participantsCollection,
} from "@/services/firestore";
import type { Address, AuthenticatedRequest, UserProfile } from "@/types/firestore";
import { canAccessParticipant, isAdminUser } from "@/utils/authz";
import { profileUpdateSchema } from "@/validation/profileUpdateSchema";

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

export class ParticipantsController {
  static async createParticipant(req: Request, res: Response) {
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
  }

  static async getAllParticipants(req: Request, res: Response) {
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
  }

  static async getMe(req: Request, res: Response) {
    const requester = (req as AuthenticatedRequest).user;
    try {
      const profile = await fetchOrCreateProfile(requester.uid);
      return res.json({ participant: normalizeUser(profile) });
    } catch (error) {
      console.error("Error fetching authenticated participant:", error);
      return res.status(500).json({ error: "Failed to fetch participant profile" });
    }
  }

  static async updateMe(req: Request, res: Response) {
    const requester = (req as AuthenticatedRequest).user;

    const parsed = profileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid profile fields",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const {
      displayName,
      email,
      photoURL,
      pageUrl,
      fullName,
      schoolName,
      schoolAddress,
      phone,
      dateOfBirth,
      gender,
      ethnicity,
      address: rawAddress,
    } = parsed.data;

    try {
      const currentProfile = await fetchOrCreateProfile(requester.uid);

      const src = rawAddress ?? currentProfile.address;
      const address = src
          ? {
              street: src.street ?? null,
              city: src.city ?? null,
              state: src.state ?? null,
              postalCode: src.postalCode ?? null,
              country: src.country ?? null,
            } as Address
          : null;

      const nextProfile: UserProfile = {
        uid: currentProfile.uid,
        email: email ?? currentProfile.email,
        displayName: displayName ?? (currentProfile.displayName ?? null),
        photoURL: photoURL ?? (currentProfile.photoURL ?? null),
        pageUrl: pageUrl ?? (currentProfile.pageUrl ?? null),
        fullName: fullName ?? (currentProfile.fullName ?? null),
        schoolName: schoolName ?? (currentProfile.schoolName ?? null),
        schoolAddress: schoolAddress ?? (currentProfile.schoolAddress ?? null),
        phone: phone ?? (currentProfile.phone ?? null),
        dateOfBirth: dateOfBirth ?? (currentProfile.dateOfBirth ?? null),
        gender: gender ?? (currentProfile.gender ?? null),
        ethnicity: ethnicity ?? (currentProfile.ethnicity ?? null),
        address,
        metadata: currentProfile.metadata,
        updatedAt: Date.now(),
        createdAt: currentProfile.createdAt ?? Date.now(),
      };

      const authUpdates: { displayName?: string; email?: string; photoURL?: string } = {};
      if (typeof displayName === "string") {
        authUpdates.displayName = displayName;
      }
      if (typeof email === "string") {
        authUpdates.email = email;
      }
      if (typeof photoURL === "string") {
        authUpdates.photoURL = photoURL;
      }

      if (Object.keys(authUpdates).length > 0) {
        await admin.auth().updateUser(requester.uid, authUpdates);
      }

      await participantsCollection.doc(requester.uid).set(nextProfile, { merge: true });
      return res.json({ participant: normalizeUser(nextProfile) });
    } catch (error) {
      console.error("Error updating authenticated participant:", error);
      return res.status(500).json({ error: "Failed to update participant profile" });
    }
  }

  static async getMeSessions(req: Request, res: Response) {
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
  }

  static async getMeSessionById(req: Request, res: Response) {
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
  }

  static async getParticipantById(req: Request, res: Response) {
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
  }

  static async deleteParticipant(req: Request, res: Response) {
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
  }
}
