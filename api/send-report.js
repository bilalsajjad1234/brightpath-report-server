'use strict';

const { loadConfig } = require('../lib/config');
const { readLead, mergeContact, missingInputs } = require('../lib/input');
const { reportFromLead } = require('../lib/report');
const { buildReportPdf } = require('../lib/pdf');
const { buildEmail } = require('../lib/email');
const { createClient, deliverReport } = require('../lib/ghl');
const { seal } = require('../lib/token');
const { sendJson, first, hasValidKey, publicBaseUrl } = require('../lib/http');

// Called by the GHL workflow right after a calculator lead is saved:
// builds that lead's PDF report and emails it to them as an attachment.
module.exports = async function sendReport(req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return sendJson(res, 200, { ok: true, service: 'BrightPath report server' });
  }
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Use POST.' });

  const cfg = loadConfig();
  if (!cfg.secret || !cfg.ghlToken) {
    return sendJson(res, 500, { ok: false, error: 'Setup incomplete: add REPORT_SECRET and GHL_TOKEN in Vercel.' });
  }
  if (!hasValidKey(req, cfg.secret)) return sendJson(res, 401, { ok: false, error: 'Missing or wrong key.' });

  const client = createClient({ token: cfg.ghlToken, versionOverride: cfg.apiVersion });
  const lead = readLead(req.body);
  const locationId = lead.locationId || cfg.locationId;

  // The webhook payload may leave custom fields out; read them from the contact.
  if (lead.contactId && missingInputs(lead).length) {
    try {
      const [contact, fields] = await Promise.all([client.getContact(lead.contactId), client.getCustomFields(locationId)]);
      mergeContact(lead, contact, fields);
    } catch (err) {
      lead.notes.push('contact lookup: ' + err.message);
    }
  }

  const missing = missingInputs(lead);
  if (missing.length) {
    console.warn('report skipped', JSON.stringify({ missing, keys: lead.receivedKeys, notes: lead.notes }));
    return sendJson(res, 400, { ok: false, error: 'Missing: ' + missing.join(', '), receivedKeys: lead.receivedKeys, notes: lead.notes });
  }

  const report = reportFromLead(lead);
  if (lead.fundingScore !== null && lead.fundingScore !== report.score) {
    lead.notes.push('score on the page was ' + lead.fundingScore + ', report says ' + report.score);
  }
  const summary = {
    contactId: lead.contactId,
    score: report.score,
    targetCost: Math.round(report.targetCost),
    projectedSavings: Math.round(report.totalProjected),
    gap: Math.round(report.gap)
  };
  if (String(first((req.query || {}).dry) || '') === '1') {
    return sendJson(res, 200, { ok: true, dryRun: true, ...summary, notes: lead.notes });
  }

  try {
    const pdf = await buildReportPdf(report);
    const base = publicBaseUrl(req, cfg.publicBaseUrl);
    const hostedUrl = base + '/r/' + seal(report.link, cfg.secret) + '/' + report.fileName;
    const email = buildEmail(report, { reportUrl: hostedUrl, logoUrl: base + '/logo.jpg' });
    const result = await deliverReport(client, {
      locationId,
      contactId: lead.contactId,
      pdf,
      fileName: report.fileName,
      hostedUrl,
      subject: email.subject,
      html: email.html,
      emailFrom: cfg.emailFrom,
      attachMode: cfg.attachMode
    });
    const notes = lead.notes.concat(result.notes);
    console.log('report sent', JSON.stringify({ ...summary, attachedFrom: result.attachedFrom, messageId: result.messageId, notes }));
    return sendJson(res, 200, { ok: true, ...summary, attachedFrom: result.attachedFrom, messageId: result.messageId, notes });
  } catch (err) {
    console.error('report failed', err.message, JSON.stringify(err.data || null));
    return sendJson(res, 502, { ok: false, error: err.message, details: err.data || null, notes: lead.notes });
  }
};
