import { Router } from "express";
import { auth } from "../middleware/auth";
import { upload } from "../middleware/upload";
import {
  eventPayments,
  uploadReceipt,
  createStripeCheckout,
  createPaypalOrder,
  capturePaypalOrder,
} from "../controllers/payment.controller";

const router = Router();

router.post("/receipt", auth, upload.single("receipt"), uploadReceipt);

router.post("/stripe/checkout", auth, createStripeCheckout);
// Stripe webhook is set in app.ts with express.raw()

router.post("/paypal/order", auth, createPaypalOrder);
router.post("/paypal/order/:orderId/capture", auth, capturePaypalOrder);

router.get("/event/:eventId", auth, eventPayments);

export default router;
