'use strict';

// Every word that appears in the PDF report and in the email lives in this
// file. The wording is copied from the landing page (index.html) and from the
// existing GHL report email, so edit it here only after the insurance
// carrier's compliance team has approved the change.
//
// In the PDF, text wrapped in **double asterisks** is printed in bold.

const BRAND = {
  company: 'BrightPath Legacy Wealth Corporation',
  wordmark: ['BRIGHT', 'PATH', 'LEGACY WEALTH'],
  tagline: 'Empowering Every Child’s Financial Future from Birth and Beyond',
  phone: '(301) 872-1151',
  phoneHref: 'tel:+13018721151',
  email: 'brightpathlegacywealth@gmail.com',
  bookingUrl: 'https://api.leadconnectorhq.com/widget/booking/WKn9IvfaxeIQOS0QH7Up'
};

const REPORT = {
  title: 'Your College Funding Showdown Report',
  intro: 'Thank you for completing the College Funding Showdown analysis.\nBelow is your personalized trajectory breakdown and 3-way showdown comparison.',
  scorecardLabel: 'YOUR TRAJECTORY SCORECARD',
  statusDesc: 'Your current trajectory leaves you exposed to market drops and tuition inflation shortfalls.',
  stats: {
    target: 'TARGET COST',
    savings: 'EST. SAVINGS',
    gap: 'FUNDING GAP'
  },
  inputsTitle: 'YOUR CALCULATOR INPUTS',
  assumptions: '*This is a hypothetical illustration based on an assumed 6.0% illustrative annual rate of return (compounded monthly) and 3.5% yearly college-cost inflation. It is not a guarantee of future performance. Actual values will vary.',
  // {year} {cost} {saved} {gap} are filled in with the visitor's numbers.
  summary: '**Analysis Summary:** For your child starting college in {year}, projected 4-year tuition benchmark is {cost}. At your planned savings rate, you are projected to accumulate {saved}, leaving a projected funding gap of {gap}. Below is your complete side-by-side evaluation of how Traditional 529s and other savings plans, Trump Accounts, and the Flexible Life Insurance Option address this gap.',
  curiosity: '**Curiosity Insight:** Did you know cash-value life insurance is completely exempt from the FAFSA financial aid formula, while 529s and other college saving plans, including Trump Accounts, are counted as parental assets (assessed up to 5.64%/yr against student aid)?',
  footnote: '*This is a hypothetical illustration based on an assumed 6.0% illustrative annual rate of return. It is not a guarantee of future performance. Actual values will vary.',
  showdownTitle: 'The 3-Way Showdown Evaluation',
  showdownSubtitle: 'Traditional 529 / ESA vs. Trump Account vs. Flexible Life Insurance Option'
};

// Readiness bands, same cut-offs as the landing page scale.
const SEGMENTS = [
  { from: 0, to: 49, range: '0 - 49', name: 'Critical Gap', colors: ['#b91c1c', '#ef4444'] },
  { from: 50, to: 69, range: '50 - 69', name: 'Action Needed', colors: ['#d97706', '#f59e0b'] },
  { from: 70, to: 84, range: '70 - 84', name: 'On Track', colors: ['#0284c7', '#00b8d4'] },
  { from: 85, to: 100, range: '85 - 100', name: 'Fully Shielded', colors: ['#059669', '#10b981'] }
];

// Status wording shown next to the score on the landing page.
function readinessStatus(score) {
  if (score >= 85) return 'Excellent Readiness — College Savings Fully Shielded';
  if (score >= 70) return 'Moderate Readiness — Optimization Opportunity';
  if (score >= 50) return 'Needs Action — Noticeable Funding Gap Identified';
  return 'Critical Action Needed — Significant College Funding Gap';
}

// "Biggest concern" dropdown: the page sends the value, the PDF shows the label.
const CONCERNS = {
  'Financial Aid Impact': 'Losing Financial Aid/FAFSA eligibility due to 529 Assets and other College Saving Plans',
  'Market Risk': 'Market volatility wiping out savings right before college',
  'Non-College Penalties': 'Penalties/taxes if child gets a scholarship or skips college',
  'Not Saving Enough': 'Falling short of high future tuition bills',
  'Lack of Flexibility': 'Wanting funds to also be usable for a home, business, or life'
};

// The 3-way comparison table from the landing page.
const TABLE = {
  columns: ['Decision Criteria', '1. Traditional 529 / ESA', '2. Trump Account', '3. Flexible Life Insurance Option'],
  rows: [
    {
      criteria: 'Contribution Limits',
      plan529: 'High state maximums ($300k-$500k aggregate), subject to federal gift tax limits.',
      trump: 'Strict government annual statutory cap ($5,000/yr). Strict eligibility rules.',
      flexible: 'Flexible funding structured to parent’s cash flow & capacity.'
    },
    {
      criteria: 'Tax-Deferred Growth & Distributions',
      plan529: 'Tax-free only for IRS-qualified education expenses.',
      trump: 'Tax-advantaged for authorized educational/training uses only.',
      flexible: 'Tax-free cash-value growth & tax-free distributions via policy loans.'
    },
    {
      criteria: 'FAFSA Financial Aid Impact',
      plan529: 'Counted as parental asset (assessed up to 5.64%/yr against student aid).',
      trump: 'Expected to be counted as student/parent asset, potentially reducing aid.',
      flexible: '**100% EXEMPT from FAFSA formula.** Does not reduce financial aid.'
    },
    {
      criteria: 'Market Downside Protection',
      plan529: 'No downside protection. Market crashes right before college can severely cut savings.',
      trump: 'Exposed to underlying federal investment portfolio risks.',
      flexible: '**Zero Downside Risk.** Guaranteed annual floor protects all principal & gains.'
    },
    {
      criteria: 'Withdrawal Restrictions',
      plan529: 'Strict. 10% federal penalty + income tax on earnings if used for non-college purposes.',
      trump: 'Rigid rules on qualifying expenses and approved institutions.',
      flexible: '**Unrestricted.** Use for college, first home, business launch, or emergencies, and Life Events.'
    },
    {
      criteria: 'Non-College Flexibility',
      plan529: 'Rigid. Can roll up to $35k to Roth IRA (after 15 yrs) or change beneficiary to family.',
      trump: 'Locked into statutory career/education program rules.',
      flexible: '**Full Ownership.** Parent owns and has control at all times. Child gets a lifetime financial asset with no penalties.'
    },
    {
      criteria: 'Family Protection & Death Benefit',
      plan529: 'None. Account balance only. If parent passes, funding ceases.',
      trump: 'None. No life insurance protection component.',
      flexible: '**Self-Completing.** Substantial tax-free death benefit ensures college is funded.'
    },
    {
      criteria: 'Creditor & Asset Protection',
      plan529: 'Varies widely by state statute; limited federal bankruptcy protection.',
      trump: 'Subject to statutory federal limits.',
      flexible: 'High statutory protection in most states for life insurance cash value.'
    },
    {
      criteria: 'Tax-Free Policy Loans & Liquidity',
      plan529: 'Not permitted. Cannot borrow against a 529 account.',
      trump: 'Not permitted. Funds locked until distribution eligibility.',
      flexible: 'Access cash value anytime via policy loans without IRS qualification triggers.'
    },
    {
      criteria: 'Generational Wealth Transfer',
      plan529: 'Limited to changing account beneficiary across generations.',
      trump: 'Strict beneficiary distribution rules upon maturity.',
      flexible: 'Transfers wealth income-tax-free to heirs via death benefit.'
    }
  ]
};

// Specialist call-to-action, worded like the existing GHL report email.
const SPECIALIST = {
  title: 'Review Your Score with a Licensed Specialist',
  text: 'Discover how to eliminate your projected funding shortfall while safeguarding your financial aid eligibility and shielding your assets from stock market losses.',
  button: 'Schedule My Strategy Review',
  finePrint: '100% Free Consultation • Zero Obligation • Licensed Professionals'
};

const DISCLOSURES = {
  title: 'Required Compliance & Illustrative Disclosures',
  paragraphs: [
    '**Hypothetical Illustration Notice:** This comparison and calculator tool provide hypothetical illustrations based on an assumed 6.0% illustrative annual rate of return. It is not a guarantee of future performance. Actual policy values and growth will vary based on premiums paid, policy charges, cost of insurance, and actual (non-guaranteed) performance. See your carrier’s official policy illustration for guaranteed and non-guaranteed values.',
    '**Non-Guaranteed Features & Advice Limitation:** BrightPath Legacy Wealth Corporation professionals hold insurance licenses. This campaign and report are governed by state insurance advertising rules (following NAIC Life Insurance Illustrations and Advertisements Regulations) and evaluate general structural features — flexibility, access, control, and tax treatment — rather than investment performance. This material does not constitute securities, investment, tax, or legal advice.',
    '**Tax Law & State Specificity:** Federal and state tax laws, Trump Account statutory frameworks, 529 plan rules, and FAFSA guidelines are subject to legislative change. Tax-free distributions from life insurance assume the policy remains in force and is not a Modified Endowment Contract (MEC). Consult your qualified tax professional and licensed advisor for personalized guidance.'
  ],
  // Same sentence as the footer of the existing GHL report email.
  general: 'This material is for informational and educational purposes only and does not constitute tax, investment, or legal advice. BrightPath Legacy Wealth Corporation professionals hold state insurance licenses.'
};

const EMAIL = {
  // Same subject line as the existing GHL report email.
  subject: 'Your 3-Way College Funding Showdown Report & Analysis',
  heading: 'Your College Funding Showdown Report is Ready',
  intro: 'Thank you for completing the College Funding Showdown analysis. Your complete personalized report is attached to this email as a PDF. Here is a quick look at your results:',
  afterScore: 'Open the attached PDF for your full trajectory breakdown and the complete 3-way showdown comparison of Traditional 529s, Trump Accounts, and the Flexible Life Insurance Option.',
  linkFallback: 'Can’t see the attachment?',
  linkText: 'Download your report here',
  questions: 'Have questions or need immediate guidance? Call us directly at {phone} or reply directly to this email.',
  signOff: 'Warm regards,'
};

module.exports = {
  BRAND,
  REPORT,
  SEGMENTS,
  readinessStatus,
  CONCERNS,
  TABLE,
  SPECIALIST,
  DISCLOSURES,
  EMAIL
};
