import { Router } from "express";
import { auth } from "../middleware/auth";
import { listNotifications, markRead } from "../controllers/notification.controller";

const router = Router();
router.get("/", auth, listNotifications);
router.post("/:id/read", auth, markRead);
export default router;
