import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/ApiResponse";
import { Message, Reward } from "../models";
import { Response } from "express";
import { User } from "../models";
import { Notification } from "../models";
import { Badge } from "../types/enums";
import { Types } from "mongoose";
import { initSocket } from "../socket";

let socketHelpers: ReturnType<typeof initSocket>;

export const setSocketHelpers = (helpers: ReturnType<typeof initSocket>) => {
  socketHelpers = helpers;
};

export const myRewards = asyncHandler(async (req: any, res: Response) => {
  const r = await Reward.findOne({ userId: req.user.id });
  res.json(ok(r));
});

const POINT_RULES = {
   CREATE_RALLY: {points: 50, reason: "Create a Rally"}, JOIN_RALLY: {points: 5, reason: "Join a Rally"}, DESIGNATED_DRIVER: {points: 15, reason: "Designated Driver"},
}

const BADGE_THRESOLDS = {
  [Badge.Bronze]: 0,
  [Badge.Silver]: 100,
  [Badge.Gold]: 500,
}

function getBadgeFromPoints(points: number): Badge{
  if(points>=BADGE_THRESOLDS[Badge.Gold]){
    return Badge.Gold
  }
  if(points>=BADGE_THRESOLDS[Badge.Silver]){
    return Badge.Silver
  }
  return Badge.Bronze
}

export const awardPoints = async (
  userId: Types.ObjectId,
  rule: keyof typeof POINT_RULES,
  eventId?: Types.ObjectId
) => {
  const ruleDetails = POINT_RULES[rule];

  // 1. Update the Reward model
  const userReward = await Reward.findOneAndUpdate(
    { userId },
    {
      $inc: { points: ruleDetails.points },
      $push: { history: { ...ruleDetails, eventId } },
    },
    { upsert: true, new: true }
  );

  // 2. Update the User model (for the badge and points)
  const newBadge = getBadgeFromPoints(userReward.points);
  const user = await User.findById(userId);

  if (user) {
    user.rewardPoints = userReward.points;
    user.badge = newBadge;
    await user.save();
  }

  // 3. Create a notification for the user with required fields
  const message = `You earned ${ruleDetails.points} points for ${ruleDetails.reason}!`;
  const notif = await Notification.create({
    userId,
    title: "Points Earned!",
    body: message,
    type: "points",
  });

  // 4. Broadcast the notification and points update in real-time
  if (socketHelpers) {
    socketHelpers.notifyUser(userId.toString(), notif.toJSON());
    socketHelpers.notifyUser(userId.toString(), { type: 'points_update', points: user.rewardPoints });
  }
  
  return { newPoints: user.rewardPoints, newBadge, awardedPoints: ruleDetails.points };
};