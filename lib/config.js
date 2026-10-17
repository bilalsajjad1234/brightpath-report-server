'use strict';

// Settings come from the Vercel project's Environment Variables.
// REPORT_SECRET is always required, plus ONE way of sending the email:
//
//   Gmail (used when both are set; the PDF is attached as a real file)
//     GMAIL_USER          the Gmail address that sends the reports
//     GMAIL_APP_PASSWORD  16-letter App Password of that Gmail account
//
//   GoHighLevel (used when the Gmail settings are absent)
//     GHL_TOKEN           Private Integration token from the GHL sub-account
//
//   REPORT_SECRET    any long random text; the GHL webhook URL must carry it as ?key=
//   EMAIL_FROM_NAME  sender name shown with Gmail sending
//   REPLY_TO         where replies to the Gmail email go
//   BCC_EMAIL        optional copy of every report email
//   EMAIL_FROM       sender used with GHL sending
//   GHL_LOCATION_ID  sub-account (location) id
//   ATTACH_MODE      auto (default) | upload | link — how GHL sending attaches the PDF
//   GHL_API_VERSION  forces one API "Version" header for every GHL call
//   PUBLIC_BASE_URL  this server's address, if it should not be read from the request

function env(name, fallback) {
  const value = process.env[name];
  return value === undefined || String(value).trim() === '' ? fallback : String(value).trim();
}

function loadConfig() {
  const cfg = {
    secret: env('REPORT_SECRET', ''),
    gmailUser: env('GMAIL_USER', ''),
    // Google shows App Passwords in groups of four; the spaces are not part of it.
    gmailAppPassword: env('GMAIL_APP_PASSWORD', '').replace(/\s+/g, ''),
    fromName: env('EMAIL_FROM_NAME', 'BrightPath Legacy Wealth'),
    replyTo: env('REPLY_TO', 'brightpathlegacywealth@gmail.com'),
    bcc: env('BCC_EMAIL', ''),
    ghlToken: env('GHL_TOKEN', ''),
    locationId: env('GHL_LOCATION_ID', 'ddsRwLtrNKoREza7orIK'),
    emailFrom: env('EMAIL_FROM', 'BrightPath Legacy Wealth <brightpathlegacywealth@gmail.com>'),
    attachMode: env('ATTACH_MODE', 'auto'),
    apiVersion: env('GHL_API_VERSION', ''),
    publicBaseUrl: env('PUBLIC_BASE_URL', '').replace(/\/+$/, '')
  };
  cfg.sender = cfg.gmailUser && cfg.gmailAppPassword ? 'gmail' : cfg.ghlToken ? 'ghl' : null;
  return cfg;
}

module.exports = { loadConfig };
