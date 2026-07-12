/**
 * Discord OAuth2 (identify) for /pay checkout identity.
 * Env: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, PUBLIC_BASE_URL
 * DISCORD_CLIENT_ID defaults to bot application id decoded from bot token.
 */
import crypto from "crypto";

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function discordClientIdFromBotToken(token = "") {
  try {
    const part = String(token).split(".")[0];
    if (!part) return "";
    return Buffer.from(part, "base64").toString("utf8").trim();
  } catch {
    return "";
  }
}

export function getDiscordOAuthConfig() {
  const clientId =
    process.env.DISCORD_CLIENT_ID ||
    discordClientIdFromBotToken(process.env.DISCORD_BOT_TOKEN || "") ||
    "1524960607948898461";
  const clientSecret = process.env.DISCORD_CLIENT_SECRET || "";
  let publicBase = String(
    process.env.PUBLIC_BASE_URL ||
      process.env.RAILWAY_STATIC_URL ||
      "",
  ).replace(/\/$/, "");
  if (!publicBase && process.env.RAILWAY_PUBLIC_DOMAIN) {
    publicBase = `https://${String(process.env.RAILWAY_PUBLIC_DOMAIN).replace(/\/$/, "")}`;
  }
  if (publicBase && !/^https?:\/\//i.test(publicBase)) {
    publicBase = `https://${publicBase}`;
  }
  // Production default for codeX bot host
  if (!publicBase) {
    publicBase = "https://codex-delivery-bot-production.up.railway.app";
  }
  const redirectUri =
    process.env.DISCORD_OAUTH_REDIRECT_URI ||
    `${publicBase}/auth/discord/callback`;
  const stateSecret =
    process.env.DISCORD_OAUTH_STATE_SECRET ||
    process.env.GUARD_API_KEY ||
    clientSecret ||
    process.env.DISCORD_BOT_TOKEN ||
    "codex-oauth";

  return {
    clientId,
    clientSecret,
    publicBase,
    redirectUri,
    stateSecret,
    enabled: Boolean(clientId && clientSecret && redirectUri),
  };
}

export function signOAuthState(payload, secret) {
  const body = b64url(JSON.stringify({ ...payload, t: Date.now() }));
  const sig = b64url(
    crypto.createHmac("sha256", secret).update(body).digest(),
  );
  return `${body}.${sig}`;
}

export function verifyOAuthState(state, secret, { maxAgeMs = 15 * 60 * 1000 } = {}) {
  const [body, sig] = String(state || "").split(".");
  if (!body || !sig) return null;
  const expect = b64url(
    crypto.createHmac("sha256", secret).update(body).digest(),
  );
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data;
  try {
    data = JSON.parse(fromB64url(body).toString("utf8"));
  } catch {
    return null;
  }
  if (!data?.t || Date.now() - Number(data.t) > maxAgeMs) return null;
  return data;
}

export function signDiscordSession(user, secret) {
  const body = b64url(
    JSON.stringify({
      id: String(user.id),
      username: String(user.username || ""),
      global_name: user.global_name || null,
      avatar: user.avatar || null,
      t: Date.now(),
    }),
  );
  const sig = b64url(
    crypto.createHmac("sha256", secret).update(body).digest(),
  );
  return `${body}.${sig}`;
}

export function verifyDiscordSession(token, secret, { maxAgeMs = 2 * 60 * 60 * 1000 } = {}) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expect = b64url(
    crypto.createHmac("sha256", secret).update(body).digest(),
  );
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(fromB64url(body).toString("utf8"));
    if (!data?.id || !data?.t || Date.now() - Number(data.t) > maxAgeMs)
      return null;
    return data;
  } catch {
    return null;
  }
}

export function buildAuthorizeUrl({ clientId, redirectUri, state }) {
  const u = new URL("https://discord.com/api/oauth2/authorize");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "identify");
  u.searchParams.set("prompt", "none");
  u.searchParams.set("state", state);
  // prompt=none fails if not logged in — use consent as fallback via second try
  // Better default: consent only when needed
  u.searchParams.delete("prompt");
  return u.toString();
}

export async function exchangeCode({ clientId, clientSecret, redirectUri, code }) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "oauth token failed");
  }
  return json;
}

export async function fetchDiscordMe(accessToken) {
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.id) {
    throw new Error(json.message || "failed to fetch discord user");
  }
  return json;
}

export function avatarUrl(user) {
  if (!user?.id) return "";
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
  }
  const idx = Number(BigInt(user.id) >> 22n) % 6;
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}
