import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { Message, Notification } from "../models";

type SocketWithUser = { userId: string };

export function initSocket(httpServer: any) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN || "*", credentials: true }
  });

  io.use((socket, next) => {
    try {
      const token = (socket.handshake.auth as any)?.token;
      if (!token) return next(new Error("No token"));
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
      (socket.data as SocketWithUser).userId = payload.id;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const { userId } = socket.data as SocketWithUser;
    socket.join(`user:${userId}`);

    socket.on("chat:join", (chatId: string) => socket.join(`chat:${chatId}`));
    socket.on("chat:leave", (chatId: string) => socket.leave(`chat:${chatId}`));

    socket.on("message:send", async (payload: { chatId: string; text?: string; attachments?: string[] }) => {
      const msg = await Message.create({
        chatId: payload.chatId,
        senderId: userId,
        text: payload.text,
        attachments: payload.attachments || [],
      });
      io.to(`chat:${payload.chatId}`).emit("message:new", msg.toJSON());
    });

    socket.on("disconnect", () => {});
  });

  const broadcastMessage = (chatId: string, message: any) =>
    io.to(`chat:${chatId}`).emit("message:new", message);
  const notifyUser = (userId: string, notif: any) =>
    io.to(`user:${userId}`).emit("notification:new", notif);

  return { io, broadcastMessage, notifyUser };
}

export type SocketHelpers = ReturnType<typeof initSocket>;
