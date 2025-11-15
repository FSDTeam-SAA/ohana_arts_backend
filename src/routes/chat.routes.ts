import { Router } from "express";
import { auth } from "../middleware/auth";
import { upload } from "../middleware/multipart";
import {
  listMyEventChats, // <-- NEW
  ensureOneOnOneChat, // <-- NEW
  listMessages,
  sendMessage,
} from "../controllers/chat.controller";
import type { SocketHelpers } from "../socket";

export default (ioHelpers: SocketHelpers) => {
  const router = Router();

  // --- REMOVED OLD ROUTE ---
  // router.post("/events/:eventId/ensure", auth, ensureEventChat);

  // --- NEW ROUTES ---

  // GET /api/chats/event/:eventId
  // Gets the list of 1-on-1 chats for the current user within an event
  router.get("/event/:eventId", auth, listMyEventChats);

  // POST /api/chats/ensure/1-on-1
  // Gets or creates the 1-on-1 chat room
  router.post("/ensure/1-on-1", auth, ensureOneOnOneChat);

  // --- KEPT EXISTING ROUTES ---

  // GET /api/chats/:chatId/messages
  // Loads the history for a specific chat room
  router.get("/:chatId/messages", auth, listMessages);

  // POST /api/chats/:chatId/messages
  // Sends a message to a specific chat room
  router.post(
    "/:chatId/messages",
    auth,
    upload.array("attachments"),
    sendMessage(ioHelpers)
  );

  return router;
};
