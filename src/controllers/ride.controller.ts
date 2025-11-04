import { asyncHandler } from "../utils/asyncHandler";
import { created, ok } from "../utils/ApiResponse";
import { Ride, User } from "../models"; // <-- Import User model
import { PassengerStatus, RideStatus } from "../types/enums";
import { Request, Response } from "express";
import { awardPoints } from "./reward.controller";
import { ApiError } from "../utils/ApiError"; // <-- Import ApiError
import { StatusCodes } from "http-status-codes"; // <-- Import StatusCodes

// --- HELPER FUNCTION ---
/**
 * Calculates the distance between two GeoJSON points in kilometers.
 * @param coords1 [lng, lat]
 * @param coords2 [lng, lat]
 * @returns Distance in km
 */
function calculateDistance(coords1: number[], coords2: number[]): number {
  const [lng1, lat1] = coords1;
  const [lng2, lat2] = coords2;

  const toRad = (value: number) => (value * Math.PI) / 180;

  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

export const createRide = asyncHandler(async (req: any, res: Response) => {
  const { eventId, vehicleName, capacity, fromHub, toHub } = req.body;
  const ride = await Ride.create({
    eventId,
    driverId: req.user.id,
    vehicle: { name: vehicleName, capacity: Number(capacity || 4) },
    fromHub,
    toHub,
    passengers: [],
    status: RideStatus.Active,
  });

  // Set user as an active driver
  await User.findByIdAndUpdate(req.user.id, { designatedDriverActive: true });

  await awardPoints(req.user.id, "DESIGNATED_DRIVER", ride.eventId);

  res.status(201).json(created(ride));
});

// This now provides data for the "Available Rides" screen
export const listRides = asyncHandler(async (req: any, res: Response) => {
  // 1. Get the current user's (passenger's) location
  const passenger = await User.findById(req.user.id).select("currentLocation");
  if (!passenger) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Passenger not found");
  }
  const passengerCoords = passenger.currentLocation?.coordinates;
  if (
    !passengerCoords ||
    (passengerCoords[0] === 0 && passengerCoords[1] === 0)
  ) {
    // Can't show distances if we don't know passenger's location
    return res.json(ok([]));
  }

  // 2. Find active rides and populate driver's location and info
  const rides = await Ride.find({
    eventId: req.params.eventId,
    status: RideStatus.Active,
  })
    .populate(
      "driverId",
      "name rewardPoints phone currentLocation profilePhoto"
    )
    .lean(); // Use .lean() to allow modifying the objects

  // 3. Calculate distance and format the response
  const availableRides = rides
    .map((ride) => {
      const driver = ride.driverId as any; // We populated this
      if (!driver) return null; // Skip if driver is missing

      let distanceKm = 0;
      if (driver.currentLocation?.coordinates) {
        distanceKm = calculateDistance(
          passengerCoords,
          driver.currentLocation.coordinates
        );
      }

      // Simple conversion: ~1.5 min per km in city
      const minutesAway = Math.max(1, Math.round(distanceKm * 1.5));

      // Format to match the UI
      return {
        _id: ride._id,
        eventId: ride.eventId,
        vehicle: ride.vehicle,
        fromHub: ride.fromHub,
        toHub: ride.toHub,
        status: "Available", // UI-friendly status
        distanceTime: `${minutesAway} min away`,
        driverInfo: {
          _id: driver._id,
          name: driver.name,
          points: driver.rewardPoints,
          phone: driver.phone,
          profilePhoto: driver.profilePhoto,
        },
      };
    })
    .filter((ride) => ride !== null); // Remove any null entries

  res.json(ok(availableRides));
});

export const requestSeat = asyncHandler(async (req: any, res: Response) => {
  const ride = await Ride.findByIdAndUpdate(
    req.params.rideId,
    {
      $addToSet: {
        passengers: { userId: req.user.id, status: PassengerStatus.Requested },
      },
    },
    { new: true }
  );
  res.json(ok(ride));
});

export const setPassengerStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId, status } = req.body as {
      userId: string;
      status: PassengerStatus;
    };
    const ride = await Ride.findOneAndUpdate(
      {
        _id: req.params.rideId,
        driverId: (req as any).user.id,
        "passengers.userId": userId,
      },
      {
        $set: {
          "passengers.$.status": status,
          "passengers.$.updatedAt": new Date(),
        },
      },
      { new: true }
    );
    res.json(ok(ride));
  }
);

export const finishRide = asyncHandler(async (req: any, res: Response) => {
  const ride = await Ride.findOneAndUpdate(
    { _id: req.params.rideId, driverId: req.user.id },
    { status: RideStatus.Completed },
    { new: true }
  );

  // Set user as no longer an active driver
  if (ride) {
    await User.findByIdAndUpdate(req.user.id, {
      designatedDriverActive: false,
    });
  }

  res.json(ok(ride));
});

// For the "Designated Driver" screen
export const getMyActiveDriverRide = asyncHandler(
  async (req: any, res: Response) => {
    // Find the user's active ride
    const activeRide = await Ride.findOne({
      driverId: req.user.id,
      status: RideStatus.Active,
    })
      .populate("passengers.userId", "name phone profilePhoto") // Get passenger info
      .lean();

    if (!activeRide) {
      // Not an error, just no active ride
      return res.json(ok(null));
    }

    // Note: The "123 Main St" address from the design is not in the
    // database schema. We are returning the passenger's user info.
    res.json(ok(activeRide));
  }
);

// For the "My Rides" screen
export const getMyRidesAsPassenger = asyncHandler(
  async (req: any, res: Response) => {
    const myId = req.user.id;

    // Find all rides where user is a passenger
    const allMyRides = await Ride.find({ "passengers.userId": myId })
      .populate("driverId", "name rewardPoints phone profilePhoto vehicle")
      .sort({ createdAt: -1 })
      .lean();

    // Find the current active ride
    const currentRide = allMyRides.find(
      (ride) => ride.status === RideStatus.Active
    );

    // Filter for completed rides
    const rideHistory = allMyRides.filter(
      (ride) => ride.status === RideStatus.Completed
    );

    res.json(ok({ currentRide, rideHistory }));
  }
);
