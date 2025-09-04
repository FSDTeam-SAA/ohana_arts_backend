import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/ApiResponse";
import { Invitation } from "../models";
import { Response } from "express";

export const myInvitations = asyncHandler(async (req: any, res: Response) => {
  const invites = await Invitation.find({ invitedUser: req.user.id }).sort({ createdAt: -1 });
  res.json(ok(invites));
});
