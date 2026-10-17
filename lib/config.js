'use strict';

// Settings come from the Vercel project's Environment Variables.
// Only GHL_TOKEN and REPORT_SECRET are required; the rest default to the
// BrightPath sub-account.
//
//   GHL_TOKEN        Private Integration token from the GHL sub-account
//   REPORT_SECRET    any long random text; the GHL webhook URL must carry it as ?key=
//   GHL_LOCATION_ID  sub-account (location) id
//   EMAIL_FROM       sender shown on the email
//   ATTACH_MODE      auto (default) | upload | link — how the PDF is attached
//   GHL_API_VERSION  forces one API "Version" header for every call
//   PUBLIC_BASE_URL  this server's address, if it should not be read from the request

function env(name, fallback) {
  const value = process.env[name];
  return value === undefined || String(value).trim() === '' ? fallback : String(value).trim();
}

function loadConfig() {
  return {
    ghlToken: env('GHL_TOKEN', ''),
    secret: env('REPORT_SECRET', ''),
    locationId: env('GHL_LOCATION_ID', 'ddsRwLtrNKoREza7orIK'),
    emailFrom: env('EMAIL_FROM', 'BrightPath Legacy Wealth <brightpathlegacywealth@gmail.com>'),
    attachMode: env('ATTACH_MODE', 'auto'),
    apiVersion: env('GHL_API_VERSION', ''),
    publicBaseUrl: env('PUBLIC_BASE_URL', '').replace(/\/+$/, '')
  };
}

module.exports = { loadConfig };
