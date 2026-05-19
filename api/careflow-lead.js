// api/careflow-lead.js
// CareFlow lead intake handler
// Receives form submissions, forwards to Olalekan, logs to Google Sheets

const https = require('https');

function sendEmail(to, subject, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: 'careflow@ten30studio.com', name: 'CareFlow' },
      subject,
      content: [{ type: 'text/plain', value: body }]
    });

    const options = {
      hostname: 'api.sendgrid.com',
      path: '/v3/mail/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      res.statusCode < 300 ? resolve(res.statusCode) : reject(new Error(`SendGrid ${res.statusCode}`));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function appendToSheet(lead) {
  // Google Sheets append via Apps Script webhook (no service account needed)
  const webhookUrl = process.env.SHEETS_WEBHOOK_URL;
  if (!webhookUrl) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const url = new URL(webhookUrl);
    const data = JSON.stringify(lead);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = https.request(options, (res) => { resolve(); });
    req.on('error', () => resolve()); // non-fatal if sheet fails
    req.write(data);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const lead = JSON.parse(body);
      const ts = new Date().toISOString();

      const {
        name = '',
        company = '',
        email = '',
        phone = '',
        care_type = '',
        funding_type = '',
        location = '',
        hours_per_week = '',
        start_date = '',
        medical_needs = '',
        message = '',
        source = 'careflow-landing'
      } = lead;

      // 1. Alert Olalekan
      const operatorEmail = `New CareFlow Lead — ${new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}

A new enquiry has come through CareFlow.

Name: ${name}
Email: ${email}
Phone: ${phone || 'Not provided'}

Care type: ${care_type || 'Not specified'}
Funding type: ${funding_type || 'Not specified'}
Location: ${location || 'Not specified'}
Hours/week: ${hours_per_week || 'Not specified'}
Start date: ${start_date || 'Not specified'}
Medical/support needs: ${medical_needs || 'Not specified'}

Additional notes: ${message || 'None'}

---
Received: ${ts}
Source: ${source}

Reply directly to this email or contact the family at ${email}.`;

      // 2. Auto-response to family
      const familyEmail = `Thank you for your enquiry

Dear ${name || 'there'},

Thank you for reaching out through CareFlow. Your enquiry has been received and passed directly to the William Waterford care team.

Someone will be in touch with you within 24 hours to discuss your needs and how we can help.

If your situation is urgent, you can also reach the team directly at:
📞 01908062452
📧 info@williamwaterfordcare.co.uk

Thank you for trusting us with this.

The CareFlow Team
Powered by Ten30 Studios`;

      const results = await Promise.allSettled([
        process.env.SENDGRID_API_KEY
          ? sendEmail('olalekanolarinde@williamwaterfordcare.co.uk', `New CareFlow Lead — ${name}`, operatorEmail)
          : Promise.resolve('no-sendgrid'),
        email && process.env.SENDGRID_API_KEY
          ? sendEmail(email, 'We received your care enquiry', familyEmail)
          : Promise.resolve('no-sendgrid'),
        appendToSheet({ ts, name, email, phone, care_type, funding_type, location, hours_per_week, start_date, medical_needs, message, source })
      ]);

      // Always succeed from the client's perspective
      res.status(200).json({ ok: true, ts });

    } catch (err) {
      console.error('careflow-lead error:', err);
      res.status(200).json({ ok: true }); // still return 200 so form shows success
    }
  });
};
