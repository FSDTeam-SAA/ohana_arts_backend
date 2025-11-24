import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/ApiResponse";
import { Message, Reward } from "../models";
import { Response } from "express";
import { User } from "../models";
import { Notification } from "../models";
import { Badge } from "../types/enums";
import { Types } from "mongoose";
import { SocketHelpers } from "../socket";
import { ApiError } from "../utils/ApiError";
import { StatusCodes } from "http-status-codes";

// This variable will hold the helpers
let socketHelpers: SocketHelpers;

// This function's parameter 'helpers: SocketHelpers' now uses the NEW type
export const setSocketHelpers = (helpers: SocketHelpers) => {
  socketHelpers = helpers;
};

export const myRewards = asyncHandler(async (req: any, res: Response) => {
  const user = await User.findById(req.user.id).select("rewardPoints badge");

  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, "User not found");

  // 1. Determine Next Badge
  // Sort thresholds ascending to find the next one
  const sortedThresholds = Object.entries(BADGE_THRESOLDS)
    .map(([badge, points]) => ({ badge, points }))
    .sort((a, b) => a.points - b.points);

  let nextBadge = null;
  let pointsToNext = 0;
  let progressPercentage = 100;

  for (const tier of sortedThresholds) {
    if (tier.points > user.rewardPoints) {
      nextBadge = tier.badge;
      pointsToNext = tier.points - user.rewardPoints;

      // Calculate percentage for the progress bar
      const prevTierPoints =
        sortedThresholds.find((t) => t.points <= user.rewardPoints)?.points ||
        0;
      const totalRange = tier.points - prevTierPoints;
      const currentProgress = user.rewardPoints - prevTierPoints;
      progressPercentage = Math.round((currentProgress / totalRange) * 100);

      break;
    }
  }

  const responseData = {
    currentPoints: user.rewardPoints,
    currentBadge: user.badge,
    nextBadge: {
      name: nextBadge || "Max Level",
      pointsNeeded: pointsToNext,
      progressPercentage: nextBadge ? progressPercentage : 100,
    },
    allBadges: sortedThresholds,
  };

  res.json(ok(responseData));
});

const POINT_RULES = {
  CREATE_RALLY: { points: 50, reason: "Create a Rally" },
  JOIN_RALLY: { points: 5, reason: "Join a Rally" },
  DESIGNATED_DRIVER: { points: 15, reason: "Designated Driver" },
};

// --- 1. THRESHOLDS UPDATED & RE-ORDERED ---
// Re-ordered from highest to lowest for clean logic.
// Fixed "Roby" -> "Ruby"
// Fixed "DarkMatter" from 500 -> 1000
const BADGE_THRESOLDS = {
  [Badge.DarkMatter]: 1000,
  [Badge.GalaxyOpal]: 900,
  [Badge.PinkDiamond]: 800,
  [Badge.Diamond]: 700,
  [Badge.Amethyst]: 600,
  [Badge.Ruby]: 500, // <-- Fixed typo
  [Badge.Sapphire]: 400,
  [Badge.Emerald]: 300,
  [Badge.Gold]: 200,
  [Badge.Silver]: 100,
  [Badge.Bronze]: 0,
};
// --- END OF UPDATE 1 ---

// --- 2. FUNCTION FULLY IMPLEMENTED ---
function getBadgeFromPoints(points: number): Badge {
  // We must check from the highest value first
  if (points >= BADGE_THRESOLDS[Badge.DarkMatter]) {
    return Badge.DarkMatter;
  }
  if (points >= BADGE_THRESOLDS[Badge.GalaxyOpal]) {
    return Badge.GalaxyOpal;
  }
  if (points >= BADGE_THRESOLDS[Badge.PinkDiamond]) {
    return Badge.PinkDiamond;
  }
  if (points >= BADGE_THRESOLDS[Badge.Diamond]) {
    return Badge.Diamond;
  }
  if (points >= BADGE_THRESOLDS[Badge.Amethyst]) {
    return Badge.Amethyst;
  }
  if (points >= BADGE_THRESOLDS[Badge.Ruby]) {
    return Badge.Ruby;
  }
  if (points >= BADGE_THRESOLDS[Badge.Sapphire]) {
    return Badge.Sapphire;
  }
  if (points >= BADGE_THRESOLDS[Badge.Emerald]) {
    return Badge.Emerald;
  }
  if (points >= BADGE_THRESOLDS[Badge.Gold]) {
    return Badge.Gold;
  }
  if (points >= BADGE_THRESOLDS[Badge.Silver]) {
    return Badge.Silver;
  }
  return Badge.Bronze; // Default
}
// --- END OF UPDATE 2 ---

export const awardPoints = async (
  userId: Types.ObjectId,
  rule: keyof typeof POINT_RULES,
  eventId?: Types.ObjectId
) => {
  const ruleDetails = POINT_RULES[rule]; // 1. Update the Reward model

  const userReward = await Reward.findOneAndUpdate(
    { userId },
    {
      $inc: { points: ruleDetails.points },
      $push: { history: { ...ruleDetails, eventId } },
    },
    { upsert: true, new: true }
  ); // 2. Update the User model (for the badge and points)

  const newBadge = getBadgeFromPoints(userReward.points); // <-- This will now work
  const user = await User.findById(userId);
  let userRewardPoints = 0; // Default value

  if (user) {
    user.rewardPoints = userReward.points;
    user.badge = newBadge; // <-- Will assign the correct new badge
    userRewardPoints = user.rewardPoints; // Store points
    await user.save();
  } // 3. Create a notification for the user with required fields

  const message = `You earned ${ruleDetails.points} points for ${ruleDetails.reason}!`;
  const notif = await Notification.create({
    userId,
    title: "Points Earned!",
    body: message,
    type: "points",
  }); // 4. Broadcast the notification and points update in real-time

  if (socketHelpers) {
    socketHelpers.notifyUser(userId.toString(), notif.toJSON());
    socketHelpers.notifyUser(userId.toString(), {
      type: "points_update",
      points: userRewardPoints, // Use the stored points
    });
  }

  return {
    newPoints: userRewardPoints,
    newBadge,
    awardedPoints: ruleDetails.points,
  };
};
