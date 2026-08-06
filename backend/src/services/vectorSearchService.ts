import { db } from "@/services/firestore";
import { embeddingService } from "./embeddingService";
import type {
  VectorSearchMatch,
  VectorSearchService,
  VectorSearchServiceOptions,
} from "@/utils/vectorSearch";

const DEFAULT_COLLECTION = "user_interactions";

function toPositiveLimit(limit: number | undefined): number {
  if (!limit || !Number.isFinite(limit) || limit <= 0) {
    return 5;
  }

  return Math.min(Math.trunc(limit), 20);
}

function toMatch(doc: FirebaseFirestore.QueryDocumentSnapshot): VectorSearchMatch {
  const data = doc.data() as Record<string, unknown>;
  return {
    id: doc.id,
    userId: typeof data.userId === "string" ? data.userId : undefined,
    skillId: typeof data.skillId === "string" ? data.skillId : undefined,
    question: typeof data.question === "string" ? data.question : undefined,
    responseText: typeof data.responseText === "string" ? data.responseText : undefined,
    mappedCategory: typeof data.mappedCategory === "string" ? data.mappedCategory : undefined,
    mappingOutcome: typeof data.mappingOutcome === "string" ? data.mappingOutcome : undefined,
    createdAt: data.createdAt,
    distance: typeof data.distance === "number" ? data.distance : undefined,
  };
}

function isMissingVectorIndexError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("FAILED_PRECONDITION") &&
    error.message.includes("Missing vector index configuration")
  );
}

function isVectorUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("Firestore vector search is not available");
}

function scoreByTokenOverlap(queryText: string, candidateText: string): number {
  const queryTokens = new Set(
    queryText
      .toLowerCase()
      .split(/\W+/)
      .filter((token) => token.length > 2)
  );
  if (!queryTokens.size) {
    return 0;
  }

  const candidateTokens = new Set(
    candidateText
      .toLowerCase()
      .split(/\W+/)
      .filter((token) => token.length > 2)
  );

  let overlapCount = 0;
  queryTokens.forEach((token) => {
    if (candidateTokens.has(token)) {
      overlapCount += 1;
    }
  });

  return overlapCount / queryTokens.size;
}

function fallbackSearch(
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
  queryText: string,
  limit: number
): VectorSearchMatch[] {
  return docs
    .map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const responseText = typeof data.responseText === "string" ? data.responseText : "";
      const score = scoreByTokenOverlap(queryText, responseText);
      return { match: toMatch(doc), score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, toPositiveLimit(limit))
    .map((item) => item.match);
}

/**
 * Creates a Firestore vector-search service.
 */
export function createVectorSearchService(
  options: VectorSearchServiceOptions = {}
): VectorSearchService {
  const firestoreDb = options.firestoreDb ?? db;
  const collectionName = options.collectionName ?? DEFAULT_COLLECTION;
  const embeddingField = options.embeddingField ?? "embedding";
  const embeddingProvider = options.embeddingProvider ?? embeddingService;

  return {
    /**
     * Finds semantically similar responses for a skill.
     */
    async findSimilarResponses(
      skillId: string,
      queryText: string,
      limit: number = 5,
      userId?: string,
      precomputedQueryEmbedding?: number[]
    ): Promise<VectorSearchMatch[]> {
      const trimmedSkillId = skillId.trim();
      const trimmedQuery = queryText.trim();
      const trimmedUserId = userId?.trim();

      if (!trimmedSkillId) {
        throw new Error("skillId is required to search for similar responses.");
      }

      if (!trimmedQuery) {
        return [];
      }

      const queryEmbedding =
        precomputedQueryEmbedding ?? (await embeddingProvider.generateEmbedding(trimmedQuery));
      const useNested = process.env.USE_NESTED_PARTICIPANT_COLLECTION === "true";
      const collection = useNested
        ? firestoreDb.collectionGroup("chat_interactions")
        : firestoreDb.collection(collectionName);
      let nearestQuery = collection.where("skillId", "==", trimmedSkillId);
      if (trimmedUserId) {
        nearestQuery = nearestQuery.where("userId", "==", trimmedUserId);
      }
      const findNearest = (
        nearestQuery as unknown as {
          findNearest?: (options: {
            vectorField: string;
            queryVector: number[];
            limit: number;
            distanceMeasure: "COSINE" | "EUCLIDEAN" | "DOT_PRODUCT";
            distanceResultField: string;
          }) => FirebaseFirestore.Query;
        }
      ).findNearest;

      try {
        if (!findNearest) {
          throw new Error("Firestore vector search is not available in this runtime.");
        }

        const snapshot = await findNearest
          .call(nearestQuery, {
            vectorField: embeddingField,
            queryVector: queryEmbedding,
            limit: toPositiveLimit(limit),
            distanceMeasure: "COSINE",
            distanceResultField: "distance",
          })
          .get();

        return snapshot.docs.map(toMatch);
      } catch (error) {
        if (!isMissingVectorIndexError(error) && !isVectorUnavailableError(error)) {
          throw error;
        }

        console.warn(
          "Vector search unavailable (missing index/runtime support). Falling back to token-overlap search."
        );

        const fallbackSnapshot = await nearestQuery
          .limit(Math.max(toPositiveLimit(limit) * 5, 20))
          .get();
        return fallbackSearch(fallbackSnapshot.docs, trimmedQuery, limit);
      }
    },
  };
}

/**
 * Default vector search service instance.
 */
export const vectorSearchService = createVectorSearchService();
