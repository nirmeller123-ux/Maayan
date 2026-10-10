import { REDIRECT_URI, SCOPE } from "../_google.js";

// Starts the OAuth flow: redirect to Google's consent screen. A random state is
// stored in a short-lived cookie and echoed back to guard against CSRF.
export default function handler(req, res) {
  const state = globalThis.crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  res.setHeader("Set-Cookie", `g_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
  res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
  res.end();
}
