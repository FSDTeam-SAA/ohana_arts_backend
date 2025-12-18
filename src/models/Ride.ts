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
  destinationAddress?: string;
  destinationLocation?: {
    type: "Point";
    coordinates: [number, number];
  };
}

export interface IRide {
  eventId?: ObjectId;
  driverId: ObjectId;
  vehicle: { name: string; capacity: number };

  fromHub?: string;
  toHub?: string;

  fromLocation?: {
    type: "Point";
    coordinates: [number, number];
  };
  toLocation?: {
    type: "Point";
    coordinates: [number, number];
  };

  passengers: IRidePassenger[];
  status: RideStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRideDocument extends IRide, Document {}

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
    fromLocation: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
    },
    toLocation: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
    },

    passengers: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        status: {
          type: String,
          enum: Object.values(PassengerStatus),
          default: PassengerStatus.Requested,
        },
        updatedAt: { type: Date, default: Date.now },
        destinationAddress: String, 
        destinationLocation: {
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
RideSchema.index({ fromLocation: "2dsphere" });
RideSchema.index({ toLocation: "2dsphere" });

export const Ride =
  mongoose.models.Ride || mongoose.model<IRideDocument>("Ride", RideSchema);
