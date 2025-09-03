import type { Document, Types } from "mongoose";
import mongoose from "mongoose";
const { Schema } = mongoose;

import { PaymentMethod, PaymentStatus } from "../types/enums";
import { toJSON } from "./plugins/toJSON";

type ObjectId = Types.ObjectId;

export interface IPayment extends Document {
  eventId: ObjectId;
  userId: ObjectId;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  receiptUrl?: string;
  paidAt?: Date;

  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  paypalOrderId?: string;
  paypalCaptureId?: string;

  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: Object.values(PaymentMethod), required: true },
    status: { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.Pending, index: true },
    receiptUrl: String,
    paidAt: Date,

    stripeSessionId: String,
    stripePaymentIntentId: String,
    paypalOrderId: String,
    paypalCaptureId: String
  },
  { timestamps: true }
);

toJSON(PaymentSchema);

PaymentSchema.index({ eventId: 1, userId: 1 }, { unique: false });

export const Payment = mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);
