import type { Document } from "mongoose";
import mongoose from "mongoose";
const { Schema } = mongoose;

import bcrypt from "bcryptjs";
import { Badge } from "../types/enums";
import { toJSON } from "./plugins/toJSON";

// For the new location field
export interface IGeoPoint {
  type: "Point";
  coordinates: [number, number];
}

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  profilePhoto?: string;
  profilePhotoPublicId?: string;
  bio?: string;
  phone?: string; // <-- NEW FIELD
  currentLocation?: IGeoPoint; // <-- NEW FIELD

  rewardPoints: number;
  badge: Badge;

  withdrawableBalance: number;

  devices: {
    token: string;
    platform: "ios" | "android" | "web";
    lastSeenAt?: Date;
  }[];

  designatedDriverActive: boolean;

  comparePassword(plain: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    profilePhoto: String,
    profilePhotoPublicId: String,
    bio: { type: String, maxlength: 500 },
    phone: String, // <-- NEW FIELD

    // --- NEW FIELD ---
    // For storing user's live location
    currentLocation: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
    },
    // --- END NEW FIELD ---

    rewardPoints: { type: Number, default: 0 },
    badge: { type: String, enum: Object.values(Badge), default: Badge.Bronze },

    withdrawableBalance: { type: Number, default: 0 },

    devices: [
      {
        token: { type: String, required: true },
        platform: {
          type: String,
          enum: ["ios", "android", "web"],
          required: true,
        },
        lastSeenAt: Date,
      },
    ],

    designatedDriverActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

toJSON(UserSchema);

// --- NEW INDEX ---
// This is crucial for fast location-based searches ("5 min away")
UserSchema.index({ currentLocation: "2dsphere" });
// --- END NEW INDEX ---

UserSchema.pre("save", async function (next) {
  const user = this as IUser & { isModified: (k: string) => boolean };
  if (!user.isModified("passwordHash")) return next();
  if (!user.passwordHash) return next();
  const salt = await bcrypt.genSalt(10);
  user.passwordHash = await bcrypt.hash(user.passwordHash, salt);
  next();
});

UserSchema.methods.comparePassword = function (plain: string) {
  const self = this as IUser;
  return bcrypt.compare(plain, self.passwordHash);
};

export const User =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
