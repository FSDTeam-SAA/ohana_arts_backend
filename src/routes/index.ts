import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import eventRoutes from "./event.routes";
import rideRoutes from "./ride.routes";
import paymentRoutes from "./payment.routes";
import notificationRoutes from "./notification.routes";
import rewardRoutes from "./reward.routes";
import taskRoutes from "./task.routes";
import chatRoutesFactory from "./chat.routes";
// --- THIS IS THE FIX ---
// We import the one, true SocketHelpers type from our socket.ts file
import type { SocketHelpers } from "../socket";

// This parameter 'ioHelpers: SocketHelpers' will now use the new, correct type
export default (ioHelpers: SocketHelpers) => {
  const router = Router();
  router.use("/auth", authRoutes);
  router.use("/users", userRoutes);
  router.use("/events", eventRoutes);
  router.use("/rides", rideRoutes);
  router.use("/payments", paymentRoutes);
  router.use("/notifications", notificationRoutes);
  router.use("/rewards", rewardRoutes);
  router.use("/tasks", taskRoutes);
  router.use("/chats", chatRoutesFactory(ioHelpers));
  return router;
};
