import Stripe from "stripe";

/**
 * AED amounts are in fils (1 AED = 100 fils).
 * Pass amountMajor as human units (e.g. 50 for 50 AED).
 */
export function createStripePayments({
  secretKey,
  webhookSecret,
  publicBaseUrl,
  currency = "aed",
}) {
  if (!secretKey) return null;

  const stripe = new Stripe(secretKey);

  const base = String(publicBaseUrl || "").replace(/\/$/, "");

  async function createCheckoutSession({
    name = "codeX — خدمة",
    amountMajor,
    quantity = 1,
    discordId = "",
    customerEmail = "",
    successPath = "/pay/success",
    cancelPath = "/pay/cancel",
    metadata = {},
  }) {
    const amount = Number(amountMajor);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("amountMajor must be a positive number");
    }
    if (!base) {
      throw new Error("PUBLIC_BASE_URL is required for Stripe Checkout");
    }

    const unitAmount = Math.round(amount * 100);
    const qty = Math.max(1, Math.min(99, Number(quantity) || 1));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "auto",
      customer_email: customerEmail || undefined,
      line_items: [
        {
          quantity: qty,
          price_data: {
            currency: String(currency).toLowerCase(),
            unit_amount: unitAmount,
            product_data: {
              name: String(name).slice(0, 120),
              description: "دفع عبر codeX",
            },
          },
        },
      ],
      success_url: `${base}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}${cancelPath}`,
      metadata: {
        source: "codex-bot",
        discordId: String(discordId || ""),
        productName: String(name).slice(0, 120),
        ...Object.fromEntries(
          Object.entries(metadata).map(([k, v]) => [k, String(v ?? "")]),
        ),
      },
    });

    return session;
  }

  function constructEvent(rawBody, signature) {
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is missing");
    }
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }

  return {
    stripe,
    currency,
    createCheckoutSession,
    constructEvent,
    enabled: true,
  };
}
