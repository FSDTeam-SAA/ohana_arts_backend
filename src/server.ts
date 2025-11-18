import "dotenv/config";
import http from "http";
import buildApp from "./app";
import { connectDB } from "./config/db";
import { initSocket, SocketHelpers } from "./socket"; // <-- 1. IMPORT SocketHelpers TYPE
import { setSocketHelpers } from "./controllers/reward.controller";
import { setRideSocketHelpers } from "./controllers/ride.controller";
import { setChatSocketHelpers } from "./controllers/chat.controller";
import { startEventNotificationScheduler } from "./services/notification.scheduler"; // <-- 2. IMPORT THE SCHEDULER

const PORT = Number(process.env.PORT || 3000);

async function main() {
  await connectDB(process.env.MONGO_URI!);

  const server = http.createServer();
  const ioHelpers: SocketHelpers = initSocket(server); // <-- 3. ENSURE TYPE IS APPLIED

  // Pass helpers to the controllers that need them
  setSocketHelpers(ioHelpers);
  setRideSocketHelpers(ioHelpers);
  setChatSocketHelpers(ioHelpers);

  // --- 4. START THE SCHEDULER ---
  // Pass it the socket helpers so it can send real-time alerts
  startEventNotificationScheduler(ioHelpers);
  // --- END OF NEW CODE ---

  const app = buildApp(ioHelpers);
  server.on("request", app);

  server.listen(PORT, () =>
  	console.log(`🚀 API + WS on http://localhost:${PORT}`)
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});