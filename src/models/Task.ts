import type { Document, Types } from "mongoose";
import mongoose from "mongoose";
const { Schema } = mongoose;

import { toJSON } from "./plugins/toJSON";

type ObjectId = Types.ObjectId;

export interface ITask extends Document {
  eventId: ObjectId;
  assignedTo: ObjectId;
  description: string;
  status: "Pending" | "Completed";
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: true },
    description: { type: String, required: true, trim: true },
    status: { type: String, enum: ["Pending", "Completed"], default: "Pending" },
  },
  { timestamps: true }
);

toJSON(TaskSchema);

TaskSchema.index({ eventId: 1, assignedTo: 1 });

export const Task = mongoose.models.Task || mongoose.model<ITask>("Task", TaskSchema);
