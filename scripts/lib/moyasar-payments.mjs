/**
 * Moyasar e-invoices → hosted payment URL (Visa/Mada/etc).
 * Auth: Basic with secret key as username, empty password.
 */
export function createMoyasarPayments({
  secretKey,
  publicBaseUrl,
  currency = "SAR",
}) {
  if (!secretKey) return null;

  const base = String(publicBaseUrl || "").replace(/\/$/, "");
  const auth = Buffer.from(`${secretKey}:`).toString("base64");

  async function api(method, path, body) {
    const res = await fetch(`https://api.moyasar.com/v1${path}`, {
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        data?.message ||
        data?.errors?.[0] ||
        data?.type ||
        `Moyasar HTTP ${res.status}`;
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    return data;
  }

  async function createInvoice({
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
      throw new Error("PUBLIC_BASE_URL is required for Moyasar invoices");
    }

    const amountHalalas = Math.round(amount * 100);
    if (amountHalalas < 100) {
      throw new Error("minimum amount is 1.00 SAR");
    }

    const invoice = await api("POST", "/invoices", {
      amount: amountHalalas,
      currency: String(currency || "SAR").toUpperCase(),
      description: String(name).slice(0, 220),
      callback_url: `${base}/moyasar/callback`,
      success_url: `${base}/pay/success`,
      back_url: `${base}/pay/cancel`,
      metadata: {
        source: "codex-bot",
        productName: String(name).slice(0, 120),
        discordId: String(discordId || ""),
        ...Object.fromEntries(
          Object.entries(metadata).map(([k, v]) => [k, String(v ?? "")]),
        ),
      },
    });

    return invoice;
  }

  return {
    enabled: true,
    currency,
    createInvoice,
  };
}
