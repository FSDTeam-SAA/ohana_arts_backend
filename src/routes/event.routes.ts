import { Router } from "express";
import { auth } from "../middleware/auth";
import { upload } from "../middleware/multipart";
import {
  createEvent, listEvents, getEvent, updateEvent, rsvp,
  inviteUser, respondInvite, createStop, listStops, quickRally, deleteEvent
} from "../controllers/event.controller";
import { myInvitations } from "../controllers/invitation.controller";
import { setCheckIn, listCheckIns } from "../controllers/checkin.controller";

const router = Router();

router.post("/", auth, upload.single("image"), createEvent);
router.get("/", auth, listEvents);
router.get("/:id", auth, getEvent);
router.patch("/:id", auth, upload.single("image"), updateEvent);
router.delete("/:id", auth, deleteEvent);

router.post("/:id/rsvp", auth, rsvp);
router.post("/:id/invite", auth, inviteUser);
router.get("/me/invitations", auth, myInvitations);
router.post("/invitations/:invitationId/respond", auth, respondInvite);

router.post("/:id/stops", auth, createStop);
router.get("/:id/stops", auth, listStops);

router.post("/:eventId/checkin", auth, setCheckIn);
router.get("/:eventId/checkins", auth, listCheckIns);

router.post("/quick", auth, quickRally);

export default router;
