import { StatusCodes } from "http-status-codes";
import dayjs from "dayjs";
import { asyncHandler } from "../utils/asyncHandler";
import { created, ok } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import {
  Event,
  Chat,
  BarHopStop,
  QuickRally,
  CheckIn,
  Message,
  Payment,
  Ride,
  Task,
} from "../models";
import { RSVPStatus } from "../types/enums"; // <-- RSVPStatus is needed
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload";
import { nanoid } from "nanoid";
import mongoose from "mongoose";
import { deleteByPublicId } from "../utils/cloudinaryDelete";
import { Request, Response } from "express";
import { awardPoints } from "./reward.controller";

const parseNumber = (x?: string) => (x === undefined ? undefined : Number(x));

export const createEvent = asyncHandler(async (req: any, res: Response) => {
  const {
    title,
    description,
    locationName,
    address,
    lat,
    lng,
    dateTime,
    capacity,
    fee,
  } = req.body;
  if (!title || !dateTime)
    throw new ApiError(StatusCodes.BAD_REQUEST, "title & dateTime required");

  // --- NEW VALIDATION ---
  // Check if the event date is in the past
  const eventDate = dayjs(dateTime);
  const today = dayjs().startOf("day");

  if (eventDate.isBefore(today)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Event date cannot be in the past"
    );
  }
  // --- END NEW VALIDATION ---

  const event: any = {
    title,
    description,
    location: { name: locationName, address },
    dateTime: eventDate.toDate(), // Use the validated dayjs object
    capacity: parseNumber(capacity),
    fee: parseNumber(fee),
    createdBy: req.user.id,
    inviteCode: nanoid(8),
    attendees: [{ userId: req.user.id, status: RSVPStatus.Yes }],
  };

  if (lat && lng)
    event.location.point = {
      type: "Point",
      coordinates: [Number(lng), Number(lat)],
    };

  if (req.file) {
    const img = await uploadBufferToCloudinary(req.file.buffer, "rally/events");
    event.image = img.url;
    event.imagePublicId = img.public_id;
  }

  const saved = await Event.create(event);
  const chat = await Chat.create({
    eventId: saved._id,
    members: [req.user.id],
    lastMessageAt: new Date(),
  });
  saved.chatId = chat._id;
  await saved.save();
  await CheckIn.create({
    eventId: saved._id,
    userId: req.user.id,
    status: "StillOut",
  });

  await awardPoints(saved.createdBy, "CREATE_RALLY", saved._id);

  res.status(StatusCodes.CREATED).json(created(saved));
});

export const listEvents = asyncHandler(async (req: any, res: Response) => {
  const scope = (req.query.scope as string) || "upcoming";
  const now = dayjs();

  let filter: any = {};
  if (scope === "upcoming") {
    filter = {
      $and: [
        { dateTime: { $gte: now.toDate() } },
        {
          $or: [
            { createdBy: req.user.id },
            {
              attendees: {
                // --- MODIFIED LOGIC ---
                // Only show if user RSVP'd Yes or Maybe, not Pending
                $elemMatch: {
                  userId: req.user.id,
                  status: { $in: [RSVPStatus.Yes, RSVPStatus.Maybe] },
                },
                // --- END MODIFIED LOGIC ---
              },
            },
          ],
        },
      ],
    };
  } else if (scope === "past") {
    // Existing logic:
    filter = { dateTime: { $lt: now.toDate() } };
    filter = {
      $and: [
        { dateTime: { $lt: now.toDate() } },
        {
          $or: [
            { createdBy: req.user.id },
            {
              attendees: {
                // --- MODIFIED LOGIC ---
                // Only show if user RSVP'd Yes or Maybe, not Pending
                $elemMatch: {
                  userId: req.user.id,
                  status: { $in: [RSVPStatus.Yes, RSVPStatus.Maybe] },
                },
                // --- END MODIFIED LOGIC ---
              },
            },
          ],
        },
      ],
    };
  } else if (scope === "live") {
    // Existing logic:
    filter = {
      dateTime: {
        $gte: now.startOf("day").toDate(),
        $lte: now.endOf("day").toDate(),
      },
    };
    filter = {
      $and: [
        {
          dateTime: {
            $gte: now.startOf("day").toDate(),
            $lte: now.endOf("day").toDate(),
          },
        },
        {
          $or: [
            { createdBy: req.user.id },
            {
              attendees: {
                // --- MODIFIED LOGIC ---
                // Only show if user RSVP'd Yes or Maybe, not Pending
                $elemMatch: {
                  userId: req.user.id,
                  status: { $in: [RSVPStatus.Yes, RSVPStatus.Maybe] },
                },
                // --- END MODIFIED LOGIC ---
              },
            },
          ],
        },
      ],
    };
  } else if (scope === "invitations") {
    filter = {
      attendees: {
        // This logic remains correct, only showing 'Pending'
        $elemMatch: { userId: req.user.id, status: RSVPStatus.Pending },
      },
    };
  }

  const events = await Event.find(filter)
    .sort({ dateTime: 1 })
    .limit(100)
    .populate("attendees.userId", "name profilePhoto");

  res.json(ok(events));
});

export const getEvent = asyncHandler(async (req: Request, res: Response) => {
  const event = await Event.findById(req.params.id);
  if (!event) throw new ApiError(StatusCodes.NOT_FOUND, "Event not found");
  res.json(ok(event));
});

export const updateEvent = asyncHandler(async (req: any, res: Response) => {
  const patch: any = { ...req.body };
  if (patch.capacity) patch.capacity = Number(patch.capacity);
  if (patch.fee) patch.fee = Number(patch.fee);

  // --- NEW VALIDATION ---
  if (patch.dateTime) {
    const eventDate = dayjs(patch.dateTime);
    const today = dayjs().startOf("day");
    if (eventDate.isBefore(today)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Event date cannot be in the past"
      );
    }
    patch.dateTime = eventDate.toDate(); // Use the validated dayjs object
  }
  // --- END NEW VALIDATION ---

  const existing = await Event.findOne({
    _id: req.params.id,
    createdBy: req.user.id,
  });
  if (!existing)
    throw new ApiError(StatusCodes.NOT_FOUND, "Event not found or not owner");

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

export const rsvp = asyncHandler(async (req: any, res: Response) => {
  const { status } = req.body as { status: RSVPStatus };
  if (!Object.values(RSVPStatus).includes(status)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid RSVP status");
  }

  const event = await Event.findById(req.params.id);
  if (!event) throw new ApiError(StatusCodes.NOT_FOUND, "Event not found");

  const idx = event.attendees.findIndex(
    (a: { userId: { toString: () => any } }) =>
      a.userId.toString() === req.user.id
  );
  if (idx >= 0) {
    event.attendees[idx].status = status;
    event.attendees[idx].updatedAt = new Date();
  } else {
    event.attendees.push({
      userId: req.user.id,
      status,
      updatedAt: new Date(),
    } as any);
  }
  await event.save();

  // --- LOGIC CHANGE ---
  // Award points for *joining* (RSVP 'Yes'), not just any RSVP
  if (status === RSVPStatus.Yes) {
    await awardPoints(req.user.id, "JOIN_RALLY", event._id);
  }
  // --- END LOGIC CHANGE ---

  res.json(ok(event.attendees));
});

export const inviteUser = asyncHandler(async (req: any, res: Response) => {
  const { userId } = req.body;
  const eventId = req.params.id;

  const event = await Event.findById(eventId);
  if (!event) throw new ApiError(StatusCodes.NOT_FOUND, "Event not found");

  if (event.createdBy.toString() !== req.user.id) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Only the host can invite");
  }

  const existing = event.attendees.find(
    (a: any) => a.userId.toString() === String(userId)
  );

  if (existing) {
    // If already invited and still pending, be idempotent
    if (existing.status === RSVPStatus.Pending) {
      return res.status(StatusCodes.OK).json(
        ok({
          message: "Already invited",
          attendee: existing,
        })
      );
    }
    // Otherwise keep their current RSVP (Yes/Maybe/No)
  } else {
    event.attendees.push({
      userId,
      status: RSVPStatus.Pending,
      invitedBy: req.user.id,
      invitedAt: new Date(),
      updatedAt: new Date(),
    } as any);
    await event.save();
  }

  // optional: socket notification here
  // req.io?.toUser(String(userId)).emit("notification:new", { type: "INVITE", eventId });

  res.status(StatusCodes.CREATED).json(
    created({
      eventId,
      userId,
      status: RSVPStatus.Pending,
    })
  );
});

// POST /api/events/:id/invite/respond  { action: "Accept" | "Decline" }
export const respondInvite = asyncHandler(async (req: any, res: Response) => {
  const { id: eventId } = req.params;
  const { action } = req.body as { action: "Accept" | "Decline" };

  const event = await Event.findById(eventId);
  if (!event) throw new ApiError(StatusCodes.NOT_FOUND, "Event not found");

  const me = event.attendees.find(
    (a: any) => a.userId.toString() === req.user.id
  );
  if (!me) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "No pending invite for this event"
    );
  }

  if (me.status !== RSVPStatus.Pending) {
    return res.json(ok({ message: "Already responded", status: me.status }));
  }

  me.status = action === "Accept" ? RSVPStatus.Yes : RSVPStatus.No;
  me.updatedAt = new Date();
  await event.save();

  // --- LOGIC CHANGE ---
  // Award points for accepting an invite
  if (me.status === RSVPStatus.Yes) {
    await awardPoints(req.user.id, "JOIN_RALLY", event._id);
  }
  // --- END LOGIC CHANGE ---

  // optional: notify host
  // req.io?.toUser(String(event.createdBy)).emit("notification:new", { type: "INVITE_RESPONSE", eventId, status: me.status });

  res.json(ok({ eventId, status: me.status }));
});

export const createStop = asyncHandler(async (req: any, res: Response) => {
  const eventId = req.params.id;
  const { name, order, time, fee, description, lat, lng, address } = req.body;
  if (!name || !order || !lat || !lng)
    throw new ApiError(StatusCodes.BAD_REQUEST, "Missing stop fields");

  const stop = await BarHopStop.create({
    eventId,
    order: Number(order),
    name,
    scheduledAt: time ? new Date(time) : undefined,
    fee: fee ? Number(fee) : undefined,
    description,
    location: {
      address,
      point: { type: "Point", coordinates: [Number(lng), Number(lat)] },
    },
  });
  res.status(StatusCodes.CREATED).json(created(stop));
});

export const listStops = asyncHandler(async (req: Request, res: Response) => {
  const stops = await BarHopStop.find({ eventId: req.params.id }).sort({
    order: 1,
  });
  res.json(ok(stops));
});

export const quickRally = asyncHandler(async (req: any, res: Response) => {
  const { locationName, lat, lng, address } = req.body;
  const event = await Event.create({
    title: "Quick Rally",
    description: "Auto-generated",
    dateTime: new Date(), // Quick Rallies are always 'now'
    createdBy: req.user.id,
    attendees: [{ userId: req.user.id, status: RSVPStatus.Yes }],
    inviteCode: nanoid(8),
    location: {
      name: locationName,
      address,
      point:
        lat && lng
          ? { type: "Point", coordinates: [Number(lng), Number(lat)] }
          : undefined,
    },
  });
  const chat = await Chat.create({
    eventId: event._id,
    members: [req.user.id],
  });
  event.chatId = chat._id;
  await event.save();

  const qr = await QuickRally.create({
    eventId: event._id,
    hostId: req.user.id,
    location: event.location,
    invitedUsers: [],
  });
  res.status(StatusCodes.CREATED).json(created({ event, quickRally: qr }));
});

export const deleteEvent = asyncHandler(async (req: any, res: Response) => {
  const event = await Event.findOne({
    _id: req.params.id,
    createdBy: req.user.id,
  });
  if (!event)
    throw new ApiError(StatusCodes.NOT_FOUND, "Event not found or not owner");

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

    // await Invitation.deleteMany({ eventId: event._id }).session(session);
    await BarHopStop.deleteMany({ eventId: event._id }).session(session);
    await QuickRally.deleteMany({ eventId: event._id }).session(session);
    await CheckIn.deleteMany({ eventId: event._id }).session(session);
    await Ride.deleteMany({ eventId: event._id }).session(session);
    await Payment.deleteMany({ eventId: event._id }).session(session);
    await Task.deleteMany({ eventId: event._id })
      .session(session)
      .catch(() => {});

    if (event.imagePublicId) await deleteByPublicId(event.imagePublicId);

    await Event.deleteOne({ _id: event._id }).session(session);
  });

  await session.endSession();
  res.json(ok({ deleted: true }));
});

export const listMyInvitations = asyncHandler(
  async (req: any, res: Response) => {
    const events = await Event.find({
      attendees: {
        $elemMatch: { userId: req.user.id, status: RSVPStatus.Pending },
      },
    })
      .sort({ dateTime: 1 })
      .limit(100);
    res.json(ok(events));
  }
);

// GET /api/events/:id/attendees
export const listAttendees = asyncHandler(
  async (req: Request, res: Response) => {
    const event = await Event.findById(req.params.id)
      .populate("attendees.userId", "name profilePhoto") // Populate user details
      .select("attendees"); // Only select the attendees field

    if (!event) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Event not found");
    }

    // Filter for attendees who have RSVP'd 'Yes'
    const attending = event.attendees.filter(
      (a: any) => a.status === RSVPStatus.Yes
    );

    res.json(ok(attending));
  }
);
