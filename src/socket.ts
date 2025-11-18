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
      // Leave any old chat room first
      const oldRoom = socketChatRooms.get(socket.id);
      if (oldRoom) {
        socket.leave(oldRoom);
      }
      // Join the new chat room
      socket.join(chatId);
      socketChatRooms.set(socket.id, chatId); // Track it
      console.log(`User ${userId} joined chat room: ${chatId}`);
    });

    socket.on("chat:leave", (chatId: string) => {
      socket.leave(chatId);
      socketChatRooms.delete(socket.id);
      console.log(`User ${userId} left chat room: ${chatId}`);
    });

    // --- THIS LISTENER IS NOW UPDATED ---
    socket.on(
      "message:send",
      async (payload: {
        chatId: string;
        text?: string;
        attachments?: string[];
      }) => {
        if (!payload.chatId) return; // Ignore if no chatId

        // 1. Create the message
        const msg = await Message.create({
          chatId: payload.chatId,
          senderId: userId,
          text: payload.text,
          attachments: payload.attachments || [],
        });

        // --- 2. ADD POPULATE STEP ---
        // We do this so the receiver gets the user's info
        const populatedMsg = await msg.populate(
          "senderId",
          "name profilePhoto"
        );
        // --- END OF UPDATE ---

        // 3. Update the chat's last message time
        await Chat.findByIdAndUpdate(payload.chatId, {
          lastMessageAt: new Date(),
        });

        // 4. This emits the "keyword" to receive with the POPULATED message
        io.to(payload.chatId).emit("chat:message:new", populatedMsg.toJSON());
      }
    );
    // --- END OF CHAT LOGIC ---

    // --- RIDE LOGIC ---
    socket.on("location:update", (data: { lat: number; lng: number }) => {
      const rideId = socketRideRooms.get(socket.id);

      if (rideId) {
        socket.to(rideId).emit("user:location:updated", {
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
      socketChatRooms.delete(socket.id); // Clean up chat
    });
  });

  // --- Helper Functions (All helpers in one place) ---
  const notifyUser = (userId: string, data: any) => {
    const socketIdToNotify = userSockets.get(userId);
    if (!socketIdToNotify) {
      return; // User is not connected
    }
    io.to(socketIdToNotify).emit("notification", data);
  };

  const broadcastMessage = (chatId: string, message: any) => {
    // This is called by your API controller
    io.to(chatId).emit("chat:message:new", message);
  };

  const joinRideRoom = (userId: string, rideId: string) => {
    const socketIdToJoin = userSockets.get(userId);
    if (!socketIdToJoin) {
      return; // User is not connected
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
      return; // User is not connected
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