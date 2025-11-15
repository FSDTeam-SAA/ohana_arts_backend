import type { Document, Types } from "mongoose";
import mongoose from "mongoose";
const { Schema } = mongoose;

import { toJSON } from "./plugins/toJSON";

type ObjectId = Types.ObjectId;

export interface IChat extends Document {
  eventId: ObjectId; // <-- ADDED BACK
  members: ObjectId[]; // Will only contain two (2) user IDs
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ChatSchema = new Schema<IChat>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true }, // <-- ADDED BACK
    members: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    lastMessageAt: Date,
  },
  { timestamps: true }
);

toJSON(ChatSchema);

// --- NEW UNIQUE INDEX ---
// This is the most important part.
// It ensures there can only be one 1-on-1 chat (members)
// *per event* (eventId).
ChatSchema.index({ eventId: 1, members: 1 }, { unique: true });
// --- END NEW INDEX ---

export const Chat =
  mongoose.models.Chat || mongoose.model<IChat>("Chat", ChatSchema);
