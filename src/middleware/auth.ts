// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";
import { ApiError } from "../utils/ApiError";
import { User } from "../models";
import { InvalidToken } from "../models/InvalidToken";

export interface AuthRequest extends Request {
  user?: { id: string };
}

export const auth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.substring(7) : null;
    if (!token) throw new ApiError(StatusCodes.UNAUTHORIZED, "Missing token");
    
    const isBlacklisted = await InvalidToken.findOne({ token });
    if (isBlacklisted) throw new ApiError(StatusCodes.UNAUTHORIZED, "Token invalidated");

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
    if (!payload?.id) throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid token");

    const user = await User.findById(payload.id).select("_id");
    if (!user) throw new ApiError(StatusCodes.UNAUTHORIZED, "User not found");

    req.user = { id: user.id };
    next();
  } catch (err) {
    next(new ApiError(StatusCodes.UNAUTHORIZED, "Unauthorized", err));
  }
};
