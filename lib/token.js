'use strict';

const crypto = require('crypto');

// The backup download link carries the report inputs inside the URL,
// encrypted and signed with REPORT_SECRET (AES-256-GCM), so no database is
// needed and nobody can read or change the numbers in the link.

function keyFor(secret) {
  return crypto.createHash('sha256').update('brightpath-report-link:' + secret).digest();
}

function seal(data, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyFor(secret), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

function unseal(token, secret) {
  try {
    const raw = Buffer.from(String(token), 'base64url');
    if (raw.length < 29) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyFor(secret), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const body = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
    return JSON.parse(body.toString('utf8'));
  } catch (err) {
    return null;
  }
}

module.exports = { seal, unseal };
