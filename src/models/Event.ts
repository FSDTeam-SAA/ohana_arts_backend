import type { Document, Types } from "mongoose";
import mongoose from "mongoose";
const { Schema } = mongoose;

import { RSVPStatus } from "../types/enums";
import { toJSON } from "./plugins/toJSON";

type ObjectId = Types.ObjectId;

export interface IEventAttendee {
  userId: ObjectId;
  status: RSVPStatus;
  updatedAt: Date;
}

export interface IGeoPoint {
  type: "Point";
  coordinates: [number, number];
}

export interface IEvent extends Document {
  title: string;
  description?: string;
  image?: string;
  imagePublicId?: string;

  location: {
    name?: string;
    address?: string;
    point?: IGeoPoint;
  };

  dateTime: Date;
  capacity?: number;
  fee?: number;

  inviteCode?: string;

  createdBy: ObjectId;
  attendees: IEventAttendee[];

  chatId?: ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: true, trim: true },
    description: String,
    image: String,
    imagePublicId: String,

    location: {
      name: String,
      address: String,
      point: {
        type: { type: String, enum: ["Point"] },
        coordinates: { type: [Number], index: "2dsphere" },
      } as any,
    },

    dateTime: { type: Date, required: true },
    capacity: Number,
    fee: Number,

    // removed field-level index to avoid duplicate with Schema.index below
    inviteCode: { type: String },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    attendees: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        status: {
          type: String,
          enum: Object.values(RSVPStatus), // includes "Pending"
          required: true,
          default: RSVPStatus.Maybe,
        },
        invitedBy: { type: Schema.Types.ObjectId, ref: "User" }, // NEW
        invitedAt: { type: Date }, // NEW
        updatedAt: { type: Date, default: Date.now },
      },
    ],

    chatId: { type: Schema.Types.ObjectId, ref: "Chat" },
  },
  { timestamps: true }
);

toJSON(EventSchema);

// helpful indexes (no duplicates)
EventSchema.index({ _id: 1, "attendees.userId": 1 }, { unique: false });
EventSchema.index({ createdBy: 1, dateTime: -1 });
EventSchema.index({ inviteCode: 1 }, { sparse: true }); // keep only this for inviteCode

export const Event =
  mongoose.models.Event || mongoose.model<IEvent>("Event", EventSchema);
