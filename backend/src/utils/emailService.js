
const nodemailer = require('nodemailer');

let transporter;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  return transporter;
};

const getSender = () => {
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  const match = from.match(/^(.*?)\s*<([^<>]+)>$/);

  if (match) {
    return {
      name: match[1].trim().replace(/^["']|["']$/g, '') || 'Task_It',
      email: match[2].trim(),
    };
  }

  return {
    name: 'Task_It',
    email: from.trim().replace(/^["']|["']$/g, ''),
  };
};

const sendWithBrevo = async ({ to, subject, html, text }) => {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: getSender(),
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Brevo API error (${response.status}): ${details}`);
  }

  return response.json();
};

const sendEmail = async ({ to, subject, html, text, required = false }) => {
  try {
    if (process.env.BREVO_API_KEY) {
      await sendWithBrevo({ to, subject, html, text });
      console.log(`[EmailService] Email accepted by Brevo for ${to}`);
      return;
    }

    const mailer = getTransporter();

    if (!mailer) {
      if (required) {
        throw new Error('Email is not configured. Set BREVO_API_KEY or valid SMTP credentials.');
      }

      console.log(`[EmailService] Skipping email because email is not configured. To: ${to} | Subject: ${subject}`);
      return;
    }

    await mailer.sendMail({
      from: process.env.EMAIL_FROM || `"Task_It" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text,
    });

    console.log(`[EmailService] Email sent to ${to}`);
  } catch (err) {
    if (required) throw err;
    console.error(`[EmailService] Failed to send email: ${err.message}`);
  }
};

module.exports = { sendEmail };