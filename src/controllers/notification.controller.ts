import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/ApiResponse";
import { Notification } from "../models";

export const listNotifications = asyncHandler(async (req: any, res) => {
  const notifs = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50);
  res.json(ok(notifs));
});
export const markRead = asyncHandler(async (req: any, res) => {
  await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { isRead: true });
  res.json(ok({}));
});
