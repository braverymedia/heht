import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";
import process from "node:process";

const BUNNY_CDN_URL = process.env.BUNNY_CDN_URL;
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
const LOOPS_API_KEY = process.env.LOOPS_API_KEY;
const LOOPS_TRANSACTIONAL_ID = process.env.LOOPS_TRANSACTIONAL_ID;
const SITE_URL = process.env.SITE_URL;

const RATE_LIMIT_MAX = 5; // max attempts per IP
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in ms

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
  try {
    const verificationUrl = `https://heht-newsletter-verify-djh7p.bunny.run/?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
    console.log('Sending verification email to:', email);
    
    const payload = {
      transactionalId: LOOPS_TRANSACTIONAL_ID,
      email,
      dataVariables: {
        verificationUrl,
      },
    };

    const res = await fetch("https://app.loops.so/api/v1/transactional", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOOPS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log('Email verification response status:', res.status);
    
    if (!res.ok) {
      try {
        const error = await res.json();
        console.error('Email verification error:', {
          status: res.status,
          error,
          request: { email, verificationUrl }
        });
        throw new Error(`Failed to send verification email: ${error.message || error.detail}`);
      } catch (parseError) {
        const errorText = await res.text();
        console.error('Email verification error:', {
          status: res.status,
          errorText,
          request: { email, verificationUrl }
        });
        throw new Error(`Failed to send verification email: ${errorText}`);
      }
    }
  } catch (err) {
    console.error('Email verification error:', {
      message: err.message,
      stack: err.stack
    });
    throw err;
  }
}

// Helper: Rate limiting using Bunny Object Storage
async function checkAndUpdateRateLimit(ip) {
	const path = `newsletter-rate-limit/${ip}.json`;
	const url = `https://${BUNNY_CDN_URL}/${BUNNY_STORAGE_ZONE}/${path}`;
	let timestamps = [];

	// Try to fetch existing rate limit data
	try {
		const res = await fetch(url, {
			method: "GET",
			headers: { AccessKey: BUNNY_API_KEY },
		});
		if (res.ok) {
			timestamps = await res.json();
		}
	} catch (e) {
		// If not found, treat as new
		timestamps = [];
	}

	const now = Date.now();
	// Remove timestamps older than window
	timestamps = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW);

	if (timestamps.length >= RATE_LIMIT_MAX) {
		return false; // Rate limit exceeded
	}

	// Add current attempt and save back to storage
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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': SITE_URL,
        'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }
	if (req.method !== "POST") {
		return new Response(JSON.stringify({ error: "Method not allowed" }), {
			status: 405,
			headers: {
        'Access-Control-Allow-Origin': SITE_URL,
        'Content-Type': 'application/json'
      },
		});
	}

	const form = await req.formData();
	const email = form.get("email");
	const firstName = form.get("firstName") || "";
	const lastName = form.get("lastName") || "";
	const honeypot = form.get("website");
	const ip =
		req.headers.get("cf-connecting-ip") ||
		req.headers.get("x-forwarded-for") ||
		"";
	const referrer = req.headers.get("referer") || "";
	const timestamp = form.get("formTimestamp");

	// Basic validation
	if (!email || typeof email !== "string") {
		return new Response(JSON.stringify({ error: "Email required" }), {
			status: 400,
			headers: {
        'Access-Control-Allow-Origin': SITE_URL,
        'Content-Type': 'application/json'
      },
		});
	}
	// Honeypot check
	if (honeypot && honeypot.trim() !== "") {
		return new Response(JSON.stringify({ error: "Spam detected" }), {
			status: 400,
			headers: {
        'Access-Control-Allow-Origin': SITE_URL,
        'Content-Type': 'application/json'
      },
		});
	}
	// Timestamp check (must be at least 2 seconds old)
	if (timestamp && Date.now() - parseInt(timestamp, 10) < 2000) {
		return new Response(
			JSON.stringify({ error: "Form submitted too quickly" }),
			{ status: 400, headers: {
        'Access-Control-Allow-Origin': SITE_URL,
        'Content-Type': 'application/json'
      }, }
		);
	}

	// Rate limiting
	const allowed = await checkAndUpdateRateLimit(ip || "unknown");
	if (!allowed) {
		return new Response(
			JSON.stringify({
				error: "Too many signups from this IP. Please try again later.",
			}),
			{ status: 429, headers: { "Access-Control-Allow-Origin": "*" } }
		);
	}

	try {
		const token = generateToken();
		await storeToken(email, token, ip, firstName, lastName, referrer);
		await sendVerificationEmail(email, token);
		return new Response(JSON.stringify({ success: true }), {
			status: 200,
			headers: { "Access-Control-Allow-Origin": "*" },
		});
	} catch (err) {
		let safeMessage = err.message;
		if (typeof safeMessage === "string" && /<\/?[a-z][\s\S]*>/i.test(safeMessage)) {
			safeMessage = "An unexpected error occurred. Please try again later or contact support.";
		}
		return new Response(
			JSON.stringify({ error: safeMessage }),
			{
				status: 500,
				headers: { "Access-Control-Allow-Origin": "*" },
			}
		);
	}
});
