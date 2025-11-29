import type { Document, Types } from "mongoose";
import mongoose from "mongoose";
const { Schema } = mongoose;
import { RSVPStatus } from "../types/enums";
import { toJSON } from "./plugins/toJSON";
import { IGeoPoint } from "./User";

type ObjectId = Types.ObjectId;

export interface IEventAttendee {
  userId: ObjectId;
  status: RSVPStatus;
  invitedBy?: ObjectId;
  invitedAt?: Date;
  updatedAt: Date;
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

  isStartNotified?: boolean;

  createdAt: Date;
  updatedAt: Date;

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

    inviteCode: { type: String },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    attendees: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        status: {
          type: String,
          enum: Object.values(RSVPStatus),
          required: true,
          default: RSVPStatus.Maybe,
        },
        invitedBy: { type: Schema.Types.ObjectId, ref: "User" },
        invitedAt: { type: Date },
        updatedAt: { type: Date, default: Date.now },
      },
    ],

    isStartNotified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

EventSchema.index({ _id: 1, "attendees.userId": 1 }, { unique: false });
EventSchema.index({ createdBy: 1, dateTime: -1 });
EventSchema.index({ inviteCode: 1 }, { sparse: true });
EventSchema.index({ dateTime: 1, isStartNotified: 1 });

EventSchema.virtual("attendeeDisplay").get(function (this: IEvent) {
  if (!this.attendees) {
    return { firstThree: [], totalAttending: 0, remainingCount: 0 };
  }

  const attending = this.attendees.filter((a) => a.status === RSVPStatus.Yes);
  const totalAttending = attending.length;

  const populatedAttendees = attending.filter(
    (a) => a.userId && (a.userId as any).name
  );

  const firstThree = populatedAttendees.slice(0, 3).map((a) => {
    const user = a.userId as any;
    return {
      name: user.name,
      profilePhoto: user.profilePhoto,
      initial: user.name.charAt(0).toUpperCase(),
    };
  });

  const remainingCount = totalAttending > 3 ? totalAttending - 3 : 0;

  return {
    firstThree,
    totalAttending,
    remainingCount,
  };
});

toJSON(EventSchema);

export const Event =
  mongoose.models.Event || mongoose.model<IEvent>("Event", EventSchema);
