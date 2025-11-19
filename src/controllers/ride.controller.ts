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

// --- UPDATED: HIDE FULL RIDES ---
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

      // 1. CHECK CAPACITY
      // Count how many seats are actually taken (Accepted or PickedUp)
      const occupiedSeats = ride.passengers.filter(
        (p: IRidePassenger) =>
          p.status === PassengerStatus.Accepted ||
          p.status === PassengerStatus.PickedUp
      ).length;

      // If the ride is full, return null so it gets filtered out
      if (occupiedSeats >= ride.vehicle.capacity) {
        return null;
      }

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
    .filter((ride) => ride !== null); // Remove nulls (full rides)

  res.json(ok(availableRides));
});

// --- UPDATED: BLOCK REQUESTS IF FULL ---
export const requestSeat = asyncHandler(async (req: any, res: Response) => {
  const { pickupLat, pickupLng, pickupAddress } = req.body;

  if (pickupLat === undefined || pickupLng === undefined) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Missing latitude or longitude in request body"
    );
  }

  const lat = Number(pickupLat);
  const lng = Number(pickupLng);

  if (isNaN(lat) || isNaN(lng)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Invalid latitude or longitude. Must be numbers."
    );
  }

  // 1. Fetch ride first to check capacity
  const rideCheck = await Ride.findById(req.params.rideId);
  if (!rideCheck) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Ride not found");
  }

  // 2. Calculate occupied seats
  const occupiedSeats = rideCheck.passengers.filter(
    (p: IRidePassenger) =>
      p.status === PassengerStatus.Accepted ||
      p.status === PassengerStatus.PickedUp
  ).length;

  // 3. Block request if full
  if (occupiedSeats >= rideCheck.vehicle.capacity) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "This ride is already full and cannot accept new requests."
    );
  }

  const update = {
    $addToSet: {
      passengers: {
        userId: req.user.id,
        status: PassengerStatus.Requested,
        pickupAddress: pickupAddress,
        pickupLocation: {
          type: "Point",
          coordinates: [lng, lat],
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

    const ride = await Ride.findOne({
      _id: req.params.rideId,
      driverId: (req as any).user.id,
    });

    if (!ride) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Ride not found");
    }

    // 1. CAPACITY CHECK
    if (status === PassengerStatus.Accepted) {
      const currentPassengers = ride.passengers.filter(
        (p: IRidePassenger) =>
          p.status === PassengerStatus.Accepted ||
          p.status === PassengerStatus.PickedUp
      ).length;

      if (currentPassengers >= ride.vehicle.capacity) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          `Vehicle is full! Capacity is ${ride.vehicle.capacity}.`
        );
      }
    }

    // 2. FIND AND UPDATE PASSENGER
    const passengerIndex = ride.passengers.findIndex(
      (p: IRidePassenger) => p.userId.toString() === userId
    );

    if (passengerIndex === -1) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Passenger request not found");
    }

    ride.passengers[passengerIndex].status = status;
    ride.passengers[passengerIndex].updatedAt = new Date();

    // 3. SAVE
    await ride.save();

    // 4. NOTIFICATIONS
    if (socketHelpers) {
      const notifData: any = {
        rideId: ride._id,
        status: status,
        message: "",
        type: "RIDE_UPDATE",
      };

      switch (status) {
        case PassengerStatus.Accepted:
          notifData.message =
            "Your ride request was ACCEPTED! The driver is on the way.";
          socketHelpers.joinRideRoom(userId, ride._id.toString());
          break;
        case PassengerStatus.Rejected:
          notifData.message = "Your ride request was declined.";
          break;
        case PassengerStatus.PickedUp:
          notifData.message = "Ride started! Enjoy the trip.";
          break;
        case PassengerStatus.DroppedOff:
          notifData.message = "You have been dropped off. Thanks for riding!";
          socketHelpers.leaveRideRoom(userId);
          break;
      }

      socketHelpers.notifyUser(userId, notifData);
    }

    const updatedRide = await Ride.findById(ride._id).populate(
      "passengers.userId",
      "name phone profilePhoto"
    );

    res.json(ok(updatedRide));
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

    const passengersWithLocation = activeRide.passengers.map(
      (p: IRidePassenger) => {
        return {
          userId: p.userId,
          status: p.status,
          updatedAt: p.updatedAt,
          pickupLocation: p.pickupLocation,
          pickupAddress: p.pickupAddress || "No address provided",
        };
      }
    );

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
