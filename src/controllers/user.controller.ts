import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/ApiResponse";
import { User } from "../models";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload";
import { deleteByPublicId } from "../utils/cloudinaryDelete";
import { Response, Request } from "express"; // <-- Import Request
import { ApiError } from "../utils/ApiError"; // <-- Import ApiError
import { StatusCodes } from "http-status-codes"; // <-- Import StatusCodes
import { error } from "console";

export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const allUser = await User.find({});
  if (!allUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "No user found");
  }

  res.json(ok(allUser));
});

export const updateProfile = asyncHandler(async (req: any, res: Response) => {
  const { name, bio, phone } = req.body; // <-- Added phone
  const update: any = {};
  if (name) update.name = name;
  if (bio) update.bio = bio;
  if (phone) update.phone = phone; // <-- Added phone

  if (req.file) {
    const user = await User.findById(req.user.id);
    if (user?.profilePhotoPublicId)
      await deleteByPublicId(user.profilePhotoPublicId);
    const up = await uploadBufferToCloudinary(req.file.buffer, "rally/avatars");
    update.profilePhoto = up.url;
    update.profilePhotoPublicId = up.public_id;
  }

  const updated = await User.findByIdAndUpdate(req.user.id, update, {
    new: true,
  });
  res.json(ok(updated));
});

// --- TOGGLE DESIGNATION AS DRIVER FUNCTION ---
export const toggleDesignatedDriver = asyncHandler(
  async (req: any, res: Response) => {
    const user = await User.findById(req.user.id);
    if (!user) throw new ApiError(StatusCodes.NOT_FOUND, "User not found");

    // Flip the boolean status
    user.designatedDriverActive = !user.designatedDriverActive;
    await user.save();

    res.json(ok({ designatedDriverActive: user.designatedDriverActive }));
  }
);

// --- UPDATE OWN LOCATION FUNCTION ---
export const updateMyLocation = asyncHandler(
  async (req: any, res: Response) => {
    const { lat, lng } = req.body;
    if (lat === undefined || lng === undefined) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Missing lat and lng");
    }

    const coordinates = [Number(lng), Number(lat)];

    await User.findByIdAndUpdate(req.user.id, {
      currentLocation: {
        type: "Point",
        coordinates: coordinates,
      },
    });

    res.json(ok({ message: "Location updated" }));
  }
);
