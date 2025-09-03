import type { Document, Types } from "mongoose";
import mongoose from "mongoose";
const { Schema } = mongoose;

import { toJSON } from "./plugins/toJSON";

type ObjectId = Types.ObjectId;

export interface IInvitation extends Document {
  eventId: ObjectId;
  invitedBy: ObjectId;
  invitedUser: ObjectId;
  status: "Pending" | "Accepted" | "Declined";
  token?: string;
  expiresAt?: Date;
  createdAt: Date;
}

const InvitationSchema = new Schema<IInvitation>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    invitedUser: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["Pending", "Accepted", "Declined"], default: "Pending" },
    token: String,
    expiresAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

toJSON(InvitationSchema);

InvitationSchema.index({ eventId: 1, invitedUser: 1 }, { unique: true });
InvitationSchema.index({ token: 1 }, { sparse: true });

export const Invitation = mongoose.models.Invitation || mongoose.model<IInvitation>("Invitation", InvitationSchema);
