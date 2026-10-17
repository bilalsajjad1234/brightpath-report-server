'use strict';

const { BRAND, REPORT, SPECIALIST, DISCLOSURES, EMAIL } = require('./content');
const { formatMoney } = require('./calc');

function esc(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function statBox(label, value, color, bg) {
  return (
    '<td width="33%" valign="top" style="padding:0 4px;">' +
    `<div style="background:${bg};border-radius:8px;padding:12px 4px;text-align:center;">` +
    `<div style="color:#9fb3c8;font-size:11px;font-weight:700;letter-spacing:.5px;">${esc(label)}</div>` +
    `<div style="color:${color};font-size:18px;font-weight:800;margin-top:4px;">${esc(value)}</div>` +
    '</div></td>'
  );
}

// HTML body of the report email, styled like the existing GHL report email.
// reportUrl is a backup download link in case the attachment is stripped.
function buildEmail(r, { reportUrl, logoUrl }) {
  const covered = Math.round(r.gap) === 0;
  const year = new Date().getFullYear();
  const phoneLink = `<a href="${esc(BRAND.phoneHref)}" style="color:#062a4d;font-weight:700;">${esc(BRAND.phone)}</a>`;
  const questions = esc(EMAIL.questions).replace('{phone}', phoneLink);
  const p = 'margin:0 0 14px;';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(EMAIL.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef2f7;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">

<tr><td align="center" style="background:#041426;padding:26px 24px 22px;border-bottom:3px solid #d4a034;">
<img src="${esc(logoUrl)}" width="112" alt="BrightPath Legacy Wealth" style="display:block;margin:0 auto 14px;width:112px;height:auto;border:0;border-radius:8px;">
<div style="font-size:20px;font-weight:800;letter-spacing:2px;color:#e2edf7;">BRIGHT<span style="color:#00b8d4;">PATH</span> <span style="color:#d4a034;font-size:16px;">LEGACY WEALTH</span></div>
<div style="font-size:13px;font-style:italic;color:#9fb3c8;margin-top:8px;">${esc(BRAND.tagline)}</div>
</td></tr>

<tr><td style="padding:30px 32px 6px;color:#485c72;font-size:15px;line-height:1.6;">
<h1 style="margin:0 0 16px;color:#062a4d;font-size:22px;line-height:1.3;">${esc(EMAIL.heading)}</h1>
<p style="${p}">Hi <strong style="color:#062a4d;">${esc(r.firstName)}</strong>,</p>
<p style="${p}">${esc(EMAIL.intro)}</p>
</td></tr>

<tr><td style="padding:4px 32px 6px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#062a4d;border:1px solid #d4a034;border-radius:12px;">
<tr><td align="center" style="padding:22px 12px 18px;">
<div style="color:#d4a034;font-weight:800;font-size:13px;letter-spacing:1.5px;">${esc(REPORT.scorecardLabel)}</div>
<div style="color:#ffffff;font-weight:700;font-size:17px;margin-top:6px;">Readiness Score: <span style="color:#f3c04a;">${r.score} / 100</span></div>
<div style="color:#c3d1df;font-size:13px;margin-top:4px;">${esc(r.status)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;"><tr>
${statBox(REPORT.stats.target, formatMoney(r.targetCost), '#ffffff', '#0c2a4a')}
${statBox(REPORT.stats.savings, formatMoney(r.totalProjected), '#00b8d4', '#0c2a4a')}
${covered ? statBox(REPORT.stats.gap, formatMoney(r.gap), '#34d399', '#0b3a35') : statBox(REPORT.stats.gap, formatMoney(r.gap), '#f87171', '#3b1a2b')}
</tr></table>
</td></tr>
</table>
</td></tr>

<tr><td style="padding:18px 32px 4px;color:#485c72;font-size:15px;line-height:1.6;">
<p style="${p}">${esc(EMAIL.afterScore)}</p>
<p style="margin:0 0 6px;font-size:13px;color:#7a8ba0;">${esc(EMAIL.linkFallback)} <a href="${esc(reportUrl)}" style="color:#029bbb;">${esc(EMAIL.linkText)}</a>.</p>
</td></tr>

<tr><td style="padding:14px 32px 6px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#062a4d;border:2px solid #d4a034;border-radius:12px;">
<tr><td align="center" style="padding:24px 22px;">
<div style="color:#ffffff;font-size:18px;font-weight:800;">${esc(SPECIALIST.title)}</div>
<div style="color:#c3d1df;font-size:14px;line-height:1.5;margin:10px 0 18px;">${esc(SPECIALIST.text)}</div>
<a href="${esc(BRAND.bookingUrl)}" style="display:inline-block;background:#f3c04a;color:#041426;font-weight:800;font-size:15px;text-decoration:none;padding:12px 26px;border-radius:30px;">${esc(SPECIALIST.button)} &rarr;</a>
<div style="color:#9fb3c8;font-size:12px;margin-top:14px;">${esc(SPECIALIST.finePrint)}</div>
</td></tr>
</table>
</td></tr>

<tr><td style="padding:18px 32px 26px;color:#485c72;font-size:15px;line-height:1.6;">
<p style="${p}">${questions}</p>
<p style="margin:0;">${esc(EMAIL.signOff)}<br><strong style="color:#062a4d;">${esc(BRAND.company)}</strong></p>
</td></tr>

<tr><td align="center" style="background:#041426;padding:20px 28px;color:#8fa3b8;font-size:12px;line-height:1.55;">
<p style="margin:0 0 10px;">${esc(REPORT.footnote)}</p>
<p style="margin:0 0 10px;">${esc(DISCLOSURES.general)}</p>
<p style="margin:0;">&copy; ${year} ${esc(BRAND.company)} &bull; <a href="${esc(BRAND.phoneHref)}" style="color:#5fb8d6;">${esc(BRAND.phone)}</a> &bull; <a href="mailto:${esc(BRAND.email)}" style="color:#5fb8d6;">${esc(BRAND.email)}</a></p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  // Plain-text version for mail apps that do not show HTML.
  const text = [
    'Hi ' + r.firstName + ',',
    '',
    EMAIL.intro,
    '',
    'Readiness Score: ' + r.score + ' / 100 — ' + r.status,
    'Target Cost: ' + formatMoney(r.targetCost),
    'Est. Savings: ' + formatMoney(r.totalProjected),
    'Funding Gap: ' + formatMoney(r.gap),
    '',
    EMAIL.afterScore,
    EMAIL.linkFallback + ' ' + reportUrl,
    '',
    SPECIALIST.title + ': ' + BRAND.bookingUrl,
    '',
    EMAIL.questions.replace('{phone}', BRAND.phone),
    '',
    EMAIL.signOff,
    BRAND.company,
    '',
    REPORT.footnote,
    DISCLOSURES.general
  ].join('\n');

  return { subject: EMAIL.subject, html, text };
}

module.exports = { buildEmail };
