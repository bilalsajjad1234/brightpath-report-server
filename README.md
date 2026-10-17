# BrightPath report server

Emails every College Funding Showdown lead their personalized PDF report, attached, through the GoHighLevel sub-account's normal email sending.

## How it works

1. A visitor fills in the calculator on the landing page; the page posts the lead to GHL (workflow WF1, Inbound Webhook trigger).
2. WF1 creates the contact, then its **Webhook** action calls `POST /api/send-report?key=REPORT_SECRET`.
3. The server recomputes the numbers with the same formula as the page (`lib/calc.js`), builds the PDF (`lib/pdf.js`), uploads it to the contact's conversation and sends the report email with the PDF attached (`lib/ghl.js`).

If the upload is refused, the email attaches the PDF from this server's own link instead (`/r/<token>/<file>.pdf`). The token holds the report inputs, encrypted with `REPORT_SECRET`.

## Environment variables (Vercel → Settings → Environment Variables)

| Name | Required | Value |
| --- | --- | --- |
| `GHL_TOKEN` | yes | Private Integration token from the GHL sub-account (scopes: conversations read/write, conversation messages read/write, contacts read, custom fields read) |
| `REPORT_SECRET` | yes | Long random text; the WF1 webhook URL must end with `?key=<same text>` |
| `GHL_LOCATION_ID` | no | Defaults to `ddsRwLtrNKoREza7orIK` |
| `EMAIL_FROM` | no | Defaults to `BrightPath Legacy Wealth <brightpathlegacywealth@gmail.com>` |
| `ATTACH_MODE` | no | `auto` (default), `upload` (GHL storage only) or `link` (server link only) |

Redeploy after changing a variable.

## Editing the report

All wording is in `lib/content.js` (copied from the landing page and the existing GHL report email). Get compliance approval before changing it. If the calculator formula on the page changes, update `lib/calc.js`; `npm test` compares the two.

## Commands

- `npm test` — offline tests against a fake GHL API, plus a formula check against `../index.html`
- `npm run sample` — writes sample PDFs and emails to `out/`
- `npx vercel@62.2.0 deploy --prod` — deploy

Quick check without sending anything: add `&dry=1` to the webhook URL.
