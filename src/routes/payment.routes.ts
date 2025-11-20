import { Router } from "express";
import { auth } from "../middleware/auth";
import { upload } from "../middleware/multipart";
import {
  eventPayments,
  uploadReceipt,
  createStripeCheckout,
  createPaypalOrder,
  capturePaypalOrder,
  getMyEarnings,
} from "../controllers/payment.controller";

const router = Router();

router.post("/receipt", auth, upload.single("receipt"), uploadReceipt);
router.post("/stripe/checkout", auth, createStripeCheckout);
router.post("/paypal/order", auth, createPaypalOrder);
router.post("/paypal/order/:orderId/capture", auth, capturePaypalOrder);
router.get("/event/:eventId", auth, eventPayments);
router.get("/my-earnings", auth, getMyEarnings);

export default router;