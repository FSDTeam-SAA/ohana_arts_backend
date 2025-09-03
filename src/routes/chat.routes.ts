import { Router } from "express";
import { auth } from "../middleware/auth";
import { upload } from "../middleware/multipart";
import { ensureEventChat, listMessages, sendMessage } from "../controllers/chat.controller";
import type { SocketHelpers } from "../socket";

export default (ioHelpers: SocketHelpers) => {
  const router = Router();

  router.post("/events/:eventId/ensure", auth, ensureEventChat);
  router.get("/:chatId/messages", auth, listMessages);
  router.post("/:chatId/messages", auth, upload.array("attachments"), sendMessage(ioHelpers));

  return router;
};
