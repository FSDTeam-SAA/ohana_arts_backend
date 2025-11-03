import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/ApiResponse";
import { CheckIn, Event } from "../models"; // <-- Import Event model
import { CheckInStatus } from "../types/enums";
import { Request, Response } from "express";
import { ApiError } from "../utils/ApiError"; // <-- Import ApiError
import { StatusCodes } from "http-status-codes"; // <-- Import StatusCodes

export const setCheckIn = asyncHandler(async (req: any, res: Response) => {
  const { status } = req.body as { status: CheckInStatus };
  const doc = await CheckIn.findOneAndUpdate(
    { eventId: req.params.eventId, userId: req.user.id },
    { status },
    { new: true, upsert: true }
  );
  res.json(ok(doc));
});

export const listCheckIns = asyncHandler(async (req: any, res: Response) => {
  const { eventId } = req.params;
  const { id: currentUserId } = req.user;

  // 1. Get the event name
  // --- THIS LINE IS MODIFIED (removed .lean()) ---
  const event = await Event.findById(eventId).select("title");
  if (!event) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Event not found");
  }

  // 2. Find all check-ins for this event,
  //    ...excluding the current user (their status is separate)
  //    ...populating the friend's name and photo
  //    ...and sorting by the most recent update
  const friendCheckIns = await CheckIn.find({
    eventId: eventId,
    userId: { $ne: currentUserId }, // <-- Exclude current user
  })
    .populate("userId", "name profilePhoto") // <-- Get friend's details
    .sort({ updatedAt: -1 }) // <-- Show latest updates first
    .lean(); // .lean() is fine here as we don't access it before sending

  // 3. Calculate the progress bar summary
  const totalFriends = friendCheckIns.length;

  // We assume the enum value for 'Home Safe' matches the UI string
  const homeSafeCount = friendCheckIns.filter(
    (c) => c.status === "Home Safe"
  ).length;

  // 4. Send the complete, structured response
  res.json(
    ok({
      eventName: event.title, // <-- This will now work
      friendCheckIns: friendCheckIns,
      summary: {
        homeSafeCount: homeSafeCount,
        totalFriends: totalFriends,
      },
    })
  );
});
