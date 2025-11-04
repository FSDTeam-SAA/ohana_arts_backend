import { Router } from "express";
import { auth } from "../middleware/auth";
import {
  updateProfile,
  toggleDesignatedDriver,
  updateMyLocation,
} from "../controllers/user.controller";
import { upload } from "../middleware/multipart";

const router = Router();

router.patch("/me", auth, upload.single("avatar"), updateProfile);

// POST /api/users/me/dd-mode
// Toggles the user's designated driver status on or off
router.post("/me/dd-mode", auth, toggleDesignatedDriver);

// POST /api/users/me/location
// Receives { lat, lng } to update the user's live location
router.post("/me/location", auth, updateMyLocation);

export default router;
