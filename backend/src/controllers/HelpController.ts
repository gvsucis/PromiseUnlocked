import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "@/types/firestore";
import Busboy from "busboy";
import { admin, db } from "@/services/firestore";
import { getStorageBucket } from "@/utils/storageBucket";
import { feedBusboy } from "@/utils/multipart";
import { randomUUID } from "node:crypto";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_FILES = 3;
const ALLOWED_MIMES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export class HelpController {
  static async submitReport(req: Request, res: Response) {
    const authUser = (req as AuthenticatedRequest).user;
    if (!authUser) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const storageBucket = getStorageBucket();
    if (!storageBucket) {
      return res
        .status(500)
        .json({ error: "Firebase storage bucket is not configured in environment" });
    }

    const fields: Record<string, string> = {};
    const images: { buffer: Buffer; mimeType: string; filename: string }[] = [];
    let streamError: string | null = null;

    const bb = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES + 1 },
    });

    bb.on("field", (name, value) => {
      fields[name] = value;
    });

    bb.on("file", (_name, fileStream, info) => {
      if (images.length >= MAX_FILES) {
        streamError = `Maximum of ${MAX_FILES} images allowed`;
        fileStream.resume();
        return;
      }

      const mime = info.mimeType.toLowerCase();
      if (!ALLOWED_MIMES.has(mime)) {
        streamError = "Only PNG, JPEG, JPG, and WEBP images are allowed.";
        fileStream.resume();
        return;
      }

      const chunks: Buffer[] = [];
      let sizeBytes = 0;

      fileStream.on("data", (chunk: Buffer) => {
        sizeBytes += chunk.byteLength;
        if (sizeBytes > MAX_FILE_SIZE) {
          streamError = `Image exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`;
          fileStream.resume();
          return;
        }
        chunks.push(chunk);
      });

      fileStream.on("end", () => {
        if (!streamError && chunks.length > 0) {
          images.push({
            buffer: Buffer.concat(chunks),
            mimeType: mime,
            filename: info.filename || `image_${Date.now()}.jpg`,
          });
        }
      });
    });

    bb.on("finish", async () => {
      if (streamError) {
        return res.status(400).json({ error: streamError });
      }

      const location = (fields.location || "").trim();
      const description = (fields.description || "").trim();

      if (!location) {
        return res.status(400).json({ error: "Location is required" });
      }
      if (!description) {
        return res.status(400).json({ error: "Description is required" });
      }

      try {
        const bucket = admin.storage().bucket(storageBucket);
        const timestamp = Date.now();
        const reportId = `${authUser.uid}_${timestamp}_${randomUUID().slice(0, 8)}`;
        const imagePaths: string[] = [];

        for (const [i, image] of images.entries()) {
          const ext = image.filename.split(".").pop() || "jpg";
          const storagePath = `help-reports/${authUser.uid}/${timestamp}/${i}.${ext}`;
          const file = bucket.file(storagePath);

          await file.save(image.buffer, {
            resumable: false,
            contentType: image.mimeType,
            metadata: { uploadedBy: authUser.uid, reportId },
          });

          imagePaths.push(storagePath);
        }

        await db.collection("help_reports").doc(reportId).set({
          userId: authUser.uid,
          location,
          description,
          imagePaths,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return res.status(200).json({
          success: true,
          data: { reportId, imageCount: images.length },
          error: null,
        });
      } catch (error: any) {
        console.error("[HelpController] Failed to submit report:", error);
        return res.status(500).json({ error: "Failed to submit help report" });
      }
    });

    feedBusboy(req, bb);
  }
}
