'use strict';

// Builds sample reports so the PDF and email can be checked without GHL.
// Usage: node scripts/sample.js [outputDir]

const fs = require('fs');
const path = require('path');
const { readLead } = require('../lib/input');
const { reportFromLead } = require('../lib/report');
const { buildReportPdf } = require('../lib/pdf');
const { buildEmail } = require('../lib/email');

const SAMPLES = {
  moderate: {
    contact_id: 'sample-1',
    first_name: 'khalid',
    last_name: 'mehmood',
    email: 'sample@example.com',
    'Child Age': '7',
    'Current Savings': '15000',
    'Monthly Contribution': '450',
    'School Type': 'Out-of-State 4-Year Public University ($180,000 total)',
    'Biggest Concern': 'Market Risk'
  },
  critical: {
    contact_id: 'sample-2',
    first_name: 'Maria',
    last_name: 'González-Ramírez',
    email: 'sample2@example.com',
    customData: {
      child_age: '14',
      current_savings: '2000',
      monthly_contribution: '150',
      school_type: 'Elite Private / Healthcare Pre-Med ($350,000 total)',
      biggest_concern: 'Financial Aid Impact'
    }
  },
  excellent: {
    contact_id: 'sample-3',
    full_name: 'Jordan Lee',
    email: 'sample3@example.com',
    child_age: '0',
    current_savings: '$60,000',
    monthly_contribution: '1,500',
    school_type: 'In-State 4-Year Public University ($110,000 total)'
  }
};

async function main() {
  const outDir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
  fs.mkdirSync(outDir, { recursive: true });
  for (const [label, body] of Object.entries(SAMPLES)) {
    const report = reportFromLead(readLead(body));
    const pdf = await buildReportPdf(report);
    fs.writeFileSync(path.join(outDir, label + '.pdf'), pdf);
    const email = buildEmail(report, { reportUrl: 'https://example.com/report.pdf', logoUrl: 'logo.jpg' });
    fs.writeFileSync(path.join(outDir, label + '.html'), email.html);
    console.log(
      label.padEnd(10),
      'score', report.score,
      '| target', Math.round(report.targetCost),
      '| projected', Math.round(report.totalProjected),
      '| gap', Math.round(report.gap),
      '| pdf', (pdf.length / 1024).toFixed(0) + 'KB',
      '|', report.fileName
    );
  }
  fs.writeFileSync(path.join(outDir, 'logo.jpg'), require('../lib/logo'));
  console.log('written to', outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
