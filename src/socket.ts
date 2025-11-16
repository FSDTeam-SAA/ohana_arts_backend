import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";

// ---
// These maps help us track who is who and where they are
// <userId, socket.id>
const userSockets = new Map<string, string>();
// <socket.id, rideId> - Tracks which room a socket is in
const socketRideRooms = new Map<string, string>();
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
    // --- NEW: FLEXIBLE TOKEN CHECK ---
    // Try to get token from the 'auth' object (for modern clients)
    let token = socket.handshake.auth.token;

    // If not found, try to get it from the query parameters (for Postman)
    if (!token && socket.handshake.query.token) {
      token = socket.handshake.query.token as string;
    }
    // --- END OF NEW LOGIC ---

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

    // --- Real-time Location Listener ---
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
    });
  });

  // --- Helper Functions ---
  const notifyUser = (userId: string, data: any) => {
    const socketId = userSockets.get(userId);
    if (socketId) {
      io.to(socketId).emit("notification", data);
    }
  };

  const broadcastMessage = (chatId: string, message: any) => {
    io.to(chatId).emit("chat:message:new", message);
  };

  const joinRideRoom = (userId: string, rideId: string) => {
    const socketId = userSockets.get(userId);
    if (socketId) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.join(rideId);
        socketRideRooms.set(socketId, rideId);
        console.log(`User ${userId} joined ride room: ${rideId}`);
      }
    }
  };

  const leaveRideRoom = (userId: string) => {
    const socketId = userSockets.get(userId);
    if (socketId) {
      const rideId = socketRideRooms.get(socketId);
      if (rideId) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.leave(rideId);
          socketRideRooms.delete(socketId);
          console.log(`User ${userId} left ride room: ${rideId}`);
        }
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
