import { Router } from "express";
import { auth } from "../middleware/auth";
import { getMe, getUser, updateProfile } from "../controllers/user.controller";
import { upload } from "../middleware/multipart";

const router = Router();
router.get("/me", auth, getMe);
router.patch("/me", auth, upload.single("avatar"), updateProfile);
router.get("/:id", auth, getUser);
export default router;
