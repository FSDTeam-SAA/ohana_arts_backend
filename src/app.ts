import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { notFound, errorHandler } from "./middleware/error";
import createRoutes from "./routes";
import type { SocketHelpers } from "./socket";
import { stripeWebhook } from "./controllers/payment.controller";

export default function buildApp(ioHelpers: SocketHelpers) {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || "*", credentials: true }));
  app.use(morgan("dev"));

  app.post("/api/payments/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhook);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", createRoutes(ioHelpers));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
