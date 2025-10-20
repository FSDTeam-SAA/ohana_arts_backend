import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { created, ok } from "../utils/ApiResponse";
import { Payment } from "../models";
import { PaymentMethod, PaymentStatus } from "../types/enums";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload";
import { stripe } from "../config/stripe";
import { getPayPalClient } from "../config/paypal";
import paypal from "@paypal/checkout-server-sdk";
import { StatusCodes } from "http-status-codes";

export const uploadReceipt = asyncHandler(async (req: any, res: Response) => {
  const { eventId, amount, method } = req.body as { eventId: string; amount: string; method: PaymentMethod };
  let receiptUrl: string | undefined;
  if (req.file) {
    const up = await uploadBufferToCloudinary(req.file.buffer, "rally/receipts");
    receiptUrl = up.url;
  }
  const payment = await Payment.create({
    eventId,
    userId: req.user.id,
    amount: Number(amount),
    method,
    status: PaymentStatus.Paid,
    receiptUrl,
    paidAt: new Date()
  });
  res.status(201).json(created(payment));
});

export const createStripeCheckout = asyncHandler(async (req: any, res: Response) => {
  const { eventId, amount, successUrl, cancelUrl } = req.body as {
    eventId: string;
    amount: number;
    successUrl: string;
    cancelUrl: string;
  };

  const currency = (process.env.STRIPE_CURRENCY || "usd").toLowerCase();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency,
          product_data: { name: "Event Payment" },
          unit_amount: Math.round(amount * 100)
        },
        quantity: 1
      }
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { eventId, userId: req.user.id }
  });

  await Payment.create({
    eventId,
    userId: req.user.id,
    amount,
    method: PaymentMethod.Stripe,
    status: PaymentStatus.Pending,
    stripeSessionId: session.id
  });

  res.status(StatusCodes.CREATED).json(created({ id: session.id, url: session.url }));
});

export const stripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      (req as any).body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const sessionId = session.id as string;
    const amountTotal = (session.amount_total ?? 0) / 100;

    await Payment.findOneAndUpdate(
      { stripeSessionId: sessionId },
      {
        status: PaymentStatus.Paid,
        amount: amountTotal || undefined,
        stripePaymentIntentId: session.payment_intent,
        paidAt: new Date()
      },
      { new: true }
    );
  }

  res.json({ received: true });
};

export const createPaypalOrder = asyncHandler(async (req: any, res: Response) => {
  const { eventId, amount, currency = "USD" } = req.body as { eventId: string; amount: number; currency?: string };

  const client = getPayPalClient();
  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [{ amount: { currency_code: currency, value: amount.toFixed(2) } }]
  });

  const order = await client.execute(request);

  await Payment.create({
    eventId,
    userId: req.user.id,
    amount,
    method: PaymentMethod.PayPal,
    status: PaymentStatus.Pending,
    paypalOrderId: order.result.id
  });

  res.status(StatusCodes.CREATED).json(created({ id: order.result.id, links: order.result.links }));
});

export const capturePaypalOrder = asyncHandler(async (req: any, res: Response) => {
  const orderId = req.params.orderId;
  const client = getPayPalClient();

  const request = new paypal.orders.OrdersCaptureRequest(orderId);
  request.requestBody({});
  const capture = await client.execute(request);

  const amount = Number(capture.result?.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || 0);

  await Payment.findOneAndUpdate(
    { paypalOrderId: orderId },
    {
      status: PaymentStatus.Paid,
      paidAt: new Date(),
      amount: isNaN(amount) ? undefined : amount,
      paypalCaptureId: capture.result?.purchase_units?.[0]?.payments?.captures?.[0]?.id
    },
    { new: true }
  );

  res.json(ok({ id: orderId, capture: capture.result }));
});

export const eventPayments = asyncHandler(async (req: Request, res: Response) => {
  const list = await Payment.find({ eventId: req.params.eventId }).sort({ createdAt: -1 });
  const collected = list.reduce((s, p) => s + (p.status === "Paid" ? p.amount : 0), 0);
  res.json(ok({ list, collected }));
});
