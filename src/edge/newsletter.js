// Bunny Edge Script — newsletter signup + confirmation for
// higheredhottakes.com
//
// Handles all three steps of a DIY double opt-in flow on a single
// endpoint (previously split across two separate Bunny Edge Scripts —
// consolidated to match the pattern in jggweb, which hit the same
// maintenance problem first):
//
//   POST /   (email, firstName, lastName) signup: generate a token, store
//            it in Bunny Object Storage, send the confirmation email via
//            Loops /transactional. No contact is created yet.
//   GET  /   ?token=…&email=… landing: look up the token and render a
//            confirmation page with a "Confirm subscription" button.
//            Read-only — no contact is created here.
//   POST /   (token, email) confirm: the button above submits here. Looks
//            up the token again, calls Loops /contacts/create, deletes
//            the token, returns an HTML confirmation page.
//
// The confirmation action must be a POST, not the initial GET — email
// security scanners and link-prefetch bots fetch every URL in an inbound
// email, so a GET that subscribes on load lets those requests silently
// confirm signups nobody actually asked for (including spam/list-bombed
// addresses). Mirrors jggweb's fix for the same bug (commit 5017278).
//
// We roll our own flow because Loops' API has no double opt-in — checked
// their full OpenAPI spec (2026-08-25): no confirmation/verification
// field on POST /v1/contacts/create or anywhere else. Only their hosted
// Form product supports it, and that's an embed widget, not something
// this API-driven form can use without giving up the on-brand UI.
//
// The confirmation URL is self-referencing (built from the incoming
// request's own host/path), so this script works the same whether it's
// deployed to one Bunny Edge Script endpoint or pasted into several —
// no hardcoded cross-endpoint URL to keep in sync.
//
// Env vars (set in Bunny → Compute → Edge Scripts → Environment):
//   LOOPS_API_KEY           — from Loops › Settings › API
//   LOOPS_TRANSACTIONAL_ID  — confirmation email template ID
//   LOOPS_MAILING_LIST      — mailing list ID to add the contact to
//   SITE_URL                — comma-separated allowed origins, e.g.
//                             https://higheredhottakes.com,http://localhost:8080
//   BUNNY_CDN_URL           — storage.bunnycdn.com
//   BUNNY_STORAGE_ZONE      — storage zone name
//   BUNNY_API_KEY           — storage zone password (FTP & API Access)

import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";
import process from "node:process";

const LOOPS_API_KEY = process.env.LOOPS_API_KEY;
const LOOPS_TRANSACTIONAL_ID = process.env.LOOPS_TRANSACTIONAL_ID;
const LOOPS_MAILING_LIST = process.env.LOOPS_MAILING_LIST || "clxw13yb8004y0ml459zv0z3c";
const ALLOWED_ORIGINS = (process.env.SITE_URL || "https://higheredhottakes.com")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const PRIMARY_SITE_URL = ALLOWED_ORIGINS[0] || "https://higheredhottakes.com";
const BUNNY_CDN_URL = process.env.BUNNY_CDN_URL;
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_API_KEY = process.env.BUNNY_API_KEY;

const RATE_LIMIT_MAX = 5; // max signup attempts per IP
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ── CORS ────────────────────────────────────────────────────────────────
function corsHeaders(req) {
  const origin = req.headers.get("origin") || "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : PRIMARY_SITE_URL;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(req, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

// ── Bunny Object Storage helpers ────────────────────────────────────────
function storageUrl(path) {
  return `https://${BUNNY_CDN_URL}/${BUNNY_STORAGE_ZONE}/${path}`;
}

async function storagePut(path, data) {
  const res = await fetch(storageUrl(path), {
    method: "PUT",
    headers: { AccessKey: BUNNY_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Storage PUT ${res.status}`);
}

async function storageGet(path) {
  const res = await fetch(storageUrl(path), {
    headers: { AccessKey: BUNNY_API_KEY },
  });
  if (!res.ok) return null;
  return res.json();
}

async function storageDelete(path) {
  await fetch(storageUrl(path), {
    method: "DELETE",
    headers: { AccessKey: BUNNY_API_KEY },
  });
}

// ── Rate limit ──────────────────────────────────────────────────────────
async function checkAndUpdateRateLimit(ip) {
  const path = `newsletter-rate-limit/${ip}.json`;
  let timestamps = (await storageGet(path)) || [];
  const now = Date.now();
  timestamps = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW);
  if (timestamps.length >= RATE_LIMIT_MAX) return false;
  timestamps.push(now);
  await storagePut(path, timestamps);
  return true;
}

// ── Token ───────────────────────────────────────────────────────────────
function generateToken(length = 32) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < length; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
  return token;
}

async function lookupValidToken(token, email) {
  const path = `newsletter-tokens/${token}.json`;
  const data = await storageGet(path);
  if (!data || data.email !== email) return { ok: false, reason: "invalid" };
  if (Date.now() > data.expiresAt) {
    await storageDelete(path);
    return { ok: false, reason: "expired" };
  }
  return { ok: true, path, data };
}

// ── Loops ───────────────────────────────────────────────────────────────
async function sendConfirmationEmail({ email, verificationUrl }) {
  const res = await fetch("https://app.loops.so/api/v1/transactional", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOOPS_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transactionalId: LOOPS_TRANSACTIONAL_ID,
      email,
      dataVariables: { verificationUrl },
    }),
  });
  if (!res.ok) {
    let detail = "";
    try { detail = JSON.stringify(await res.json()); } catch (_) {}
    console.error("Loops transactional error:", { status: res.status, detail, email });
    throw new Error(`Loops transactional ${res.status}`);
  }
}

// Adds the contact via a raw fetch — this edge runtime only has esm.sh
// imports available, and the response is parsed into JSON before being
// checked (an earlier version checked fields on the raw fetch Response
// object instead, which doesn't have them, so every real success fell
// through to an error path anyway).
async function createContact({ email, firstName, lastName, referrer }) {
  const payload = {
    email: String(email).toLowerCase().trim(),
    firstName: firstName ? String(firstName) : undefined,
    lastName: lastName ? String(lastName) : undefined,
    source: "newsletter-signup",
    referrer: (referrer && typeof referrer === "string") ? referrer : "direct",
    signupDate: new Date().toISOString(),
    signupMethod: "website",
    userGroup: "Newsletter Subscriber",
    mailingLists: { [LOOPS_MAILING_LIST]: true },
  };

  const res = await fetch("https://app.loops.so/api/v1/contacts/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOOPS_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  // 409 = already exists; treat as success rather than an error.
  if (res.status === 409) return;

  if (!res.ok) {
    let detail = "";
    try { detail = JSON.stringify(await res.json()); } catch (_) {}
    console.error("Loops contacts/create error:", { status: res.status, detail });
    throw new Error(`Loops contacts/create ${res.status}`);
  }
}

// ── HTML (GET landing + POST confirm responses) ─────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlPage({ title, heading, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  html, body { margin: 0; padding: 0; }
  body {
    background: #100346; color: #ffffff;
    font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    min-height: 100vh; display: grid; place-items: center; padding: 2rem;
    line-height: 1.55;
  }
  main { max-width: 28rem; text-align: center; }
  h1 { font-weight: 800; font-size: clamp(1.6rem, 1.3rem + 1.4vw, 2.1rem); margin: 0 0 0.75rem; }
  p { color: #d8d3ea; margin: 0 0 1.5rem; }
  .button {
    display: inline-block; padding: 0.75rem 1.75rem; border: none;
    font: inherit; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.14em;
    text-transform: uppercase; text-decoration: none; cursor: pointer;
    color: #100346; background: #ffff00; border-radius: 4px;
  }
</style>
</head>
<body>
<main>
  <h1>${heading}</h1>
  ${body}
  <p><a class="button" href="${PRIMARY_SITE_URL}" style="background:transparent;color:#ffff00;border:1px solid #ffff00;">Back to Higher Ed Hot Takes</a></p>
</main>
</body>
</html>`;
}

function htmlResponse(status, { title, heading, body }) {
  return new Response(htmlPage({ title, heading, body }), {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline';",
    },
  });
}

function invalidOrExpiredPage(reason) {
  return reason === "expired"
    ? {
        title: "Link expired",
        heading: "This link has expired",
        body: "<p>Confirmation links are valid for 24 hours. Please subscribe again to get a fresh link.</p>",
      }
    : {
        title: "Link not valid",
        heading: "This link is no longer valid",
        body: "<p>The confirmation link has already been used or doesn't match. Try subscribing again.</p>",
      };
}

// ── Handlers ────────────────────────────────────────────────────────────
async function handleSignup(req, form) {
  const email = (form.get("email") || "").toString().trim();
  const firstName = (form.get("firstName") || "").toString().trim();
  const lastName = (form.get("lastName") || "").toString().trim();
  const honeypot = (form.get("website") || "").toString();
  const timestamp = parseInt(form.get("formTimestamp") || "0", 10);
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown";
  const referrer = req.headers.get("referer") || "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(req, 400, { error: "A valid email is required." });
  }
  if (honeypot.trim() !== "") return json(req, 400, { error: "Spam detected." });
  if (timestamp && Date.now() - timestamp < 2000) {
    return json(req, 400, { error: "Form submitted too quickly." });
  }

  const allowed = await checkAndUpdateRateLimit(ip);
  if (!allowed) return json(req, 429, { error: "Too many signups from this IP. Please try again later." });

  try {
    const token = generateToken();
    await storagePut(`newsletter-tokens/${token}.json`, {
      email, firstName, lastName, referrer, expiresAt: Date.now() + TOKEN_TTL, ip,
    });

    // Self-referencing: points back at whichever host/path this request
    // came in on, so the same script works regardless of how many Bunny
    // endpoints it's deployed to.
    const reqUrl = new URL(req.url);
    const base = `${reqUrl.protocol}//${reqUrl.host}${reqUrl.pathname}`;
    const verificationUrl = `${base}?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    await sendConfirmationEmail({ email, verificationUrl });
    return json(req, 200, { success: true });
  } catch (err) {
    console.error("Signup error:", { message: err.message, stack: err.stack });
    return json(req, 500, { error: "Subscription failed. Please try again later." });
  }
}

// GET — read-only landing page. Does not create the contact: a plain page
// load must never have side effects, since email scanners and prefetch
// bots fetch links automatically.
async function handleConfirmLanding(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const email = url.searchParams.get("email");

  if (!token || !email) {
    return htmlResponse(400, {
      title: "Invalid link",
      heading: "That link isn't valid",
      body: "<p>The confirmation link is missing required data. Try subscribing again.</p>",
    });
  }

  const lookup = await lookupValidToken(token, email);
  if (!lookup.ok) return htmlResponse(400, invalidOrExpiredPage(lookup.reason));

  return htmlResponse(200, {
    title: "Confirm your subscription",
    heading: `One more step${lookup.data.firstName ? `, ${escapeHtml(lookup.data.firstName)}` : ""}`,
    body: `
      <p>Click below to finish subscribing to Higher Ed Hot Takes.</p>
      <form method="POST" action="${escapeHtml(url.pathname)}">
        <input type="hidden" name="token" value="${escapeHtml(token)}">
        <input type="hidden" name="email" value="${escapeHtml(email)}">
        <button type="submit" class="button">Confirm subscription</button>
      </form>
    `,
  });
}

// POST (token, email) — the actual confirming action, submitted by the
// button on the landing page above. This is where the contact is created.
async function handleConfirm(form) {
  const token = (form.get("token") || "").toString();
  const email = (form.get("email") || "").toString();

  if (!token || !email) {
    return htmlResponse(400, {
      title: "Invalid link",
      heading: "That link isn't valid",
      body: "<p>The confirmation link is missing required data. Try subscribing again.</p>",
    });
  }

  const lookup = await lookupValidToken(token, email);
  if (!lookup.ok) return htmlResponse(400, invalidOrExpiredPage(lookup.reason));

  const { data, path } = lookup;
  try {
    await createContact({
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      referrer: data.referrer,
    });
    await storageDelete(path);
    return htmlResponse(200, {
      title: "You're subscribed",
      heading: "You're in.",
      body: `<p>Thanks for confirming${data.firstName ? `, ${escapeHtml(data.firstName)}` : ""}. New episodes and updates will land in your inbox.</p>`,
    });
  } catch (err) {
    console.error("Confirm error:", { message: err.message, stack: err.stack });
    return htmlResponse(500, {
      title: "Something went wrong",
      heading: "We couldn't finish your subscription",
      body: "<p>Please try subscribing again. If the problem persists, get in touch.</p>",
    });
  }
}

// ── Router ──────────────────────────────────────────────────────────────
BunnySDK.net.http.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method === "GET") return handleConfirmLanding(req);
  if (req.method === "POST") {
    const form = await req.formData();
    return form.get("token") ? handleConfirm(form) : handleSignup(req, form);
  }
  return json(req, 405, { error: "Method not allowed" });
});
