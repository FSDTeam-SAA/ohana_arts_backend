import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/ApiResponse";
import { User } from "../models";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload";
import { deleteByPublicId } from "../utils/cloudinaryDelete";

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
