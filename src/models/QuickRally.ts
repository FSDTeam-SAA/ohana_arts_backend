import type { Document, Types } from "mongoose";
import mongoose from "mongoose";
const { Schema } = mongoose;

import { toJSON } from "./plugins/toJSON";

type ObjectId = Types.ObjectId;

export interface IQuickRally extends Document {
  eventId: ObjectId;
  hostId: ObjectId;
  location: {
    name?: string;
    address?: string;
    point?: { type: "Point"; coordinates: [number, number] };
  };
  invitedUsers: ObjectId[];
  createdAt: Date;
}

const QuickRallySchema = new Schema<IQuickRally>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true, unique: true },
    hostId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    location: {
      name: String,
      address: String,
      point: {
        type: { type: String, enum: ["Point"] },
        coordinates: { type: [Number], index: "2dsphere" },
      } as any,
    },
    invitedUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

toJSON(QuickRallySchema);

QuickRallySchema.index({ hostId: 1, createdAt: -1 });

export const QuickRally = mongoose.models.QuickRally || mongoose.model<IQuickRally>("QuickRally", QuickRallySchema);
