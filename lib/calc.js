'use strict';

// Same math as calculateShowdown() on the landing page (index.html), so the
// PDF shows exactly the numbers the visitor saw on screen. If the formula on
// the page changes, change it here too.

const START_YEAR = 2026; // the page counts the college start year from 2026
const COLLEGE_INFLATION = 0.035; // 3.5% yearly tuition inflation
const RATE = 0.06; // 6.0% illustrative annual return
const MIN_MONTHLY = 150; // the page's monthly slider starts at $150
const DEFAULT_COST = 110000;

const BENCHMARKS = [
  { cost: 110000, label: 'In-State 4-Year Public University ($110,000 total)' },
  { cost: 180000, label: 'Out-of-State 4-Year Public University ($180,000 total)' },
  { cost: 240000, label: 'Private 4-Year Non-Profit College ($240,000 total)' },
  { cost: 350000, label: 'Elite Private / Healthcare Pre-Med ($350,000 total)' }
];

// The School Type field holds the dropdown label, e.g.
// "Out-of-State 4-Year Public University ($180,000 total)".
function costFromSchoolType(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const money = text.match(/\$\s*([\d,]{5,})/);
  if (money) return Number(money[1].replace(/,/g, ''));
  if (/^\$?\s*[\d,]+(\.\d+)?$/.test(text)) {
    const n = Number(text.replace(/[^\d.]/g, ''));
    if (n >= 10000) return n;
  }
  const t = text.toLowerCase();
  if (/elite|pre-?med|healthcare/.test(t)) return 350000;
  if (/private/.test(t)) return 240000;
  if (/out[\s-]*of[\s-]*state/.test(t)) return 180000;
  if (/in[\s-]*state|public/.test(t)) return DEFAULT_COST;
  return null;
}

function schoolLabel(cost, fallback) {
  const match = BENCHMARKS.find((b) => b.cost === cost);
  if (match) return match.label;
  return fallback || formatMoney(cost) + ' total';
}

function calculateShowdown({ age, currentSavings, monthly, baseCost }) {
  const years = Math.max(1, 18 - age);
  const monthlyUsed = Math.max(MIN_MONTHLY, monthly || MIN_MONTHLY);
  const cost = baseCost || DEFAULT_COST;

  // Projected cost with 3.5% educational inflation
  const targetCost = cost * Math.pow(1 + COLLEGE_INFLATION, years);

  // Projected savings compounding at 6.0% annual rate
  const futureCurrentSavings = (currentSavings || 0) * Math.pow(1 + RATE, years);
  const rm = RATE / 12;
  const nMonths = years * 12;
  const futureMonthlySavings = monthlyUsed * ((Math.pow(1 + rm, nMonths) - 1) / rm);
  const totalProjected = futureCurrentSavings + futureMonthlySavings;

  const gap = Math.max(0, targetCost - totalProjected);
  const fundedRatio = Math.min(1.2, totalProjected / targetCost);

  // Scoring: funded ratio, time horizon, monthly commitment
  let score = Math.round(fundedRatio * 75 + Math.min(20, (monthlyUsed / 500) * 15) + Math.min(10, years));
  score = Math.max(20, Math.min(96, score));

  return {
    years,
    startYear: START_YEAR + years,
    monthlyUsed,
    targetCost,
    totalProjected,
    gap,
    score
  };
}

function formatMoney(n) {
  const rounded = Math.round(Number(n) || 0);
  const sign = rounded < 0 ? '-' : '';
  return sign + '$' + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

module.exports = {
  START_YEAR,
  BENCHMARKS,
  costFromSchoolType,
  schoolLabel,
  calculateShowdown,
  formatMoney
};
