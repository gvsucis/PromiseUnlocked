import type { EmbeddingService } from "../services/embeddingService";

export interface VectorSearchMatch {
  id: string;
  userId: string | undefined;
  skillId: string | undefined;
  question: string | undefined;
  responseText: string | undefined;
  mappedCategory: string | undefined;
  mappingOutcome: string | undefined;
  createdAt: unknown;
  distance: number | undefined;
}

export interface VectorSearchServiceOptions {
  firestoreDb?: FirebaseFirestore.Firestore;
  collectionName?: string;
  embeddingField?: string;
  embeddingProvider?: EmbeddingService;
}

export interface VectorSearchService {
  findSimilarResponses(
    skillId: string,
    queryText: string,
    limit?: number,
    userId?: string,
    precomputedQueryEmbedding?: number[]
  ): Promise<VectorSearchMatch[]>;
}
