import { Router } from "express";
import { auth } from "../middleware/auth";
import { createTask, listTasks, toggleTask } from "../controllers/task.controller";

const router = Router();
router.post("/event/:eventId", auth, createTask);
router.get("/event/:eventId", auth, listTasks);
router.post("/:taskId/toggle", auth, toggleTask);
export default router;
