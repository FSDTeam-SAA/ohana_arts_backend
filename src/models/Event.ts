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

  //virtual property
  attendeeDisplay?: {
    firstThree: {
      name: string;
      profilePhoto?: string;
      initial: string;
    }[];
    totalAttending: number;
    remainingCount: number;
  };
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

// helpful indexes (no duplicates)
EventSchema.index({ _id: 1, "attendees.userId": 1 }, { unique: false });
EventSchema.index({ createdBy: 1, dateTime: -1 });
EventSchema.index({ inviteCode: 1 }, { sparse: true }); // keep only this for inviteCode

// --- NEW VIRTUAL PROPERTY ---
// This calculates the display data for attendees
EventSchema.virtual("attendeeDisplay").get(function (this: IEvent) {
  if (!this.attendees) {
    return { firstThree: [], totalAttending: 0, remainingCount: 0 };
  }

  // Filter for attendees who have RSVP'd 'Yes'
  const attending = this.attendees.filter((a) => a.status === RSVPStatus.Yes);
  const totalAttending = attending.length;

  // Check if attendees are populated.
  // (a.userId as any).name checks if userId is an object with a name property.
  const populatedAttendees = attending.filter(
    (a) => a.userId && (a.userId as any).name
  );

  // Get the first 3 for display
  const firstThree = populatedAttendees.slice(0, 3).map((a) => {
    const user = a.userId as any; // We know it's populated
    return {
      name: user.name,
      profilePhoto: user.profilePhoto,
      initial: user.name.charAt(0).toUpperCase(),
    };
  });

  // Get the "+X" number
  const remainingCount = totalAttending > 3 ? totalAttending - 3 : 0;

  return {
    firstThree, // Array of { name, profilePhoto, initial }
    totalAttending, // Total number of 'Yes' attendees
    remainingCount, // The "+X" number
  };
});
// --- END OF NEW VIRTUAL PROPERTY ---

toJSON(EventSchema);

export const Event =
  mongoose.models.Event || mongoose.model<IEvent>("Event", EventSchema);
