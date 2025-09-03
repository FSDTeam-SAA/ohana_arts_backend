import type { Document, Types } from "mongoose";
import mongoose from "mongoose";
const { Schema } = mongoose;

import { toJSON } from "./plugins/toJSON";

type ObjectId = Types.ObjectId;

export interface IChat extends Document {
  eventId?: ObjectId;
  members: ObjectId[];
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ChatSchema = new Schema<IChat>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event" },
    members: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    lastMessageAt: Date,
  },
  { timestamps: true }
);

toJSON(ChatSchema);

ChatSchema.index(
  { eventId: 1 },
  { unique: true, partialFilterExpression: { eventId: { $exists: true } } }
);
ChatSchema.index({ members: 1 });

export const Chat = mongoose.models.Chat || mongoose.model<IChat>("Chat", ChatSchema);
