import { Router } from "express";
import { auth } from "../middleware/auth";
import {
  createRide,
  endDDMode,
  listRides,
  requestSeat,
  setPassengerStatus,
  getMyActiveDriverRide, 
  getMyRidesAsPassenger,
  getPassengerDestinationHistory,
} from "../controllers/ride.controller";

const router = Router();

// GET /api/rides/me/driver
// For the "Designated Driver" screen
router.get("/me/driver", auth, getMyActiveDriverRide);

// GET /api/rides/me/passenger
// For the "My Rides" screen (Current Ride + History)
router.get("/me/passenger", auth, getMyRidesAsPassenger);

// Existing routes
router.post("/", auth, createRide);

// GET /api/rides/event/:eventId
// For the "Available Rides" screen
router.get("/event/:eventId", auth, listRides);

router.get("/passenger/destination-history", auth, getPassengerDestinationHistory);

router.post("/:rideId/request", auth, requestSeat);
router.post("/:rideId/passenger", auth, setPassengerStatus);
router.post("/end-dd-mode", auth, endDDMode);

export default router;