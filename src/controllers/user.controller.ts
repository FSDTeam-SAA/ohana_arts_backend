import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/ApiResponse";
import { User } from "../models";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload";
import { deleteByPublicId } from "../utils/cloudinaryDelete";
import { ApiError } from "../utils/ApiError";
import { StatusCodes } from "http-status-codes";

export const updateProfile = asyncHandler(async (req: any, res) => {
  const { name, bio } = req.body;
  const update: any = {};
  if (name) update.name = name;
  if (bio) update.bio = bio;

  if (req.file) {
    const user = await User.findById(req.user.id);
    if (user?.profilePhotoPublicId) await deleteByPublicId(user.profilePhotoPublicId);
    const up = await uploadBufferToCloudinary(req.file.buffer, "rally/avatars");
    update.profilePhoto = up.url;
    update.profilePhotoPublicId = up.public_id;
  }

  const updated = await User.findByIdAndUpdate(req.user.id, update, { new: true });
  res.json(ok(updated));
});

export const getMe = asyncHandler(async (req: any, res) => {
  const user = await User.findById(req.user.id);
  return res.json(ok(user));
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById((req as any).params.id);
  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  return res.json(ok(user));
});
