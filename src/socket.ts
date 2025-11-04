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

  // --- Socket.io Authentication Middleware ---
  // This function runs *before* a user is allowed to connect
  io.use((socket, next) => {
    // The token is sent from the client's auth handshake
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    try {
      // Verify the token
      const decoded = jwt.verify(process.env.JWT_SECRET as string, token) as {
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
  // This runs *after* a user is authenticated and connected
  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).userId as string;
    console.log(`Socket connected: ${socket.id} for user: ${userId}`);

    // Track this user's socket
    userSockets.set(userId, socket.id);

    // --- Real-time Location Listener ---
    // Listen for location updates from this client
    socket.on("location:update", (data: { lat: number; lng: number }) => {
      // 1. Find which ride room this socket is in
      const rideId = socketRideRooms.get(socket.id);

      if (rideId) {
        // 2. Broadcast to everyone *else* in that ride room
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
      // Stop tracking this user
      userSockets.delete(userId);
      // Remove them from any ride room they were in
      socketRideRooms.delete(socket.id);
    });
  });

  // --- Helper Functions ---
  // These are the functions our controllers will call

  /**
   * Send a real-time notification to a specific user
   */
  const notifyUser = (userId: string, data: any) => {
    const socketId = userSockets.get(userId);
    if (socketId) {
      io.to(socketId).emit("notification", data);
    }
  };

  /**
   * Broadcast a chat message to everyone in a chat room
   */
  const broadcastMessage = (chatId: string, message: any) => {
    io.to(chatId).emit("chat:message:new", message);
  };

  /**
   * Joins a user's socket to a specific ride room
   * This is how we group a driver and passengers
   */
  const joinRideRoom = (userId: string, rideId: string) => {
    const socketId = userSockets.get(userId);
    if (socketId) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.join(rideId);
        // Track that this socket is in this room
        socketRideRooms.set(socketId, rideId);
        console.log(`User ${userId} joined ride room: ${rideId}`);
      }
    }
  };

  /**
   * Makes a user's socket leave a ride room
   * (e.g., when the ride is finished or canceled)
   */
  const leaveRideRoom = (userId: string) => {
    const socketId = userSockets.get(userId);
    if (socketId) {
      const rideId = socketRideRooms.get(socketId);
      if (rideId) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.leave(rideId);
          // Stop tracking
          socketRideRooms.delete(socketId);
          console.log(`User ${userId} left ride room: ${rideId}`);
        }
      }
    }
  };

  // Return the io instance and all our helper functions
  // This object shape MUST match what the controllers expect
  return {
    io,
    notifyUser,
    broadcastMessage,
    joinRideRoom,
    leaveRideRoom,
  };
};

// This exports the *type* of our helper object,
// which we will use in other files.
export type SocketHelpers = ReturnType<typeof initSocket>;
