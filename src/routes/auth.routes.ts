import { Router } from "express";
import { authLimiter } from "../middleware/rateLimit";
import {
  login,
  me,
  register,
  changePassword,
} from "../controllers/auth.controller";
import { auth } from "../middleware/auth";
const router = Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.get("/me", auth, me);
router.post("/changePassword", auth, changePassword);

export default router;
