import { Router } from "express";
import { authLimiter } from "../middleware/rateLimit";
import {
  login,
  me,
  register,
  changePassword,
  forgotPassword,
  verifyOtp,
  resetPassword,
  withdrawFunds,
  logout,
  refreshToken,
} from "../controllers/auth.controller";
import { getAllUsers } from "../controllers/user.controller";
import { auth } from "../middleware/auth";
const router = Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.get("/me", auth, me);
router.post("/changePassword", auth, changePassword);
router.get("/allUsers", getAllUsers);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/verify-otp", authLimiter, verifyOtp);
router.post("/reset-password", authLimiter, resetPassword);
router.post("/withdraw", auth, withdrawFunds);
router.post("/refresh-token", auth, refreshToken);
router.post("/logout", auth, logout);
//test
export default router;
