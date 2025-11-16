import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { Message, Notification } from "../models";

type SocketWithUser = { userId: string };

export function initSocket(httpServer: any) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN || "*", credentials: true },
  });

  // --- THIS MIDDLEWARE IS NOW UPDATED ---
  io.use((socket, next) => {
    try {
      // 1. Try to get token from 'auth' (for modern clients)
      let token = (socket.handshake.auth as any)?.token;

      // 2. If not found, get it from 'query' (for Postman)
      if (!token && socket.handshake.query.token) {
        token = socket.handshake.query.token as string;
      }

      if (!token) {
        return next(new Error("No token"));
      }

      const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
        id: string;
      };
      (socket.data as SocketWithUser).userId = payload.id;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });
  // --- END OF UPDATE ---

  io.on("connection", (socket) => {
    const { userId } = socket.data as SocketWithUser;
    socket.join(`user:${userId}`);

    // This is the "keyword" to join a room
    socket.on("chat:join", (chatId: string) => socket.join(`chat:${chatId}`));
    socket.on("chat:leave", (chatId: string) => socket.leave(`chat:${chatId}`));

    // This is the "keyword" to send a message
    socket.on(
      "message:send",
      async (payload: {
        chatId: string;
        text?: string;
        attachments?: string[];
      }) => {
        const msg = await Message.create({
          chatId: payload.chatId,
          senderId: userId,
          text: payload.text,
          attachments: payload.attachments || [],
        });
        // This emits the "keyword" to receive
        io.to(`chat:${payload.chatId}`).emit("message:new", msg.toJSON());
      }
    );

    socket.on("disconnect", () => {});
  });

  const broadcastMessage = (chatId: string, message: any) =>
    io.to(`chat:${chatId}`).emit("message:new", message);
  const notifyUser = (userId: string, notif: any) =>
    io.to(`user:${userId}`).emit("notification:new", notif);

  return { io, broadcastMessage, notifyUser };
}

export type SocketHelpers = ReturnType<typeof initSocket>;
