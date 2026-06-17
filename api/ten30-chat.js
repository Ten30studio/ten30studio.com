// Serverless proxy: ten30studio.com/api/ten30-chat -> FMIFY backend /webchat/ten30_studios
//
// Why this exists: the browser must never see the webchat auth token or the
// backend host. This function holds both in Vercel environment variables
// (TEN30_FMIFY_TOKEN, FMIFY_BACKEND) — set with `vercel env add`, never committed —
// and injects the token server-side. The visitor only ever talks to
// ten30studio.com. The backend's own per-client daily cap is the spend ceiling.
//
// This is "Tilda" — Ten30 Studios' own concierge, FMIFY customer #2 (the studio
// that builds FMIFY, served by it). Same pattern as getfmify.com/api/fmify-chat.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const token = process.env.TEN30_FMIFY_TOKEN;
  const backend = process.env.FMIFY_BACKEND; // e.g. https://<host>/  (no trailing path)
  if (!token || !backend) {
    res.status(503).json({ reply: "Tilda is warming up — please try again in a moment." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const message = String((body && body.message) || "").slice(0, 1000);
  const session_id = String((body && body.session_id) || "").slice(0, 64);
  if (!message.trim()) {
    res.status(400).json({ error: "message required" });
    return;
  }

  try {
    const r = await fetch(`${backend.replace(/\/+$/, "")}/webchat/ten30_studios`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-FMIFY-Token": token },
      body: JSON.stringify({ message, session_id }),
    });
    const data = await r.json().catch(() => ({}));
    res.status(r.status).json(data);
  } catch (e) {
    res.status(502).json({ reply: "I couldn't reach our system just now — please try again shortly." });
  }
}
