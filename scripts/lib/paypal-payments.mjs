/**
 * PayPal Orders API v2 + webhook verification (no SDK).
 * Env: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID,
 *      PAYPAL_MODE=live|sandbox, PAYPAL_CURRENCY=USD, PUBLIC_BASE_URL
 */

export function createPayPalPayments({
  clientId,
  clientSecret,
  webhookId,
  publicBaseUrl,
  currency = "USD",
  mode = "live",
}) {
  if (!clientId || !clientSecret) return null;

  const apiBase =
    String(mode).toLowerCase() === "sandbox"
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com";
  const base = String(publicBaseUrl || "").replace(/\/$/, "");
  const currencyCode = String(currency || "USD").toUpperCase();

  let cachedToken = null;
  let tokenExpiresAt = 0;

  async function getAccessToken() {
    const now = Date.now();
    if (cachedToken && now < tokenExpiresAt - 30_000) return cachedToken;

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch(`${apiBase}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      throw new Error(
        data?.error_description || data?.error || `PayPal OAuth HTTP ${res.status}`,
      );
    }
    cachedToken = data.access_token;
    tokenExpiresAt = now + Number(data.expires_in || 300) * 1000;
    return cachedToken;
  }

  async function api(method, path, body) {
    const token = await getAccessToken();
    const res = await fetch(`${apiBase}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const msg =
        data?.message ||
        data?.details?.[0]?.description ||
        data?.error_description ||
        data?.name ||
        `PayPal HTTP ${res.status}`;
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    return data;
  }

  function encodeCustomId({ discordId = "", productName = "" } = {}) {
    // PayPal custom_id max length is 127
    const raw = `d=${discordId}|n=${String(productName).slice(0, 80)}`;
    return raw.slice(0, 127);
  }

  function decodeCustomId(customId = "") {
    const s = String(customId || "");
    const discordId = (s.match(/(?:^|\|)d=([^|]*)/) || [])[1] || "";
    const productName = (s.match(/(?:^|\|)n=([^|]*)/) || [])[1] || "";
    return { discordId, productName };
  }

  async function createOrder({
    name = "codeX — خدمة",
    amountMajor,
    discordId = "",
    metadata = {},
  }) {
    const amount = Number(amountMajor);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("amountMajor must be a positive number");
    }
    if (!base) {
      throw new Error("PUBLIC_BASE_URL is required for PayPal checkout");
    }

    const value = amount.toFixed(2);
    const productName = String(name).slice(0, 120);
    const customId = encodeCustomId({
      discordId,
      productName: metadata.productName || productName,
    });

    const order = await api("POST", "/v2/checkout/orders", {
      intent: "CAPTURE",
      purchase_units: [
        {
          description: productName,
          custom_id: customId,
          amount: {
            currency_code: currencyCode,
            value,
          },
        },
      ],
      application_context: {
        brand_name: "codeX",
        locale: "ar-SA",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        return_url: `${base}/pay/success`,
        cancel_url: `${base}/pay/cancel`,
      },
    });

    const approveUrl =
      order?.links?.find((l) => l.rel === "approve")?.href || null;
    if (!approveUrl) {
      throw new Error("PayPal did not return an approve URL");
    }

    return {
      id: order.id,
      status: order.status,
      url: approveUrl,
      order,
    };
  }

  async function captureOrder(orderId) {
    return api("POST", `/v2/checkout/orders/${orderId}/capture`, {});
  }

  async function verifyWebhook({ headers, body }) {
    if (!webhookId) {
      throw new Error("PAYPAL_WEBHOOK_ID is missing");
    }
    const webhookEvent =
      typeof body === "string" ? JSON.parse(body) : body;
    const result = await api("POST", "/v1/notifications/verify-webhook-signature", {
      auth_algo: headers["paypal-auth-algo"],
      cert_url: headers["paypal-cert-url"],
      transmission_id: headers["paypal-transmission-id"],
      transmission_sig: headers["paypal-transmission-sig"],
      transmission_time: headers["paypal-transmission-time"],
      webhook_id: webhookId,
      webhook_event: webhookEvent,
    });
    return result?.verification_status === "SUCCESS";
  }

  function parseCaptureResource(resource = {}) {
    const amount = resource.amount || {};
    const custom = decodeCustomId(resource.custom_id || "");
    const orderId =
      resource.supplementary_data?.related_ids?.order_id ||
      resource.invoice_id ||
      "";
    const productName =
      custom.productName ||
      resource.description ||
      resource.soft_descriptor ||
      resource.invoice_id ||
      "خدمة codeX";
    return {
      captureId: resource.id || "",
      orderId,
      amountValue: amount.value || "?",
      currencyCode: amount.currency_code || currencyCode,
      status: resource.status || "",
      productName: String(productName).slice(0, 120),
      discordId: custom.discordId || "",
      payerName:
        [resource.payer?.name?.given_name, resource.payer?.name?.surname]
          .filter(Boolean)
          .join(" ") || "",
      payerEmail: resource.payer?.email_address || "",
    };
  }

  return {
    enabled: true,
    currency: currencyCode,
    mode,
    apiBase,
    createOrder,
    captureOrder,
    verifyWebhook,
    parseCaptureResource,
    decodeCustomId,
  };
}
