import { asyncHandler } from "../utils/asyncHandler";
import { created, ok } from "../utils/ApiResponse";
import { Ride } from "../models";
import { PassengerStatus, RideStatus } from "../types/enums";
import { Request, Response } from "express";

export const createRide = asyncHandler(async (req: any, res: Response) => {
  const { eventId, vehicleName, capacity, fromHub, toHub } = req.body;
  const ride = await Ride.create({
    eventId,
    driverId: req.user.id,
    vehicle: { name: vehicleName, capacity: Number(capacity || 4) },
    fromHub,
    toHub,
    passengers: [],
    status: RideStatus.Active
  });
  res.status(201).json(created(ride));
});

export const listRides = asyncHandler(async (req: Request, res: Response) => {
  const rides = await Ride.find({ eventId: req.params.eventId, status: RideStatus.Active });
  res.json(ok(rides));
});

export const requestSeat = asyncHandler(async (req: any, res: Response) => {
  const ride = await Ride.findByIdAndUpdate(
    req.params.rideId,
    { $addToSet: { passengers: { userId: req.user.id, status: PassengerStatus.Requested } } },
    { new: true }
  );
  res.json(ok(ride));
});

export const setPassengerStatus = asyncHandler(async (req: Request, res: Response) => {
  const { userId, status } = req.body as { userId: string; status: PassengerStatus };
  const ride = await Ride.findOneAndUpdate(
    { _id: req.params.rideId, driverId: (req as any).user.id, "passengers.userId": userId },
    { $set: { "passengers.$.status": status, "passengers.$.updatedAt": new Date() } },
    { new: true }
  );
  res.json(ok(ride));
});

export const finishRide = asyncHandler(async (req: any, res: Response) => {
  const ride = await Ride.findOneAndUpdate(
    { _id: req.params.rideId, driverId: req.user.id },
    { status: RideStatus.Completed },
    { new: true }
  );
  res.json(ok(ride));
});
