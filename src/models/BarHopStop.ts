import type { Document, Types } from "mongoose";
import mongoose from "mongoose";
const { Schema } = mongoose;

import { toJSON } from "./plugins/toJSON";

type ObjectId = Types.ObjectId;

export interface IBarHopStop extends Document {
  eventId: ObjectId;
  order: number;
  name: string;
  image?: string;
  scheduledAt?: Date;
  fee?: number;
  description?: string;
  location: {
    address?: string;
    point: { type: "Point"; coordinates: [number, number] };
  };
  createdAt: Date;
  updatedAt: Date;
}

const BarHopStopSchema = new Schema<IBarHopStop>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    order: { type: Number, required: true },
    name: { type: String, required: true },
    image: String,
    scheduledAt: Date,
    fee: Number,
    description: String,
    location: {
      address: String,
      point: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], required: true, index: "2dsphere" },
      } as any,
    },
  },
  { timestamps: true }
);

toJSON(BarHopStopSchema);

BarHopStopSchema.index({ eventId: 1, order: 1 }, { unique: true });

export const BarHopStop = mongoose.models.BarHopStop || mongoose.model<IBarHopStop>("BarHopStop", BarHopStopSchema);
