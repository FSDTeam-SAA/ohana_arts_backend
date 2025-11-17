import { asyncHandler } from "../utils/asyncHandler";
import { ok, created } from "../utils/ApiResponse";
import { Chat, Message, User, IUser } from "../models";
import type { SocketHelpers } from "../socket";
import { Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { StatusCodes } from "http-status-codes";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload";
import { Types } from "mongoose";

let socketHelpers: SocketHelpers;

export const setChatSocketHelpers = (helpers: SocketHelpers) => {
  socketHelpers = helpers;
};

/**
 * @route GET /api/chats/event/:eventId
 * @desc Gets the list of 1-on-1 chats for the current user within an event
 */
export const listMyEventChats = asyncHandler(
  async (req: any, res: Response) => {
    const { eventId } = req.params;
    const { id: currentUserId } = req.user;

    const chats = await Chat.find({
      eventId: eventId,
      members: currentUserId,
    })
      .populate({
        path: "members",
        select: "name profilePhoto",
      })
      .sort({ lastMessageAt: -1 })
      .lean();

    const chatList = chats.map((chat) => {
      // Find the *other* user in the 1-on-1 chat
      const otherUser = chat.members.find(
        (member: { _id: Types.ObjectId }) =>
          member._id.toString() !== currentUserId
      ) as IUser | undefined;

      return {
        _id: chat._id, // The chatId
        eventId: chat.eventId,
        lastMessageAt: chat.lastMessageAt,
        withUser: {
          _id: otherUser?._id,
          name: otherUser?.name || "Unknown User",
          profilePhoto: otherUser?.profilePhoto,
        },
      };
    });

    res.json(ok(chatList));
  }
);

/**
 * @route POST /api/chats/ensure/1-on-1
 * @desc Gets or creates a 1-on-1 chat room for an event.
 * @body { eventId: string, otherUserId: string }
 */
export const ensureOneOnOneChat = asyncHandler(
  async (req: any, res: Response) => {
    const { eventId, otherUserId } = req.body;
    const { id: currentUserId } = req.user;

    if (!eventId || !otherUserId) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "eventId and otherUserId are required"
      );
    }

    if (otherUserId === currentUserId) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Cannot create a chat with yourself"
      );
    }

    // --- 1. SORT THE MEMBERS ARRAY ---
    const members = [currentUserId, otherUserId].sort();

    const chat = await Chat.findOneAndUpdate(
      // --- 2. THE QUERY IS NOW SIMPLE ---
      {
        eventId: eventId,
        members: members,
      },
      // --- 3. $setOnInsert IS SIMPLIFIED ---
      {
        $setOnInsert: {
          lastMessageAt: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
        populate: { path: "members", select: "name profilePhoto" },
      }
    );

    res.json(ok(chat));
  }
);

/**
 * @route GET /api/chats/:chatId/messages
 * @desc Loads the history for a specific chat room
 */
// --- THIS FUNCTION IS UPDATED ---
export const listMessages = asyncHandler(
  async (req: Request, res: Response) => {
    const msgs = await Message.find({ chatId: req.params.chatId })
      .populate("senderId", "name profilePhoto") // <-- 1. ADD THIS POPULATE
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(ok(msgs.reverse()));
  }
);
// --- END OF UPDATE ---

/**
 * @route POST /api/chats/:chatId/messages
 * @desc Sends a message to a specific chat room
 */
// --- THIS FUNCTION IS UPDATED ---
export const sendMessage =
  (ioHelpers: SocketHelpers) => async (req: any, res: any) => {
    const { text } = req.body;
    const { chatId } = req.params;
    let attachments: string[] = [];
    let attachmentPids: string[] = [];

    if (Array.isArray(req.files) && req.files.length) {
      for (const f of req.files as Express.Multer.File[]) {
        const up = await uploadBufferToCloudinary(f.buffer, "rally/messages");
        attachments.push(up.url);
        attachmentPids.push(up.public_id);
      }
    }

    // 1. Create the message
    const msg = await Message.create({
      chatId: chatId,
      senderId: req.user.id,
      text,
      attachments,
      attachmentsPublicIds: attachmentPids,
    });

    // --- 2. THIS IS THE NEW STEP ---
    // Populate the sender's info (name and photo)
    const populatedMsg = await msg.populate("senderId", "name profilePhoto");
    // --- END OF NEW STEP ---

    const chat = await Chat.findByIdAndUpdate(chatId, {
      lastMessageAt: new Date(),
    });

    // 3. Broadcast the POPULATED message
    ioHelpers.broadcastMessage(chatId, populatedMsg.toJSON()); // <-- Use populatedMsg

    if (chat && socketHelpers) {
      const otherUser = chat.members.find(
        (member: Types.ObjectId) => member.toString() !== req.user.id
      );
      if (otherUser) {
        socketHelpers.notifyUser(otherUser.toString(), {
          type: "NEW_MESSAGE",
          message: `You have a new message`,
          chatId: chatId,
          senderId: req.user.id,
        });
      }
    }

    // 4. Respond with the POPULATED message
    res.status(StatusCodes.CREATED).json(created(populatedMsg.toJSON())); // <-- Use populatedMsg and send 201
  };
// --- END OF UPDATE ---
