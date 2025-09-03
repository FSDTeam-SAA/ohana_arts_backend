import type { Document, Types } from "mongoose";
import mongoose from "mongoose";
const { Schema } = mongoose;

import { toJSON } from "./plugins/toJSON";

type ObjectId = Types.ObjectId;

export interface IMessage extends Document {
  chatId: ObjectId;
  senderId: ObjectId;
  text?: string;
  attachments?: string[];
  attachmentsPublicIds?: string[];
  seenBy: ObjectId[];
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    chatId: { type: Schema.Types.ObjectId, ref: "Chat", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, trim: true },
    attachments: [String],
    attachmentsPublicIds: [String],
    seenBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

toJSON(MessageSchema);

MessageSchema.index({ chatId: 1, createdAt: -1 });

export const Message = mongoose.models.Message || mongoose.model<IMessage>("Message", MessageSchema);
