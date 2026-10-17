'use strict';

const LOGO = require('../lib/logo');

// Logo shown at the top of the email (served as /logo.jpg via vercel.json).
module.exports = function logo(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Content-Length', LOGO.length);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.end(LOGO);
};
