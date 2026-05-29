// api/data-deletion.js — User data deletion endpoint
// Handles:
//   GET  /api/data-deletion?signed_request=... (Meta callback verification)
//   POST /api/data-deletion                    (Meta callback or web form submission)
// Meta docs: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback

const crypto = require('crypto');

function parseSignedRequest(signedRequest, appSecret) {
  try {
    const [encodedSig, payload] = signedRequest.split('.');
    const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    const expectedSig = crypto.createHmac('sha256', appSecret).update(payload).digest();
    if (!crypto.timingSafeEqual(sig, expectedSig)) return null;
    return data;
  } catch (_) {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const APP_SECRET = process.env.META_APP_SECRET || '';

  // Meta sends a GET with signed_request to verify the endpoint
  if (req.method === 'GET') {
    const { signed_request } = req.query;
    if (signed_request) {
      const data = parseSignedRequest(signed_request, APP_SECRET);
      if (!data) { res.status(400).json({ error: 'invalid signed_request' }); return; }
      // Return confirmation URL where user can check deletion status
      const confirmationCode = Buffer.from(JSON.stringify({ user_id: data.user_id, ts: Date.now() })).toString('base64url');
      res.status(200).json({
        url: `https://www.ten30studio.com/data-deletion?code=${confirmationCode}`,
        confirmation_code: confirmationCode
      });
      return;
    }
    // Plain GET — redirect to deletion page
    res.writeHead(302, { Location: '/data-deletion' });
    res.end();
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;

    // Meta deletion callback (application/x-www-form-urlencoded with signed_request)
    if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(body);
      const signedRequest = params.get('signed_request');
      if (signedRequest) {
        const data = parseSignedRequest(signedRequest, APP_SECRET);
        if (!data) { res.status(400).json({ error: 'invalid signed_request' }); return; }
        const confirmationCode = Buffer.from(JSON.stringify({ user_id: data.user_id, ts: Date.now() })).toString('base64url');
        console.log(`[data-deletion] Meta deletion request for user_id=${data.user_id}`);
        res.status(200).json({
          url: `https://www.ten30studio.com/data-deletion?code=${confirmationCode}`,
          confirmation_code: confirmationCode
        });
        return;
      }
    }

    // Web form submission (JSON)
    try {
      const parsed = JSON.parse(body);
      console.log(`[data-deletion] Web form request from ${parsed.email || 'unknown'}`);
      // Log the request (best-effort — no external deps needed)
      res.status(200).json({ received: true });
    } catch (_) {
      res.status(200).json({ received: true });
    }
    return;
  }

  res.status(405).json({ error: 'method not allowed' });
};
