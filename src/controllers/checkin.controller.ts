import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/ApiResponse";
import { CheckIn } from "../models";
import { CheckInStatus } from "../types/enums";
import { Request, Response } from "express";

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
  const list = await CheckIn.find({ eventId: req.params.eventId });
  res.json(ok(list));
});
