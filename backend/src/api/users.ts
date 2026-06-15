import express from "express";
import { authenticateToken } from "@/middleware/auth";
import { UsersController } from "../controllers/UsersController";
import { ProfilePictureController } from "@/controllers/ProfilePictureController";

const router = express.Router();

router.post("/", UsersController.createUser);

router.get("/me", authenticateToken, UsersController.getMe);

router.patch("/me", authenticateToken, UsersController.updateMe);
router.post("/me/profile-picture", authenticateToken, ProfilePictureController.uploadProfilePicture);

router.get("/all", authenticateToken, UsersController.getAllUsers);

router.get("/:uid", authenticateToken, UsersController.getUserById);

router.get("/:uid/sessions", authenticateToken, UsersController.getUserSessions);

router.get("/", authenticateToken, UsersController.getCurrentUser);

export default router;
