import type { Document, Types } from "mongoose";
import mongoose from "mongoose";
const { Schema } = mongoose;

import { PassengerStatus, RideStatus } from "../types/enums";
import { toJSON } from "./plugins/toJSON";

type ObjectId = Types.ObjectId;

export interface IRidePassenger {
  userId: ObjectId;
  status: PassengerStatus;
  updatedAt: Date;
}

export interface IRide extends Document {
  eventId?: ObjectId;
  driverId: ObjectId;
  vehicle: { name: string; capacity: number };
  fromHub?: string;
  toHub?: string;
  passengers: IRidePassenger[];
  status: RideStatus;
  createdAt: Date;
  updatedAt: Date;
}

const RideSchema = new Schema<IRide>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event" },
    driverId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vehicle: {
      name: { type: String, required: true },
      capacity: { type: Number, required: true, min: 1 },
    },
    fromHub: String,
    toHub: String,
    passengers: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        status: { type: String, enum: Object.values(PassengerStatus), default: PassengerStatus.Requested },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    status: { type: String, enum: Object.values(RideStatus), default: RideStatus.Active },
  },
  { timestamps: true }
);

toJSON(RideSchema);

RideSchema.index({ driverId: 1, status: 1 });
RideSchema.index({ eventId: 1, status: 1 });

export const Ride = mongoose.models.Ride || mongoose.model<IRide>("Ride", RideSchema);
