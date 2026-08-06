import express from "express";
import { authenticateToken } from "@/middleware/auth";
import { ArtifactsController } from "@/controllers/ArtifactsController";

const router = express.Router();

router.post("/upload", authenticateToken, ArtifactsController.upload);

router.get("/brief", authenticateToken, ArtifactsController.getBrief);

router.get("/", authenticateToken, ArtifactsController.list);

router.get("/:id", authenticateToken, ArtifactsController.getById);

router.delete("/:id", authenticateToken, ArtifactsController.delete);

export default router;
