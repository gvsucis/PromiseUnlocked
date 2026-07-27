import type { Request, Response } from "express";
import {
  admin,
  normalizeSession,
  normalizeParticipant,
  normalizePassport,
  participantSessionDoc,
  participantSessionsCollection,
  participantPassportCollection,
  participantsCollection,
} from "@/services/firestore";
import type { Address, AuthenticatedRequest, ParticipantProfile } from "@/types/firestore";
import { canAccessParticipant, isAdminUser } from "@/utils/authz";
import { profileUpdateSchema } from "@/validation/profileUpdateSchema";
import { parsePagination } from "@/utils/pagination";
import { normalizeSearchTerm, searchParticipantDocs } from "@/utils/participantSearch";

const buildProfileFromRecord = (
  userRecord: admin.auth.UserRecord,
  metadata: Record<string, unknown> = {}
): ParticipantProfile => {
  const now = Date.now();
  return {
    uid: userRecord.uid,
    email: userRecord.email ?? "",
    fullName: userRecord.displayName ?? null,
    photoURL: userRecord.photoURL ?? null,
    createdAt: now,
    updatedAt: now,
    metadata,
  };
};

const fetchOrCreateProfile = async (uid: string): Promise<ParticipantProfile> => {
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

export class ParticipantsController {
  static async createParticipant(req: Request, res: Response) {
    const { email, password, fullName, photoURL, metadata = {} } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    try {
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: fullName ?? null, // Firebase Auth uses displayName internally, but we map it to fullName in our profile
        photoURL,
      });
      const baseProfile = buildProfileFromRecord(userRecord, metadata);
      const profile: ParticipantProfile = {
        ...baseProfile,
        fullName: fullName === "undefined" ? baseProfile.fullName : fullName,
        photoURL: photoURL === "undefined" ? baseProfile.photoURL : photoURL,
      };
      await participantsCollection.doc(userRecord.uid).set(profile);
      return res.status(201).json({ participant: normalizeParticipant(profile) });
    } catch (error) {
      console.error("Error creating participant:", error);
      return res.status(500).json({ error: "Failed to create participant" });
    }
  }

  static async getAllParticipants(req: Request, res: Response) {
    const requester = (req as AuthenticatedRequest).user;
    try {
      if (isAdminUser(requester)) {
        const { page, pageSize, offset } = parsePagination(req.query, 20, 100);
        const term = normalizeSearchTerm(req.query.search);

        if (term) {
          const snapshot = await participantsCollection.get();
          const matched = searchParticipantDocs(snapshot.docs, term);
          const paginated = matched.slice(offset, offset + pageSize);
          return res.json({ participants: paginated, page, pageSize, total: matched.length });
        }

        const totalSnapshot = await participantsCollection.count().get();
        const total = totalSnapshot.data().count;

        const snapshot = await participantsCollection
          .orderBy("createdAt", "desc")
          .offset((page - 1) * pageSize)
          .limit(pageSize)
          .get();
        const participants = snapshot.docs.map((doc) => normalizeParticipant(doc));
        return res.json({ participants, page, pageSize, total });
      }
      const profile = await fetchOrCreateProfile(requester.uid);
      const participants = [normalizeParticipant(profile)];
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
      return res.json({ participant: normalizeParticipant(profile) });
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
        details: parsed.error.issues,
      });
    }

    const {
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
      selectedPvaId,
      metadata: incomingMetadata,
    } = parsed.data;

    try {
      const currentProfile = await fetchOrCreateProfile(requester.uid);

      const src = rawAddress ?? currentProfile.address;
      const address = src
        ? ({
            street: src.street ?? null,
            city: src.city ?? null,
            state: src.state ?? null,
            postalCode: src.postalCode ?? null,
            country: src.country ?? null,
          } as Address)
        : null;

      const nextProfile: ParticipantProfile = {
        uid: currentProfile.uid,
        email: email ?? currentProfile.email,
        fullName: fullName ?? currentProfile.fullName ?? null,
        photoURL: photoURL ?? currentProfile.photoURL ?? null,
        pageUrl: pageUrl ?? currentProfile.pageUrl ?? null,
        schoolName: schoolName ?? currentProfile.schoolName ?? null,
        schoolAddress: schoolAddress ?? currentProfile.schoolAddress ?? null,
        phone: phone ?? currentProfile.phone ?? null,
        dateOfBirth: dateOfBirth ?? currentProfile.dateOfBirth ?? null,
        gender: gender ?? currentProfile.gender ?? null,
        ethnicity: ethnicity ?? currentProfile.ethnicity ?? null,
        address,
        selectedPvaId: selectedPvaId ?? currentProfile.selectedPvaId ?? null,
        metadata: { ...currentProfile.metadata, ...incomingMetadata },
        updatedAt: Date.now(),
        createdAt: currentProfile.createdAt ?? Date.now(),
      };

      // Only forward fields to Firebase Auth that were provided and actually changed.
      const authUpdates: { displayName?: string; email?: string; photoURL?: string } = {};
      const setIfChanged = (key: keyof typeof authUpdates, value: unknown, current: unknown) => {
        if (typeof value === "string" && value !== current) {
          authUpdates[key] = value;
        }
      };
      setIfChanged("displayName", fullName, currentProfile.fullName);
      setIfChanged("email", email, currentProfile.email);
      setIfChanged("photoURL", photoURL, currentProfile.photoURL);

      const tasks: Promise<unknown>[] = [
        participantsCollection.doc(requester.uid).set(nextProfile, { merge: true }),
      ];
      if (Object.keys(authUpdates).length > 0) {
        tasks.push(admin.auth().updateUser(requester.uid, authUpdates));
      }
      await Promise.all(tasks);
      return res.json({ participant: normalizeParticipant(nextProfile) });
    } catch (error) {
      console.error("Error updating authenticated participant:", error);
      return res.status(500).json({ error: "Failed to update participant profile" });
    }
  }

  static async getMeSessions(req: Request, res: Response) {
    const requester = (req as AuthenticatedRequest).user;
    const { status } = req.query;
    const { page, pageSize, offset } = parsePagination(req.query, 20, 100);
    let query = participantSessionsCollection(requester.uid).orderBy("startedAt", "desc");
    if (typeof status === "string" && ["in_progress", "completed", "abandoned"].includes(status)) {
      query = query.where("status", "==", status);
    }
    try {
      const snapshot = await query.offset(offset).limit(pageSize).get();
      const sessions = snapshot.docs.map((doc) => normalizeSession(doc));
      return res.json({ sessions, page, pageSize });
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
      return res.json({ participant: normalizeParticipant(participantSnapshot) });
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

  static async getPassport(req: Request, res: Response) {
    const requester = (req as AuthenticatedRequest).user;
    const { uid } = req.params as { uid: string };
    const sessionId = req.query.sessionId as string | undefined;
    if (!uid) {
      return res.status(400).json({ error: "Missing participant uid" });
    }
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId query param is required" });
    }
    try {
      if (!(await canAccessParticipant(requester, uid))) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const snapshot = await participantPassportCollection(uid, sessionId).get();
      const passport = snapshot.docs.map((doc) => normalizePassport(doc));
      return res.json({ passport, sessionId });
    } catch (error) {
      console.error("Error fetching passport:", error);
      return res.status(500).json({ error: "Failed to fetch passport" });
    }
  }

  static async getMePassport(req: Request, res: Response) {
    const requester = (req as AuthenticatedRequest).user;
    try {
      const sessionsSnapshot = await participantSessionsCollection(requester.uid).get();
      const allPassportDocs: Array<Record<string, unknown>> = [];
      for (const sessionDoc of sessionsSnapshot.docs) {
        const passportSnapshot = await participantPassportCollection(
          requester.uid,
          sessionDoc.id
        ).get();
        for (const p of passportSnapshot.docs) {
          allPassportDocs.push(normalizePassport(p) ?? {});
        }
      }

      const aggregated = allPassportDocs.reduce<Record<string, unknown>>(
        (acc, p) => {
          const category = p.category as string;
          if (!category) return acc;
          if (!acc[category]) {
            acc[category] = { category, totalMappings: 0, unlockedStampCount: 0 };
          }
          const stamps = p.unlockedStamps as Record<string, { timesUnlocked?: number }> | undefined;
          const stampCount = stamps ? Object.keys(stamps).length : 0;
          (acc[category] as Record<string, unknown>).totalMappings =
            ((acc[category] as Record<string, unknown>).totalMappings as number) +
            ((p.totalMappings as number) ?? 0);
          (acc[category] as Record<string, unknown>).unlockedStampCount =
            ((acc[category] as Record<string, unknown>).unlockedStampCount as number) + stampCount;
          return acc;
        },
        {} as Record<string, unknown>
      );

      const passport = Object.values(aggregated) as Array<{
        category: string;
        totalMappings: number;
        unlockedStampCount: number;
      }>;
      const totalStampsUnlocked = passport.reduce(
        (sum, c) => sum + (c.unlockedStampCount as number),
        0
      );
      const totalMappings = passport.reduce((sum, c) => sum + (c.totalMappings as number), 0);

      return res.json({ passport, totalStampsUnlocked, totalMappings });
    } catch (error) {
      console.error("Error fetching authenticated participant passport:", error);
      return res.status(500).json({ error: "Failed to fetch participant passport" });
    }
  }

  static async getAllPassports(req: Request, res: Response) {
    const requester = (req as AuthenticatedRequest).user;
    if (!isAdminUser(requester)) {
      return res.status(403).json({ error: "Forbidden — admin access required" });
    }
    try {
      const participantsSnapshot = await participantsCollection.get();
      const errors: Array<{ uid: string; error: string }> = [];

      const settled = await Promise.allSettled(
        participantsSnapshot.docs.map(async (doc) => {
          try {
            const profile = normalizeParticipant(doc) as Record<string, unknown>;
            const displayName = (profile.displayName as string | null) ?? null;
            const email = (profile.email as string | null) ?? null;
            const schoolName = (profile.schoolName as string | null) ?? null;
            const sessionsSnapshot = await participantSessionsCollection(doc.id)
              .select("status")
              .get();
            const sessionStatusCounts = { completed: 0, in_progress: 0, abandoned: 0 };

            const passportNested = await Promise.all(
              sessionsSnapshot.docs.map(async (sessionDoc) => {
                const status = sessionDoc.get("status") as string;
                if (status === "completed") sessionStatusCounts.completed++;
                else if (status === "in_progress") sessionStatusCounts.in_progress++;
                else if (status === "abandoned") sessionStatusCounts.abandoned++;
                const passportSnapshot = await participantPassportCollection(
                  doc.id,
                  sessionDoc.id
                ).get();
                return passportSnapshot.docs.map((p) => normalizePassport(p) ?? {});
              })
            );
            const allPassportDocs = passportNested.flat();

            const aggregated = allPassportDocs.reduce<Record<string, unknown>>(
              (acc, p) => {
                const category = p.category as string;
                if (!category) return acc;
                if (!acc[category]) {
                  acc[category] = { category, totalMappings: 0, unlockedStampCount: 0 };
                }
                const stamps = p.unlockedStamps as
                  | Record<string, { timesUnlocked?: number }>
                  | undefined;
                const stampCount = stamps ? Object.keys(stamps).length : 0;
                (acc[category] as Record<string, unknown>).totalMappings =
                  ((acc[category] as Record<string, unknown>).totalMappings as number) +
                  ((p.totalMappings as number) ?? 0);
                (acc[category] as Record<string, unknown>).unlockedStampCount =
                  ((acc[category] as Record<string, unknown>).unlockedStampCount as number) +
                  stampCount;
                return acc;
              },
              {} as Record<string, unknown>
            );
            const passport = Object.values(aggregated) as Array<{
              category: string;
              totalMappings: number;
              unlockedStampCount: number;
            }>;
            const totalStampsUnlocked = passport.reduce(
              (sum, c) => sum + (c.unlockedStampCount as number),
              0
            );
            const totalMappings = passport.reduce(
              (sum, c) => sum + (c.totalMappings as number),
              0
            );
            return {
              uid: doc.id,
              displayName,
              email,
              schoolName,
              passport,
              totalStampsUnlocked,
              totalMappings,
              sessionStatusCounts,
            };
          } catch (err) {
            errors.push({ uid: doc.id, error: (err as Error).message });
            return null;
          }
        })
      );
      const results: Array<{
        uid: string;
        displayName: string | null;
        email: string | null;
        schoolName: string | null;
        passport: Array<{ category: string; totalMappings: number; unlockedStampCount: number }>;
        totalStampsUnlocked: number;
        totalMappings: number;
        sessionStatusCounts: { completed: number; in_progress: number; abandoned: number };
      }> = [];
      for (const r of settled) {
        if (r.status === "fulfilled" && r.value !== null) {
          results.push(r.value);
        }
      }

      results.sort((a, b) => (a.displayName ?? "").localeCompare(b.displayName ?? ""));

      return res.json({ participants: results, total: results.length, errors: errors.length > 0 ? errors : undefined });
    } catch (error) {
      console.error("Error fetching all passports:", error);
      return res.status(500).json({ error: "Failed to fetch all passports" });
    }
  }
}
