import type { Document, Types } from "mongoose";
import mongoose from "mongoose";
const { Schema } = mongoose;

import { NotificationType } from "../types/enums";
import { toJSON } from "./plugins/toJSON";

type ObjectId = Types.ObjectId;

export interface INotification extends Document {
  userId: ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  data?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: Object.values(NotificationType), required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    isRead: { type: Boolean, default: false, index: true },
    data: Schema.Types.Mixed,
  },
  { timestamps: true }
);

toJSON(NotificationSchema);

NotificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification = mongoose.models.Notification || mongoose.model<INotification>("Notification", NotificationSchema);
