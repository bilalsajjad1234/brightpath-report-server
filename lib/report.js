'use strict';

const { calculateShowdown, costFromSchoolType, schoolLabel } = require('./calc');
const { readinessStatus, CONCERNS } = require('./content');
const { resolveAge } = require('./input');

function titleCase(text) {
  return String(text || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(^|[\s'-])([a-z])/g, (m, p, c) => p + c.toUpperCase());
}

function reportDate(date) {
  return date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function fileNameFor(fullName) {
  const slug = String(fullName || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return 'BrightPath-College-Funding-Report' + (slug ? '-' + slug : '') + '.pdf';
}

// Turns the inputs into everything the PDF and the email print.
// The same object is rebuilt from the download-link token, so it only
// depends on the compact `link` data below.
function buildReport({ firstName, lastName, fullName, age, currentSavings, monthly, baseCost, schoolType, concern, dateISO }) {
  const first = titleCase(firstName || String(fullName || '').split(' ')[0]);
  const name = titleCase(fullName || [firstName, lastName].filter(Boolean).join(' ')) || 'Valued Family';
  const calc = calculateShowdown({ age, currentSavings, monthly, baseCost });
  const date = dateISO ? new Date(dateISO) : new Date();

  return {
    firstName: first || 'there',
    name,
    dateLabel: reportDate(date),
    age,
    years: calc.years,
    startYear: calc.startYear,
    baseCost,
    school: schoolLabel(baseCost, schoolType),
    currentSavings: currentSavings || 0,
    monthly: calc.monthlyUsed,
    concern: CONCERNS[concern] || concern || '',
    targetCost: calc.targetCost,
    totalProjected: calc.totalProjected,
    gap: calc.gap,
    score: calc.score,
    status: readinessStatus(calc.score),
    fileName: fileNameFor(name === 'Valued Family' ? '' : name),
    link: {
      v: 1,
      f: firstName || '',
      l: lastName || '',
      n: fullName || '',
      a: age,
      s: currentSavings || 0,
      m: monthly,
      b: baseCost,
      t: schoolType || '',
      c: concern || '',
      d: date.toISOString()
    }
  };
}

function reportFromLead(lead) {
  return buildReport({
    firstName: lead.firstName,
    lastName: lead.lastName,
    fullName: lead.fullName,
    age: resolveAge(lead),
    currentSavings: lead.currentSavings,
    monthly: lead.monthly,
    baseCost: costFromSchoolType(lead.schoolType),
    schoolType: lead.schoolType,
    concern: lead.concern
  });
}

function reportFromLink(data) {
  return buildReport({
    firstName: data.f,
    lastName: data.l,
    fullName: data.n,
    age: data.a,
    currentSavings: data.s,
    monthly: data.m,
    baseCost: data.b,
    schoolType: data.t,
    concern: data.c,
    dateISO: data.d
  });
}

module.exports = {
  reportFromLead,
  reportFromLink
};
