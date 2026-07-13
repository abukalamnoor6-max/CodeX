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
        Prefer: "return=representation",
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
      const detail =
        data?.details?.[0]?.description ||
        data?.details?.[0]?.issue ||
        data?.message ||
        data?.error_description ||
        data?.name ||
        `PayPal HTTP ${res.status}`;
      const issue = data?.details?.[0]?.issue || data?.name || "";
      const err = new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      err.issue = issue;
      err.status = res.status;
      err.paypal = data;
      throw err;
    }
    return data;
  }

  function encodeCustomId({
    discordId = "",
    discordUser = "",
    productName = "",
  } = {}) {
    // PayPal custom_id max length is 127
    const raw = `d=${discordId}|u=${encodeURIComponent(String(discordUser).slice(0, 40))}|n=${String(productName).slice(0, 60)}`;
    return raw.slice(0, 127);
  }

  function decodeCustomId(customId = "") {
    const s = String(customId || "");
    const discordId = (s.match(/(?:^|\|)d=([^|]*)/) || [])[1] || "";
    let discordUser = "";
    try {
      discordUser = decodeURIComponent(
        (s.match(/(?:^|\|)u=([^|]*)/) || [])[1] || "",
      );
    } catch {
      discordUser = (s.match(/(?:^|\|)u=([^|]*)/) || [])[1] || "";
    }
    const productName = (s.match(/(?:^|\|)n=([^|]*)/) || [])[1] || "";
    return { discordId, discordUser, productName };
  }

  async function createOrder({
    name = "𝐂𝐨𝐝𝐞𝐗 — خدمة",
    amountMajor,
    discordId = "",
    discordUser = "",
    lang = "ar",
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
    const user = String(discordUser || metadata.discordUser || "")
      .trim()
      .replace(/^@+/, "")
      .slice(0, 40);
    const id =
      String(discordId || "").trim() ||
      (/^\d{15,22}$/.test(user) ? user : "");
    const customId = encodeCustomId({
      discordId: id,
      discordUser: user,
      productName: metadata.productName || productName,
    });
    // PayPal description is picky with some unicode — keep a safe short label
    const safeDescription =
      String(productName)
        .replace(/[^\w\s\-_.\u0600-\u06FF]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120) || "𝐂𝐨𝐝𝐞𝐗 service";

    // Mobile card/wallet flows leave the page and return via return_url
    // (JS onApprove often never runs). Bake order details into the URL.
    const payLang = String(lang || metadata.lang || "ar").toLowerCase() === "en" ? "en" : "ar";
    const successQs = new URLSearchParams({
      amount: value,
      name: productName,
      user,
      lang: payLang,
    });
    const cancelQs = new URLSearchParams({
      amount: value,
      name: productName,
      lang: payLang,
    });

    const order = await api("POST", "/v2/checkout/orders", {
      intent: "CAPTURE",
      purchase_units: [
        {
          description: safeDescription,
          custom_id: customId,
          amount: {
            currency_code: currencyCode,
            value,
          },
        },
      ],
      application_context: {
        brand_name: "𝐂𝐨𝐝𝐞𝐗",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        return_url: `${base}/pay/success?${successQs.toString()}`,
        cancel_url: `${base}/pay/cancel?${cancelQs.toString()}`,
      },
    });

    return {
      id: order.id,
      status: order.status,
      url: order?.links?.find((l) => l.rel === "approve")?.href || null,
      order,
    };
  }

  async function getOrder(orderId) {
    return api("GET", `/v2/checkout/orders/${orderId}`);
  }

  async function captureOrder(orderId) {
    try {
      return await api("POST", `/v2/checkout/orders/${orderId}/capture`, {});
    } catch (e) {
      const issue = String(e.issue || e.message || "");
      // Idempotent: already captured / completed is success for checkout UX
      if (
        /ORDER_ALREADY_CAPTURED|CAPTURE_ALREADY|ORDER_NOT_APPROVED/i.test(issue) ||
        /already been captured|already captured/i.test(String(e.message || ""))
      ) {
        const existing = await getOrder(orderId).catch(() => null);
        if (existing) return existing;
      }
      // If capture raced with webhook, order may already be COMPLETED
      const existing = await getOrder(orderId).catch(() => null);
      if (
        existing &&
        (existing.status === "COMPLETED" ||
          existing.purchase_units?.some((u) =>
            u.payments?.captures?.some((c) => c.status === "COMPLETED"),
          ))
      ) {
        return existing;
      }
      throw e;
    }
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
      "خدمة 𝐂𝐨𝐝𝐞𝐗";
    return {
      captureId: resource.id || "",
      orderId,
      amountValue: amount.value || "?",
      currencyCode: amount.currency_code || currencyCode,
      status: resource.status || "",
      productName: String(productName).slice(0, 120),
      discordId: custom.discordId || "",
      discordUser: custom.discordUser || "",
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
    getOrder,
    verifyWebhook,
    parseCaptureResource,
    decodeCustomId,
  };
}
