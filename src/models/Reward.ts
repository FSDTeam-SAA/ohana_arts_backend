import type { Document, Types } from "mongoose";
import mongoose from "mongoose";
const { Schema } = mongoose;

import { Badge } from "../types/enums";
import { toJSON } from "./plugins/toJSON";

type ObjectId = Types.ObjectId;

export interface IRewardHistory {
  eventId?: ObjectId;
  points: number;
  reason: string;
  createdAt: Date;
}

export interface IReward extends Document {
  userId: ObjectId;
  points: number;
  badge: Badge;
  history: IRewardHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const RewardSchema = new Schema<IReward>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    points: { type: Number, default: 0 },
    badge: { type: String, enum: Object.values(Badge), default: Badge.Bronze },
    history: [
      {
        eventId: { type: Schema.Types.ObjectId, ref: "Event" },
        points: { type: Number, required: true },
        reason: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

toJSON(RewardSchema);

export const Reward = mongoose.models.Reward || mongoose.model<IReward>("Reward", RewardSchema);
