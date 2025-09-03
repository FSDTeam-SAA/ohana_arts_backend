import { RequestHandler } from "express";

export const asyncHandler = (fn: Function): RequestHandler =>
  (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
