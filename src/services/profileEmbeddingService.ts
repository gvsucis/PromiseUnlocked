import { CONFIG } from "../config/env";
import { auth } from "../config/firebase";

interface SearchResult {
  id: string;
  fileName: string;
  extractedText: string;
  distance?: number;
}

interface SearchResponse {
  results: SearchResult[];
}

export async function searchPdfContext(query: string, limit = 3): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    console.info("[PandoraData] Pandora Data not ready — no auth token");
    return "";
  }

  const url = `${CONFIG.API_BASE_URL}/profile-embeddings/search`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, limit }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(
        `[PandoraData] Pandora Data not ready — search unavailable (${response.status})`
      );
      return "";
    }

    let data: SearchResponse;
    try {
      data = await response.json();
    } catch {
      console.warn("[PandoraData] Pandora Data not ready — parse failed");
      return "";
    }

    if (!data.results?.length) return "";

    return data.results
      .map((r) => r.extractedText ?? "")
      .filter(Boolean)
      .join("\n\n---\n\n");
  } catch (err) {
    let message: string;
    if (err instanceof Error && err.name === "AbortError") {
      message = "Search timed out after 8s";
    } else if (err instanceof Error) {
      message = err.message;
    } else {
      message = String(err);
    }
    console.warn(`[PandoraData] Pandora Data not ready — search error: ${message}`);
    return "";
  } finally {
    clearTimeout(timeoutId);
  }
}
