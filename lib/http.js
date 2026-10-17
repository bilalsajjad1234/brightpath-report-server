'use strict';

const crypto = require('crypto');

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function sameSecret(given, expected) {
  if (!given || !expected) return false;
  const a = crypto.createHash('sha256').update(String(given)).digest();
  const b = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

// The standard GHL "Webhook" action cannot set headers, so the key normally
// rides in the URL (?key=...). A header works too for other callers.
function hasValidKey(req, secret) {
  const query = req.query || {};
  const headers = req.headers || {};
  const bearer = String(headers.authorization || '').replace(/^Bearer\s+/i, '');
  return [first(query.key), headers['x-report-key'], bearer].some((given) => sameSecret(given, secret));
}

function publicBaseUrl(req, configured) {
  if (configured) return configured;
  const headers = req.headers || {};
  const host = String(headers['x-forwarded-host'] || headers.host || '').split(',')[0].trim();
  const proto = String(headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  return proto + '://' + host;
}

module.exports = { sendJson, first, hasValidKey, publicBaseUrl };
