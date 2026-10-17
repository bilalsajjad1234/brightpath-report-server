# BrightPath report server

Emails every College Funding Showdown lead their personalized PDF report as an attachment.

## How it works

1. A visitor fills in the calculator on the landing page; the page posts the lead to GHL (workflow WF1, Inbound Webhook trigger).
2. WF1 creates the contact, then its **Webhook** action calls `POST /api/send-report?key=REPORT_SECRET`.
3. The server recomputes the numbers with the same formula as the page (`lib/calc.js`), builds the PDF (`lib/pdf.js`) and emails it with the PDF attached.

The email goes out one of two ways:

- **Gmail** (`lib/mailer.js`), used when `GMAIL_USER` and `GMAIL_APP_PASSWORD` are set. The PDF is a real attachment; the email does not show in GHL Conversations, only in that Gmail's Sent folder.
- **GoHighLevel** (`lib/ghl.js`), used otherwise when `GHL_TOKEN` is set. The PDF is uploaded to the contact's conversation and the email is sent through the sub-account, so it shows in GHL Conversations. If the upload is refused, the email attaches the PDF from this server's own link (`/r/<token>/<file>.pdf`; the token holds the report inputs, encrypted with `REPORT_SECRET`).

## Environment variables (Vercel → Settings → Environment Variables)

| Name | Required | Value |
| --- | --- | --- |
| `REPORT_SECRET` | yes | Long random text; the WF1 webhook URL must end with `?key=<same text>` |
| `GMAIL_USER` | for Gmail | Gmail address that sends the reports |
| `GMAIL_APP_PASSWORD` | for Gmail | 16-letter App Password of that account (Google Account → Security → App passwords; needs 2-Step Verification) |
| `EMAIL_FROM_NAME` | no | Sender name for Gmail sending; defaults to `BrightPath Legacy Wealth` |
| `REPLY_TO` | no | Where replies go; defaults to `brightpathlegacywealth@gmail.com` |
| `BCC_EMAIL` | no | Gets a copy of every report email |
| `GHL_TOKEN` | for GHL | Private Integration token from the GHL sub-account (scopes: conversations read/write, conversation messages read/write, contacts read, custom fields read) |
| `GHL_LOCATION_ID` | no | Defaults to `ddsRwLtrNKoREza7orIK` |
| `EMAIL_FROM` | no | Sender for GHL sending; defaults to `BrightPath Legacy Wealth <brightpathlegacywealth@gmail.com>` |
| `ATTACH_MODE` | no | GHL sending only: `auto` (default), `upload` (GHL storage only) or `link` (server link only) |

Redeploy after changing a variable.

## Editing the report

All wording is in `lib/content.js` (copied from the landing page and the existing GHL report email). Get compliance approval before changing it. If the calculator formula on the page changes, update `lib/calc.js`; `npm test` compares the two when the landing page's `index.html` sits next to this folder.

## Commands

- `npm test` — offline tests against a fake GHL API and a fake Gmail, plus the formula check
- `npm run sample` — writes sample PDFs and emails to `out/`

Quick check without sending anything: add `&dry=1` to the webhook URL.
