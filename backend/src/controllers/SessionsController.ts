import type { Request, Response } from "express";
import {
  participantSessionDoc,
  participantSessionsCollection,
  participantSessionInteractionsCollection,
  participantPassportCollection,
  participantsCollection,
  normalizeSession,
  normalizeUser,
} from "@/services/firestore";
import type { AuthenticatedRequest } from "@/types/firestore";
import { canAccessParticipant, isAdminUser } from "@/utils/authz";
import { parsePagination } from "@/utils/pagination";
import { matchesSearchTerm, normalizeSearchTerm } from "@/utils/participantSearch";

function resolveParticipantId(params: Record<string, any>): string | undefined {
  return params.participantId || params.uid || params.id;
}

function mapStatusFilter(input: string): string | undefined {
  if (["active", "completed", "cancelled"].includes(input)) return input;
  if (input === "in_progress") return "active";
  if (input === "abandoned") return "cancelled";
  return undefined;
}

export class SessionsController {
  static async listSessions(req: Request, res: Response) {
    const { status } = req.query;
    const { page, pageSize, offset } = parsePagination(req.query, 20, 100);
    const participantId = resolveParticipantId(req.params);
    const requester = (req as AuthenticatedRequest).user;
    if (!participantId) {
      return res.status(400).json({ error: "Missing participantId in route." });
    }
    if (!(await canAccessParticipant(requester, participantId))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    let query = participantSessionsCollection(participantId).orderBy("startedAt", "desc");
    if (typeof status === "string" && ["active", "completed", "cancelled"].includes(status)) {
      query = query.where("status", "==", status);
    }
    try {
      const snapshot = await query.offset(offset).limit(pageSize).get();
      const sessions = snapshot.docs.map((doc) => normalizeSession(doc));
      return res.json({ sessions, page, pageSize });
    } catch (error) {
      console.error("Error listing sessions:", error);
      return res.status(500).json({ error: "Failed to list sessions" });
    }
  }

  static async getSessionById(req: Request, res: Response) {
    const participantId = resolveParticipantId(req.params);
    const { sessionId } = req.params as { sessionId: string };
    const requester = (req as AuthenticatedRequest).user;
    if (!participantId) {
      return res.status(400).json({ error: "Missing participantId in route." });
    }
    if (!(await canAccessParticipant(requester, participantId))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    try {
      const doc = await participantSessionDoc(participantId, sessionId).get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Session not found" });
      }
      const session = normalizeSession(doc);
      return res.json({ session });
    } catch (error) {
      console.error("Error fetching session:", error);
      return res.status(500).json({ error: "Failed to fetch session" });
    }
  }

  static async getAllSessions(req: Request, res: Response) {
    const requester = (req as AuthenticatedRequest).user;
    if (!isAdminUser(requester)) {
      return res.status(403).json({ error: "Forbidden — admin access required" });
    }
    try {
      const { status: statusFilter, participantId: pidFilter } = req.query;
      const { page, pageSize } = parsePagination(req.query, 50, 200);
      const mappedStatus = typeof statusFilter === "string" ? mapStatusFilter(statusFilter) : undefined;
      const searchTerm = normalizeSearchTerm(req.query.search);

      if (typeof statusFilter === "string" && statusFilter.trim() && !mappedStatus) {
        return res.status(400).json({ error: `Invalid status filter: ${statusFilter}` });
      }

      const participantsSnapshot = await participantsCollection.get();

      const filteredParticipants = participantsSnapshot.docs.filter((pDoc) => {
        if (typeof pidFilter === "string" && pidFilter && pDoc.id !== pidFilter) return false;
        if (searchTerm && !matchesSearchTerm(pDoc.data(), searchTerm)) return false;
        return true;
      });

      const perParticipantSessions = await Promise.all(
        filteredParticipants.map(async (pDoc) => {
          const pid = pDoc.id;
          const profile = pDoc.data();

          let query = participantSessionsCollection(pid).orderBy("startedAt", "desc");
          if (mappedStatus) {
            query = query.where("status", "==", mappedStatus);
          }
          const sessionsSnapshot = await query.get();

          return sessionsSnapshot.docs.map((sDoc) => {
            const s = sDoc.data();
            return {
              sessionId: sDoc.id,
              status: s.status ?? null,
              startedAt:
                s.startedAt && typeof s.startedAt === "object" && "toDate" in s.startedAt
                  ? (s.startedAt as any).toDate().toISOString()
                  : (s.startedAt ?? null),
              lastActiveAt:
                s.lastActiveAt && typeof s.lastActiveAt === "object" && "toDate" in s.lastActiveAt
                  ? (s.lastActiveAt as any).toDate().toISOString()
                  : null,
              completedAt:
                s.completedAt && typeof s.completedAt === "object" && "toDate" in s.completedAt
                  ? (s.completedAt as any).toDate().toISOString()
                  : null,
              totalInteractions: s.totalInteractions ?? 0,
              categoriesMapped: s.categoriesMapped ?? [],
              categoriesMappedCount: s.categoriesMappedCount ?? 0,
              weakFitCount: s.weakFitCount ?? 0,
              participant: {
                uid: pid,
                displayName: profile.displayName ?? null,
                fullName: profile.fullName ?? null,
                email: profile.email ?? null,
              },
            };
          });
        })
      );

      const allSessions: Array<Record<string, unknown>> = perParticipantSessions.flat();

      allSessions.sort((a, b) => {
        const aTime = a.startedAt ? new Date(a.startedAt as string).getTime() : 0;
        const bTime = b.startedAt ? new Date(b.startedAt as string).getTime() : 0;
        return bTime - aTime;
      });

      const total = allSessions.length;
      const start = (page - 1) * pageSize;
      const paginated = allSessions.slice(start, start + pageSize);

      return res.json({ sessions: paginated, page, pageSize, total });
    } catch (error) {
      console.error("Error fetching all sessions:", error);
      return res.status(500).json({ error: "Failed to fetch sessions" });
    }
  }

  static async getSessionDetail(req: Request, res: Response) {
    const requester = (req as AuthenticatedRequest).user;
    if (!isAdminUser(requester)) {
      return res.status(403).json({ error: "Forbidden — admin access required" });
    }
    const { sessionId } = req.params as { sessionId: string };
    if (!sessionId) {
      return res.status(400).json({ error: "Missing sessionId" });
    }
    try {
      const participantsSnapshot = await participantsCollection.get();

      const lookups = await Promise.all(
        participantsSnapshot.docs.map(async (pDoc) => ({
          pDoc,
          sDoc: await participantSessionDoc(pDoc.id, sessionId).get(),
        }))
      );
      const match = lookups.find((entry) => entry.sDoc.exists);

      if (!match) {
        return res.status(404).json({ error: "Session not found" });
      }

      const pid = match.pDoc.id;
      const s = match.sDoc.data()!;
      const profile = normalizeUser(match.pDoc) as Record<string, unknown>;

      const [interactionsSnapshot, passportSnapshot] = await Promise.all([
        participantSessionInteractionsCollection(pid, sessionId).orderBy("timestamp", "asc").get(),
        participantPassportCollection(pid, sessionId).get(),
      ]);

      const foundInteractions: Array<Record<string, unknown>> = interactionsSnapshot.docs.map(
        (iDoc) => {
          const d = iDoc.data();
          return {
            id: iDoc.id,
            sequenceIndex: d.sequenceIndex ?? null,
            question: d.question ?? null,
            answer: d.answer ?? null,
            inputMethod: d.inputMethod ?? null,
            mappingOutcome: d.mappingOutcome ?? null,
            mappedCategory: d.mappedCategory ?? null,
            isWeakFit: d.isWeakFit ?? false,
            isAlreadyMapped: d.isAlreadyMapped ?? false,
            justification: d.justification ?? "",
            specificStamp: d.specificStamp ?? undefined,
            matchedToCategory: d.matchedToCategory ?? null,
            matchedToSequenceIndex: d.matchedToSequenceIndex ?? null,
            proofJobId: d.proofJobId ?? null,
            proofStatus: d.proofStatus ?? null,
            proofStoragePath: d.proofStoragePath ?? null,
            proofTier: d.proofTier ?? null,
            proofConfidence: d.proofConfidence ?? null,
            timestamp:
              d.timestamp && typeof d.timestamp === "object" && "toDate" in d.timestamp
                ? (d.timestamp as any).toDate().toISOString()
                : (d.timestamp ?? null),
          };
        });

      const foundPassport: Array<Record<string, unknown>> = passportSnapshot.docs.map(
        (pDocSnapshot) => {
          const p = pDocSnapshot.data();
          return {
            categoryId: pDocSnapshot.id,
            category: p.category ?? null,
            firstMappedAt:
              p.firstMappedAt && typeof p.firstMappedAt === "object" && "toDate" in p.firstMappedAt
                ? (p.firstMappedAt as any).toDate().toISOString()
                : null,
            lastMappedAt:
              p.lastMappedAt && typeof p.lastMappedAt === "object" && "toDate" in p.lastMappedAt
                ? (p.lastMappedAt as any).toDate().toISOString()
                : null,
            totalMappings: p.totalMappings ?? 0,
            unlockedStamps: p.unlockedStamps ?? {},
          };
        }
      );

      const foundSession = {
        sessionId: match.sDoc.id,
        status: s.status ?? null,
        startedAt:
          s.startedAt && typeof s.startedAt === "object" && "toDate" in s.startedAt
            ? (s.startedAt as any).toDate().toISOString()
            : (s.startedAt ?? null),
        lastActiveAt:
          s.lastActiveAt && typeof s.lastActiveAt === "object" && "toDate" in s.lastActiveAt
            ? (s.lastActiveAt as any).toDate().toISOString()
            : null,
        completedAt:
          s.completedAt && typeof s.completedAt === "object" && "toDate" in s.completedAt
            ? (s.completedAt as any).toDate().toISOString()
            : null,
        totalInteractions: s.totalInteractions ?? 0,
        categoriesMapped: s.categoriesMapped ?? [],
        categoriesMappedCount: s.categoriesMappedCount ?? 0,
        weakFitCount: s.weakFitCount ?? 0,
      };
      const foundParticipant = {
        uid: pid,
        displayName: profile.displayName ?? null,
        fullName: profile.fullName ?? null,
        email: profile.email ?? null,
      };

      return res.json({
        session: foundSession,
        participant: foundParticipant,
        interactions: foundInteractions,
        passport: foundPassport,
      });
    } catch (error) {
      console.error("Error fetching session detail:", error);
      return res.status(500).json({ error: "Failed to fetch session detail" });
    }
  }
}
