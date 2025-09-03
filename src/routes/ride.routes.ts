import { Router } from "express";
import { auth } from "../middleware/auth";
import { createRide, finishRide, listRides, requestSeat, setPassengerStatus } from "../controllers/ride.controller";

const router = Router();

router.post("/", auth, createRide);
router.get("/event/:eventId", auth, listRides);
router.post("/:rideId/request", auth, requestSeat);
router.post("/:rideId/passenger", auth, setPassengerStatus);
router.post("/:rideId/finish", auth, finishRide);

export default router;
