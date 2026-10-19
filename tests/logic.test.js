'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../public/logic.js');

const ids = (r) => r.findings.map((f) => f.id);
const find = (r, id) => r.findings.find((f) => f.id === id);

test('date arithmetic keeps month ends', () => {
  assert.equal(L.addMonths('2025-12-31', 12), '2026-12-31');
  assert.equal(L.addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(L.addMonths('2025-02-28', 12), '2026-02-28');
  assert.equal(L.addMonths('2024-02-29', 12), '2025-02-28');
  assert.equal(L.addMonths('2026-03-10', 12), '2027-03-10');
  assert.equal(L.addMonths('2026-03-10', -3), '2025-12-10');
  assert.equal(L.endOfMonth('2026-02-11'), '2026-02-28');
  assert.equal(L.daysBetween('2026-01-01', '2026-12-31'), 364);
  assert.equal(L.periodMonths('2025-01-01', '2025-12-31'), 12);
  assert.equal(L.periodMonths('2025-07-01', '2025-12-31'), 6);
  assert.equal(L.isDate('2025-02-30'), false);
});

test('§ 556 Abs. 3 BGB: statement deadline is the end of the 12th month after the period', () => {
  let d = L.deadlines('2025-01-01', '2025-12-31', '2026-12-31', '2027-01-05');
  assert.equal(d.billDue, '2026-12-31');
  assert.equal(d.late, false, 'received on the last day is on time');
  d = L.deadlines('2025-01-01', '2025-12-31', '2027-01-01', '2027-01-05');
  assert.equal(d.late, true, 'one day later is too late');
  // period ending mid-month: end of the calendar month 12 months later
  d = L.deadlines('2024-06-16', '2025-06-15', '2026-06-20', '2026-06-21');
  assert.equal(d.billDue, '2026-06-30');
  assert.equal(d.late, false);
  // period ending 30 June
  d = L.deadlines('2024-07-01', '2025-06-30', '2026-07-01', '2026-07-02');
  assert.equal(d.billDue, '2026-06-30');
  assert.equal(d.late, true);
});

test('§ 556 Abs. 3 BGB: period of at most 12 months', () => {
  assert.equal(L.deadlines('2025-01-01', '2025-12-31').tooLong, false);
  assert.equal(L.deadlines('2025-01-01', '2026-01-01').tooLong, true);
  assert.equal(L.deadlines('2025-07-01', '2026-06-30').tooLong, false);
  assert.equal(L.deadlines('2025-07-01', '2026-07-01').tooLong, true);
  assert.equal(L.deadlines('2025-03-01', '2025-08-31').tooLong, false, 'shorter periods are allowed');
  const r = L.analyze({ start: '2025-12-31', end: '2025-01-01' }, '2026-05-01');
  assert.ok(ids(r).includes('period_order'));
});

test('§ 556 Abs. 3 BGB: objection deadline 12 months after receipt (safe reading)', () => {
  let d = L.deadlines('2025-01-01', '2025-12-31', '2026-03-10', '2026-10-19');
  assert.equal(d.objectDue, '2027-03-10');
  assert.equal(d.objectExpired, false);
  assert.equal(d.objectDaysLeft, 142);
  d = L.deadlines('2024-01-01', '2024-12-31', '2025-03-10', '2026-03-11');
  assert.equal(d.objectExpired, true);
  d = L.deadlines('2024-01-01', '2024-12-31', '2025-03-10', '2026-03-10');
  assert.equal(d.objectExpired, false, 'the last day still counts');
});

test('late statement: the Nachzahlung is the amount at stake', () => {
  const r = L.analyze({ start: '2024-01-01', end: '2024-12-31', received: '2026-01-15', resultType: 'nach', resultAmount: '312,40' }, '2026-02-01');
  const f = find(r, 'bill_late');
  assert.equal(f.sev, 'error');
  assert.equal(f.amount, 312.4);
  assert.equal(r.totals.billLate, true);
  assert.equal(r.totals.reduction, 0, 'the late claim is not counted twice as a reduction');
  const g = L.analyze({ start: '2024-01-01', end: '2024-12-31', received: '2026-01-15', resultType: 'gut', resultAmount: '50' }, '2026-02-01');
  assert.equal(find(g, 'bill_late').amount, undefined, 'a refund (Guthaben) is still owed to the tenant');
  const n = L.analyze({ start: '2025-01-01', end: '2025-12-31' }, '2027-01-02');
  assert.ok(ids(n).includes('bill_missing_overdue'));
});

test('BetrKV: non-allowable items are errors with their amount, allowable ones are not', () => {
  for (const c of L.CATS) {
    const out = L.checkLine({ cat: c.id, share: '100' }, { end: '2025-12-31', months: 12, area: 0 }, 0);
    const no = out.find((f) => f.id.startsWith('cat_no_'));
    if (c.ok === 'no') {
      assert.ok(no, c.id + ' should be flagged');
      assert.equal(no.amount, 100);
      assert.ok(L.RULES[no.rule], c.id + ' cites a rule');
    } else assert.equal(no, undefined, c.id + ' should not be flagged');
  }
  for (const id of ['verwaltung', 'instand', 'bank', 'leerstand', 'ruecklage']) assert.equal(L.CAT[id].ok, 'no');
});

test('cable TV only after June 2024; sonstige needs the lease', () => {
  const ctx = (end) => ({ end, months: 12, area: 0 });
  assert.ok(L.checkLine({ cat: 'antenne', share: 80 }, ctx('2024-12-31'), 0).some((f) => f.id === 'cable_tv'));
  assert.ok(!L.checkLine({ cat: 'antenne', share: 80 }, ctx('2024-06-30'), 0).some((f) => f.id === 'cable_tv'));
  assert.ok(L.checkLine({ cat: 'sonstige', share: 20 }, ctx('2025-12-31'), 0).some((f) => f.id === 'needs_lease'));
});

test('Umlageschlüssel: share must equal total × mine / all', () => {
  const ctx = { end: '2025-12-31', months: 12, area: 0 };
  // 1200 € building, 60 of 600 m² -> 120 €
  assert.equal(L.checkLine({ cat: 'grundsteuer', total: '1.200,00', key: 'flaeche', all: 600, mine: 60, share: '120,00' }, ctx, 0).length, 0);
  assert.equal(L.checkLine({ cat: 'grundsteuer', total: 1200, key: 'flaeche', all: 600, mine: 60, share: 120.9 }, ctx, 0).length, 0, 'within 1 € tolerance');
  const over = L.checkLine({ cat: 'grundsteuer', total: 1200, key: 'flaeche', all: 600, mine: 60, share: 150 }, ctx, 0);
  const m = over.find((f) => f.id === 'share_mismatch');
  assert.equal(m.sev, 'error');
  assert.equal(m.p.expected, 120);
  assert.equal(m.amount, 30);
  const under = L.checkLine({ cat: 'grundsteuer', total: 1200, key: 'flaeche', all: 600, mine: 60, share: 100 }, ctx, 0);
  assert.equal(under.find((f) => f.id === 'share_mismatch').sev, 'info', 'paying less is not an objection');
  assert.ok(L.checkLine({ cat: 'muell', total: 900, key: 'personen', all: 3, mine: 4, share: 100 }, ctx, 0).some((f) => f.id === 'key_over'));
  assert.ok(L.checkLine({ cat: 'muell', total: 900, key: 'personen', all: 30, mine: 3, share: 90 }, ctx, 0).some((f) => f.id === 'key_persons'));
  assert.equal(L.checkLine({ cat: 'muell', total: 900, key: 'direkt', share: 123 }, ctx, 0).length, 0);
});

test('Wohnfläche must be the same on every line and match the flat', () => {
  const base = { start: '2025-01-01', end: '2025-12-31', area: '62' };
  let r = L.analyze({ ...base, lines: [{ cat: 'grundsteuer', key: 'flaeche', mine: 62 }, { cat: 'muell', key: 'flaeche', mine: 65 }] }, '2026-03-01');
  assert.ok(ids(r).includes('area_inconsistent'));
  r = L.analyze({ ...base, lines: [{ cat: 'grundsteuer', key: 'flaeche', mine: 68 }] }, '2026-03-01');
  assert.equal(find(r, 'area_differs').sev, 'error');
  r = L.analyze({ ...base, lines: [{ cat: 'grundsteuer', key: 'flaeche', mine: '62,0' }] }, '2026-03-01');
  assert.ok(!ids(r).includes('area_differs'));
});

test('Betriebskostenspiegel comparison flags only clearly high lines', () => {
  const ctx = { end: '2025-12-31', months: 12, area: 60 };
  // Grundsteuer avg 0.18 €/m²/month -> 60 m² × 12 × 0.18 = 129.60 €; flagged above 1.5×
  assert.ok(!L.checkLine({ cat: 'grundsteuer', share: 190 }, ctx, 0).some((f) => f.id === 'above_avg'));
  assert.ok(L.checkLine({ cat: 'grundsteuer', share: 200 }, ctx, 0).some((f) => f.id === 'above_avg'));
  // Heizung: compared with the top of the range (2.18)
  assert.ok(!L.checkLine({ cat: 'heizung', share: 1500 }, ctx, 0).some((f) => f.id === 'above_avg'));
  assert.ok(L.checkLine({ cat: 'heizung', share: 1600 }, ctx, 0).some((f) => f.id === 'above_avg'));
});

test('HeizkostenV: 50 to 70 %, 15 % cut, 3 % cut', () => {
  let h = L.checkHeating({ hkv: 'y', consBased: 'y', consPct: 80 }, {}, 1000, '2025-01-01');
  assert.ok(h.some((f) => f.id === 'hkv_pct' && f.sev === 'error'));
  h = L.checkHeating({ hkv: 'y', consBased: 'y', consPct: 45 }, {}, 1000, '2025-01-01');
  assert.ok(h.some((f) => f.id === 'hkv_pct'));
  h = L.checkHeating({ hkv: 'y', consBased: 'y', consPct: 70 }, {}, 1000, '2025-01-01');
  assert.equal(h.length, 0);
  h = L.checkHeating({ hkv: 'y', consBased: 'y', consPct: 50 }, {}, 1000, '2025-01-01');
  assert.ok(h.some((f) => f.id === 'hkv_pct70' && f.sev === 'info'));
  h = L.checkHeating({ hkv: 'y', consBased: 'n' }, {}, 1000, '2025-01-01');
  assert.equal(h.find((f) => f.id === 'hkv_flat').amount, 150);
  h = L.checkHeating({ hkv: 'y', remote: 'y', info: 'n' }, {}, 1000, '2025-01-01');
  assert.equal(h.find((f) => f.id === 'hkv_info').amount, 30);
  h = L.checkHeating({ hkv: 'n', consBased: 'n' }, { fossil: 'y', shown: 'n' }, 1000, '2025-01-01');
  assert.deepEqual(h.map((f) => f.id), ['hkv_na'], 'HeizkostenV not applicable: no cuts');
});

test('CO2KostAufG: stage table and 3 % cut', () => {
  const cases = [[0, 0], [11.9, 0], [12, 10], [16.9, 10], [17, 20], [26.99, 30], [32, 50], [41.9, 60], [47, 80], [51.99, 80], [52, 95], [120, 95]];
  for (const [kg, pct] of cases) assert.equal(L.co2LandlordPct(kg), pct, kg + ' kg');
  let h = L.checkHeating({ hkv: 'y' }, { fossil: 'y', shown: 'n' }, 900, '2025-01-01');
  assert.equal(h.find((f) => f.id === 'co2_missing').amount, 27);
  h = L.checkHeating({ hkv: 'y' }, { fossil: 'y', shown: 'n' }, 900, '2022-10-01');
  assert.ok(h.some((f) => f.id === 'co2_old'), 'periods starting before 2023 are not covered');
  h = L.checkHeating({ hkv: 'y' }, { fossil: 'y', shown: 'y', kg: 30, llPct: 20 }, 900, '2025-01-01');
  assert.equal(h.find((f) => f.id === 'co2_wrong').p.due, 40);
  h = L.checkHeating({ hkv: 'y' }, { fossil: 'y', shown: 'y', kg: 30, llPct: 40 }, 900, '2025-01-01');
  assert.ok(h.some((f) => f.id === 'co2_ok'));
  h = L.checkHeating({ hkv: 'y' }, { fossil: 'n', shown: 'n' }, 900, '2025-01-01');
  assert.equal(h.length, 0, 'no CO2 split for heat pumps or renewables');
});

test('number parsing: German and English formats', () => {
  assert.equal(L.num('1.234,56'), 1234.56);
  assert.equal(L.num('1,234.56'), 1234.56);
  assert.equal(L.num('120'), 120);
  assert.equal(L.num('12,5 €'), 12.5);
  assert.ok(Number.isNaN(L.num('')));
  assert.ok(Number.isNaN(L.num('abc')));
});

const sample = {
  tenant: { name: 'Erika Muster', street: 'Hauptstr. 1', city: '10115 Berlin' },
  landlord: { name: 'Hausverwaltung Beispiel GmbH', street: 'Ring 2', city: '10117 Berlin' },
  object: 'Hauptstr. 1, 2. OG links', area: '60',
  start: '2025-01-01', end: '2025-12-31', received: '2026-06-02', resultType: 'nach', resultAmount: '420,00',
  heatOn: true,
  heat: { hkv: 'y', consBased: 'y', consPct: '70', remote: 'y', info: 'n' },
  co2: { fossil: 'y', shown: 'n' },
  lines: [
    { cat: 'grundsteuer', total: 1800, key: 'flaeche', all: 600, mine: 60, share: 180 },
    { cat: 'verwaltung', label: 'Verwaltergebühr', total: 3000, key: 'einheiten', all: 10, mine: 1, share: 300 },
    { cat: 'heizung', total: 9000, key: 'verbrauch', all: 100, mine: 10, share: 900 },
    { cat: 'muell', total: 1200, key: 'flaeche', all: 600, mine: 60, share: 150 },
  ],
};

test('full analysis of a sample statement', () => {
  const r = L.analyze(sample, '2026-10-19');
  assert.ok(ids(r).includes('bill_on_time'));
  assert.equal(find(r, 'object_open').p.due, '2027-06-02');
  assert.equal(find(r, 'cat_no_verwaltung').amount, 300);
  assert.equal(find(r, 'share_mismatch').amount, 30);
  assert.equal(find(r, 'hkv_info').amount, 27);
  assert.equal(find(r, 'co2_missing').amount, 27);
  assert.equal(r.totals.heatShare, 900);
  assert.equal(r.totals.lines, 1530);
  assert.equal(r.totals.reduction, 384);
  assert.equal(r.findings[0].sev, 'error', 'errors come first');
  assert.ok(ids(r).includes('belege'));
});

test('the letter: objection lists the points, inspection asks for the receipts', () => {
  const r = L.analyze(sample, '2026-10-19');
  const w = L.buildLetter(sample, r, { mode: 'objection', today: '2026-10-19' });
  assert.match(w, /^Erika Muster\nHauptstr\. 1\n10115 Berlin/);
  assert.match(w, /Berlin, 19\.10\.2026/);
  assert.match(w, /Widerspruch gegen die Betriebskostenabrechnung für den Zeitraum 01\.01\.2025 bis 31\.12\.2025/);
  assert.match(w, /Verwaltergebühr \(Verwaltungskosten \/ Hausverwaltung\)“ \(300,00 €\)/);
  assert.match(w, /§ 1 Abs\. 2 BetrKV/);
  assert.match(w, /um 3 %, also um 27,00 €/);
  assert.match(w, /§ 259 BGB/);
  assert.match(w, /mindestens in Höhe von 384,00 €/);
  assert.match(w, /bis zum 09\.11\.2026/);
  assert.doesNotMatch(w, /undefined|NaN|null/);
  const e = L.buildLetter(sample, r, { mode: 'inspect', today: '2026-10-19' });
  assert.match(e, /^Erika Muster/);
  assert.match(e, /Belegeinsicht zur Betriebskostenabrechnung/);
  assert.match(e, /VIII ZR 118\/19/);
  assert.doesNotMatch(e, /Verwaltergebühr/);
  // empty state still gives a usable template
  const blank = L.buildLetter({}, L.analyze({}, '2026-10-19'), { mode: 'objection', today: '2026-10-19' });
  assert.match(blank, /\[Ihr Name\]/);
  assert.doesNotMatch(blank, /undefined|NaN/);
});

test('late letter refuses the Nachzahlung', () => {
  const st = { ...sample, start: '2024-01-01', end: '2024-12-31', received: '2026-01-10' };
  const w = L.buildLetter(st, L.analyze(st, '2026-02-01'), { mode: 'objection', today: '2026-02-01' });
  assert.match(w, /erst am 10\.01\.2026 zugegangen, also nach Ablauf der Frist am 31\.12\.2025/);
  assert.match(w, /Eine Nachzahlung leiste ich wegen des verspäteten Zugangs nicht\./);
});

test('every finding cites a known rule; every rule has a source URL', () => {
  const r = L.analyze(sample, '2026-10-19');
  for (const f of r.findings) assert.ok(L.RULES[f.rule], f.id);
  for (const [k, v] of Object.entries(L.RULES)) { assert.ok(v.cite, k); assert.match(v.url, /^https:\/\//, k); }
  assert.equal(L.AS_OF, '2026-10-19');
});

test('reminder 30 days before the objection deadline, valid .ics', () => {
  assert.equal(L.reminderDate('2027-06-02', '2026-10-19'), '2027-05-03');
  assert.equal(L.reminderDate('2026-11-01', '2026-10-19'), '2026-10-20');
  assert.equal(L.reminderDate('2026-10-19', '2026-10-19'), null);
  const ics = L.buildICS({ date: '2027-05-03', summary: 'Einwendungsfrist Nebenkostenabrechnung endet am 02.06.2027', description: 'Prüfen, Widerspruch, Belegeinsicht. Läuft ab: 02.06.2027 – hmsk.life', url: 'https://hmsk.life/de/tools/nebenkosten-check/', uid: 'x@hmsk.life', now: new Date(Date.UTC(2026, 9, 19, 8, 0, 0)) });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20270503\r\n/);
  assert.match(ics, /DTEND;VALUE=DATE:20270504\r\n/);
  assert.match(ics, /DTSTAMP:20261019T080000Z/);
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, line);
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
});
