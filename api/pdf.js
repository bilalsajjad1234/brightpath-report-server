'use strict';

const { loadConfig } = require('../lib/config');
const { unseal } = require('../lib/token');
const { reportFromLink } = require('../lib/report');
const { buildReportPdf } = require('../lib/pdf');
const { first } = require('../lib/http');

// Backup download link printed in the email: /r/<token>/<file name>.pdf
// (rewritten here by vercel.json). Rebuilds the same PDF from the token.
module.exports = async function reportPdf(req, res) {
  const cfg = loadConfig();
  const data = cfg.secret ? unseal(first((req.query || {}).t), cfg.secret) : null;
  if (!data || data.v !== 1) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Report not found.');
  }
  try {
    const report = reportFromLink(data);
    const pdf = await buildReportPdf(report);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('Content-Disposition', 'inline; filename="' + report.fileName + '"');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return res.end(pdf);
  } catch (err) {
    console.error('report link failed', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Could not build the report.');
  }
};
