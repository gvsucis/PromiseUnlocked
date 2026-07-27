import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "@/types/firestore";
import Busboy from "busboy";
import crypto from "node:crypto";
import { isAllowedMimeType, uploadMemoryFile } from "@/services/memoryFileStorageService";
import { feedBusboy } from "@/utils/multipart";
import {
  createCatalogEntry,
  findByChecksum,
  getById,
  listCatalog,
  listCatalogDetailed,
  resetForReembed,
  embedAndBrief,
} from "@/services/pvaCatalogService";
import { isAdminUser } from "@/utils/authz";
import { getPvaProfile } from "@/data/pvaStyleProfiles";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILE_SIZE_LABEL = `${MAX_FILE_SIZE / (1024 * 1024)}MB`;
// File path namespace for catalog uploads (uploadMemoryFile partitions by this).
const CATALOG_STORAGE_OWNER = "pva-catalog";

interface FileBufferState {
  chunks: Buffer[];
  filename: string;
  mimeType: string;
  totalSize: number;
  error: Error | null;
}

export class PvaCatalogController {
  static async uploadCatalogPdf(req: Request, res: Response) {
    const authUser = (req as AuthenticatedRequest).user;
    if (!authUser) return res.status(401).json({ error: "Authentication required" });
    if (!isAdminUser(authUser)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    // Busboy throws on non-multipart bodies; guard for a clean 400.
    const contentType = req.headers["content-type"] ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return res
        .status(400)
        .json({ error: "Use multipart/form-data with 'file' and 'name' fields." });
    }

    const bb = Busboy({ headers: req.headers, limits: { fileSize: MAX_FILE_SIZE } });
    const fields: Record<string, string> = {};
    const state: FileBufferState = {
      chunks: [],
      filename: "",
      mimeType: "",
      totalSize: 0,
      error: null,
    };

    bb.on("field", (name: string, val: string) => {
      fields[name] = val;
    });

    bb.on(
      "file",
      (
        _field: string,
        fileStream: NodeJS.ReadableStream,
        info: { filename: string; mimeType: string }
      ) => {
        state.filename = info.filename;
        state.mimeType = info.mimeType;
        fileStream.on("data", (chunk: Buffer) => {
          state.chunks.push(chunk);
          state.totalSize += chunk.length;
          if (state.totalSize > MAX_FILE_SIZE) {
            state.error = new Error(`File exceeds the ${MAX_FILE_SIZE_LABEL} maximum size.`);
            fileStream.resume();
          }
        });
        fileStream.on("limit", () => {
          state.error = new Error(`File exceeds the ${MAX_FILE_SIZE_LABEL} maximum size.`);
        });
        fileStream.on("error", (err: Error) => {
          state.error = err;
        });
      }
    );

    bb.on("finish", async () => {
      if (state.error) return res.status(400).json({ error: state.error.message });
      if (!state.chunks.length) return res.status(400).json({ error: "No file uploaded" });
      if (!isAllowedMimeType(state.mimeType)) {
        return res
          .status(400)
          .json({ error: `Only PDF files are accepted (${MAX_FILE_SIZE_LABEL} max).` });
      }

      const name = fields.name?.trim();
      if (!name) return res.status(400).json({ error: "A 'name' field is required." });

      const fileBuffer = Buffer.concat(state.chunks);
      const checksum = crypto.createHash("sha256").update(fileBuffer).digest("hex");

      const existing = await findByChecksum(checksum);
      if (existing) {
        return res.status(200).json({
          id: existing.id,
          name: existing.name,
          embeddingStatus: existing.embeddingStatus ?? (existing.embedding ? "ready" : "failed"),
          duplicate: true,
          message: "PVA already in catalog — returning existing entry",
        });
      }

      let gcsResult;
      try {
        gcsResult = await uploadMemoryFile({
          userId: CATALOG_STORAGE_OWNER,
          fileName: state.filename,
          fileBuffer,
          contentType: state.mimeType,
        });
      } catch (err) {
        console.error("[PvaCatalog] GCS upload failed:", err);
        return res.status(500).json({ error: "File storage failed" });
      }

      try {
        const id = await createCatalogEntry({
          name,
          fileName: state.filename,
          storagePath: gcsResult.storagePath,
          bucket: gcsResult.bucket,
          fileSizeBytes: fileBuffer.length,
          contentType: state.mimeType,
          checksum,
          extractedText: "",
          embedding: null,
          embeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-2",
          embeddingStatus: "processing",
          embeddingAttempts: 0,
          personaBrief: null,
        });

        console.log(`[PvaCatalog] Added ${id} (${name}) — embedding queued`);
        return res.status(201).json({
          id,
          name,
          embeddingStatus: "processing",
          duplicate: false,
          message: "Catalog PVA added — embedding queued",
        });
      } catch (err) {
        console.error("[PvaCatalog] Firestore write failed:", err);
        return res.status(500).json({ error: "Failed to save catalog entry" });
      }
    });

    bb.on("error", (err: Error) => {
      console.error("[PvaCatalog] Busboy error:", err);
      if (!res.headersSent) res.status(400).json({ error: err.message || "Upload parsing failed" });
    });

    feedBusboy(req, bb);
  }

  // Selection dropdown source.
  static async list(req: Request, res: Response) {
    const authUser = (req as AuthenticatedRequest).user;
    if (!authUser) return res.status(401).json({ error: "Authentication required" });

    try {
      const items = await listCatalog();
      return res.json({ pvas: items });
    } catch (err) {
      console.error("[PvaCatalog] list error:", err);
      return res.status(500).json({ error: "Failed to list catalog" });
    }
  }

  // Admin-only: full preview of every catalog entry (status, brief, text preview).
  static async listAll(req: Request, res: Response) {
    const authUser = (req as AuthenticatedRequest).user;
    if (!authUser) return res.status(401).json({ error: "Authentication required" });
    if (!isAdminUser(authUser)) return res.status(403).json({ error: "Admin access required" });

    try {
      const items = await listCatalogDetailed();
      return res.json({ pvas: items });
    } catch (err) {
      console.error("[PvaCatalog] listAll error:", err);
      return res.status(500).json({ error: "Failed to list catalog" });
    }
  }

  // Persona brief for the selected PVA (falls back to extracted text).
  static async getContext(req: Request, res: Response) {
    const authUser = (req as AuthenticatedRequest).user;
    if (!authUser) return res.status(401).json({ error: "Authentication required" });

    const { id } = req.params as { id?: string };
    if (!id) return res.status(400).json({ error: "Missing id" });

    try {
      const entry = await getById(id);
      if (!entry) return res.status(404).json({ error: "PVA not found" });
      const status = entry.embeddingStatus ?? (entry.embedding ? "ready" : "failed");
      if (status !== "ready") {
        return res.json({ context: "", embeddingStatus: status });
      }
      return res.json({
        context: getPvaProfile(entry.name ?? ""),
        embeddingStatus: status,
      });
    } catch (err) {
      console.error("[PvaCatalog] getContext error:", err);
      return res.status(500).json({ error: "Failed to get PVA context" });
    }
  }

  // Admin-only: re-run embedding + brief for a stuck/failed entry (no auto-retry).
  static async reembed(req: Request, res: Response) {
    const authUser = (req as AuthenticatedRequest).user;
    if (!authUser) return res.status(401).json({ error: "Authentication required" });
    if (!isAdminUser(authUser)) return res.status(403).json({ error: "Admin access required" });

    const { id } = req.params as { id?: string };
    if (!id) return res.status(400).json({ error: "Missing id" });

    const entry = await getById(id);
    if (!entry) return res.status(404).json({ error: "PVA not found" });

    try {
      await resetForReembed(id);
      const result = await embedAndBrief(id, `pva-reembed:${id}`);
      const embeddingStatus = result === "ready" ? "ready" : "failed";
      console.log(`[PvaCatalog] re-embed ${id} → ${embeddingStatus}`);
      return res.json({ id, embeddingStatus });
    } catch (err) {
      console.error(`[PvaCatalog] re-embed ${id} failed:`, err);
      return res.status(502).json({ error: "Embedding failed — try again." });
    }
  }
}
