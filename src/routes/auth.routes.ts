import { Router } from "express";
import { authLimiter } from "../middleware/rateLimit";
import {
  login,
  me,
  register,
  changePassword,
  updateProfilePhoto,
} from "../controllers/auth.controller";
import { auth } from "../middleware/auth";
import { upload } from "../middleware/upload";

const router = Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.get("/me", auth, me);
router.post("/changePassword", auth, changePassword);
router.patch(
  "/profile-photo",
  auth,
  upload.single("photo"),
  updateProfilePhoto
);

export default router;
