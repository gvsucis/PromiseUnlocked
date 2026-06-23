import type { Request, Response } from "express";

import {
  admin,
  normalizeSession,
  normalizeUser,
  participantsCollection,
  participantSessionsCollection,
} from "@/services/firestore";
import type { AuthenticatedRequest, UserProfile } from "@/types/firestore";
import { DEFAULT_ROLE, isAdminUser, isSuperAdmin, isValidRole } from "@/utils/authz";
import { parsePagination } from "@/utils/pagination";
import { normalizeSearchTerm, searchParticipantDocs } from "@/utils/participantSearch";

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

export class UsersController {
  static async createUser(req: Request, res: Response) {
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
  }

  static async getMe(req: Request, res: Response) {
    const { uid } = (req as AuthenticatedRequest).user;
    try {
      const profile = await fetchOrCreateProfile(uid);
      return res.json({ user: normalizeUser(profile) });
    } catch (error) {
      console.error("Error fetching authenticated user:", error);
      return res.status(500).json({ error: "Failed to fetch profile" });
    }
  }

  static async updateMe(req: Request, res: Response) {
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
  }

  static async getAllUsers(req: Request, res: Response) {
    const requester = (req as AuthenticatedRequest).user;
    if (!isAdminUser(requester)) {
      return res.status(403).json({ error: "Forbidden — admin access required" });
    }
    try {
      const { page, pageSize, offset } = parsePagination(req.query, 20, 100);
      const term = normalizeSearchTerm(req.query.search);

      if (term) {
        const snapshot = await participantsCollection.get();
        const matched = searchParticipantDocs(snapshot.docs, term);
        const paginated = matched.slice(offset, offset + pageSize);
        return res.json({ users: paginated, page, pageSize, total: matched.length });
      }

      const totalSnapshot = await participantsCollection.count().get();
      const total = totalSnapshot.data().count;

      const snapshot = await participantsCollection
        .orderBy("createdAt", "desc")
        .offset(offset)
        .limit(pageSize)
        .get();
      const users = snapshot.docs.map((doc) => normalizeUser(doc));
      return res.json({ users, page, pageSize, total });
    } catch (error) {
      console.error("Error fetching users:", error);
      return res.status(500).json({ error: "Failed to fetch users" });
    }
  }

  static async updateUserRole(req: Request, res: Response) {
    const requester = (req as AuthenticatedRequest).user;
    if (!isSuperAdmin(requester)) {
      return res.status(403).json({ error: "Forbidden — super admin access required" });
    }

    const { uid } = req.params;
    if (typeof uid !== "string" || !uid) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    if (uid === requester.uid) {
      return res.status(400).json({ error: "You cannot change your own role" });
    }

    const role = req.body?.role ?? DEFAULT_ROLE;
    if (!isValidRole(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    try {
      const userRecord = await admin.auth().getUser(uid).catch(() => null);
      if (!userRecord) {
        return res.status(404).json({ error: "User not found" });
      }

      // Custom claims drive isAdminUser/isSuperAdmin; the token must be refreshed
      // by the client before the new role takes effect.
      await admin.auth().setCustomUserClaims(uid, {
        ...userRecord.customClaims,
        role,
        admin: role === "admin" || role === "superadmin",
      });

      await participantsCollection.doc(uid).set({ role, updatedAt: Date.now() }, { merge: true });

      return res.json({ uid, role });
    } catch (error) {
      console.error("Error updating user role:", error);
      return res.status(500).json({ error: "Failed to update user role" });
    }
  }

  static async getUserById(req: Request, res: Response) {
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
  }

  static async getUserSessions(req: Request, res: Response) {
    const { uid } = req.params as { uid: string };
    try {
      const sessionsSnapshot = await participantSessionsCollection(uid).get();
      const sessions = sessionsSnapshot.docs.map((doc) => normalizeSession(doc));
      return res.json({ sessions });
    } catch (error) {
      console.error("Error fetching sessions for user:", error);
      return res.status(500).json({ error: "Failed to fetch sessions" });
    }
  }

  static async getCurrentUser(req: Request, res: Response) {
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
  }
}
