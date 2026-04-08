import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";
import { LoopsClient, APIError, RateLimitExceededError } from "https://esm.sh/loops@5.0.1";
import process from "node:process";

// Environment variables from Bunny Edge Scripting
const BUNNY_CDN_URL = process.env.BUNNY_CDN_URL;
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
const LOOPS_API_KEY = process.env.LOOPS_API_KEY;

// Log environment variable status (without values for security)
console.log('Environment variables initialized:', {
  BUNNY_CDN_URL: process.env.BUNNY_CDN_URL ? '***' : 'Not set',
  BUNNY_STORAGE_ZONE: process.env.BUNNY_STORAGE_ZONE ? '***' : 'Not set',
  BUNNY_API_KEY: process.env.BUNNY_API_KEY ? '***' : 'Not set',
  LOOPS_API_KEY: process.env.LOOPS_API_KEY ? '***' : 'Not set'
});

// Initialize Loops client immediately
console.log('Initializing Loops client...');

// Create the client synchronously
let loops;
try {
  // Create the client
  loops = new LoopsClient(LOOPS_API_KEY);
  
  // Log that we've created the client
  console.log('Loops client created, will test API key on first request');
} catch (error) {
  console.error('Failed to create Loops client:', error);
  throw new Error('Failed to initialize newsletter service');
}

// We'll test the API key on the first request
let isTestingApiKey = false;
let apiKeyTested = false;
let apiKeyTestError = null;
let teamName = null;

// Function to ensure API key is tested
async function ensureApiKeyTested() {
  // If already tested successfully, return
  if (apiKeyTested && !apiKeyTestError) return true;
  
  // If test is in progress, wait for it
  if (isTestingApiKey) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return ensureApiKeyTested();
  }
  
  // If test failed before, throw the error
  if (apiKeyTestError) {
    throw apiKeyTestError;
  }
  
  // Otherwise, run the test
  isTestingApiKey = true;
  
  try {
    console.log('Testing Loops API key...');
    const testResponse = await loops.testApiKey();
    if (!testResponse.success) {
      throw new Error('API key test did not return success');
    }
    
    teamName = testResponse.teamName;
    console.log('Loops API key test successful, team:', teamName);
    apiKeyTested = true;
    return true;
  } catch (error) {
    apiKeyTestError = error;
    console.error('API key test failed:', error);
    throw error;
  } finally {
    isTestingApiKey = false;
  }
}

// Start testing the API key in the background
ensureApiKeyTested().catch(error => {
  console.error('Background API key test failed:', error);
});

// Helper: Get token from Bunny Object Storage
async function getToken(token) {
  try {
    const url = `https://${BUNNY_CDN_URL}/${BUNNY_STORAGE_ZONE}/newsletter-tokens/${token}.json`;
    console.log('Fetching token from:', url);
    
    // Log the environment variables for debugging (without values)
    console.log('Environment config:', {
      BUNNY_CDN_URL: BUNNY_CDN_URL ? '***' : 'Not set',
      BUNNY_STORAGE_ZONE: BUNNY_STORAGE_ZONE ? '***' : 'Not set',
      BUNNY_API_KEY: BUNNY_API_KEY ? '***' : 'Not set'
    });
    
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'AccessKey': BUNNY_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
    });

    const responseText = await res.text();
    console.log('Token fetch response status:', res.status);
    
    if (!res.ok) {
      console.error('Token fetch error:', {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        body: responseText,
        url: url
      });
      throw new Error(`Failed to fetch token: ${res.status} ${res.statusText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
      console.log('Token data retrieved successfully');
      return data;
    } catch (parseError) {
      console.error('Failed to parse token data:', {
        responseText,
        error: parseError.message
      });
      throw new Error('Invalid token data format');
    }
  } catch (err) {
    console.error('Token fetch failed:', {
      message: err.message,
      stack: err.stack,
      token: token ? '***' : 'missing'
    });
    throw new Error('Unable to verify your subscription. Please try again or contact support.');
  }
}

// Helper: Delete token from Bunny Object Storage
async function deleteToken(token) {
  try {
    const url = `https://${BUNNY_CDN_URL}/${BUNNY_STORAGE_ZONE}/newsletter-tokens/${token}.json`;
    console.log('Deleting token from:', url);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'AccessKey': BUNNY_API_KEY,
        'Content-Type': 'application/json'
      },
    });

    if (!res.ok) {
      console.error('Token delete error:', {
        status: res.status,
        url: url
      });
      throw new Error('Failed to delete token');
    }

    console.log('Token deleted successfully');
  } catch (err) {
    console.error('Token delete error:', {
      message: err.message,
      stack: err.stack
    });
    throw err;
  }
}

// Helper: Add user to Loops audience
async function addToLoops({ email, firstName, lastName, referrer }) {
  try {
    // Validate required fields
    if (!email) {
      throw new Error('Email is required');
    }

    console.log('Attempting to add contact to Loops:', { 
      email, 
      firstName: firstName || 'Not provided',
      lastName: lastName || 'Not provided',
      referrer: referrer ? '***' : 'not set'
    });

    // Log API key status
    console.log('Using Loops API key:', LOOPS_API_KEY ? '***' : 'MISSING');
    
    if (!LOOPS_API_KEY) {
      throw new Error('LOOPS_API_KEY environment variable is not set');
    }

    // Prepare the contact data
    const contactData = {
      email: String(email).toLowerCase().trim(),
      firstName: firstName ? String(firstName) : undefined,
      lastName: lastName ? String(lastName) : undefined,
      source: 'newsletter-signup',
      referrer: (referrer && typeof referrer === 'string') ? referrer : 'direct',
      signupDate: new Date().toISOString(),
      signupMethod: 'website',
      userGroup: 'Newsletter Subscriber',
      mailingLists: {
        'clxw13yb8004y0ml459zv0z3c': true
      }
    };

    console.log('Sending to Loops API:', {
      email: contactData.email,
      hasFirstName: !!contactData.firstName,
      hasLastName: !!contactData.lastName,
      source: contactData.source,
      referrer: contactData.referrer ? '***' : 'not set',
      mailingListIds: Object.keys(contactData.mailingLists)
    });

    // Make direct API call to Loops
    const response = await fetch('https://app.loops.so/api/v1/contacts/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOOPS_API_KEY}`
      },
      body: JSON.stringify(contactData)
    });

    const responseData = await response.json();
    console.log('Loops API response:', {
      status: response.status,
      statusText: response.statusText,
      data: responseData
    });

    // Handle 409 Conflict (email already exists) as a success case
    if (response.status === 409) {
      console.log('Email already subscribed to the list');
      return { success: true, message: 'Email already subscribed' };
    }
    
    // Handle other error statuses
    if (!response.ok) {
      throw new Error(`Loops API error: ${response.status} - ${response.statusText}`);
    }
    
    if (!response) {
      throw new Error('No response received from Loops API');
    }
    
    if (!response.success) {
      console.error('Error response from Loops API:', response);
      throw new Error(response.message || 'Failed to add contact to newsletter');
    }
    
    console.log('Successfully added to Loops:', { 
      contactId: response.id,
      email: email,
      timestamp: new Date().toISOString()
    });
    
    return response;
    
  } catch (error) {
    let errorMessage = 'Failed to add your email to our newsletter. Please try again later.';
    let errorDetails = { message: error.message };
    
    console.error('Error in addToLoops:', {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
      response: error.response
    });
    
    // Handle specific error types
    if (error instanceof RateLimitExceededError) {
      errorMessage = 'Newsletter service is currently busy. Please try again in a moment.';
      errorDetails = {
        ...errorDetails,
        rateLimit: error.limit,
        remaining: error.remaining,
        retryAfter: error.retryAfter
      };
    } 
    else if (error.statusCode === 401) {
      errorMessage = 'Newsletter service configuration error. Please contact support.';
      errorDetails = { ...errorDetails, statusCode: 401 };
    }
    else if (error.statusCode === 409) {
      // Contact already exists - return success
      console.log('Contact already exists in Loops');
      return { success: true };
    }
    else if (error.message === 'LOOPS_API_KEY environment variable is not set') {
      errorMessage = 'Newsletter service configuration error. Please contact support.';
      errorDetails = { ...errorDetails, configError: true };
    }
    
    console.error('Error details:', errorDetails);
    
    // Don't expose internal error details to the user
    throw new Error(errorMessage);
  }
}

function htmlResponse(message, status = 200) {
  const html = '<html>' +
    '<head>' +
      '<meta charset="utf-8">' +
      '<title>Newsletter Confirmation</title>' +
      '<style>' +
        'body { font-family: Arial, sans-serif; margin: 20px; }' +
        'h1 { color: #0077b6; }' +
        '.message { margin: 10px 0; }' +
        '.button {' +
          'display: inline-block;' +
          'padding: 8px 16px;' +
          'background: #0077b6;' +
          'color: white;' +
          'text-decoration: none;' +
          'border-radius: 4px;' +
          'margin-top: 10px;' +
        '}' +
        '.button:hover { background: #005f99; }' +
      '</style>' +
    '</head>' +
    '<body>' +
      '<h1>Newsletter Confirmation</h1>' +
      '<div class="message">' + message + '</div>' +
      '<p><a href="https://higheredhottakes.com" class="button">Return to Higher Ed Hot Takes</a></p>' +
    '</body>' +
    '</html>';
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline';",
      'Access-Control-Allow-Origin': '*'
    }
  });
}

BunnySDK.net.http.serve(async (req) => {
  // Log the incoming request
  console.log('Incoming request:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  // Set CORS headers for all responses
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'text/plain',
  };

  try {
    // Log environment status
    console.log('Environment status:', {
      LOOPS_API_KEY: LOOPS_API_KEY ? '***' : 'MISSING',
      BUNNY_CDN_URL: BUNNY_CDN_URL ? '***' : 'MISSING',
      BUNNY_STORAGE_ZONE: BUNNY_STORAGE_ZONE ? '***' : 'MISSING',
      BUNNY_API_KEY: BUNNY_API_KEY ? '***' : 'MISSING'
    });

    // Ensure we have a valid client instance
    if (!loops) {
      const errorMsg = 'No Loops client instance available';
      console.error(errorMsg);
      return new Response('Newsletter service is unavailable. Please try again later.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // Ensure API key is tested
    try {
      console.log('Ensuring API key is tested...');
      await ensureApiKeyTested();
      console.log('API key test completed successfully');
    } catch (error) {
      console.error('API key test failed:', {
        error: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        statusCode: error.statusCode
      });
      return new Response('Newsletter service is currently unavailable. Please try again later.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (!token || !email) {
      console.log('Missing token or email:', { token, email });
      return htmlResponse('Invalid verification link. Please try subscribing again.', 400);
    }

    console.log('Attempting to verify token:', { token });
    const data = await getToken(token);
    console.log('Token data retrieved successfully', data);

    if (data.email !== email) {
      console.error('Email mismatch:', { stored: data.email, provided: email });
      return htmlResponse('This verification link is not valid for your email address.', 400);
    }

    if (Date.now() > data.expiresAt) {
      console.error('Token expired');
      return htmlResponse('This verification link has expired. Please try subscribing again.', 400);
    }

    console.log('Attempting to add to Loops...', { email: data.email });
    const result = await addToLoops({ 
      email: data.email, 
      firstName: data.firstName, 
      lastName: data.lastName, 
      referrer: data.referrer 
    });
    
    console.log('Successfully processed subscription:', result);
    
    // Only delete the token if we successfully added the contact or they were already subscribed
    if (result && result.success) {
      await deleteToken(token);
      console.log('Token deleted successfully');
      return htmlResponse('Thank you for confirming your email address! You are now subscribed to our Higher Ed Hot Takes.');
    } else {
      throw new Error('Failed to process your subscription. Please try again later.');
    }

  } catch (err) {
    console.error('Verification error:', {
      message: err.message,
      stack: err.stack
    });
    return htmlResponse(`There was an error completing your subscription: ${err.message}`, 400);
  }
});
