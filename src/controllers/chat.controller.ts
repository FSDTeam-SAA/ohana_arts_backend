import { asyncHandler } from "../utils/asyncHandler";
import { ok, created } from "../utils/ApiResponse";
import { Chat, Message, User, IUser } from "../models";
import type { SocketHelpers } from "../socket";
import { Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { StatusCodes } from "http-status-codes";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload";
import { Types } from "mongoose"; // <-- This is needed

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

    const members = [currentUserId, otherUserId];

    const chat = await Chat.findOneAndUpdate(
      {
        eventId: eventId,
        members: { $all: members },
      },
      {
        $setOnInsert: {
          eventId: eventId,
          members: members,
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
export const listMessages = asyncHandler(
  async (req: Request, res: Response) => {
    const msgs = await Message.find({ chatId: req.params.chatId })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(ok(msgs.reverse()));
  }
);

/**
 * @route POST /api/chats/:chatId/messages
 * @desc Sends a message to a specific chat room
 */
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

    const msg = await Message.create({
      chatId: chatId,
      senderId: req.user.id,
      text,
      attachments,
      attachmentsPublicIds: attachmentPids,
    });

    const chat = await Chat.findByIdAndUpdate(chatId, {
      lastMessageAt: new Date(),
    });

    // Broadcast the message to the (private 1-on-1) room
    ioHelpers.broadcastMessage(chatId, msg.toJSON());

    if (chat && socketHelpers) {
      // --- THIS IS THE FIX ---
      const otherUser = chat.members.find(
        (member: Types.ObjectId) => member.toString() !== req.user.id
      );
      // --- END OF FIX ---
      if (otherUser) {
        socketHelpers.notifyUser(otherUser.toString(), {
          type: "NEW_MESSAGE",
          message: `You have a new message`,
          chatId: chatId,
          senderId: req.user.id,
        });
      }
    }

    res.json(created(msg));
  };
