import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { StatusCodes } from "http-status-codes";
import { Client, PlaceType1 } from "@googlemaps/google-maps-services-js";

const gmapsClient = new Client({});
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY!;

// A default placeholder image if the bar has no photo on Google
const DEFAULT_BAR_IMAGE =
  "https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=1974&auto=format&fit=crop";

if (!GOOGLE_API_KEY) {
  console.warn(
    "!! WARNING: GOOGLE_MAPS_API_KEY is not set in .env file. Nearby search will fail. !!"
  );
}

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
          type: PlaceType1.bar,
        },
        timeout: 2000,
      });

      // --- NEW LOGIC TO PROCESS IMAGES ---
      const resultsWithImages = response.data.results.map((place: any) => {
        let imageUrl = DEFAULT_BAR_IMAGE;

        // If Google has photos, we construct the URL
        if (place.photos && place.photos.length > 0) {
          const photoRef = place.photos[0].photo_reference;
          // This URL endpoint serves the actual image
          imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoRef}&key=${GOOGLE_API_KEY}`;
        }

        return {
          ...place,
          // We add a clean 'image' field for your frontend to use
          image: imageUrl,
        };
      });

      res.json(ok(resultsWithImages));
    } catch (error: any) {
      console.error(
        "Google Places API error:",
        error.response?.data?.error_message || error.message
      );
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Failed to fetch data from Google Places",
        error.response?.data
      );
    }
  }
);
