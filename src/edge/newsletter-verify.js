// Bunny Edge Script — newsletter confirmation for higheredhottakes.com
//
// Paired with newsletter-signup.js, which generates the token this script
// verifies. Two-step confirm, not a bare GET:
//
//   GET  /  ?token=…&email=…  landing: look up the token and render a
//           confirmation page with a "Confirm subscription" button.
//           Read-only — no contact is created here.
//   POST /  (token, email)    confirm: the button above submits here.
//           Looks up the token again, calls Loops /contacts/create,
//           deletes the token, returns an HTML confirmation page.
//
// The confirming action must be a POST, not the initial GET — email
// security scanners and link-prefetch bots fetch every URL in an inbound
// email, so a GET that subscribes on load lets those requests silently
// confirm signups nobody actually clicked (including spam/list-bombed
// addresses). Ported from the same fix in jggweb (commit 5017278).
//
// Env vars (set in Bunny → Compute → Edge Scripts → Environment):
//   LOOPS_API_KEY       — from Loops › Settings › API
//   LOOPS_MAILING_LIST  — mailing list ID to add the contact to
//   SITE_URL            — comma-separated allowed origins, e.g.
//                         https://higheredhottakes.com,http://localhost:8080
//   BUNNY_CDN_URL       — storage.bunnycdn.com
//   BUNNY_STORAGE_ZONE  — storage zone name
//   BUNNY_API_KEY       — storage zone password (FTP & API Access)

import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";
import process from "node:process";

const LOOPS_API_KEY = process.env.LOOPS_API_KEY;
const LOOPS_MAILING_LIST = process.env.LOOPS_MAILING_LIST || "clxw13yb8004y0ml459zv0z3c";
const ALLOWED_ORIGINS = (process.env.SITE_URL || "https://higheredhottakes.com")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const PRIMARY_SITE_URL = ALLOWED_ORIGINS[0] || "https://higheredhottakes.com";
const BUNNY_CDN_URL = process.env.BUNNY_CDN_URL;
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_API_KEY = process.env.BUNNY_API_KEY;

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

// ── Bunny Object Storage helpers ────────────────────────────────────────
function storageUrl(path) {
  return `https://${BUNNY_CDN_URL}/${BUNNY_STORAGE_ZONE}/${path}`;
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

// ── Loops ───────────────────────────────────────────────────────────────
// Adds the contact via a raw fetch (not the loops SDK — this edge runtime
// only has esm.sh imports available, same as newsletter-signup.js).
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
    // Parse the body for a useful log line, but never surface it to the
    // visitor (see htmlResponse callers below — always a generic message).
    let detail = "";
    try { detail = JSON.stringify(await res.json()); } catch (_) {}
    console.error("Loops contacts/create error:", { status: res.status, detail });
    throw new Error(`Loops contacts/create ${res.status}`);
  }
  // res.ok and not 409 — success. (Previously this read `.success`/`.id`
  // off the raw fetch Response instead of its parsed JSON body, which
  // doesn't have those properties — every real success fell through to
  // the error branch below and showed the visitor a failure page even
  // though the contact really had been created.)
}

// ── Confirmation HTML ───────────────────────────────────────────────────
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
    return handleConfirm(form);
  }
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
});
