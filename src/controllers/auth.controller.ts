import { StatusCodes } from "http-status-codes";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { created, ok } from "../utils/ApiResponse";
import { User } from "../models";

const sign = (id: string) =>
  jwt.sign({ id }, process.env.JWT_SECRET!, { expiresIn: process.env.JWT_EXPIRES_IN || "30d" });

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) throw new ApiError(StatusCodes.BAD_REQUEST, "Missing fields");

  const exists = await (await User.findOne({ email }).lean());
  if (exists) throw new ApiError(StatusCodes.CONFLICT, "Email already registered");

  const user = new User({ name, email, passwordHash: password });
  await user.save();
  return res.status(StatusCodes.CREATED).json(created({ token: sign(user.id), user }));
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid credentials");

  const okPass = await user.comparePassword(password);
  if (!okPass) throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid credentials");

  return res.json(ok({ token: sign(user.id), user: user.toJSON() }));
});

export const me = asyncHandler(async (req: any, res) => {
  const user = await User.findById(req.user.id);
  return res.json(ok(user));
});
