import nodemailer from 'nodemailer';
import env from '../config/env.js';

let transporter = null;

if (env.brevoSmtpLogin && env.brevoSmtpPassword) {
  transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
      user: env.brevoSmtpLogin,
      pass: env.brevoSmtpPassword,
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
  });
}

/**
 * Sends an email using Brevo REST API (fastest, unblocked on all cloud providers)
 * or fallback to Nodemailer Brevo SMTP.
 */
export async function sendMail({ to, subject, text, html }) {
  const senderEmail = env.brevoSmtpLogin || (env.smtpFrom ? env.smtpFrom.replace(/.*<([^>]+)>.*/, '$1') : 'no-reply@safaaisarathi.in');
  const senderName = 'Safaai Sarathi';

  // 1. Try Brevo REST API first (over HTTPS, never blocked by cloud firewalls)
  const brevoKey = env.brevoApiKey || env.brevoSmtpPassword;
  if (brevoKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: to }],
          subject,
          htmlContent: html || `<p>${text}</p>`,
          textContent: text,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        console.log(`[mail] Brevo REST API email sent to ${to}:`, data.messageId);
        return { success: true, messageId: data.messageId };
      } else {
        const errText = await res.text();
        console.warn(`[mail] Brevo REST API returned ${res.status}:`, errText);
      }
    } catch (apiErr) {
      console.warn('[mail] Brevo REST API attempt failed:', apiErr.message);
    }
  }

  // 2. Fallback to Nodemailer SMTP
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: env.smtpFrom || `"Safaai Sarathi" <${senderEmail}>`,
        to,
        subject,
        text,
        html: html || text,
      });
      console.log(`[mail] SMTP sent to ${to}: ${info.messageId}`);
      return info;
    } catch (smtpErr) {
      console.error('[mail] SMTP transport error:', smtpErr.message);
    }
  }

  // 3. Fallback: Log to console so login / OTP is never blocked
  console.log(`\n========================================`);
  console.log(`[OTP DISPATCH] Recipient: ${to}`);
  console.log(`[OTP DISPATCH] Subject: ${subject}`);
  console.log(`[OTP DISPATCH] Body: ${text}`);
  console.log(`========================================\n`);

  return { devSimulated: true };
}

export default { sendMail };
