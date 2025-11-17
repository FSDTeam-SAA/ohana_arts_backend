import { Router } from "express";
import { auth } from "../middleware/auth";
import { findNearbyPlaces } from "../controllers/places.controller";

const router = Router();

// GET /api/places/nearby?lat=...&lng=...&radius=...
router.get("/nearby", auth, findNearbyPlaces);

export default router;
