import nodemailer from 'nodemailer';
import env from '../config/env.js';

let transporter = null;

if (env.brevoSmtpLogin && env.brevoSmtpPassword) {
  transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: env.brevoSmtpLogin,
      pass: env.brevoSmtpPassword,
    },
  });
}

/**
 * Sends an email using Brevo SMTP.
 * If credentials are not set, it logs to the console for dev purposes.
 */
export async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    console.warn('[mail] SMTP credentials not set. Simulated email:');
    console.log(`[mail] To: ${to}`);
    console.log(`[mail] Subject: ${subject}`);
    console.log(`[mail] Body: ${text}`);
    return { devSimulated: true };
  }

  try {
    const info = await transporter.sendMail({
      from: env.smtpFrom || '"Safaai Sarathi" <no-reply@safaaisarathi.in>',
      to,
      subject,
      text,
      html: html || text,
    });
    console.log(`[mail] Message sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('[mail] Failed to send email:', error);
    throw error;
  }
}
