import "dotenv/config";
import http from "http";
import buildApp from "./app";
import { connectDB } from "./config/db";
import { initSocket } from "./socket"; // Assuming socket.ts is in src/
import { setSocketHelpers } from "./controllers/reward.controller";
import { setRideSocketHelpers } from "./controllers/ride.controller";
import { setChatSocketHelpers } from "./controllers/chat.controller"; // <-- 1. IMPORT NEW FUNCTION

const PORT = Number(process.env.PORT || 3000);

async function main() {
  await connectDB(process.env.MONGO_URI!);

  const server = http.createServer();
  const ioHelpers = initSocket(server);

  // Pass helpers to the controllers that need them
  setSocketHelpers(ioHelpers);
  setRideSocketHelpers(ioHelpers);
  setChatSocketHelpers(ioHelpers); // <-- 2. CALL NEW FUNCTION

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
