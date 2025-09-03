import { StatusCodes } from "http-status-codes";
import dayjs from "dayjs";
import { asyncHandler } from "../utils/asyncHandler";
import { created, ok } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { Event, Chat, Invitation, BarHopStop, QuickRally, CheckIn, Message, Payment, Ride, Task } from "../models";
import { RSVPStatus } from "../types/enums";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload";
import { nanoid } from "nanoid";
import mongoose from "mongoose";
import { deleteByPublicId } from "../utils/cloudinaryDelete";

const parseNumber = (x?: string) => (x === undefined ? undefined : Number(x));

export const createEvent = asyncHandler(async (req: any, res) => {
  const { title, description, locationName, address, lat, lng, dateTime, capacity, fee } = req.body;
  if (!title || !dateTime) throw new ApiError(StatusCodes.BAD_REQUEST, "title & dateTime required");

  const event: any = {
    title,
    description,
    location: { name: locationName, address },
    dateTime: new Date(dateTime),
    capacity: parseNumber(capacity),
    fee: parseNumber(fee),
    createdBy: req.user.id,
    inviteCode: nanoid(8),
    attendees: [{ userId: req.user.id, status: RSVPStatus.Yes }]
  };

  if (lat && lng) event.location.point = { type: "Point", coordinates: [Number(lng), Number(lat)] };

  if (req.file) {
    const img = await uploadBufferToCloudinary(req.file.buffer, "rally/events");
    event.image = img.url;
    event.imagePublicId = img.public_id;
  }

  const saved = await Event.create(event);
  const chat = await Chat.create({ eventId: saved._id, members: [req.user.id], lastMessageAt: new Date() });
  saved.chatId = chat._id;
  await saved.save();
  await CheckIn.create({ eventId: saved._id, userId: req.user.id, status: "StillOut" });

  res.status(StatusCodes.CREATED).json(created(saved));
});

export const listEvents = asyncHandler(async (req: any, res) => {
  const scope = (req.query.scope as string) || "upcoming";
  const now = dayjs();

  let filter: any = {};
  if (scope === "upcoming") filter = { dateTime: { $gte: now.toDate() } };
  if (scope === "past") filter = { dateTime: { $lt: now.toDate() } };
  if (scope === "live") filter = { dateTime: { $gte: now.startOf("day").toDate(), $lte: now.endOf("day").toDate() } };

  const events = await Event.find(filter).sort({ dateTime: 1 }).limit(100);
  res.json(ok(events));
});

export const getEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) throw new ApiError(StatusCodes.NOT_FOUND, "Event not found");
  res.json(ok(event));
});

export const updateEvent = asyncHandler(async (req: any, res) => {
  const patch: any = { ...req.body };
  if (patch.capacity) patch.capacity = Number(patch.capacity);
  if (patch.fee) patch.fee = Number(patch.fee);
  if (patch.dateTime) patch.dateTime = new Date(patch.dateTime);

  const existing = await Event.findOne({ _id: req.params.id, createdBy: req.user.id });
  if (!existing) throw new ApiError(StatusCodes.NOT_FOUND, "Event not found or not owner");

  if (req.file) {
    if (existing.imagePublicId) await deleteByPublicId(existing.imagePublicId);
    const up = await uploadBufferToCloudinary(req.file.buffer, "rally/events");
    patch.image = up.url;
    patch.imagePublicId = up.public_id;
  }

  Object.assign(existing, patch);
  await existing.save();
  res.json(ok(existing));
});

export const rsvp = asyncHandler(async (req: any, res) => {
  const { status } = req.body as { status: RSVPStatus };
  if (!Object.values(RSVPStatus).includes(status)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid RSVP status");
  }

  const event = await Event.findById(req.params.id);
  if (!event) throw new ApiError(StatusCodes.NOT_FOUND, "Event not found");

  const idx = event.attendees.findIndex(a => a.userId.toString() === req.user.id);
  if (idx >= 0) {
    event.attendees[idx].status = status;
    event.attendees[idx].updatedAt = new Date();
  } else {
    event.attendees.push({ userId: req.user.id, status, updatedAt: new Date() } as any);
  }
  await event.save();
  res.json(ok(event.attendees));
});

export const inviteUser = asyncHandler(async (req: any, res) => {
  const { userId } = req.body;
  const eventId = req.params.id;

  const inv = await Invitation.findOneAndUpdate(
    { eventId, invitedUser: userId },
    { $setOnInsert: { invitedBy: req.user.id, status: "Pending" } },
    { upsert: true, new: true }
  );
  res.status(StatusCodes.CREATED).json(created(inv));
});

export const respondInvite = asyncHandler(async (req: any, res) => {
  const { invitationId } = req.params;
  const { action } = req.body as { action: "Accept" | "Decline" };

  const inv = await Invitation.findById(invitationId);
  if (!inv) throw new ApiError(StatusCodes.NOT_FOUND, "Invitation not found");
  if (inv.invitedUser.toString() !== req.user.id) throw new ApiError(StatusCodes.FORBIDDEN, "Not your invite");

  inv.status = action === "Accept" ? "Accepted" : "Declined";
  await inv.save();

  if (inv.status === "Accepted") {
    await Event.findByIdAndUpdate(inv.eventId, {
      $addToSet: { attendees: { userId: inv.invitedUser, status: RSVPStatus.Maybe, updatedAt: new Date() } }
    });
  }

  res.json(ok(inv));
});

export const createStop = asyncHandler(async (req: any, res) => {
  const eventId = req.params.id;
  const { name, order, time, fee, description, lat, lng, address } = req.body;
  if (!name || !order || !lat || !lng) throw new ApiError(StatusCodes.BAD_REQUEST, "Missing stop fields");

  const stop = await BarHopStop.create({
    eventId,
    order: Number(order),
    name,
    scheduledAt: time ? new Date(time) : undefined,
    fee: fee ? Number(fee) : undefined,
    description,
    location: { address, point: { type: "Point", coordinates: [Number(lng), Number(lat)] } }
  });
  res.status(StatusCodes.CREATED).json(created(stop));
});

export const listStops = asyncHandler(async (req, res) => {
  const stops = await BarHopStop.find({ eventId: req.params.id }).sort({ order: 1 });
  res.json(ok(stops));
});

export const quickRally = asyncHandler(async (req: any, res) => {
  const { locationName, lat, lng, address } = req.body;
  const event = await Event.create({
    title: "Quick Rally",
    description: "Auto-generated",
    dateTime: new Date(),
    createdBy: req.user.id,
    attendees: [{ userId: req.user.id, status: RSVPStatus.Yes }],
    inviteCode: nanoid(8),
    location: { name: locationName, address, point: lat && lng ? { type: "Point", coordinates: [Number(lng), Number(lat)] } : undefined }
  });
  const chat = await Chat.create({ eventId: event._id, members: [req.user.id] });
  event.chatId = chat._id;
  await event.save();

  const qr = await QuickRally.create({ eventId: event._id, hostId: req.user.id, location: event.location, invitedUsers: [] });
  res.status(StatusCodes.CREATED).json(created({ event, quickRally: qr }));
});

export const deleteEvent = asyncHandler(async (req: any, res) => {
  const event = await Event.findOne({ _id: req.params.id, createdBy: req.user.id });
  if (!event) throw new ApiError(StatusCodes.NOT_FOUND, "Event not found or not owner");

  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    const chat = await Chat.findOne({ eventId: event._id }).session(session);
    if (chat) {
      const msgs = await Message.find({ chatId: chat._id }).session(session);
      for (const m of msgs) {
        if (m.attachmentsPublicIds?.length) {
          for (const pid of m.attachmentsPublicIds) await deleteByPublicId(pid);
        }
      }
      await Message.deleteMany({ chatId: chat._id }).session(session);
      await Chat.deleteOne({ _id: chat._id }).session(session);
    }

    await Invitation.deleteMany({ eventId: event._id }).session(session);
    await BarHopStop.deleteMany({ eventId: event._id }).session(session);
    await QuickRally.deleteMany({ eventId: event._id }).session(session);
    await CheckIn.deleteMany({ eventId: event._id }).session(session);
    await Ride.deleteMany({ eventId: event._id }).session(session);
    await Payment.deleteMany({ eventId: event._id }).session(session);
    await Task.deleteMany({ eventId: event._id }).session(session).catch(() => {});

    if (event.imagePublicId) await deleteByPublicId(event.imagePublicId);

    await Event.deleteOne({ _id: event._id }).session(session);
  });

  await session.endSession();
  res.json(ok({ deleted: true }));
});
