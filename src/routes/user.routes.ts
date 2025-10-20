import { Router } from "express";
import { auth } from "../middleware/auth";
import { updateProfile } from "../controllers/user.controller";
import { upload } from "../middleware/upload";

const router = Router();
router.patch("/me", auth, upload.single("avatar"), updateProfile);
export default router;
