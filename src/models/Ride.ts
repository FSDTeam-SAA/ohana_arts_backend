import type { Document, Types } from "mongoose";
import mongoose from "mongoose";
const { Schema } = mongoose;

import { PassengerStatus, RideStatus } from "../types/enums";
import { toJSON } from "./plugins/toJSON";

type ObjectId = Types.ObjectId;

// 1. Interface for the plain passenger object (no change)
export interface IRidePassenger {
  userId: ObjectId;
  status: PassengerStatus;
  updatedAt: Date;
  pickupAddress?: string;
  pickupLocation?: {
    type: "Point";
    coordinates: [number, number];
  };
}

// 2. Interface for the plain ride object (POJO)
// --- THIS IS THE FIX: I have removed the '_id' field ---
// Mongoose's 'Document' type will provide this automatically.
export interface IRide {
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

// 3. This is the Mongoose Document interface.
// It now correctly combines IRide and Document without conflict.
export interface IRideDocument extends IRide, Document {}

// 4. The Schema is typed with the Document interface
const RideSchema = new Schema<IRideDocument>(
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
        status: {
          type: String,
          enum: Object.values(PassengerStatus),
          default: PassengerStatus.Requested,
        },
        updatedAt: { type: Date, default: Date.now },
        pickupAddress: String,
        pickupLocation: {
          type: { type: String, enum: ["Point"], default: "Point" },
          coordinates: { type: [Number], default: [0, 0] },
        },
      },
    ],
    status: {
      type: String,
      enum: Object.values(RideStatus),
      default: RideStatus.Active,
    },
  },
  { timestamps: true }
);

toJSON(RideSchema);

RideSchema.index({ driverId: 1, status: 1 });
RideSchema.index({ eventId: 1, status: 1 });

// 5. The model uses the Document interface
export const Ride =
  mongoose.models.Ride || mongoose.model<IRideDocument>("Ride", RideSchema);
