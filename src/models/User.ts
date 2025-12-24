import type { Document } from "mongoose";
import mongoose from "mongoose";
const { Schema } = mongoose;

import bcrypt from "bcryptjs";
import { Badge } from "../types/enums";
import { toJSON } from "./plugins/toJSON";

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
  phone?: string;
  currentLocation?: IGeoPoint;

  bleUUID?: string;

  resetPasswordOtp?: string;
  resetPasswordExpires?: Date;

  rewardPoints: number;
  badge: Badge;

  withdrawableBalance: number;

  devices: {
    token: string;
    platform: "ios" | "android" | "web";
    lastSeenAt?: Date;
  }[];

  designatedDriverActive: boolean;

  homeAddress?: string;
  homeLocation?: {
    type: string;
    coordinates: number[];
  };

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
    phone: String,

    bleUUID: { type: String },
    
    resetPasswordOtp: { type: String, select: false }, // Hide by default
    resetPasswordExpires: { type: Date, select: false },

    currentLocation: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] }, 
    },

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

    homeAddress: { type: String }, // Stores "123 Main St"
  homeLocation: {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], default: [0, 0] },
  },
  },
  { timestamps: true }
);

toJSON(UserSchema);

UserSchema.index({ currentLocation: "2dsphere" });

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
