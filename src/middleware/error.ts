import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import { fail } from "../utils/ApiResponse";
import { StatusCodes } from "http-status-codes";

export function notFound(_req: Request, res: Response) {
  return res.status(StatusCodes.NOT_FOUND).json(fail("Route not found"));
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json(fail(err.message, err.details));
  }
  console.error("💥", err);
  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(fail("Internal Server Error"));
}
