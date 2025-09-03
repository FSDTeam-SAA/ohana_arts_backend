import { asyncHandler } from "../utils/asyncHandler";
import { ok, created } from "../utils/ApiResponse";
import { Chat, Message } from "../models";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload";
import type { SocketHelpers } from "../socket";

export const ensureEventChat = asyncHandler(async (req: any, res) => {
  const chat = await Chat.findOneAndUpdate(
    { eventId: req.params.eventId },
    { $setOnInsert: { members: [req.user.id], lastMessageAt: new Date() } },
    { new: true, upsert: true }
  );
  res.json(ok(chat));
});

export const listMessages = asyncHandler(async (req, res) => {
  const msgs = await Message.find({ chatId: req.params.chatId }).sort({ createdAt: -1 }).limit(100);
  res.json(ok(msgs.reverse()));
});

export const sendMessage =
  (ioHelpers: SocketHelpers) =>
  async (req: any, res: any) => {
    const { text } = req.body;
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
      chatId: req.params.chatId,
      senderId: req.user.id,
      text,
      attachments,
      attachmentsPublicIds: attachmentPids
    });

    ioHelpers.broadcastMessage(req.params.chatId, msg.toJSON());
    res.json(created(msg));
  };
