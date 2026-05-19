// api/careflow-lead.js — CareFlow lead intake handler
// Uses Resend for email delivery

const https = require('https');

function sendViaResend(to, from, subject, text) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ from, to: [to], subject, text });
    const options = {
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => res.statusCode < 300 ? resolve(body) : reject(new Error(`Resend ${res.statusCode}: ${body}`)));
    });
    req.on('error', reject);
    req.write(payload);
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
      const lead = typeof body === 'string' ? JSON.parse(body) : body;
      const ts = new Date().toISOString();
      const {
        name = 'Not provided',
        email = '',
        phone = 'Not provided',
        careType = 'Not specified',
        fundingType = 'Not specified',
        location = 'Not specified',
        hoursPerWeek = 'Not specified',
        startDate = 'Not specified',
        medicalNeeds = 'None',
        source = 'careflow-landing'
      } = lead;

      const FROM = 'CareFlow <onboarding@resend.dev>';
      const date = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

      // Alert to Olalekan
      const operatorBody = `New CareFlow Enquiry — ${date}

Name:           ${name}
Email:          ${email}
Phone:          ${phone}

Care type:      ${careType}
Funding:        ${fundingType}
Location:       ${location}
Hours/week:     ${hoursPerWeek}
Start date:     ${startDate}
Medical needs:  ${medicalNeeds}

Received: ${ts}
Source: ${source}

Reply directly to this email or contact the family at: ${email}

---
Powered by CareFlow / Ten30 Studios`;

      // Auto-response to family
      const familyBody = `Hi ${name},

Thank you for reaching out. Your care enquiry has been received and passed directly to the William Waterford team.

Someone will be in touch within 24 hours to discuss your needs.

If your situation is urgent, you can also reach the team directly:
Phone: 01908062452
Email: info@williamwaterfordcare.co.uk

The CareFlow Team
Powered by Ten30 Studios`;

      const tasks = [
        sendViaResend(
          'olalekanolarinde@williamwaterfordcare.co.uk',
          FROM,
          `New CareFlow Enquiry — ${name || 'New Lead'}`,
          operatorBody
        )
      ];

      if (email) {
        tasks.push(sendViaResend(email, FROM, 'We received your care enquiry', familyBody));
      }

      await Promise.allSettled(tasks);
      res.status(200).json({ ok: true, ts });

    } catch (err) {
      console.error('careflow-lead error:', err.message);
      res.status(200).json({ ok: true }); // always succeed to client
    }
  });
};
