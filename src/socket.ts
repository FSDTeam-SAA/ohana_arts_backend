import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
// --- 1. IMPORT MODELS NEEDED FOR CHAT ---
import { Message, Chat } from "./models";

// ---
// These maps help us track who is who and where they are
// <userId, socket.id>
const userSockets = new Map<string, string>();
// <socket.id, rideId> - Tracks which room a socket is in
const socketRideRooms = new Map<string, string>();
// <socket.id, chatId> - Tracks which chat room a socket is in
const socketChatRooms = new Map<string, string>();

// --- NEW: EVENT ROOM TRACKING ---
// <socket.id, eventId> - Tracks which event a user is currently viewing/live in
const socketEventRooms = new Map<string, string>();
// ---

export const initSocket = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "*", // TODO: Change to your frontend URL in production
      methods: ["GET", "POST"],
    },
  });

  // --- Socket.io Authentication Middleware (UPDATED) ---
  io.use((socket, next) => {
    let token = socket.handshake.auth.token;

    if (!token && socket.handshake.query.token) {
      token = socket.handshake.query.token as string;
    }

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    try {
      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
        id: string;
      };
      // Attach the user's ID to the socket object for this session
      (socket as any).userId = decoded.id;
      next(); // Allow connection
    } catch (err) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  // --- Main Connection Handler ---
  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).userId as string;
    console.log(`Socket connected: ${socket.id} for user: ${userId}`);

    // Track this user's socket
    userSockets.set(userId, socket.id);

    // --- CHAT LOGIC ---
    socket.on("chat:join", (chatId: string) => {
      const oldRoom = socketChatRooms.get(socket.id);
      if (oldRoom) {
        socket.leave(oldRoom);
      }
      socket.join(chatId);
      socketChatRooms.set(socket.id, chatId);
      console.log(`User ${userId} joined chat room: ${chatId}`);
    });

    socket.on("chat:leave", (chatId: string) => {
      socket.leave(chatId);
      socketChatRooms.delete(socket.id);
      console.log(`User ${userId} left chat room: ${chatId}`);
    });

    socket.on(
      "message:send",
      async (payload: {
        chatId: string;
        text?: string;
        attachments?: string[];
      }) => {
        if (!payload.chatId) return;

        const msg = await Message.create({
          chatId: payload.chatId,
          senderId: userId,
          text: payload.text,
          attachments: payload.attachments || [],
        });

        const populatedMsg = await msg.populate(
          "senderId",
          "name profilePhoto"
        );

        await Chat.findByIdAndUpdate(payload.chatId, {
          lastMessageAt: new Date(),
        });

        io.to(payload.chatId).emit("chat:message:new", populatedMsg.toJSON());
      }
    );
    // --- END OF CHAT LOGIC ---

    // --- NEW: EVENT TRACKING LOGIC ---
    // 1. Join Event Room
    socket.on("event:join", (eventId: string) => {
      const oldEvent = socketEventRooms.get(socket.id);
      if (oldEvent) {
        socket.leave(oldEvent);
      }
      socket.join(eventId);
      socketEventRooms.set(socket.id, eventId);
      console.log(`User ${userId} joined event room: ${eventId}`);
    });

    // 2. Leave Event Room
    socket.on("event:leave", (eventId: string) => {
      socket.leave(eventId);
      socketEventRooms.delete(socket.id);
      console.log(`User ${userId} left event room: ${eventId}`);
    });
    // --- END EVENT TRACKING ---

    // --- RIDE & LOCATION LOGIC ---
    socket.on("location:update", (data: { lat: number; lng: number }) => {
      // A. Handle Ride Updates (Existing)
      const rideId = socketRideRooms.get(socket.id);
      if (rideId) {
        socket.to(rideId).emit("user:location:updated", {
          userId,
          lat: data.lat,
          lng: data.lng,
        });
      }

      // B. Handle Event Updates (New)
      // If user is inside an Event Room (meaning they are viewing a live event map)
      const eventId = socketEventRooms.get(socket.id);
      if (eventId) {
        socket.to(eventId).emit("event:user:moved", {
          userId,
          lat: data.lat,
          lng: data.lng,
        });
      }
    });

    // --- Cleanup on Disconnect ---
    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id} for user: ${userId}`);
      userSockets.delete(userId);
      socketRideRooms.delete(socket.id);
      socketChatRooms.delete(socket.id);
      socketEventRooms.delete(socket.id); // Cleanup new map
    });
  });

  // --- Helper Functions ---
  const notifyUser = (userId: string, data: any) => {
    const socketIdToNotify = userSockets.get(userId);
    if (!socketIdToNotify) {
      return;
    }
    io.to(socketIdToNotify).emit("notification", data);
  };

  const broadcastMessage = (chatId: string, message: any) => {
    io.to(chatId).emit("chat:message:new", message);
  };

  const joinRideRoom = (userId: string, rideId: string) => {
    const socketIdToJoin = userSockets.get(userId);
    if (!socketIdToJoin) {
      return;
    }
    const socket = io.sockets.sockets.get(socketIdToJoin);
    if (socket) {
      socket.join(rideId);
      socketRideRooms.set(socketIdToJoin, rideId);
      console.log(`User ${userId} joined ride room: ${rideId}`);
    }
  };

  const leaveRideRoom = (userId: string) => {
    const socketIdToLeave = userSockets.get(userId);
    if (!socketIdToLeave) {
      return;
    }
    const rideId = socketRideRooms.get(socketIdToLeave);
    if (rideId) {
      const socket = io.sockets.sockets.get(socketIdToLeave);
      if (socket) {
        socket.leave(rideId);
        socketRideRooms.delete(socketIdToLeave);
        console.log(`User ${userId} left ride room: ${rideId}`);
      }
    }
  };

  return {
    io,
    notifyUser,
    broadcastMessage,
    joinRideRoom,
    leaveRideRoom,
  };
};

export type SocketHelpers = ReturnType<typeof initSocket>;
