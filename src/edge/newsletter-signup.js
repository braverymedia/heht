// Bunny Edge Script — newsletter signup for higheredhottakes.com
//
// POST /  (email, firstName, lastName) — generates a verification token,
// stores it in Bunny Object Storage, and sends a confirmation email via
// Loops /transactional. No contact is created here — see
// newsletter-verify.js for the GET-landing/POST-confirm step that
// actually creates the Loops contact once a human clicks through.
//
// We roll our own double opt-in because Loops' API-level double opt-in
// isn't available (only their hosted Form endpoints support it).
//
// Env vars (set in Bunny → Compute → Edge Scripts → Environment):
//   LOOPS_API_KEY           — from Loops › Settings › API
//   LOOPS_TRANSACTIONAL_ID  — confirmation email template ID
//   SITE_URL                — comma-separated allowed origins, e.g.
//                             https://higheredhottakes.com,http://localhost:8080
//   BUNNY_CDN_URL           — storage.bunnycdn.com
//   BUNNY_STORAGE_ZONE      — storage zone name
//   BUNNY_API_KEY           — storage zone password (FTP & API Access)

import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";
import process from "node:process";

const BUNNY_CDN_URL = process.env.BUNNY_CDN_URL;
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
const LOOPS_API_KEY = process.env.LOOPS_API_KEY;
const LOOPS_TRANSACTIONAL_ID = process.env.LOOPS_TRANSACTIONAL_ID;
const ALLOWED_ORIGINS = (process.env.SITE_URL || "https://higheredhottakes.com")
	.split(",")
	.map((s) => s.trim())
	.filter(Boolean);
const PRIMARY_SITE_URL = ALLOWED_ORIGINS[0] || "https://higheredhottakes.com";

const RATE_LIMIT_MAX = 5; // max attempts per IP
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in ms

// ── CORS — same helper as newsletter-verify.js, validates the request's
// Origin against the configured allow-list instead of mixing a hardcoded
// origin on some responses with a wildcard on others.
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

// Helper: Generate a random token
function generateToken(length = 32) {
	const chars =
		"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let token = "";
	for (let i = 0; i < length; i++) {
		token += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return token;
}

// Helper: Write verification token to Bunny Object Storage
async function storeToken(email, token, ip, firstName, lastName, referrer) {
	const expiresAt = Date.now() + 1000 * 60 * 60 * 24; // 24 hours
	const data = { email, token, expiresAt, ip, firstName, lastName, referrer };
	const path = `newsletter-tokens/${token}.json`;
	const url = `https://${BUNNY_CDN_URL}/${BUNNY_STORAGE_ZONE}/${path}`;
	const res = await fetch(url, {
		method: "PUT",
		headers: {
			AccessKey: BUNNY_API_KEY,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(data),
	});
	if (!res.ok) throw new Error("Failed to store token");
	return path;
}

// Helper: Send transactional email via Loops
async function sendVerificationEmail(email, token) {
	const verificationUrl = `https://heht-newsletter-verify-djh7p.bunny.run/?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

	const payload = {
		transactionalId: LOOPS_TRANSACTIONAL_ID,
		email,
		dataVariables: { verificationUrl },
	};

	const res = await fetch("https://app.loops.so/api/v1/transactional", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${LOOPS_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	if (!res.ok) {
		let detail = "";
		try { detail = JSON.stringify(await res.json()); } catch (_) {
			try { detail = await res.text(); } catch (_) {}
		}
		console.error("Email verification error:", { status: res.status, detail, email });
		throw new Error(`Failed to send verification email: ${res.status}`);
	}
}

// Helper: Rate limiting using Bunny Object Storage
async function checkAndUpdateRateLimit(ip) {
	const path = `newsletter-rate-limit/${ip}.json`;
	const url = `https://${BUNNY_CDN_URL}/${BUNNY_STORAGE_ZONE}/${path}`;
	let timestamps = [];

	try {
		const res = await fetch(url, {
			method: "GET",
			headers: { AccessKey: BUNNY_API_KEY },
		});
		if (res.ok) {
			timestamps = await res.json();
		}
	} catch (e) {
		timestamps = [];
	}

	const now = Date.now();
	timestamps = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW);

	if (timestamps.length >= RATE_LIMIT_MAX) {
		return false;
	}

	timestamps.push(now);
	await fetch(url, {
		method: "PUT",
		headers: {
			AccessKey: BUNNY_API_KEY,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(timestamps),
	});

	return true;
}

BunnySDK.net.http.serve(async (req) => {
	if (req.method === "OPTIONS") {
		return new Response(null, { headers: corsHeaders(req) });
	}
	if (req.method !== "POST") {
		return json(req, 405, { error: "Method not allowed" });
	}

	const form = await req.formData();
	const email = (form.get("email") || "").toString().trim();
	const firstName = (form.get("firstName") || "").toString().trim();
	const lastName = (form.get("lastName") || "").toString().trim();
	const honeypot = (form.get("website") || "").toString();
	const ip =
		req.headers.get("cf-connecting-ip") ||
		req.headers.get("x-forwarded-for") ||
		"";
	const referrer = req.headers.get("referer") || "";
	const timestamp = form.get("formTimestamp");

	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return json(req, 400, { error: "A valid email is required." });
	}
	if (honeypot.trim() !== "") {
		return json(req, 400, { error: "Spam detected" });
	}
	if (timestamp && Date.now() - parseInt(timestamp, 10) < 2000) {
		return json(req, 400, { error: "Form submitted too quickly" });
	}

	const allowed = await checkAndUpdateRateLimit(ip || "unknown");
	if (!allowed) {
		return json(req, 429, {
			error: "Too many signups from this IP. Please try again later.",
		});
	}

	try {
		const token = generateToken();
		await storeToken(email, token, ip, firstName, lastName, referrer);
		await sendVerificationEmail(email, token);
		return json(req, 200, { success: true });
	} catch (err) {
		console.error("Signup error:", { message: err.message, stack: err.stack });
		return json(req, 500, {
			error: "Subscription failed. Please try again later.",
		});
	}
});
