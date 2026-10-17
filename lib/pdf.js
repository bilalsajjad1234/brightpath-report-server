'use strict';

const PDFDocument = require('pdfkit');
const LOGO = require('./logo');
const { BRAND, REPORT, SEGMENTS, TABLE, SPECIALIST, DISCLOSURES } = require('./content');
const { formatMoney } = require('./calc');

// Brand colors from the landing page CSS variables.
const COLOR = {
  navy: '#062a4d',
  navyDark: '#041426',
  navyMid: '#0a3a6b',
  gold: '#d4a034',
  goldLight: '#f3c04a',
  goldPale: '#fcf7ed',
  cyan: '#029bbb',
  cyanBright: '#00b8d4',
  cyanText: '#5fe5fc',
  silver: '#e2edf7',
  greyLine: '#e1e7f0',
  greyText: '#485c72',
  offWhite: '#f5f8fc',
  white: '#ffffff',
  redSoft: '#f87171',
  muted: '#9fb3c8'
};

const PAGE_W = 612; // US Letter
const PAGE_H = 792;
const M = 42; // side margin
const CW = PAGE_W - M * 2; // content width
const TOP = 66; // content top on pages 2+ (below the slim header)
const BOTTOM = PAGE_H - 56; // content ends above the footer

// The built-in PDF fonts only cover the Windows-1252 character set, so any
// other character (emoji, non-Latin names) is simplified or dropped instead
// of printing as garbage.
const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';

function safe(value) {
  return Array.from(String(value === null || value === undefined ? '' : value).normalize('NFC'))
    .map((ch) => {
      const code = ch.codePointAt(0);
      if (ch === '\n' || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.includes(ch)) return ch;
      const plain = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      return /^[\x20-\x7e]+$/.test(plain) ? plain : '';
    })
    .join('');
}

// "**bold** normal" -> [{ text, bold }]
function parts(text) {
  return safe(text)
    .split('**')
    .map((t, i) => ({ text: t, bold: i % 2 === 1 }))
    .filter((p) => p.text);
}

function richHeight(doc, text, width, size, lineGap) {
  doc.font('Helvetica-Bold').fontSize(size);
  return doc.heightOfString(safe(text).replace(/\*\*/g, ''), { width, lineGap });
}

function richText(doc, text, x, y, width, o) {
  const segs = parts(text);
  doc.fontSize(o.size);
  segs.forEach((seg, i) => {
    doc.font(seg.bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(seg.bold ? o.boldColor || o.color : o.color);
    const opts = { width, lineGap: o.lineGap || 0, continued: i < segs.length - 1 };
    if (i === 0) doc.text(seg.text, x, y, opts);
    else doc.text(seg.text, opts);
  });
  doc.x = M;
  return doc.y;
}

function ensureSpace(doc, height) {
  if (doc.y + height > BOTTOM) doc.addPage();
}

function plural(n, word) {
  return n + ' ' + word + (n === 1 ? '' : 's');
}

// BRIGHT (silver) PATH (cyan) LEGACY WEALTH (gold), like the email header.
function wordmark(doc, x, y, size, centered) {
  const [bright, path, legacy] = BRAND.wordmark;
  const sp = size * 0.1;
  const small = size * 0.8;
  doc.font('Helvetica-Bold').fontSize(size);
  const w1 = doc.widthOfString(bright, { characterSpacing: sp }) + sp;
  const w2 = doc.widthOfString(path, { characterSpacing: sp });
  const gap = size * 0.55;
  doc.fontSize(small);
  const w3 = doc.widthOfString(legacy, { characterSpacing: sp * 0.8 });
  let cx = centered ? x - (w1 + w2 + gap + w3) / 2 : x;
  doc.fontSize(size).fillColor(COLOR.silver).text(bright, cx, y, { characterSpacing: sp, lineBreak: false });
  cx += w1;
  doc.fillColor(COLOR.cyanBright).text(path, cx, y, { characterSpacing: sp, lineBreak: false });
  cx += w2 + gap;
  doc.fontSize(small).fillColor(COLOR.gold).text(legacy, cx, y + size * 0.15, { characterSpacing: sp * 0.8, lineBreak: false });
}

function coverHeader(doc) {
  const h = 148;
  const bg = doc.linearGradient(0, 0, PAGE_W, h);
  bg.stop(0, COLOR.navyDark).stop(0.65, '#06213f').stop(1, COLOR.navy);
  doc.rect(0, 0, PAGE_W, h).fill(bg);

  const lw = 104;
  const lh = (lw * 304) / 400;
  const lx = (PAGE_W - lw) / 2;
  const ly = 15;
  doc.save();
  doc.roundedRect(lx, ly, lw, lh, 7).clip();
  doc.image(LOGO, lx, ly, { width: lw, height: lh });
  doc.restore();

  wordmark(doc, PAGE_W / 2, ly + lh + 11, 15, true);
  doc
    .font('Helvetica-Oblique')
    .fontSize(9.5)
    .fillColor(COLOR.muted)
    .text(safe(BRAND.tagline), M, ly + lh + 33, { width: CW, align: 'center', lineBreak: false });
  doc.rect(0, h, PAGE_W, 2.5).fill(COLOR.gold);
  return h + 2.5;
}

function slimHeader(doc, r) {
  doc.rect(0, 0, PAGE_W, 40).fill(COLOR.navyDark);
  doc.rect(0, 40, PAGE_W, 2).fill(COLOR.gold);
  wordmark(doc, M, 14, 11, false);
  const who = r.name.length > 34 ? r.name.slice(0, 33) + '…' : r.name;
  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor(COLOR.muted)
    .text(safe('College Funding Showdown Report  •  ' + who), M, 16, { width: CW, align: 'right', lineBreak: false });
}

function statusColor(score) {
  if (score >= 85) return '#34d399';
  if (score >= 70) return '#38d0ef';
  if (score >= 50) return '#fbbf24';
  return COLOR.redSoft;
}

// The 4-band readiness bar with the "My Score" pointer.
function scaleBar(doc, score, x, y, w) {
  const trackY = y + 24;
  const trackH = 26;
  doc.save();
  doc.roundedRect(x, trackY, w, trackH, 7).clip();
  let sx = x;
  SEGMENTS.forEach((s) => {
    const sw = (w * ((s.to === 100 ? 100 : s.to + 1) - s.from)) / 100;
    const g = doc.linearGradient(sx, trackY, sx + sw, trackY);
    g.stop(0, s.colors[0]).stop(1, s.colors[1]);
    doc.rect(sx, trackY, sw, trackH).fill(g);
    doc.font('Helvetica').fontSize(6.6).fillColor(COLOR.white).text(s.range, sx, trackY + 4.2, { width: sw, align: 'center', lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(7.4).text(s.name, sx, trackY + 13.6, { width: sw, align: 'center', lineBreak: false });
    sx += sw;
  });
  SEGMENTS.slice(1).forEach((s) => {
    const lx = x + (w * s.from) / 100;
    doc.rect(lx - 0.6, trackY, 1.2, trackH).fill(COLOR.navyDark);
  });
  doc.restore();

  // "My Score" bubble whose arrow touches the track at the score position.
  const pos = Math.max(1.5, Math.min(98.5, score));
  const px = x + (w * pos) / 100;
  const label = 'My Score: ' + score;
  doc.font('Helvetica-Bold').fontSize(8.2);
  const bw = doc.widthOfString(label) + 16;
  const bh = 16;
  const bx = Math.min(Math.max(px - bw / 2, x - 4), x + w - bw + 4);
  doc.roundedRect(bx, y, bw, bh, 8).fill(COLOR.goldLight);
  doc.polygon([px - 5, y + bh - 0.5], [px + 5, y + bh - 0.5], [px, trackY + 1]).fill(COLOR.goldLight);
  doc.fillColor(COLOR.navyDark).text(label, bx, y + 4.6, { width: bw, align: 'center', lineBreak: false });
}

function statBoxes(doc, r, x, y, w) {
  const gap = 12;
  const bw = (w - gap * 2) / 3;
  const bh = 56;
  const covered = Math.round(r.gap) === 0;
  const items = [
    { label: REPORT.stats.target, value: formatMoney(r.targetCost), color: COLOR.white, bg: '#0c2a4a', border: '#1f4a78' },
    { label: REPORT.stats.savings, value: formatMoney(r.totalProjected), color: COLOR.cyanBright, bg: '#0c2a4a', border: '#1f4a78' },
    covered
      ? { label: REPORT.stats.gap, value: formatMoney(r.gap), color: '#34d399', bg: '#0b3a35', border: '#1f6f5c' }
      : { label: REPORT.stats.gap, value: formatMoney(r.gap), color: COLOR.redSoft, bg: '#3b1a2b', border: '#8b3346' }
  ];
  items.forEach((it, i) => {
    const bx = x + i * (bw + gap);
    doc.roundedRect(bx, y, bw, bh, 8).fill(it.bg);
    doc.roundedRect(bx + 0.5, y + 0.5, bw - 1, bh - 1, 8).lineWidth(0.8).strokeColor(it.border).stroke();
    doc.font('Helvetica-Bold').fontSize(8.2).fillColor(COLOR.muted).text(it.label, bx, y + 12, { width: bw, align: 'center', characterSpacing: 0.9, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(18).fillColor(it.color).text(it.value, bx, y + 27, { width: bw, align: 'center', lineBreak: false });
  });
}

function scorecard(doc, r, y) {
  const x = M;
  const w = CW;
  const h = 232;
  const bg = doc.linearGradient(x, y, x + w, y + h);
  bg.stop(0, COLOR.navyDark).stop(0.6, COLOR.navy).stop(1, COLOR.navyMid);
  doc.roundedRect(x, y, w, h, 12).fill(bg);
  doc.roundedRect(x + 0.6, y + 0.6, w - 1.2, h - 1.2, 12).lineWidth(1.2).strokeColor(COLOR.gold).stroke();

  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(COLOR.gold).text(REPORT.scorecardLabel, x, y + 18, { width: w, align: 'center', characterSpacing: 1.6, lineBreak: false });

  const a = 'Readiness Score: ';
  const b = r.score + ' / 100';
  doc.font('Helvetica-Bold').fontSize(16);
  const wa = doc.widthOfString(a);
  const sx = x + (w - wa - doc.widthOfString(b)) / 2;
  doc.fillColor(COLOR.white).text(a, sx, y + 38, { lineBreak: false });
  doc.fillColor(COLOR.goldLight).text(b, sx + wa, y + 38, { lineBreak: false });

  doc.font('Helvetica-Bold').fontSize(11).fillColor(statusColor(r.score)).text(safe(r.status), x + 20, y + 62, { width: w - 40, align: 'center', lineBreak: false });
  doc.font('Helvetica').fontSize(8.8).fillColor('#c3d1df').text(safe(REPORT.statusDesc), x + 20, y + 79, { width: w - 40, align: 'center', lineBreak: false });

  scaleBar(doc, r.score, x + 26, y + 102, w - 52);
  statBoxes(doc, r, x + 20, y + 160, w - 40);
  return y + h;
}

function inputsCard(doc, r, y) {
  const pad = 14;
  const colW = (CW - pad * 2 - 16) / 2;
  const age = r.age === 0 ? 'Under 1 year old' : plural(r.age, 'year') + ' old';
  const rows = [
    [
      ['Child’s Age', age],
      ['College Start Year', r.startYear + ' (' + plural(r.years, 'year') + ' away)']
    ],
    [
      ['Current Savings', formatMoney(r.currentSavings)],
      ['Monthly Contribution', formatMoney(r.monthly) + '/mo']
    ],
    [['College Benchmark', r.school]]
  ];
  if (r.concern) rows.push([['Biggest Concern', r.concern]]);
  const cellText = ([label, value]) => label + ': **' + String(value).replace(/\*/g, '') + '**';

  const size = 9;
  const heights = rows.map((row) => Math.max(...row.map((c) => richHeight(doc, cellText(c), row.length === 1 ? CW - pad * 2 : colW, size, 1))));
  doc.font('Helvetica-Oblique').fontSize(7.6);
  const noteH = doc.heightOfString(safe(REPORT.assumptions), { width: CW - pad * 2 });
  const h = pad + 13 + heights.reduce((s, v) => s + v + 5, 0) + 3 + noteH + pad;

  doc.roundedRect(M, y, CW, h, 9).fill(COLOR.offWhite);
  doc.roundedRect(M + 0.5, y + 0.5, CW - 1, h - 1, 9).lineWidth(0.8).strokeColor(COLOR.greyLine).stroke();
  doc.rect(M, y + 10, 3, h - 20).fill(COLOR.gold);

  doc.font('Helvetica-Bold').fontSize(8.3).fillColor(COLOR.navy).text(REPORT.inputsTitle, M + pad, y + pad, { width: CW - pad * 2, characterSpacing: 1, lineBreak: false });
  let cy = y + pad + 15;
  rows.forEach((row, i) => {
    row.forEach((cell, j) => {
      const cx = M + pad + j * (colW + 16);
      richText(doc, cellText(cell), cx, cy, row.length === 1 ? CW - pad * 2 : colW, { size, color: COLOR.greyText, boldColor: COLOR.navy, lineGap: 1 });
    });
    cy += heights[i] + 5;
  });
  doc.font('Helvetica-Oblique').fontSize(7.6).fillColor('#6b7f95').text(safe(REPORT.assumptions), M + pad, cy + 2, { width: CW - pad * 2 });
  doc.x = M;
  return y + h;
}

function noteBox(doc, text, y, style) {
  const pad = 13;
  const size = 9.2;
  const h = richHeight(doc, text, CW - pad * 2 - 4, size, 2) + pad * 2;
  if (y + h > BOTTOM) {
    doc.addPage();
    y = doc.y;
  }
  doc.roundedRect(M, y, CW, h, 8).fill(style.bg);
  if (style.border) doc.roundedRect(M + 0.5, y + 0.5, CW - 1, h - 1, 8).lineWidth(0.8).strokeColor(style.border).stroke();
  if (style.bar) doc.rect(M, y, 3.5, h).fill(style.bar);
  richText(doc, text, M + pad + 4, y + pad, CW - pad * 2 - 4, { size, color: COLOR.navy, boldColor: COLOR.navy, lineGap: 2 });
  return y + h;
}

function sectionTitle(doc, title, subtitle) {
  ensureSpace(doc, 120);
  const y = doc.y;
  doc.font('Helvetica-Bold').fontSize(16).fillColor(COLOR.navy).text(safe(title), M, y, { width: CW });
  doc.font('Helvetica').fontSize(9.3).fillColor(COLOR.greyText).text(safe(subtitle), M, doc.y + 2, { width: CW });
  const lineY = doc.y + 6;
  doc.rect(M, lineY, 46, 2.5).fill(COLOR.gold);
  doc.x = M;
  doc.y = lineY + 14;
}

function checkMark(doc, x, y, color) {
  doc.save().lineWidth(1.7).lineCap('round').lineJoin('round').strokeColor(color).moveTo(x, y + 3.6).lineTo(x + 2.9, y + 6.6).lineTo(x + 8.2, y).stroke().restore();
}

function comparisonTable(doc) {
  const widths = [0.21, 0.25, 0.25, 0.29].map((f) => CW * f);
  const pad = 7;
  const size = 8.2;
  const lineGap = 1.3;
  const tick = 12;

  const header = () => {
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(8.6);
    const hh = Math.max(...TABLE.columns.map((c, i) => doc.heightOfString(safe(c), { width: widths[i] - pad * 2 }))) + pad * 2 + 3;
    let x = M;
    TABLE.columns.forEach((c, i) => {
      const highlight = i === 3;
      doc.rect(x, y, widths[i], hh).fill(highlight ? COLOR.navyDark : COLOR.navy);
      if (highlight) doc.rect(x, y, widths[i], 3).fill(COLOR.cyan);
      doc.font('Helvetica-Bold').fontSize(8.6).fillColor(highlight ? COLOR.cyanText : COLOR.white).text(safe(c), x + pad, y + pad + 2, { width: widths[i] - pad * 2 });
      x += widths[i];
    });
    doc.x = M;
    doc.y = y + hh;
  };

  header();
  TABLE.rows.forEach((row, ri) => {
    const cells = ['**' + row.criteria + '**', row.plan529, row.trump, row.flexible];
    const textW = (i) => widths[i] - pad * 2 - (i === 3 ? tick : 0);
    const rh = Math.max(...cells.map((t, i) => richHeight(doc, t, textW(i), size, lineGap))) + pad * 2;
    if (doc.y + rh > BOTTOM) {
      doc.addPage();
      header();
    }
    const y = doc.y;
    const zebra = ri % 2 === 1;
    let x = M;
    cells.forEach((t, i) => {
      const highlight = i === 3;
      doc.rect(x, y, widths[i], rh).fill(highlight ? (zebra ? '#e7f3f7' : '#eff8fb') : zebra ? COLOR.offWhite : COLOR.white);
      if (highlight) checkMark(doc, x + pad, y + pad + 1.2, COLOR.cyan);
      richText(doc, t, x + pad + (highlight ? tick : 0), y + pad, textW(i), {
        size,
        color: i === 0 || highlight ? COLOR.navy : COLOR.greyText,
        boldColor: COLOR.navy,
        lineGap
      });
      x += widths[i];
    });
    const hx = M + widths[0] + widths[1] + widths[2];
    doc.lineWidth(1.1).strokeColor('#a6d9e5');
    doc.moveTo(hx, y).lineTo(hx, y + rh).stroke();
    doc.moveTo(hx + widths[3], y).lineTo(hx + widths[3], y + rh).stroke();
    doc.lineWidth(0.6).strokeColor(COLOR.greyLine).moveTo(M, y + rh).lineTo(M + CW, y + rh).stroke();
    doc.x = M;
    doc.y = y + rh;
  });
  doc.y += 16;
}

function arrow(doc, x, cy, color) {
  doc.save().lineWidth(1.6).lineCap('round').lineJoin('round').strokeColor(color).moveTo(x, cy).lineTo(x + 11, cy).moveTo(x + 7, cy - 4).lineTo(x + 11, cy).lineTo(x + 7, cy + 4).stroke().restore();
}

function specialistCard(doc) {
  const h = 136;
  ensureSpace(doc, h + 10);
  const x = M;
  const y = doc.y;
  const w = CW;
  const bg = doc.linearGradient(x, y, x + w, y + h);
  bg.stop(0, COLOR.navy).stop(1, COLOR.navyDark);
  doc.roundedRect(x, y, w, h, 12).fill(bg);
  doc.roundedRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5, 12).lineWidth(1.5).strokeColor(COLOR.gold).stroke();

  doc.font('Helvetica-Bold').fontSize(15).fillColor(COLOR.white).text(safe(SPECIALIST.title), x + 20, y + 20, { width: w - 40, align: 'center', lineBreak: false });
  doc.font('Helvetica').fontSize(9.4).fillColor('#c3d1df').text(safe(SPECIALIST.text), x + 60, y + 43, { width: w - 120, align: 'center', lineGap: 1.5 });

  const label = safe(SPECIALIST.button);
  doc.font('Helvetica-Bold').fontSize(10.5);
  const tw = doc.widthOfString(label);
  const bw = tw + 58;
  const bh = 28;
  const bx = x + (w - bw) / 2;
  const by = y + 84;
  const btn = doc.linearGradient(bx, by, bx, by + bh);
  btn.stop(0, COLOR.goldLight).stop(1, COLOR.gold);
  doc.roundedRect(bx, by, bw, bh, 14).fill(btn);
  doc.fillColor(COLOR.navyDark).text(label, bx + 21, by + 9.3, { lineBreak: false });
  arrow(doc, bx + 21 + tw + 9, by + bh / 2, COLOR.navyDark);
  doc.link(bx, by, bw, bh, BRAND.bookingUrl);

  doc.font('Helvetica').fontSize(7.8).fillColor(COLOR.muted).text(safe(SPECIALIST.finePrint), x, by + bh + 9, { width: w, align: 'center', lineBreak: false });
  doc.x = M;
  doc.y = y + h + 14;
}

function contactLine(doc) {
  ensureSpace(doc, 34);
  const y = doc.y;
  doc.font('Helvetica').fontSize(9.4).fillColor(COLOR.greyText).text('Have questions or need immediate guidance? Call us directly at ', M, y, { width: CW, continued: true });
  doc.font('Helvetica-Bold').fillColor(COLOR.navy).text(BRAND.phone, { link: BRAND.phoneHref, continued: true });
  doc.font('Helvetica').fillColor(COLOR.greyText).text(' or email ', { link: null, continued: true });
  doc.font('Helvetica-Bold').fillColor(COLOR.navy).text(BRAND.email, { link: 'mailto:' + BRAND.email, continued: true });
  doc.font('Helvetica').fillColor(COLOR.greyText).text('.', { link: null });
  doc.x = M;
  doc.y += 14;
}

function disclosures(doc) {
  ensureSpace(doc, 90);
  doc.moveTo(M, doc.y).lineTo(M + CW, doc.y).lineWidth(0.6).strokeColor(COLOR.greyLine).stroke();
  doc.y += 10;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR.navy).text(safe(DISCLOSURES.title.toUpperCase()), M, doc.y, { width: CW, characterSpacing: 0.6 });
  doc.y += 5;
  DISCLOSURES.paragraphs.concat(DISCLOSURES.general).forEach((p) => {
    ensureSpace(doc, richHeight(doc, p, CW, 7.5, 1.5) + 6);
    richText(doc, p, M, doc.y, CW, { size: 7.5, color: COLOR.greyText, boldColor: COLOR.navy, lineGap: 1.5 });
    doc.y += 6;
  });
}

function footers(doc) {
  const range = doc.bufferedPageRange();
  const year = new Date().getFullYear();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const keep = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = PAGE_H - 36;
    doc.moveTo(M, y - 9).lineTo(PAGE_W - M, y - 9).lineWidth(0.6).strokeColor(COLOR.greyLine).stroke();
    doc.font('Helvetica').fontSize(7.3).fillColor('#7a8ba0');
    doc.text(safe('© ' + year + ' ' + BRAND.company + '  •  ' + BRAND.phone + '  •  ' + BRAND.email), M, y, { width: CW - 70, lineBreak: false });
    doc.text('Page ' + (i + 1) + ' of ' + range.count, M, y, { width: CW, align: 'right', lineBreak: false });
    doc.page.margins.bottom = keep;
  }
}

// Builds the full report and resolves with the PDF bytes.
function buildReportPdf(r) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: TOP, bottom: PAGE_H - BOTTOM, left: M, right: M },
      bufferPages: true,
      info: {
        Title: safe('College Funding Showdown Report — ' + r.name),
        Author: BRAND.company,
        Subject: '3-Way College Funding Showdown Report',
        Creator: BRAND.company
      }
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.on('pageAdded', () => {
      slimHeader(doc, r);
      doc.x = M;
      doc.y = TOP;
    });

    try {
      let y = coverHeader(doc) + 20;
      doc.font('Helvetica-Bold').fontSize(19).fillColor(COLOR.navy).text(safe(REPORT.title), M, y, { width: CW });
      richText(doc, 'Prepared for: **' + r.name.replace(/\*/g, '') + '**  •  ' + r.dateLabel, M, doc.y + 3, CW, {
        size: 10,
        color: COLOR.greyText,
        boldColor: COLOR.navy
      });
      doc.font('Helvetica').fontSize(9.6).fillColor(COLOR.greyText).text(safe(REPORT.intro), M, doc.y + 8, { width: CW, lineGap: 2 });

      y = scorecard(doc, r, doc.y + 14);
      y = inputsCard(doc, r, y + 14);
      const summary = REPORT.summary
        .replace('{year}', r.startYear)
        .replace('{cost}', formatMoney(r.targetCost))
        .replace('{saved}', formatMoney(r.totalProjected))
        .replace('{gap}', formatMoney(r.gap));
      noteBox(doc, summary, y + 12, { bg: COLOR.goldPale, border: '#e8c983' });

      // Page 2: the comparison table on its own page.
      doc.addPage();
      sectionTitle(doc, REPORT.showdownTitle, REPORT.showdownSubtitle);
      comparisonTable(doc);

      // Page 3: insight, specialist call-to-action, contact and disclosures.
      if (doc.y > TOP + 1) doc.addPage();
      doc.y = noteBox(doc, REPORT.curiosity, doc.y, { bg: '#e8f6fa', bar: COLOR.cyan }) + 16;
      specialistCard(doc);
      contactLine(doc);
      disclosures(doc);

      footers(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { buildReportPdf, safe };
