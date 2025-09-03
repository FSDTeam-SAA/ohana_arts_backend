import type { Document, Types } from "mongoose";
import mongoose from "mongoose";
const { Schema } = mongoose;

import { CheckInStatus } from "../types/enums";
import { toJSON } from "./plugins/toJSON";

type ObjectId = Types.ObjectId;

export interface ICheckIn extends Document {
  eventId: ObjectId;
  userId: ObjectId;
  status: CheckInStatus;
  updatedAt: Date;
  createdAt: Date;
}

const CheckInSchema = new Schema<ICheckIn>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: Object.values(CheckInStatus),
      default: CheckInStatus.StillOut,
      required: true,
    },
  },
  { timestamps: true }
);

toJSON(CheckInSchema);

CheckInSchema.index({ eventId: 1, userId: 1 }, { unique: true });

export const CheckIn = mongoose.models.CheckIn || mongoose.model<ICheckIn>("CheckIn", CheckInSchema);
