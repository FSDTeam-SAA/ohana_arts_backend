import { StatusCodes } from "http-status-codes";

export class ApiError extends Error {
  statusCode: number;
  details?: any;

  constructor(statusCode = StatusCodes.INTERNAL_SERVER_ERROR, message = "Unexpected error", details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}
