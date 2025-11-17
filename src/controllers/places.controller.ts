import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { StatusCodes } from "http-status-codes";
import { Client, PlaceType1 } from "@googlemaps/google-maps-services-js";

const gmapsClient = new Client({});
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY!;

if (!GOOGLE_API_KEY) {
  console.warn(
    "!! WARNING: GOOGLE_MAPS_API_KEY is not set in .env file. Nearby search will fail. !!"
  );
}

/**
 * @query lat (number), lng (number), radius (number, in meters, e.g., 5000)
 */
export const findNearbyPlaces = asyncHandler(
  async (req: Request, res: Response) => {
    const { lat, lng, radius } = req.query;

    if (!GOOGLE_API_KEY) {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Google API key is not configured on the server."
      );
    }

    if (!lat || !lng || !radius) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Missing required query parameters: lat, lng, radius"
      );
    }

    const location = {
      lat: Number(lat),
      lng: Number(lng),
    };

    try {
      const response = await gmapsClient.placesNearby({
        params: {
          key: GOOGLE_API_KEY,
          location,
          radius: Number(radius),
          type: PlaceType1.bar, // for bars
        },
        timeout: 1000, 
      });

      //list of places
      res.json(ok(response.data.results));
    } catch (error: any) {
      console.error("Google Places API error:", error.response?.data?.error_message || error.message);
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Failed to fetch data from Google Places",
        error.response?.data
      );
    }
  }
);