// api/careflow-lead.js — CareFlow lead intake handler
// Uses Resend for email delivery
// Handles two form sources:
//   _form: 'hero' — family/client inquiry (top of page)
//   _form: 'cta'  — operator early access request (bottom of page)

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
      const isOperator = lead._form === 'cta';

      const FROM = 'CareFlow <noreply@ten30studio.com>';
      const date = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

      let notifyBody, autoReplyBody, autoReplyTo, autoReplySubject;

      if (isOperator) {
        // ── OPERATOR EARLY ACCESS FORM ──
        const {
          company = 'Not provided',
          fullName = 'Not provided',
          email = '',
          phone = 'Not provided',
          careType = 'Not specified',
          fundingType = 'Not specified',
          location = 'Not specified',
          capacity = 'Not specified',
          startDate = 'Not specified',
          notes = ''
        } = lead;

        notifyBody = `New CareFlow Operator Request — ${date}

Company:          ${company}
Contact:          ${fullName}
Email:            ${email}
Phone:            ${phone}

Care specialisms: ${careType}
Funding accepted: ${fundingType}
Service area:     ${location}
Current capacity: ${capacity}
When to start:    ${startDate}

Notes / Questions:
${notes || 'None'}

Received: ${ts}
Source: CareFlow Early Access Form

---
Powered by CareFlow / Ten30 Studio`;

        autoReplyTo = email;
        autoReplySubject = 'You\'re on the CareFlow early access list';
        autoReplyBody = `Hi ${fullName},

Thanks for applying — we received your early access request for ${company}.

We're onboarding a small number of UK care operators to shape the product. We'll review your application and be in touch within 48 hours to discuss next steps.

In the meantime, if you have any questions, reply to this email directly.

The CareFlow Team
Powered by Ten30 Studio`;

      } else {
        // ── FAMILY / CLIENT INQUIRY FORM ──
        const {
          fullName = 'Not provided',
          email = '',
          phone = 'Not provided',
          careType = 'Not specified',
          fundingType = 'Not specified',
          location = 'Not specified',
          hoursPerWeek = 'Not specified',
          startDate = 'Not specified',
          specialNeeds = ''
        } = lead;

        notifyBody = `New CareFlow Family Enquiry — ${date}

Name:           ${fullName}
Email:          ${email}
Phone:          ${phone}

Care type:      ${careType}
Funding:        ${fundingType}
Location:       ${location}
Hours/week:     ${hoursPerWeek}
Start date:     ${startDate}
Special needs:  ${specialNeeds || 'None'}

Received: ${ts}
Source: CareFlow Family Inquiry Form

Reply directly to this email or contact the family at: ${email}

---
Powered by CareFlow / Ten30 Studio`;

        autoReplyTo = email;
        autoReplySubject = 'We received your care enquiry';
        autoReplyBody = `Hi ${fullName},

Thank you for reaching out. Your care enquiry has been received and passed directly to the William Waterford team.

Someone will be in touch within 24 hours to discuss your needs.

If your situation is urgent, you can also reach the team directly:
Phone: 01908062452
Email: info@williamwaterfordcare.co.uk

The CareFlow Team
Powered by Ten30 Studio`;
      }

      const tasks = [
        sendViaResend(
          'olalekanolarinde@williamwaterfordcare.co.uk',
          FROM,
          isOperator
            ? `CareFlow Operator Request — ${lead.company || 'New Operator'}`
            : `New CareFlow Family Enquiry — ${lead.fullName || 'New Lead'}`,
          notifyBody
        )
      ];

      if (autoReplyTo) {
        tasks.push(sendViaResend(autoReplyTo, FROM, autoReplySubject, autoReplyBody));
      }

      await Promise.allSettled(tasks);
      res.status(200).json({ ok: true, ts });

    } catch (err) {
      console.error('careflow-lead error:', err.message);
      res.status(200).json({ ok: true }); // always succeed to client
    }
  });
};
