import paypal from "@paypal/checkout-server-sdk";

export function getPayPalClient() {
  const mode = (process.env.PAYPAL_MODE || "sandbox").toLowerCase();
  const clientId = process.env.PAYPAL_CLIENT_ID!;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET!;
  const env =
    mode === "live"
      ? new paypal.core.LiveEnvironment(clientId, clientSecret)
      : new paypal.core.SandboxEnvironment(clientId, clientSecret);
  return new paypal.core.PayPalHttpClient(env);
}

export default paypal;
