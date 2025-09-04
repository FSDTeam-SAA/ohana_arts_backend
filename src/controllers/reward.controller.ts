import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/ApiResponse";
import { Reward } from "../models";
import { Response } from "express";

export const myRewards = asyncHandler(async (req: any, res: Response) => {
  const r = await Reward.findOne({ userId: req.user.id });
  res.json(ok(r));
});
