import { StatusCodes } from "http-status-codes";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { created, ok } from "../utils/ApiResponse";
import { User } from "../models";
import { Request, Response } from "express";
import { InvalidToken } from "../models/InvalidToken";
import { sendEmail } from "../utils/sendEmail"; // <--- Import this

const sign = (id: string) => {
  const secret = process.env.JWT_SECRET as jwt.Secret;
  const expiresIn: jwt.SignOptions["expiresIn"] =
    (process.env.JWT_EXPIRES_IN as unknown as jwt.SignOptions["expiresIn"]) ||
    "30d";
  return jwt.sign({ id }, secret, { expiresIn });
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    throw new ApiError(StatusCodes.BAD_REQUEST, "Missing fields");

  const exists = await User.findOne({ email }).lean();
  if (exists)
    throw new ApiError(StatusCodes.CONFLICT, "Email already registered");

  const user = new User({ name, email, passwordHash: password });
  await user.save();
  return res
    .status(StatusCodes.CREATED)
    .json(created({ token: sign(user.id), user }));
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user)
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid credentials");

  const okPass = await user.comparePassword(password);
  if (!okPass)
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid credentials");

  return res.json(ok({ token: sign(user.id), user: user.toJSON() }));
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id);
  return res.json(ok(user));
});

export const changePassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword)
      throw new ApiError(StatusCodes.BAD_REQUEST, "Missing passwords");

    const user = await User.findById(req.user!.id).select("+passwordHash");
    if (!user) throw new ApiError(StatusCodes.UNAUTHORIZED, "User not found");

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch)
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Old password is incorrect");

    user.passwordHash = newPassword;
    await user.save();
    return res.json(ok({ message: "Password updated successfully" }));
  }
);

export const withdrawFunds = asyncHandler(
  async (req: Request, res: Response) => {
    const { amount } = req.body;
    if (!amount || isNaN(amount) || amount <= 0)
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid amount");

    const user = await User.findById(req.user!.id);
    if (!user) throw new ApiError(StatusCodes.NOT_FOUND, "User not found");

    if (user.withdrawableBalance < amount) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Insufficient balance");
    }

    user.withdrawableBalance -= amount;
    await user.save();

    return res.json(
      ok({
        message: `Withdrawal of ${amount} successful.`,
        newBalance: user.withdrawableBalance,
      })
    );
  }
);

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) throw new ApiError(StatusCodes.BAD_REQUEST, "No token provided");

  const decoded = jwt.decode(token) as { exp: number };
  const expiresAt = new Date(decoded.exp * 1000);

  await InvalidToken.create({ token, expiresAt });
  res.json(ok({ message: "Logout successful" }));
});

// --- NEW: Forgot Password ---
export const forgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) throw new ApiError(StatusCodes.NOT_FOUND, "User not found");

    // Generate 6 digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Save hashed OTP or plain (Plain is simpler for now, expires in 10 mins)
    user.resetPasswordOtp = otp;
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await user.save();

    const message = `Your password reset OTP is: ${otp}\n\nIt expires in 10 minutes.`;

    try {
      await sendEmail({
        email: user.email,
        subject: "Password Reset OTP",
        message,
      });
      res.json(ok({ message: "Email sent" }));
    } catch (err) {
      console.error("❌ EMAIL ERROR:", err);
      user.resetPasswordOtp = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Email could not be sent"
      );
    }
  }
);

// --- NEW: Verify OTP ---
export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  // Find user with matching OTP and make sure it hasn't expired
  const user = await User.findOne({
    email,
    resetPasswordOtp: otp,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid or expired OTP");
  }

  res.json(ok({ message: "OTP Verified" }));
});

// --- NEW: Reset Password ---
export const resetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({
      email,
      resetPasswordOtp: otp,
      resetPasswordExpires: { $gt: Date.now() },
    }).select("+passwordHash"); // Select password field to modify it

    if (!user) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid or expired OTP");
    }

    user.passwordHash = newPassword; // The model's pre-save hook will hash this
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json(ok({ message: "Password reset successful" }));
  }
);
