'use strict';

const { START_YEAR, costFromSchoolType } = require('./calc');

// GHL can call this server in a few shapes: the standard "Webhook" workflow
// action (contact fields at the top level, custom fields keyed by their
// display name, extra values under customData), the "Custom Webhook" action
// (whatever body is typed in), or a plain JSON test. Keys are matched without
// caring about case, spaces or punctuation, so "Child Age", "child_age" and
// "childAge" are the same key.
const FIELDS = {
  contactId: ['contact_id', 'contactId'],
  email: ['email'],
  firstName: ['first_name', 'firstName'],
  lastName: ['last_name', 'lastName'],
  fullName: ['full_name', 'fullName', 'name'],
  phone: ['phone', 'phone_number'],
  childAge: ['child_age', 'Child Age', "Child's Age"],
  collegeStartYear: ['college_start_year', 'College Start Year'],
  currentSavings: ['current_savings', 'Current Savings', 'Current College Savings'],
  monthly: ['monthly_contribution', 'Monthly Contribution', 'Monthly Savings'],
  schoolType: ['school_type', 'School Type', 'College Type', 'College Benchmark'],
  concern: ['biggest_concern', 'Biggest Concern'],
  fundingScore: ['funding_score', 'Funding Score'],
  locationId: ['location_id', 'locationId']
};

// Sub-objects that describe the business or the workflow, not the lead.
const SKIP_OBJECTS = new Set(['location', 'user', 'workflow', 'attributionsource', 'lastattributionsource', 'triggerdata']);

function normKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cleanValue(value) {
  if (value === null || value === undefined || typeof value === 'object') return '';
  const text = String(value).trim();
  // An unfilled GHL merge tag arrives as literal "{{contact.something}}".
  if (!text || text.includes('{{')) return '';
  return text;
}

function parseBody(body) {
  if (!body) return {};
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch (e) {
      return Object.fromEntries(new URLSearchParams(body));
    }
  }
  return typeof body === 'object' ? body : {};
}

// Flattens the payload into normalized-key -> value. Values set explicitly in
// customData win over the default contact payload.
function collect(body) {
  const map = new Map();
  const add = (obj, depth) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    for (const [key, value] of Object.entries(obj)) {
      const nk = normKey(key);
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (depth < 2 && !SKIP_OBJECTS.has(nk)) add(value, depth + 1);
        continue;
      }
      const text = cleanValue(value);
      if (text && !map.has(nk)) map.set(nk, text);
    }
  };
  add(body.customData, 1);
  add(body.custom_data, 1);
  add(body, 0);
  return map;
}

function pick(map, names) {
  for (const name of names) {
    const value = map.get(normKey(name));
    if (value) return value;
  }
  return '';
}

function toNumber(text) {
  if (text === '' || text === null || text === undefined) return null;
  const n = Number(String(text).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) && String(text).match(/\d/) ? n : null;
}

function readLead(rawBody) {
  const body = parseBody(rawBody);
  const map = collect(body);
  const get = (field) => pick(map, FIELDS[field]);

  const lead = {
    contactId: get('contactId'),
    email: get('email'),
    firstName: get('firstName'),
    lastName: get('lastName'),
    fullName: get('fullName'),
    phone: get('phone'),
    childAge: toNumber(get('childAge')),
    collegeStartYear: toNumber(get('collegeStartYear')),
    currentSavings: toNumber(get('currentSavings')),
    monthly: toNumber(get('monthly')),
    schoolType: get('schoolType'),
    concern: get('concern'),
    fundingScore: toNumber(get('fundingScore')),
    locationId: get('locationId') || cleanValue(body.location && body.location.id),
    receivedKeys: Object.keys(body).slice(0, 60),
    notes: []
  };
  // In the standard Webhook payload the contact's own id can also be "id".
  if (!lead.contactId && body.contact && cleanValue(body.contact.id)) lead.contactId = cleanValue(body.contact.id);
  return lead;
}

// Fills whatever the webhook left out from the GHL contact record.
// customFieldDefs comes from GET /locations/{id}/customFields.
function mergeContact(lead, contact, customFieldDefs) {
  if (!contact) return;
  lead.email = lead.email || cleanValue(contact.email);
  lead.firstName = lead.firstName || cleanValue(contact.firstName);
  lead.lastName = lead.lastName || cleanValue(contact.lastName);
  lead.phone = lead.phone || cleanValue(contact.phone);

  const byId = new Map((customFieldDefs || []).map((d) => [d.id, d]));
  const map = new Map();
  for (const cf of contact.customFields || contact.customField || []) {
    const def = byId.get(cf.id);
    const text = cleanValue(Array.isArray(cf.value) ? cf.value.join(', ') : cf.value);
    if (!def || !text) continue;
    map.set(normKey(def.name), text);
    if (def.fieldKey) map.set(normKey(String(def.fieldKey).replace(/^contact\./, '')), text);
  }
  const get = (field) => pick(map, FIELDS[field]);
  if (lead.childAge === null) lead.childAge = toNumber(get('childAge'));
  if (lead.collegeStartYear === null) lead.collegeStartYear = toNumber(get('collegeStartYear'));
  if (lead.currentSavings === null) lead.currentSavings = toNumber(get('currentSavings'));
  if (lead.monthly === null) lead.monthly = toNumber(get('monthly'));
  if (!lead.schoolType) lead.schoolType = get('schoolType');
  if (!lead.concern) lead.concern = get('concern');
  if (lead.fundingScore === null) lead.fundingScore = toNumber(get('fundingScore'));
}

// Child age can also be worked out from the college start year the page sent
// (start year = 2026 + years until college, years = 18 - age).
function resolveAge(lead) {
  if (lead.childAge !== null) return lead.childAge;
  if (lead.collegeStartYear !== null) {
    const years = lead.collegeStartYear - START_YEAR;
    if (years >= 1 && years <= 18) return 18 - years;
  }
  return null;
}

// What is still missing before a report can be built and sent.
// GHL sending needs the contact id; Gmail sending needs the lead's email.
function missingInputs(lead, sender) {
  const missing = [];
  if (sender === 'ghl' && !lead.contactId) missing.push('contact_id');
  if (sender === 'gmail' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email || '')) missing.push('email');
  if (resolveAge(lead) === null) missing.push('child_age');
  if (costFromSchoolType(lead.schoolType) === null) missing.push('school_type');
  if (lead.currentSavings === null) missing.push('current_savings');
  if (lead.monthly === null) missing.push('monthly_contribution');
  return missing;
}

module.exports = {
  readLead,
  mergeContact,
  missingInputs,
  resolveAge
};
