import { asyncHandler } from "../utils/asyncHandler";
import { created, ok } from "../utils/ApiResponse";
import { Ride, User, IRideDocument, IRidePassenger } from "../models";
import { PassengerStatus, RideStatus } from "../types/enums";
import { Request, Response } from "express";
import { awardPoints } from "./reward.controller";
import { ApiError } from "../utils/ApiError";
import { StatusCodes } from "http-status-codes";
import { SocketHelpers } from "../socket";

let socketHelpers: SocketHelpers;

export const setRideSocketHelpers = (helpers: SocketHelpers) => {
  socketHelpers = helpers;
};

/**
 * Calculates the distance between two GeoJSON points in kilometers.
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

  await User.findByIdAndUpdate(req.user.id, { designatedDriverActive: true });

  if (socketHelpers) {
    socketHelpers.joinRideRoom(req.user.id, ride._id.toString());
  }

  await awardPoints(req.user.id, "DESIGNATED_DRIVER", ride.eventId);

  res.status(201).json(created(ride));
});

export const listRides = asyncHandler(async (req: any, res: Response) => {
  const passenger = await User.findById(req.user.id).select("currentLocation");
  if (!passenger) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Passenger not found");
  }
  const passengerCoords = passenger.currentLocation?.coordinates;
  if (
    !passengerCoords ||
    (passengerCoords[0] === 0 && passengerCoords[1] === 0)
  ) {
    return res.json(ok([]));
  }

  const rides: IRideDocument[] = await Ride.find({
    eventId: req.params.eventId,
    status: RideStatus.Active,
  }).populate(
    "driverId",
    "name rewardPoints phone currentLocation profilePhoto"
  );

  const availableRides = rides
    .map((ride: IRideDocument) => {
      const driver = ride.driverId as any;
      if (!driver) return null;

      let distanceKm = 0;
      if (driver.currentLocation?.coordinates) {
        distanceKm = calculateDistance(
          passengerCoords,
          driver.currentLocation.coordinates
        );
      }

      const minutesAway = Math.max(1, Math.round(distanceKm * 1.5));

      return {
        id: ride.id,
        eventId: ride.eventId,
        vehicle: ride.vehicle,
        fromHub: ride.fromHub,
        toHub: ride.toHub,
        status: "Available",
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
    .filter((ride) => ride !== null);

  res.json(ok(availableRides));
});

export const requestSeat = asyncHandler(async (req: any, res: Response) => {
  const { pickupLat, pickupLng, pickupAddress } = req.body;

  const update = {
    $addToSet: {
      passengers: {
        userId: req.user.id,
        status: PassengerStatus.Requested,
        pickupAddress: pickupAddress,
        pickupLocation: {
          type: "Point",
          coordinates: [Number(pickupLng), Number(pickupLat)],
        },
      },
    },
  };

  const ride = await Ride.findByIdAndUpdate(req.params.rideId, update, {
    new: true,
  });

  if (socketHelpers && ride) {
    const driverSocketId = (ride.driverId as any).toString();
    socketHelpers.notifyUser(driverSocketId, {
      type: "RIDE_REQUEST",
      message: "You have a new ride request!",
      rideId: ride.id,
    });
  }

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

    if (socketHelpers && ride && status === PassengerStatus.Accepted) {
      socketHelpers.joinRideRoom(userId, ride._id.toString());
      socketHelpers.notifyUser(userId, {
        type: "RIDE_ACCEPTED",
        message: "Your ride request was accepted!",
        rideId: ride.id,
      });
    }

    res.json(ok(ride));
  }
);

export const finishRide = asyncHandler(async (req: any, res: Response) => {
  const ride: IRideDocument | null = await Ride.findOneAndUpdate(
    { _id: req.params.rideId, driverId: req.user.id },
    { status: RideStatus.Completed },
    { new: true }
  );

  if (ride) {
    await User.findByIdAndUpdate(req.user.id, {
      designatedDriverActive: false,
    });

    if (socketHelpers) {
      socketHelpers.leaveRideRoom(req.user.id);

      ride.passengers.forEach((passenger: IRidePassenger) => {
        socketHelpers.leaveRideRoom(passenger.userId.toString());
      });
    }
  }

  res.json(ok(ride));
});

export const getMyActiveDriverRide = asyncHandler(
  async (req: any, res: Response) => {
    const activeRide: IRideDocument | null = await Ride.findOne({
      driverId: req.user.id,
      status: RideStatus.Active,
    }).populate("passengers.userId", "name phone profilePhoto");

    if (!activeRide) {
      return res.json(ok(null));
    }

    // --- THIS IS THE FIX ---
    // We access the plain properties of the sub-document (p)
    // The parent 'activeRide.toJSON()' will handle the rest.
    const passengersWithLocation = activeRide.passengers.map(
      (p: IRidePassenger) => {
        return {
          userId: p.userId, // This is populated
          status: p.status,
          updatedAt: p.updatedAt,
          pickupLocation: p.pickupLocation,
          // Add the 'pickupAddress' with the default
          pickupAddress: p.pickupAddress || "No address provided",
        };
      }
    );
    // --- END OF FIX ---

    res.json(
      ok({ ...activeRide.toJSON(), passengers: passengersWithLocation })
    );
  }
);

export const getMyRidesAsPassenger = asyncHandler(
  async (req: any, res: Response) => {
    const myId = req.user.id;

    const allMyRides: IRideDocument[] = await Ride.find({
      "passengers.userId": myId,
    })
      .populate("driverId", "name rewardPoints phone profilePhoto vehicle")
      .sort({ createdAt: -1 });

    const currentRide = allMyRides.find(
      (ride: IRideDocument) => ride.status === RideStatus.Active
    );

    const rideHistory = allMyRides.filter(
      (ride: IRideDocument) => ride.status === RideStatus.Completed
    );

    res.json(ok({ currentRide, rideHistory }));
  }
);
