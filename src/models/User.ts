import type { Document } from "mongoose";
import mongoose from "mongoose";
const { Schema } = mongoose;

import bcrypt from "bcryptjs";
import { Badge } from "../types/enums";
import { toJSON } from "./plugins/toJSON";

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  profilePhoto?: string;
  profilePhotoPublicId?: string;
  bio?: string;

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
    email: { type: String, required: true, unique: true, lowercase: true }, // <- unique here creates the index
    passwordHash: { type: String, required: true, select: false },
    profilePhoto: String,
    profilePhotoPublicId: String,
    bio: { type: String, maxlength: 500 },

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

// ✂️ Removed: UserSchema.index({ email: 1 }, { unique: true });

export const User =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
