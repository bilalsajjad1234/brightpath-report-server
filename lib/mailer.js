'use strict';

const nodemailer = require('nodemailer');

// Sends the report straight from a Gmail account using an App Password
// (Google Account -> Security -> App passwords). The PDF goes out as a real
// attachment and a copy lands in that Gmail's Sent folder.
async function sendWithGmail({ user, pass, fromName, replyTo, bcc, to, subject, html, text, pdf, fileName }) {
  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000
  });
  const info = await transport.sendMail({
    from: { name: fromName, address: user },
    to,
    replyTo: replyTo || undefined,
    bcc: bcc || undefined,
    subject,
    html,
    text,
    attachments: [{ filename: fileName, content: pdf, contentType: 'application/pdf' }]
  });
  if (info.rejected && info.rejected.length) {
    throw new Error('Gmail refused the address: ' + info.rejected.join(', '));
  }
  return { messageId: info.messageId || null };
}

module.exports = { sendWithGmail };
