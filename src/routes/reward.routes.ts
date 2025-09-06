import { Router } from "express";
import { auth } from "../middleware/auth";
import { myRewards } from "../controllers/reward.controller";

const router = Router();
router.get("/my-rewards", auth, myRewards);
export default router;
