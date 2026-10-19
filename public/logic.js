/* Nebenkostenabrechnung checker: rules, deadlines and the letter. No DOM, so Node can test it (tests/).
   Every rule carries a source (RULES) and the date the rules were checked (AS_OF). Not legal advice. */
(function (root) {
  'use strict';

  var AS_OF = '2026-10-19';

  // ---------- sources (shown next to every finding) ----------
  var GII = 'https://www.gesetze-im-internet.de/';
  var RULES = {
    bgb556: { cite: '§ 556 Abs. 3 BGB', url: GII + 'bgb/__556.html' },
    bgb556a: { cite: '§ 556a BGB', url: GII + 'bgb/__556a.html' },
    bgb259: { cite: '§ 259 BGB; BGH, Urteil vom 09.12.2020, VIII ZR 118/19', url: GII + 'bgb/__259.html' },
    betrkv1: { cite: '§ 1 Abs. 2 BetrKV', url: GII + 'betrkv/__1.html' },
    betrkv2: { cite: '§ 2 BetrKV', url: GII + 'betrkv/__2.html' },
    betrkv2_15: { cite: '§ 2 Nr. 15 BetrKV', url: GII + 'betrkv/__2.html' },
    betrkv2_17: { cite: '§ 2 Nr. 17 BetrKV', url: GII + 'betrkv/__2.html' },
    leerstand: { cite: 'BGH, Urteil vom 31.05.2006, VIII ZR 159/05', url: 'https://www.bundesgerichtshof.de/' },
    rauch: { cite: 'BGH, Urteil vom 11.05.2022, VIII ZR 379/20', url: 'https://www.bundesgerichtshof.de/' },
    notdienst: { cite: 'BGH, Urteil vom 18.12.2019, VIII ZR 62/19', url: 'https://www.bundesgerichtshof.de/' },
    hkv2: { cite: '§ 2 HeizkostenV', url: GII + 'heizkostenv/__2.html' },
    hkv7: { cite: '§ 7 Abs. 1 und § 8 Abs. 1 HeizkostenV', url: GII + 'heizkostenv/__7.html' },
    hkv12a: { cite: '§ 12 Abs. 1 Satz 1 HeizkostenV', url: GII + 'heizkostenv/__12.html' },
    hkv12b: { cite: '§ 12 Abs. 1 Satz 2 und 3, § 5, § 6a HeizkostenV', url: GII + 'heizkostenv/__12.html' },
    co2: { cite: '§§ 5 bis 7 CO2KostAufG und Anlage', url: GII + 'co2kostaufg/anlage.html' },
    co2_7: { cite: '§ 7 Abs. 3 und 4 CO2KostAufG', url: GII + 'co2kostaufg/__7.html' },
    co2_11: { cite: '§ 11 Abs. 2 CO2KostAufG', url: GII + 'co2kostaufg/__11.html' },
    dmb: { cite: 'Deutscher Mieterbund, Betriebskostenspiegel für Deutschland, Abrechnungsjahr 2024 (veröffentlicht 18.12.2025)', url: 'https://mieterbund.de/app/uploads/2025/12/20251218-3.pdf' },
  };

  /* Cost categories. ok: 'yes' allowed under § 2 BetrKV (if the lease passes Betriebskosten on),
     'cond' allowed only under a condition, 'no' never a Betriebskosten item.
     avg: Betriebskostenspiegel 2024, € per m² and month (DMB, 18.12.2025); top: upper end of the range given. */
  var CATS = [
    { id: 'grundsteuer', ok: 'yes', nr: '1', avg: 0.18, de: 'Grundsteuer', en: 'Property tax (Grundsteuer)' },
    { id: 'wasser', ok: 'yes', nr: '2, 3', avg: 0.29, de: 'Wasser und Abwasser', en: 'Water and sewage' },
    { id: 'heizung', ok: 'yes', nr: '4 bis 6', avg: 1.32, top: 2.18, de: 'Heizung und Warmwasser', en: 'Heating and hot water' },
    { id: 'aufzug', ok: 'yes', nr: '7', avg: 0.20, de: 'Aufzug', en: 'Lift' },
    { id: 'strasse', ok: 'yes', nr: '8', avg: 0.04, de: 'Straßenreinigung / Winterdienst', en: 'Street cleaning / winter service' },
    { id: 'muell', ok: 'yes', nr: '8', avg: 0.16, de: 'Müllbeseitigung', en: 'Waste disposal' },
    { id: 'reinigung', ok: 'yes', nr: '9', avg: 0.21, de: 'Gebäudereinigung / Ungezieferbekämpfung', en: 'Building cleaning / pest control' },
    { id: 'garten', ok: 'yes', nr: '10', avg: 0.15, de: 'Gartenpflege', en: 'Garden maintenance' },
    { id: 'licht', ok: 'yes', nr: '11', avg: 0.06, de: 'Beleuchtung (Allgemeinstrom)', en: 'Lighting (common areas)' },
    { id: 'schornstein', ok: 'yes', nr: '12', avg: 0.04, de: 'Schornsteinreinigung', en: 'Chimney sweep' },
    { id: 'versicherung', ok: 'yes', nr: '13', avg: 0.31, de: 'Sach- und Haftpflichtversicherung', en: 'Building and liability insurance' },
    { id: 'hauswart', ok: 'yes', nr: '14', avg: 0.37, de: 'Hauswart / Hausmeister', en: 'Caretaker (Hausmeister)' },
    { id: 'antenne', ok: 'cond', nr: '15', avg: 0.07, de: 'Antenne / Kabelfernsehen', en: 'Antenna / cable TV' },
    { id: 'waesche', ok: 'yes', nr: '16', de: 'Einrichtungen der Wäschepflege', en: 'Laundry facilities' },
    { id: 'sonstige', ok: 'cond', nr: '17', avg: 0.07, de: 'Sonstige Betriebskosten', en: 'Other operating costs' },
    { id: 'rauch_wartung', ok: 'cond', nr: '17', de: 'Rauchwarnmelder: Wartung', en: 'Smoke detectors: servicing' },
    { id: 'verwaltung', ok: 'no', rule: 'betrkv1', de: 'Verwaltungskosten / Hausverwaltung', en: 'Management fees' },
    { id: 'instand', ok: 'no', rule: 'betrkv1', de: 'Instandhaltung / Reparaturen', en: 'Repairs and maintenance' },
    { id: 'ruecklage', ok: 'no', rule: 'betrkv1', de: 'Instandhaltungs- / Erhaltungsrücklage', en: 'Repair reserve fund' },
    { id: 'bank', ok: 'no', rule: 'betrkv1', de: 'Bank- und Kontoführungsgebühren, Porto', en: 'Bank charges, postage' },
    { id: 'leerstand', ok: 'no', rule: 'leerstand', de: 'Kosten leerstehender Wohnungen', en: 'Costs of empty flats' },
    { id: 'rauch_miete', ok: 'no', rule: 'rauch', de: 'Rauchwarnmelder: Miete / Leasing', en: 'Smoke detectors: rent / leasing' },
    { id: 'notdienst', ok: 'no', rule: 'notdienst', de: 'Notdienstpauschale (Hausmeister)', en: 'Emergency call-out flat fee' },
    { id: 'vers_falsch', ok: 'no', rule: 'betrkv2', de: 'Rechtsschutz-, Mietausfall- oder Hausratversicherung', en: 'Legal, rent-loss or contents insurance' },
    { id: 'anschaffung', ok: 'no', rule: 'betrkv1', de: 'Anschaffung (z. B. Mülltonnen, Geräte)', en: 'Purchases (e.g. bins, equipment)' },
    { id: 'andere', ok: 'unknown', de: 'Andere Position', en: 'Other item' },
  ];
  var CAT = {};
  CATS.forEach(function (c) { CAT[c.id] = c; });

  var KEYS = ['flaeche', 'personen', 'einheiten', 'verbrauch', 'mea', 'direkt'];

  // CO2KostAufG, Anlage: kg CO2 per m² living area and year -> landlord share in percent
  var CO2_STEPS = [[12, 0], [17, 10], [22, 20], [27, 30], [32, 40], [37, 50], [42, 60], [47, 70], [52, 80], [Infinity, 95]];
  function co2LandlordPct(kg) {
    for (var i = 0; i < CO2_STEPS.length; i++) if (kg < CO2_STEPS[i][0]) return CO2_STEPS[i][1];
    return 95;
  }

  // ---------- dates (ISO yyyy-mm-dd, calendar arithmetic in UTC) ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parse(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > dim(y, mo)) return null;
    return { y: y, m: mo, d: d };
  }
  function iso(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function dim(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function isDate(s) { return !!parse(s); }
  // Same day n months later; a month-end stays a month-end (31 Jan + 1 -> 28/29 Feb).
  function addMonths(s, n) {
    var p = parse(s);
    var t = p.y * 12 + (p.m - 1) + n;
    var y = Math.floor(t / 12), m = t % 12 + 1;
    var last = p.d === dim(p.y, p.m);
    return iso(y, m, last ? dim(y, m) : Math.min(p.d, dim(y, m)));
  }
  function addDays(s, n) {
    var p = parse(s);
    var d = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  function endOfMonth(s) { var p = parse(s); return iso(p.y, p.m, dim(p.y, p.m)); }
  function daysBetween(a, b) {
    var x = parse(a), y = parse(b);
    return Math.round((Date.UTC(y.y, y.m - 1, y.d) - Date.UTC(x.y, x.m - 1, x.d)) / 86400000);
  }
  function todayISO(now) {
    now = now || new Date();
    return iso(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }
  // Length of the period in whole months, rounded (for € per m² and month)
  function periodMonths(start, end) {
    var days = daysBetween(start, end) + 1;
    return Math.max(1, Math.round(days / (365.25 / 12)));
  }

  /* Deadlines under § 556 Abs. 3 BGB.
     - Period: at most 12 months (end is before start + 12 months).
     - Statement due "bis zum Ablauf des zwölften Monats nach Ende des Abrechnungszeitraums": end of the
       calendar month 12 months after the period end (31.12.2025 -> 31.12.2026). Received later: no Nachzahlung,
       unless the landlord is not to blame for the delay.
     - Objections: "bis zum Ablauf des zwölften Monats nach Zugang". We use the earlier, safe reading (same day
       12 months later, § 188 Abs. 2 BGB); some courts read it as the end of that month. */
  function deadlines(start, end, received, today) {
    var out = { valid: false };
    if (!isDate(start) || !isDate(end)) return out;
    out.valid = end >= start;
    if (!out.valid) { out.order = true; return out; }
    out.months = periodMonths(start, end);
    out.maxEnd = addDays(addMonths(start, 12), -1);
    out.tooLong = end > out.maxEnd;
    out.billDue = endOfMonth(addMonths(end, 12));
    if (isDate(received)) {
      out.received = received;
      out.beforeEnd = received <= end;
      out.late = received > out.billDue;
      out.objectDue = addMonths(received, 12);
      if (today) {
        out.objectDaysLeft = daysBetween(today, out.objectDue);
        out.objectExpired = today > out.objectDue;
      }
    } else if (today) {
      out.notYet = true;
      out.billOverdue = today > out.billDue;
    }
    return out;
  }

  // ---------- numbers ----------
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    var s = String(v == null ? '' : v).trim().replace(/\s|€/g, '');
    if (!s) return NaN;
    // German "1.234,56" and English "1,234.56" both work
    if (s.indexOf(',') > -1 && s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
    var n = Number(s);
    return isFinite(n) ? n : NaN;
  }
  function round2(n) { return Math.round(n * 100) / 100; }
  function has(n) { return typeof n === 'number' && !isNaN(n); }

  /* checkLine(line, ctx) -> list of findings for one cost line.
     line: { cat, label, total, key, all, mine, share }
     ctx: { end (ISO), months, area } */
  function checkLine(line, ctx, idx) {
    var out = [];
    var c = CAT[line.cat] || CAT.andere;
    var share = num(line.share), total = num(line.total), all = num(line.all), mine = num(line.mine);
    var p = { i: idx, cat: c.id, label: line.label || '', share: has(share) ? round2(share) : null };
    function add(id, sev, rule, extra) {
      var f = { id: id, sev: sev, rule: rule, line: idx, p: Object.assign({}, p, extra || {}) };
      out.push(f);
      return f;
    }

    if (c.ok === 'no') {
      var no = add('cat_no_' + c.id, 'error', c.rule);
      if (has(share) && share > 0) no.amount = round2(share);
    } else if (c.id === 'antenne') {
      if (ctx.end && ctx.end > '2024-06-30') add('cable_tv', 'warn', 'betrkv2_15');
    } else if (c.id === 'sonstige' || c.id === 'rauch_wartung') {
      add('needs_lease', 'info', 'betrkv2_17');
    } else if (c.id === 'andere') {
      add('unknown_cat', 'info', 'betrkv2');
    }

    // Umlageschlüssel: your units cannot exceed the total, and share should be total × mine / all
    if (line.key && line.key !== 'direkt') {
      if (has(all) && has(mine) && all > 0 && mine > all) add('key_over', 'error', 'bgb556a', { mine: mine, all: all });
      else if (has(total) && has(all) && has(mine) && all > 0 && has(share)) {
        var exp = round2(total * mine / all);
        var diff = round2(share - exp);
        if (Math.abs(diff) > Math.max(1, Math.abs(exp) * 0.01)) {
          var f = add('share_mismatch', diff > 0 ? 'error' : 'info', 'bgb556a', { expected: exp, diff: diff });
          if (diff > 0) f.amount = diff;
        }
      }
      if (line.key === 'personen') add('key_persons', 'info', 'bgb556a');
    }

    // Betriebskostenspiegel: only a hint, never a legal error
    if (c.avg && has(share) && ctx.area > 0 && ctx.months > 0) {
      var perM2 = share / ctx.months / ctx.area;
      var limit = c.top || c.avg * 1.5;
      if (perM2 > limit) add('above_avg', 'warn', 'dmb', { perM2: round2(perM2), avg: c.avg, top: c.top || null });
    }
    return out;
  }

  /* Heizkosten (HeizkostenV) and CO2 cost split (CO2KostAufG).
     heat: { hkv: 'y'|'n', consBased: 'y'|'n', consPct, remote: 'y'|'n'|'u', info: 'y'|'n' }
     co2: { fossil: 'y'|'n', shown: 'y'|'n', kg, llPct } ; heatShare = your heating + hot water share in € */
  function checkHeating(heat, co2, heatShare, start) {
    var out = [];
    heat = heat || {}; co2 = co2 || {};
    var base = has(heatShare) && heatShare > 0 ? heatShare : 0;
    if (heat.hkv === 'n') {
      out.push({ id: 'hkv_na', sev: 'info', rule: 'hkv2', p: {} });
      return out;
    }
    if (heat.consBased === 'n') {
      out.push({ id: 'hkv_flat', sev: 'error', rule: 'hkv12a', amount: round2(base * 0.15), p: { base: round2(base), amount: round2(base * 0.15) } });
    } else {
      var pct = num(heat.consPct);
      if (has(pct)) {
        if (pct < 50 || pct > 70) out.push({ id: 'hkv_pct', sev: 'error', rule: 'hkv7', p: { pct: pct } });
        else if (pct < 70) out.push({ id: 'hkv_pct70', sev: 'info', rule: 'hkv7', p: { pct: pct } });
      }
    }
    if (heat.remote === 'y' && heat.info === 'n') {
      out.push({ id: 'hkv_info', sev: 'warn', rule: 'hkv12b', amount: round2(base * 0.03), p: { base: round2(base), amount: round2(base * 0.03) } });
    } else if (heat.remote === 'n') {
      out.push({ id: 'hkv_remote', sev: 'info', rule: 'hkv12b', p: { base: round2(base), amount: round2(base * 0.03) } });
    }

    // CO2KostAufG: periods beginning on or after 1 January 2023, fossil fuels (gas, oil, coal, fossil district heating)
    if (co2.fossil === 'y') {
      if (start && start < '2023-01-01') {
        out.push({ id: 'co2_old', sev: 'info', rule: 'co2_11', p: {} });
      } else if (co2.shown === 'n') {
        out.push({ id: 'co2_missing', sev: 'error', rule: 'co2_7', amount: round2(base * 0.03), p: { base: round2(base), amount: round2(base * 0.03) } });
      } else if (co2.shown === 'y') {
        var kg = num(co2.kg), stated = num(co2.llPct);
        if (has(kg) && kg >= 0) {
          var due = co2LandlordPct(kg);
          if (has(stated) && stated < due) out.push({ id: 'co2_wrong', sev: 'error', rule: 'co2', p: { kg: kg, due: due, stated: stated } });
          else out.push({ id: 'co2_ok', sev: 'ok', rule: 'co2', p: { kg: kg, due: due } });
        }
      }
    }
    return out;
  }

  /* analyze(state, today) -> { dl, findings, totals }
     findings: [{ id, sev: 'error'|'warn'|'info'|'ok', rule, amount?, line?, p }] */
  function analyze(s, today) {
    s = s || {};
    today = today || todayISO();
    var dl = deadlines(s.start, s.end, s.received, today);
    var f = [];
    if (dl.order) f.push({ id: 'period_order', sev: 'error', rule: 'bgb556', p: {} });
    if (dl.valid) {
      if (dl.tooLong) f.push({ id: 'period_long', sev: 'error', rule: 'bgb556', p: { months: dl.months, maxEnd: dl.maxEnd } });
      else f.push({ id: 'period_ok', sev: 'ok', rule: 'bgb556', p: { months: dl.months } });
      if (dl.received) {
        if (dl.beforeEnd) f.push({ id: 'received_early', sev: 'warn', rule: 'bgb556', p: {} });
        var claim = s.resultType === 'nach' ? num(s.resultAmount) : NaN;
        if (dl.late) {
          var x = { id: 'bill_late', sev: 'error', rule: 'bgb556', p: { due: dl.billDue, received: dl.received } };
          if (has(claim) && claim > 0) { x.amount = round2(claim); x.p.amount = round2(claim); }
          f.push(x);
        } else f.push({ id: 'bill_on_time', sev: 'ok', rule: 'bgb556', p: { due: dl.billDue, received: dl.received } });
        if (dl.objectExpired) f.push({ id: 'object_expired', sev: 'warn', rule: 'bgb556', p: { due: dl.objectDue } });
        else f.push({ id: 'object_open', sev: 'info', rule: 'bgb556', p: { due: dl.objectDue, days: dl.objectDaysLeft } });
      } else if (dl.billOverdue) {
        f.push({ id: 'bill_missing_overdue', sev: 'warn', rule: 'bgb556', p: { due: dl.billDue } });
      }
    }

    var area = num(s.area);
    var ctx = { end: dl.valid ? s.end : null, months: dl.valid ? dl.months : 0, area: has(area) ? area : 0 };
    var lines = (s.lines || []).filter(function (l) { return l && (l.cat || has(num(l.share))); });
    var sum = 0, heatShare = 0;
    lines.forEach(function (l, i) {
      var sh = num(l.share);
      if (has(sh)) sum += sh;
      if (l.cat === 'heizung' && has(sh)) heatShare += sh;
      f = f.concat(checkLine(l, ctx, i));
    });

    // Wohnfläche key: your area should be the same on every line (and match the area you entered)
    var areas = {};
    lines.forEach(function (l) { if (l.key === 'flaeche' && has(num(l.mine))) areas[num(l.mine)] = 1; });
    var distinct = Object.keys(areas).map(Number);
    if (distinct.length > 1) f.push({ id: 'area_inconsistent', sev: 'warn', rule: 'bgb556a', p: { values: distinct } });
    else if (distinct.length === 1 && ctx.area > 0 && Math.abs(distinct[0] - ctx.area) > 0.5) {
      f.push({ id: 'area_differs', sev: distinct[0] > ctx.area ? 'error' : 'info', rule: 'bgb556a', p: { used: distinct[0], area: ctx.area } });
    }

    if (s.heatOn) f = f.concat(checkHeating(s.heat, s.co2, heatShare, dl.valid ? s.start : null));

    // Belegeinsicht is always possible; worth asking whenever something is unclear
    f.push({ id: 'belege', sev: 'info', rule: 'bgb259', p: {} });

    var reduction = 0;
    var billLate = f.some(function (x) { return x.id === 'bill_late' && x.amount; });
    f.forEach(function (x) { if (x.amount && x.id !== 'bill_late') reduction += x.amount; });
    var order = { error: 0, warn: 1, info: 2, ok: 3 };
    f.sort(function (a, b) { return order[a.sev] - order[b.sev]; });
    return {
      dl: dl, findings: f,
      totals: {
        lines: round2(sum), heatShare: round2(heatShare), reduction: round2(reduction), billLate: billLate,
        errors: f.filter(function (x) { return x.sev === 'error'; }).length,
        warnings: f.filter(function (x) { return x.sev === 'warn'; }).length,
      },
    };
  }

  // ---------- the letter (always German: it goes to a landlord in Germany) ----------
  function fmtDE(isoDate) { var p = parse(isoDate); return p ? pad(p.d) + '.' + pad(p.m) + '.' + p.y : ''; }
  function eur(n) {
    var s = Math.abs(n).toFixed(2).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (n < 0 ? '-' : '') + s[0] + ',' + s[1] + ' €';
  }
  function lineName(st, i) {
    var l = (st.lines || [])[i] || {};
    var c = CAT[l.cat] || CAT.andere;
    return l.label ? l.label + ' (' + c.de + ')' : c.de;
  }

  // One sentence per finding that belongs in a letter; null for findings that don't.
  function letterPoint(x, st) {
    var p = x.p, r = RULES[x.rule] ? RULES[x.rule].cite : '';
    switch (x.id) {
      case 'period_long': return 'Der Abrechnungszeitraum umfasst ' + p.months + ' Monate. Nach ' + r + ' darf er höchstens zwölf Monate betragen. Bitte rechnen Sie jährlich ab.';
      case 'bill_late': return 'Die Abrechnung ist mir erst am ' + fmtDE(p.received) + ' zugegangen, also nach Ablauf der Frist am ' + fmtDE(p.due) + '. Eine Nachforderung ist nach ' + r + ' ausgeschlossen' + (p.amount ? ' (geforderte Nachzahlung: ' + eur(p.amount) + ')' : '') + '.';
      case 'share_mismatch': return 'Position „' + lineName(st, x.line) + '“: Nach dem angegebenen Umlageschlüssel ergibt sich ein Anteil von ' + eur(p.expected) + ', abgerechnet wurden ' + eur(p.share) + '. Bitte erläutern oder korrigieren Sie die Differenz von ' + eur(p.diff) + '.';
      case 'key_over': return 'Position „' + lineName(st, x.line) + '“: Mein Anteil am Umlageschlüssel (' + p.mine + ') ist größer als die Gesamtsumme (' + p.all + '). Bitte korrigieren Sie den Verteilerschlüssel.';
      case 'key_persons': return 'Position „' + lineName(st, x.line) + '“ wird nach Personen verteilt. Bitte nennen Sie die Vereinbarung, auf der dieser Schlüssel beruht, und die zugrunde gelegten Personenzahlen (' + r + ').';
      case 'area_inconsistent': return 'Die Abrechnung legt für meine Wohnung unterschiedliche Flächen zugrunde (' + p.values.join(' / ') + ' m²). Bitte erläutern Sie das.';
      case 'area_differs': return p.used > p.area ? 'Für meine Wohnung wird eine Fläche von ' + p.used + ' m² angesetzt, sie hat jedoch ' + p.area + ' m². Bitte korrigieren Sie die Verteilung.' : null;
      case 'cable_tv': return 'Position „' + lineName(st, x.line) + '“: Kosten für Kabelfernsehen über einen Sammelvertrag sind seit dem 01.07.2024 nicht mehr als Betriebskosten umlagefähig (' + r + '). Bitte streichen Sie diese Kosten für die Zeit ab Juli 2024.';
      case 'needs_lease': return 'Position „' + lineName(st, x.line) + '“: Sonstige Betriebskosten dürfen nur umgelegt werden, wenn sie im Mietvertrag ausdrücklich benannt sind (' + r + '). Bitte nennen Sie die Vereinbarung.';
      case 'hkv_flat': return 'Die Heizkosten wurden nicht verbrauchsabhängig abgerechnet. Nach ' + r + ' kürze ich meinen Anteil von ' + eur(p.base) + ' um 15 %, also um ' + eur(p.amount) + '.';
      case 'hkv_pct': return 'Der verbrauchsabhängige Anteil der Heiz- bzw. Warmwasserkosten beträgt ' + p.pct + ' %. Zulässig sind 50 bis 70 % (' + r + '). Bitte rechnen Sie neu ab.';
      case 'hkv_info': return 'Trotz fernablesbarer Zähler habe ich keine monatlichen Verbrauchsinformationen erhalten. Nach ' + r + ' kürze ich meinen Heizkostenanteil um 3 %, also um ' + eur(p.amount) + '.';
      case 'co2_missing': return 'Die Heizkostenabrechnung weist die Aufteilung der CO2-Kosten zwischen Mieter und Vermieter nicht aus. Nach ' + r + ' kürze ich meinen Heizkostenanteil um 3 %, also um ' + eur(p.amount) + '.';
      case 'co2_wrong': return 'Bei ' + p.kg + ' kg CO2 je m² und Jahr trägt der Vermieter nach ' + r + ' ' + p.due + ' % der CO2-Kosten, angesetzt wurden ' + p.stated + ' %. Bitte korrigieren Sie die Aufteilung.';
      default:
        if (x.id.indexOf('cat_no_') === 0) {
          var why = { betrkv1: 'Verwaltungs- und Instandhaltungskosten sind keine Betriebskosten', leerstand: 'die Kosten leerstehender Wohnungen trägt der Vermieter', rauch: 'die Miete von Rauchwarnmeldern ist nicht umlagefähig', notdienst: 'eine Notdienstpauschale gehört zu den Verwaltungskosten', betrkv2: 'diese Versicherung zählt nicht zu den Sach- und Haftpflichtversicherungen' }[x.rule] || 'die Kosten sind nicht umlagefähig';
          return 'Position „' + lineName(st, x.line) + '“' + (p.share ? ' (' + eur(p.share) + ')' : '') + ': ' + why + ' (' + r + '). Bitte streichen Sie diese Position.';
        }
        return null;
    }
  }

  /* buildLetter(state, result, { mode: 'objection'|'inspect', today })
     objection: Widerspruch with every point + request to inspect the receipts.
     inspect:   only Belegeinsicht (when nothing is clearly wrong yet, or to check first). */
  function buildLetter(st, res, opts) {
    st = st || {}; opts = opts || {};
    var mode = opts.mode || 'objection';
    var today = opts.today || todayISO();
    var t = st.tenant || {}, l = st.landlord || {};
    var period = isDate(st.start) && isDate(st.end) ? fmtDE(st.start) + ' bis ' + fmtDE(st.end) : '[Zeitraum]';
    var recv = isDate(st.received) ? ' vom ' + fmtDE(st.received) : '';
    var points = mode === 'objection'
      ? res.findings.map(function (x) { return letterPoint(x, st); }).filter(Boolean) : [];
    var cut = 0;
    res.findings.forEach(function (x) { if (x.amount && x.id !== 'bill_late' && x.sev === 'error') cut += x.amount; });
    if (mode === 'objection') res.findings.forEach(function (x) { if (x.id === 'hkv_info' && x.amount) cut += x.amount; });

    var out = [];
    out.push([t.name || '[Ihr Name]', t.street || '[Straße, Hausnummer]', t.city || '[PLZ Ort]'].join('\n'));
    out.push('');
    out.push([l.name || '[Vermieter / Hausverwaltung]', l.street || '[Straße, Hausnummer]', l.city || '[PLZ Ort]'].join('\n'));
    out.push('');
    out.push((t.city ? t.city.replace(/^\d{5}\s*/, '') + ', ' : '') + fmtDE(today));
    out.push('');
    var obj = st.object ? ', Mietobjekt: ' + st.object : '';
    if (mode === 'objection') {
      out.push('Widerspruch gegen die Betriebskostenabrechnung für den Zeitraum ' + period + obj);
      out.push('');
      out.push('Sehr geehrte Damen und Herren,');
      out.push('');
      out.push('gegen Ihre Betriebskostenabrechnung' + recv + ' für den Zeitraum ' + period + ' erhebe ich nach § 556 Abs. 3 BGB folgende Einwendungen:');
      out.push('');
      if (points.length) points.forEach(function (s, i) { out.push((i + 1) + '. ' + s); out.push(''); });
      else { out.push('1. [Ihre Einwendung]'); out.push(''); }
      out.push('Zugleich bitte ich nach § 259 BGB um Einsicht in die Originalbelege zu dieser Abrechnung (Rechnungen, Verträge, Bescheide, Ablesewerte und die Aufstellung der Verteilerschlüssel). Bitte nennen Sie mir dafür einen Termin oder übersenden Sie mir Kopien gegen Erstattung der Kosten.');
      out.push('');
      if (res.totals.billLate) out.push('Eine Nachzahlung leiste ich wegen des verspäteten Zugangs nicht.');
      else if (st.resultType === 'nach') out.push('Bis zur Klärung dieser Punkte und bis zur Belegeinsicht halte ich die geforderte Nachzahlung' + (cut > 0 ? ' mindestens in Höhe von ' + eur(round2(cut)) : '') + ' zurück.');
      else out.push('Bitte senden Sie mir eine korrigierte Abrechnung.');
      out.push('');
      out.push('Bitte antworten Sie mir bis zum ' + fmtDE(addDays(today, 21)) + '.');
    } else {
      out.push('Belegeinsicht zur Betriebskostenabrechnung für den Zeitraum ' + period + obj);
      out.push('');
      out.push('Sehr geehrte Damen und Herren,');
      out.push('');
      out.push('zu Ihrer Betriebskostenabrechnung' + recv + ' für den Zeitraum ' + period + ' bitte ich nach § 259 BGB um Einsicht in die Originalbelege: Rechnungen, Verträge, Gebühren- und Steuerbescheide, die Ablesewerte der Verbrauchserfassung und die Aufstellung der Verteilerschlüssel (Gesamtflächen bzw. -einheiten).');
      out.push('');
      out.push('Bitte nennen Sie mir einen Termin in den nächsten drei Wochen oder übersenden Sie mir Kopien gegen Erstattung der Kosten.');
      out.push('');
      if (st.resultType === 'nach') { out.push('Bis zur Einsicht in die Belege halte ich die geforderte Nachzahlung zurück (BGH, Urteil vom 09.12.2020, VIII ZR 118/19).'); out.push(''); }
      out.push('Weitere Einwendungen innerhalb der Frist des § 556 Abs. 3 BGB behalte ich mir ausdrücklich vor.');
    }
    out.push('');
    out.push('Mit freundlichen Grüßen');
    out.push('');
    out.push('');
    out.push(t.name || '[Ihr Name]');
    return out.join('\n');
  }

  // ---------- calendar reminder for the objection deadline (RFC 5545) ----------
  function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function utf8Len(ch) { var c = ch.codePointAt(0); return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; }
  function fold(line) {
    var out = [], cur = '', bytes = 0;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i], code = line.charCodeAt(i);
      if (code >= 0xD800 && code <= 0xDBFF && i + 1 < line.length) ch += line[++i];
      var b = utf8Len(ch);
      if (bytes + b > 75) { out.push(cur); cur = ' ' + ch; bytes = 1 + b; } else { cur += ch; bytes += b; }
    }
    out.push(cur);
    return out.join('\r\n');
  }
  function stamp(now) {
    now = now || new Date();
    return now.getUTCFullYear() + pad(now.getUTCMonth() + 1) + pad(now.getUTCDate()) + 'T' + pad(now.getUTCHours()) + pad(now.getUTCMinutes()) + pad(now.getUTCSeconds()) + 'Z';
  }
  /* reminderDate(due, today): 30 days before the deadline, or tomorrow if that has passed; null if due has passed. */
  function reminderDate(due, today) {
    if (!isDate(due) || due <= today) return null;
    var d = addDays(due, -30);
    return d > today ? d : addDays(today, 1);
  }
  function buildICS(o) {
    var lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//hmsk.life//Nebenkosten Check//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + (o.uid || (Date.now().toString(36) + Math.random().toString(36).slice(2, 10) + '@hmsk.life')),
      'DTSTAMP:' + stamp(o.now),
      'DTSTART;VALUE=DATE:' + o.date.replace(/-/g, ''),
      'DTEND;VALUE=DATE:' + addDays(o.date, 1).replace(/-/g, ''),
      'SUMMARY:' + icsEscape(o.summary),
      'DESCRIPTION:' + icsEscape(o.description),
      'URL:' + o.url,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEscape(o.summary), 'TRIGGER;RELATED=START:PT9H', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ];
    return lines.map(fold).join('\r\n') + '\r\n';
  }

  var api = {
    AS_OF: AS_OF, RULES: RULES, CATS: CATS, CAT: CAT, KEYS: KEYS, CO2_STEPS: CO2_STEPS,
    co2LandlordPct: co2LandlordPct, addMonths: addMonths, addDays: addDays, endOfMonth: endOfMonth,
    daysBetween: daysBetween, todayISO: todayISO, isDate: isDate, periodMonths: periodMonths,
    deadlines: deadlines, num: num, checkLine: checkLine, checkHeating: checkHeating, analyze: analyze,
    letterPoint: letterPoint, buildLetter: buildLetter, fmtDE: fmtDE, eur: eur,
    reminderDate: reminderDate, buildICS: buildICS, fold: fold,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NKCheck = api;
})(typeof window !== 'undefined' ? window : globalThis);
