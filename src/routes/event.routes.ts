import { Router } from "express";
import { auth } from "../middleware/auth";
import { upload } from "../middleware/multipart";
import {
  createEvent,
  listEvents,
  getEvent,
  updateEvent,
  rsvp,
  inviteUser,
  respondInvite,
  createStop,
  listStops,
  quickRally,
  deleteEvent,
  listMyInvitations, // <- add
} from "../controllers/event.controller";
// import { myInvitations } from "../controllers/invitation.controller"; // REMOVE
import { setCheckIn, listCheckIns } from "../controllers/checkin.controller";

const router = Router();

// Quick rally
router.post("/quick", auth, quickRally);

// Invitations tab (now RSVP-based)
router.get("/me/invitations", auth, listMyInvitations);

// Events
router.post("/create", auth, upload.single("image"), createEvent);
router.get("/", auth, listEvents);

router.get("/:id", auth, getEvent);
router.patch("/:id", auth, upload.single("image"), updateEvent);
router.delete("/:id", auth, deleteEvent);

// RSVP + Invite
router.post("/:id/rsvp", auth, rsvp);
router.post("/:id/invite", auth, inviteUser);
router.post("/:id/invite/respond", auth, respondInvite); // NEW endpoint

// Stops + Check-ins
router.post("/:id/stops", auth, createStop);
router.get("/:id/stops", auth, listStops);
router.post("/:eventId/checkin", auth, setCheckIn);
router.get("/:eventId/checkins", auth, listCheckIns);

export default router;
