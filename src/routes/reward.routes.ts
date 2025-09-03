import { Router } from "express";
import { auth } from "../middleware/auth";
import { myRewards } from "../controllers/reward.controller";

const router = Router();
router.get("/me", auth, myRewards);
export default router;
