import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "@/types/firestore";
import Busboy from "busboy";
import { admin, db } from "@/services/firestore";

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB limit
const ALLOWED_MIMES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const STORAGE_BUCKET_NAME = process.env.APP_FIREBASE_STORAGE_BUCKET;

export class ProfilePictureController {
  static async uploadProfilePicture(req: Request, res: Response) {
    const authUser = (req as AuthenticatedRequest).user;
    if (!authUser) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Determine type: 'participant' or 'user' based on baseUrl
    const type = req.baseUrl.includes("participants") ? "participant" : "user";
    const collectionName = type === "participant" ? "participants" : "users";

    if (!STORAGE_BUCKET_NAME) {
      return res
        .status(500)
        .json({ error: "Firebase storage bucket is not configured in environment" });
    }

    const bb = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
    });

    let fileBuffer: Buffer | null = null;
    let mimeType = "";
    let filename = "";
    let uploadError: string | null = null;

    bb.on("file", (fieldname, fileStream, info) => {
      filename = info.filename;
      mimeType = info.mimeType;

      if (!ALLOWED_MIMES.has(mimeType.toLowerCase())) {
        uploadError = "Only PNG, JPEG, JPG, and WEBP images are allowed.";
        fileStream.resume();
        return;
      }

      const chunks: Buffer[] = [];
      fileStream.on("data", (chunk) => {
        chunks.push(chunk);
      });

      fileStream.on("end", () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    bb.on("finish", async () => {
      if (uploadError) {
        return res.status(400).json({ error: uploadError });
      }
      if (!fileBuffer) {
        return res.status(400).json({ error: "No image file uploaded" });
      }

      try {
        const ext = filename.split(".").pop() || "jpg";
        const storagePath = `profile-pictures/${authUser.uid}/${Date.now()}.${ext}`;
        const bucket = admin.storage().bucket(STORAGE_BUCKET_NAME);
        const file = bucket.file(storagePath);

        // Save file to storage
        await file.save(fileBuffer, {
          resumable: false,
          contentType: mimeType,
          metadata: {
            uploadedBy: authUser.uid,
          },
        });

        // Make it public to get a direct URL
        await file.makePublic();
        const photoURL = `https://storage.googleapis.com/${STORAGE_BUCKET_NAME}/${storagePath}`;

        // Update Firebase Auth user profile
        await admin.auth().updateUser(authUser.uid, { photoURL });

        // Update Firestore collection (either 'participants' or 'users')
        const userDocRef = db.collection(collectionName).doc(authUser.uid);
        await userDocRef.set(
          {
            photoURL,
            updatedAt: Date.now(),
          },
          { merge: true }
        );

        return res.status(200).json({
          message: "Profile picture updated successfully",
          photoURL,
        });
      } catch (error: any) {
        console.error("[ProfilePictureUpload] Failed:", error);
        return res.status(500).json({ error: "Failed to upload profile picture" });
      }
    });

    req.pipe(bb);
  }
}
