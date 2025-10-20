import "dotenv/config";
import http from "http";
import buildApp from "./app";
import { connectDB } from "./config/db";
import { initSocket } from "./socket";
import { setSocketHelpers } from "./controllers/reward.controller";

const PORT = Number(process.env.PORT || 3000);

async function main() {
  await connectDB(process.env.MONGO_URI!);

  const server = http.createServer();
  const ioHelpers = initSocket(server);

  setSocketHelpers(ioHelpers);

  const app = buildApp(ioHelpers);
  server.on("request", app);

  server.listen(PORT, () => console.log(`🚀 API + WS on http://localhost:${PORT}`));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
