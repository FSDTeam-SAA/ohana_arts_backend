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
  const existingRide = await Ride.findOne({
    driverId: req.user.id,
    status: RideStatus.Active,
  });

  if (existingRide) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "You already have an active ride. End your current DD Mode first."
    );
  }

  const {
    eventId,
    vehicleName,
    capacity,
    fromHub,
    toHub,
    fromLat,
    fromLng,
    toLat,
    toLng,
  } = req.body;

  let fromLocation, toLocation;

  if (fromLat !== undefined && fromLng !== undefined) {
    fromLocation = {
      type: "Point",
      coordinates: [Number(fromLng), Number(fromLat)],
    };
  }

  if (toLat !== undefined && toLng !== undefined) {
    toLocation = {
      type: "Point",
      coordinates: [Number(toLng), Number(toLat)],
    };
  }

  const ride = await Ride.create({
    eventId,
    driverId: req.user.id,
    vehicle: { name: vehicleName, capacity: Number(capacity || 4) },
    fromHub,
    toHub,
    fromLocation,
    toLocation,
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
  const passengerCoords = passenger?.currentLocation?.coordinates;

  const hasPassengerLoc =
    passengerCoords && (passengerCoords[0] !== 0 || passengerCoords[1] !== 0);

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

      const occupiedSeats = ride.passengers.filter(
        (p: IRidePassenger) =>
          p.status === PassengerStatus.Accepted ||
          p.status === PassengerStatus.PickedUp
      ).length;

      if (occupiedSeats >= ride.vehicle.capacity) {
        return null;
      }

      let distanceTime = "Distance unknown";

      if (hasPassengerLoc && driver.currentLocation?.coordinates) {
        const distanceKm = calculateDistance(
          passengerCoords,
          driver.currentLocation.coordinates
        );
        const minutesAway = Math.max(1, Math.round(distanceKm * 1.5));
        distanceTime = `${minutesAway} min away`;
      }

      return {
        id: ride.id,
        eventId: ride.eventId,
        vehicle: ride.vehicle,
        fromHub: ride.fromHub,
        toHub: ride.toHub,
        fromLocation: ride.fromLocation,
        toLocation: ride.toLocation,
        status: "Available",
        distanceTime: distanceTime,
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

// --- UPDATED FUNCTION ---
export const requestSeat = asyncHandler(async (req: any, res: Response) => {
  // CHANGED: We now expect destination details instead of pickup
  const { destinationLat, destinationLng, destinationAddress } = req.body;

  // 1. Validation
  if (destinationLat === undefined || destinationLng === undefined) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Missing destination location data");
  }

  // 2. Check Ride Availability
  const rideCheck = await Ride.findById(req.params.rideId);
  if (!rideCheck) throw new ApiError(StatusCodes.NOT_FOUND, "Ride not found");

  const occupiedSeats = rideCheck.passengers.filter(
    (p: any) =>
      p.status === PassengerStatus.Accepted || p.status === PassengerStatus.PickedUp
  ).length;

  if (occupiedSeats >= rideCheck.vehicle.capacity) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Ride is full");
  }

  // --- NEW LOGIC: Save this destination as the user's HOME location ---
  await User.findByIdAndUpdate(req.user.id, {
    homeAddress: destinationAddress,
    homeLocation: {
      type: "Point",
      coordinates: [Number(destinationLng), Number(destinationLat)],
    },
  });

  // 3. Add Passenger to Ride (With Destination Address)
  const update = {
    $addToSet: {
      passengers: {
        userId: req.user.id,
        status: PassengerStatus.Requested,
        destinationAddress: destinationAddress, // Stored for the Driver to see (Drop Off)
        destinationLocation: {
          type: "Point",
          coordinates: [Number(destinationLng), Number(destinationLat)],
        },
      },
    },
  };

  const ride = await Ride.findByIdAndUpdate(req.params.rideId, update, {
    new: true,
  });

  // 4. Notify Driver
  if (socketHelpers && ride) {
    const driverSocketId = (ride.driverId as any).toString();
    socketHelpers.notifyUser(driverSocketId, {
      type: "RIDE_REQUEST",
      message: "You have a new ride request!",
      rideId: ride.id,
      passengerName: req.user.name, // Helpful to send name immediately
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

    const passengerIndex = ride.passengers.findIndex(
      (p: IRidePassenger) => p.userId.toString() === userId
    );

    if (passengerIndex === -1) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Passenger request not found");
    }

    ride.passengers[passengerIndex].status = status;
    ride.passengers[passengerIndex].updatedAt = new Date();

    await ride.save();

    if (socketHelpers) {
      const notifData: any = {
        rideId: ride._id,
        status: status,
        message: "",
        type: "RIDE_UPDATE",
      };

      switch (status) {
        case PassengerStatus.Accepted:
          notifData.message = "Your ride request was ACCEPTED!";
          socketHelpers.joinRideRoom(userId, ride._id.toString());
          break;
        case PassengerStatus.Rejected:
          notifData.message = "Your ride request was declined.";
          break;
        case PassengerStatus.PickedUp:
          notifData.message = "Ride started! Enjoy the trip.";
          break;
        case PassengerStatus.DroppedOff:
          notifData.message = "You have been dropped off.";
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

export const endDDMode = asyncHandler(async (req: any, res: Response) => {
  // 1. Find ANY active ride for this driver (Fixes the "Zombie Data" issue)
  const ride = await Ride.findOne({
    driverId: req.user.id,
    status: RideStatus.Active,
  });

  // 2. Even if no ride is found, force the User Flag to false (Safety Net)
  if (!ride) {
    await User.findByIdAndUpdate(req.user.id, {
      designatedDriverActive: false,
    });
    return res.json(
      ok({ message: "DD Mode is now OFF (No active ride was found)" })
    );
  }

  // 3. Mark Ride as Completed
  ride.status = RideStatus.Completed;
  await ride.save();

  // 4. Update User Flag
  await User.findByIdAndUpdate(req.user.id, { designatedDriverActive: false });

  // 5. Cleanup Sockets (Disconnect everyone from the room)
  if (socketHelpers) {
    socketHelpers.leaveRideRoom(req.user.id);

    ride.passengers.forEach((passenger: any) => {
      // Check if passenger exists before accessing userId
      if (passenger && passenger.userId) {
        socketHelpers.leaveRideRoom(passenger.userId.toString());
      }
    });
  }

  res.json(ok({ message: "DD Mode Ended Successfully", ride }));
});

// --- UPDATED FUNCTION ---
export const getMyActiveDriverRide = asyncHandler(
  async (req: any, res: Response) => {
    const activeRide = await Ride.findOne({
      driverId: req.user.id,
      status: RideStatus.Active,
    }).populate("passengers.userId", "name profilePhoto phone");

    if (!activeRide) {
      return res.json(ok(null));
    }

    const passengerTrackerList = activeRide.passengers
      .filter((p: any) => p.status !== PassengerStatus.Rejected)
      .map((p: any) => {
        const user = p.userId;

        return {
          _id: p._id,
          userId: user._id,
          name: user.name,
          profilePhoto: user.profilePhoto,
          status: p.status,

          // --- CHANGED: Return destinationAddress as 'address' ---
          // This ensures the driver sees "123 Main St" (Drop Off) in the Tracker
          address: p.destinationAddress || "No destination provided",

          requestedAt: p.updatedAt, // Using updatedAt as the request time
        };
      });

    res.json(
      ok({
        _id: activeRide._id,
        eventId: activeRide.eventId,
        vehicle: activeRide.vehicle,
        passengers: passengerTrackerList,
      })
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