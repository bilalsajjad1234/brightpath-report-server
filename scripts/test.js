'use strict';

// Offline checks: runs the API handlers against a fake GHL API and compares
// the report math with calculateShowdown() from the landing page.
// Usage: node scripts/test.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.GHL_TOKEN = 'pit-test-token';
process.env.REPORT_SECRET = 'test-secret-123';

const sendReport = require('../api/send-report');
const reportPdf = require('../api/pdf');
const logo = require('../api/logo');
const { calculateShowdown } = require('../lib/calc');

// ---- fake Gmail (nodemailer) --------------------------------------------
const nodemailer = require('nodemailer');
let mails = [];
nodemailer.createTransport = (options) => ({
  sendMail: async (message) => {
    mails.push({ options, message });
    return { messageId: '<test@gmail>', accepted: [message.to], rejected: [] };
  }
});

function withEnv(vars, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === null) delete process.env[k];
    else process.env[k] = v;
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    });
}

// ---- fake GHL API -------------------------------------------------------
let calls = [];
let routes = {};
global.fetch = async (url, init = {}) => {
  const u = new URL(url);
  const key = (init.method || 'GET') + ' ' + u.pathname;
  const call = { key, url: u, headers: init.headers || {}, body: init.body };
  calls.push(call);
  const route = routes[key];
  if (!route) return reply(404, { message: 'no route ' + key });
  const out = await route(call);
  return reply(out.status || 200, out.body);
};
function reply(status, body) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}
function happyRoutes() {
  return {
    'GET /conversations/search': () => ({ body: { conversations: [], total: 0 } }),
    'POST /conversations/': () => ({ body: { success: true, conversation: { id: 'conv-1' } } }),
    'POST /conversations/messages/upload': () => ({ body: { uploadedFiles: { 'report.pdf': 'https://storage.example.com/report.pdf' } } }),
    'POST /conversations/messages': () => ({ body: { conversationId: 'conv-1', messageId: 'msg-1', emailMessageId: 'em-1' } })
  };
}

// ---- fake Vercel request/response ----------------------------------------
function fakeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    end(b) {
      this.body = b;
    },
    json() {
      return JSON.parse(this.body);
    }
  };
}
async function run(handler, { method = 'POST', query = {}, body = {}, headers = {} } = {}) {
  const res = fakeRes();
  await handler({ method, query, body, headers: { host: 'brightpath-report.vercel.app', ...headers } }, res);
  return res;
}

// Payload shaped like the standard GHL "Webhook" workflow action.
const WEBHOOK_BODY = {
  contact_id: 'contact-123',
  first_name: 'Khalid',
  last_name: 'Mehmood',
  full_name: 'Khalid Mehmood',
  email: 'lead@example.com',
  phone: '+12405551234',
  'Child Age': '7',
  'College Start Year': '2037',
  'Current Savings': '15000',
  'Monthly Contribution': '450',
  'School Type': 'Out-of-State 4-Year Public University ($180,000 total)',
  'Funding Score': '56',
  'Biggest Concern': 'Market Risk',
  location: { id: 'ddsRwLtrNKoREza7orIK', name: 'AMERICAN CONSULTING PARTNERS CORPORATION', email: 'office@example.com' },
  workflow: { id: 'wf-1', name: 'WF1' }
};

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('GET answers with ok (health check)', async () => {
  const res = await run(sendReport, { method: 'GET' });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.json().ok, true);
});

test('POST without the key is refused', async () => {
  const res = await run(sendReport, { body: WEBHOOK_BODY });
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(calls.length, 0);
});

test('standard webhook payload -> PDF uploaded to GHL and emailed', async () => {
  const res = await run(sendReport, { query: { key: 'test-secret-123' }, body: WEBHOOK_BODY });
  const out = res.json();
  assert.strictEqual(res.statusCode, 200, res.body);
  assert.strictEqual(out.attachedFrom, 'ghl-storage');
  assert.strictEqual(out.score, 56);
  assert.strictEqual(out.targetCost, 262795);
  assert.deepStrictEqual(out.notes, []);

  const upload = calls.find((c) => c.key === 'POST /conversations/messages/upload');
  assert.strictEqual(upload.headers.Authorization, 'Bearer pit-test-token');
  assert.strictEqual(upload.headers.Version, '2021-04-15');
  assert.strictEqual(upload.body.get('contactId'), 'contact-123');
  assert.strictEqual(upload.body.get('locationId'), 'ddsRwLtrNKoREza7orIK');
  assert.strictEqual(upload.body.get('conversationId'), 'conv-1');
  const file = upload.body.get('fileAttachment');
  assert.strictEqual(file.name, 'BrightPath-College-Funding-Report-Khalid-Mehmood.pdf');
  assert.strictEqual(file.type, 'application/pdf');
  const bytes = Buffer.from(await file.arrayBuffer());
  assert.strictEqual(bytes.subarray(0, 5).toString(), '%PDF-');

  const send = calls.find((c) => c.key === 'POST /conversations/messages');
  const payload = JSON.parse(send.body);
  assert.strictEqual(payload.type, 'Email');
  assert.strictEqual(payload.contactId, 'contact-123');
  assert.strictEqual(payload.subject, 'Your 3-Way College Funding Showdown Report & Analysis');
  assert.deepStrictEqual(payload.attachments, ['https://storage.example.com/report.pdf']);
  assert.strictEqual(payload.emailFrom, 'BrightPath Legacy Wealth <brightpathlegacywealth@gmail.com>');
  assert.ok(payload.html.includes('Hi <strong style="color:#062a4d;">Khalid</strong>'));
  assert.ok(payload.html.includes('$262,795'));
  assert.ok(payload.html.includes('https://brightpath-report.vercel.app/logo.jpg'));
  assert.ok(!payload.html.includes('office@example.com'), 'business email must not be used as the lead');
});

test('custom fields missing from the payload are read from the contact', async () => {
  routes['GET /contacts/contact-9'] = () => ({
    body: {
      contact: {
        id: 'contact-9',
        firstName: 'Ann',
        lastName: 'Lee',
        email: 'ann@example.com',
        customFields: [
          { id: 'f1', value: 14 },
          { id: 'f2', value: '2000' },
          { id: 'f3', value: '150' },
          { id: 'f4', value: 'Elite Private / Healthcare Pre-Med ($350,000 total)' }
        ]
      }
    }
  });
  routes['GET /locations/ddsRwLtrNKoREza7orIK/customFields'] = () => ({
    body: {
      customFields: [
        { id: 'f1', name: 'Child Age', fieldKey: 'contact.child_age' },
        { id: 'f2', name: 'Current Savings', fieldKey: 'contact.current_savings' },
        { id: 'f3', name: 'Monthly Contribution', fieldKey: 'contact.monthly_contribution' },
        { id: 'f4', name: 'School Type', fieldKey: 'contact.school_type' }
      ]
    }
  });
  const res = await run(sendReport, { query: { key: 'test-secret-123' }, body: { contact_id: 'contact-9', first_name: 'Ann' } });
  assert.strictEqual(res.statusCode, 200, res.body);
  assert.strictEqual(res.json().score, 20);
  const contactCall = calls.find((c) => c.key === 'GET /contacts/contact-9');
  assert.strictEqual(contactCall.headers.Version, '2021-07-28');
});

test('upload refused -> PDF attached from the report link instead', async () => {
  routes['POST /conversations/messages/upload'] = () => ({ status: 422, body: { message: ['conversationId must be a string'] } });
  const res = await run(sendReport, { query: { key: 'test-secret-123' }, body: WEBHOOK_BODY });
  assert.strictEqual(res.statusCode, 200, res.body);
  assert.strictEqual(res.json().attachedFrom, 'report-link');
  const send = calls.find((c) => c.key === 'POST /conversations/messages');
  const link = JSON.parse(send.body).attachments[0];
  assert.ok(link.startsWith('https://brightpath-report.vercel.app/r/'));
  assert.ok(link.endsWith('/BrightPath-College-Funding-Report-Khalid-Mehmood.pdf'));

  // The same link serves the PDF, and a tampered link does not.
  const token = link.split('/r/')[1].split('/')[0];
  const pdfRes = await run(reportPdf, { method: 'GET', query: { t: token } });
  assert.strictEqual(pdfRes.statusCode, 200);
  assert.strictEqual(pdfRes.headers['content-type'], 'application/pdf');
  assert.strictEqual(pdfRes.body.subarray(0, 5).toString(), '%PDF-');
  const bad = await run(reportPdf, { method: 'GET', query: { t: token.slice(0, -2) + 'xx' } });
  assert.strictEqual(bad.statusCode, 404);
});

test('API asks for "status" -> retried with status pending', async () => {
  let n = 0;
  routes['POST /conversations/messages'] = (call) => {
    n++;
    const body = JSON.parse(call.body);
    if (!body.status) return { status: 422, body: { statusCode: 422, message: ['status must be one of the following values: delivered, failed, pending, read'] } };
    return { body: { conversationId: 'conv-1', messageId: 'msg-2' } };
  };
  const res = await run(sendReport, { query: { key: 'test-secret-123' }, body: WEBHOOK_BODY });
  assert.strictEqual(res.statusCode, 200, res.body);
  assert.strictEqual(n, 2);
});

test('API refuses "Name <email>" sender -> retried with the bare address', async () => {
  const seen = [];
  routes['POST /conversations/messages'] = (call) => {
    const body = JSON.parse(call.body);
    seen.push(body.emailFrom);
    if (String(body.emailFrom).includes('<')) return { status: 400, body: { message: 'emailFrom must be an email' } };
    return { body: { conversationId: 'conv-1', messageId: 'msg-3' } };
  };
  const res = await run(sendReport, { query: { key: 'test-secret-123' }, body: WEBHOOK_BODY });
  assert.strictEqual(res.statusCode, 200, res.body);
  assert.deepStrictEqual(seen, ['BrightPath Legacy Wealth <brightpathlegacywealth@gmail.com>', 'brightpathlegacywealth@gmail.com']);
});

test('expired token -> clear error, no retry loop', async () => {
  routes['POST /conversations/messages'] = () => ({ status: 401, body: { message: 'Invalid JWT' } });
  const res = await run(sendReport, { query: { key: 'test-secret-123' }, body: WEBHOOK_BODY });
  assert.strictEqual(res.statusCode, 502);
  assert.ok(res.json().error.includes('401'));
  assert.strictEqual(calls.filter((c) => c.key === 'POST /conversations/messages').length, 1);
});

test('nothing to work with -> 400 listing what is missing', async () => {
  routes['GET /contacts/contact-x'] = () => ({ body: { contact: { id: 'contact-x', customFields: [] } } });
  routes['GET /locations/ddsRwLtrNKoREza7orIK/customFields'] = () => ({ body: { customFields: [] } });
  const res = await run(sendReport, { query: { key: 'test-secret-123' }, body: { contact_id: 'contact-x' } });
  assert.strictEqual(res.statusCode, 400);
  assert.ok(res.json().error.includes('child_age'));
});

test('dry run returns the numbers without emailing', async () => {
  const res = await run(sendReport, { query: { key: 'test-secret-123', dry: '1' }, body: { ...WEBHOOK_BODY, customData: { child_age: '0' } } });
  assert.strictEqual(res.statusCode, 200, res.body);
  assert.strictEqual(res.json().dryRun, true);
  assert.ok(!calls.some((c) => c.key === 'POST /conversations/messages'));
});

test('Gmail mode: PDF attached as a file, sent from the Gmail account', () =>
  withEnv({ GMAIL_USER: 'sender@gmail.com', GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop' }, async () => {
    const res = await run(sendReport, { query: { key: 'test-secret-123' }, body: WEBHOOK_BODY });
    assert.strictEqual(res.statusCode, 200, res.body);
    assert.strictEqual(res.json().sender, 'gmail');
    assert.strictEqual(calls.length, 0, 'no GHL calls in Gmail mode');
    assert.strictEqual(mails.length, 1);
    const { options, message } = mails[0];
    assert.deepStrictEqual(options.auth, { user: 'sender@gmail.com', pass: 'abcdefghijklmnop' });
    assert.strictEqual(options.host, 'smtp.gmail.com');
    assert.deepStrictEqual(message.from, { name: 'BrightPath Legacy Wealth', address: 'sender@gmail.com' });
    assert.strictEqual(message.to, 'lead@example.com');
    assert.strictEqual(message.replyTo, 'brightpathlegacywealth@gmail.com');
    assert.strictEqual(message.subject, 'Your 3-Way College Funding Showdown Report & Analysis');
    assert.ok(message.text.includes('Readiness Score: 56 / 100'));
    // Booking button pre-fills the GHL calendar form with the lead's details.
    const booking = 'https://api.leadconnectorhq.com/widget/booking/WKn9IvfaxeIQOS0QH7Up?first_name=Khalid&amp;last_name=Mehmood&amp;email=lead%40example.com&amp;phone=%2B12405551234';
    assert.ok(message.html.includes('href="' + booking + '"'), 'personalized booking link in the email');
    assert.ok(message.text.includes(booking.replace(/&amp;/g, '&')));
    assert.strictEqual(message.attachments[0].filename, 'BrightPath-College-Funding-Report-Khalid-Mehmood.pdf');
    assert.strictEqual(message.attachments[0].content.subarray(0, 5).toString(), '%PDF-');
  }));

test('Gmail mode: no valid lead email -> 400, nothing sent', () =>
  withEnv({ GMAIL_USER: 'sender@gmail.com', GMAIL_APP_PASSWORD: 'x' }, async () => {
    const res = await run(sendReport, { query: { key: 'test-secret-123' }, body: { ...WEBHOOK_BODY, email: 'not-an-email' } });
    assert.strictEqual(res.statusCode, 400);
    assert.ok(res.json().error.includes('email'));
    assert.strictEqual(mails.length, 0);
  }));

test('no sender set up yet: dry run works, real send explains what is missing', () =>
  withEnv({ GHL_TOKEN: null }, async () => {
    const dry = await run(sendReport, { query: { key: 'test-secret-123', dry: '1' }, body: WEBHOOK_BODY });
    assert.strictEqual(dry.statusCode, 200, dry.body);
    assert.strictEqual(dry.json().score, 56);
    const real = await run(sendReport, { query: { key: 'test-secret-123' }, body: WEBHOOK_BODY });
    assert.strictEqual(real.statusCode, 500);
    assert.ok(real.json().error.includes('GMAIL_USER'));
  }));

test('logo endpoint serves the JPEG', async () => {
  const res = await run(logo, { method: 'GET' });
  assert.strictEqual(res.headers['content-type'], 'image/jpeg');
  assert.strictEqual(res.body[0], 0xff);
});

test('math matches calculateShowdown() in index.html for every input combination', async () => {
  const pagePath = path.join(__dirname, '..', '..', 'index.html');
  if (!fs.existsSync(pagePath)) {
    console.log('    (skipped: landing page index.html is not next to this folder)');
    return;
  }
  const html = fs.readFileSync(pagePath, 'utf8');
  const start = html.indexOf('function calculateShowdown()');
  assert.ok(start > 0, 'calculateShowdown not found in index.html');
  let depth = 0;
  let end = html.indexOf('{', start);
  for (let i = end; i < html.length; i++) {
    if (html[i] === '{') depth++;
    if (html[i] === '}' && --depth === 0) {
      end = i + 1;
      break;
    }
  }
  const pageCalc = new Function('ageSlider', 'savingsInput', 'monthlyInput', 'benchmarkSelect', html.slice(start, end) + '\nreturn calculateShowdown();');
  let checked = 0;
  for (let age = 0; age <= 17; age++) {
    for (const savings of [0, 1000, 15000, 75000, 150000]) {
      for (const monthly of [150, 350, 975, 2500]) {
        for (const cost of [110000, 180000, 240000, 350000]) {
          const page = pageCalc({ value: String(age) }, { value: String(savings) }, { value: String(monthly) }, { value: String(cost) });
          const ours = calculateShowdown({ age, currentSavings: savings, monthly, baseCost: cost });
          assert.strictEqual(ours.score, page.score);
          assert.strictEqual(ours.years, page.years);
          assert.ok(Math.abs(ours.targetCost - page.targetCost) < 1e-6);
          assert.ok(Math.abs(ours.totalProjected - page.totalProjected) < 1e-6);
          assert.ok(Math.abs(ours.gap - page.gap) < 1e-6);
          checked++;
        }
      }
    }
  }
  assert.strictEqual(checked, 1440);
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    calls = [];
    mails = [];
    routes = happyRoutes();
    try {
      await t.fn();
      console.log('PASS', t.name);
    } catch (err) {
      failed++;
      console.log('FAIL', t.name, '\n   ', err.message);
    }
  }
  console.log(failed ? failed + ' failed' : 'all ' + tests.length + ' passed');
  process.exit(failed ? 1 : 0);
})();
