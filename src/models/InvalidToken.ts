import mongoose, { Document, Schema } from 'mongoose';

export interface IInvalidToken extends Document {
  token: string;
  expiresAt: Date;
}

const InvalidTokenSchema = new Schema<IInvalidToken>({
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

export const InvalidToken = mongoose.models.InvalidToken || mongoose.model<IInvalidToken>('InvalidToken', InvalidTokenSchema);