import express from "express";
import { authenticateToken } from "@/middleware/auth";
import { SessionsController } from "../controllers/SessionsController";

const router = express.Router({ mergeParams: true });

router.get("/", authenticateToken, SessionsController.listSessions);

router.get("/:sessionId", authenticateToken, SessionsController.getSessionById);

const adminRouter = express.Router();

adminRouter.get("/", authenticateToken, SessionsController.getAllSessions);

adminRouter.get("/:sessionId", authenticateToken, SessionsController.getSessionDetail);

export { adminRouter };
export default router;
