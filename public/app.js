/* UI for the Nebenkosten check. Rules live in logic.js, texts in i18n.js. Nothing leaves the browser. */
(function () {
  'use strict';
  var L = window.NKCheck;
  var I = window.NK_I18N;
  var CFG = window.NK_CONFIG || {};
  var SITE = CFG.siteBase || '';
  var KEY = 'hmsk-nebenkosten-check:v1';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };

  function blank() {
    return { lines: [{ cat: '', key: 'flaeche' }], heatOn: false, heat: {}, co2: {}, tenant: {}, landlord: {}, letterMode: 'objection', letterCustom: null };
  }
  var saved = store.get(KEY);
  var st = saved && saved.state ? Object.assign(blank(), saved.state) : blank();
  var meta = saved && saved.meta ? saved.meta : { uses: 0, sent: 0 };
  var lang = pickLang();
  var today = L.todayISO();
  var res = null;

  function pickLang() {
    var q = new URLSearchParams(location.search).get('lang');
    if (q === 'de' || q === 'en') return q;
    if (saved && (saved.lang === 'de' || saved.lang === 'en')) return saved.lang;
    var nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'de';
    return /^en\b/i.test(nav) ? 'en' : 'de';
  }
  function t(key, vars) {
    var s = I[lang][key];
    if (s === undefined || s === null) s = I.de[key];
    if (vars) Object.keys(vars).forEach(function (k) { s = String(s).split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function fmtDate(iso) {
    if (!L.isDate(iso)) return '';
    var p = iso.split('-');
    return new Intl.DateTimeFormat(t('locale'), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])));
  }
  function money(n) { return new Intl.NumberFormat(t('locale'), { style: 'currency', currency: 'EUR' }).format(n); }
  function numFmt(n) { return new Intl.NumberFormat(t('locale'), { maximumFractionDigits: 2 }).format(n); }
  function link(href) { return SITE + href; }
  function save() { store.set(KEY, { v: 1, lang: lang, state: st, meta: meta }); }

  // ---------- path helpers for data-f="a.b" ----------
  function getP(path) { return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, st); }
  function setP(path, v) {
    var ks = path.split('.'), o = st;
    for (var i = 0; i < ks.length - 1; i++) { if (!o[ks[i]] || typeof o[ks[i]] !== 'object') o[ks[i]] = {}; o = o[ks[i]]; }
    o[ks[ks.length - 1]] = v;
  }

  // ---------- static texts ----------
  function applyLang() {
    document.documentElement.lang = lang;
    document.title = t('title');
    $$('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    $$('.lang button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang)); });
    $('#lnkHome').href = link(t('home_href'));
    $('#lnkImprint').href = link(t('imprint_href'));
    $('#lnkImprint').textContent = t('imprint');
    $('#lnkPrivacy').href = link(t('privacy_href'));
    $('#lnkPrivacy').textContent = t('privacy');
    $('#sourcesList').innerHTML = t('src').map(function (s) {
      return '<li><a href="' + esc(s[1]) + '" rel="noopener" target="_blank">' + esc(s[0]) + '</a><span class="src-url">' + esc(s[1]) + '</span></li>';
    }).join('');
    renderLines();
  }

  // ---------- form ----------
  function fillForm() {
    $$('[data-f]').forEach(function (el) {
      var v = getP(el.getAttribute('data-f'));
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v == null ? '' : v;
    });
    $$('#form input[type=radio], #letter input[type=radio]').forEach(function (el) { el.checked = String(getP(el.name)) === el.value; });
    renderLines();
    syncVisibility();
  }
  function syncVisibility() {
    $('#heatBox').hidden = !st.heatOn;
    $('#hkvBox').hidden = (st.heat || {}).hkv === 'n';
    $('#pctField').hidden = (st.heat || {}).consBased === 'n';
    $('#infoBox').hidden = (st.heat || {}).remote !== 'y';
    $('#co2Box').hidden = (st.co2 || {}).fossil !== 'y';
    $('#co2Fields').hidden = (st.co2 || {}).shown !== 'y';
  }

  function catOptions(sel) {
    var groups = [['yes', 'grp_yes'], ['cond', 'grp_cond'], ['no', 'grp_no'], ['unknown', 'grp_other']];
    var h = '<option value="">' + esc(t('cat_pick')) + '</option>';
    groups.forEach(function (g) {
      h += '<optgroup label="' + esc(t(g[1])) + '">';
      L.CATS.filter(function (c) { return c.ok === g[0]; }).forEach(function (c) {
        h += '<option value="' + c.id + '"' + (c.id === sel ? ' selected' : '') + '>' + esc(c[lang]) + (c.nr ? ' (Nr. ' + c.nr + ')' : '') + '</option>';
      });
      h += '</optgroup>';
    });
    return h;
  }
  function keyOptions(sel) {
    return L.KEYS.map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + esc(t('k_' + k)) + '</option>'; }).join('');
  }
  function renderLines() {
    var box = $('#lines');
    if (!st.lines.length) st.lines.push({ cat: '', key: 'flaeche' });
    box.innerHTML = st.lines.map(function (l, i) {
      var f = function (k, cls, mode) {
        return '<label class="field ' + (cls || '') + '"><span>' + esc(t(k)) + '</span><input type="text" ' + (mode ? 'inputmode="' + mode + '" ' : '') +
          'data-l="' + i + '" data-k="' + k + '" value="' + esc(l[k] == null ? '' : l[k]) + '"></label>';
      };
      return '<div class="line" data-i="' + i + '">' +
        '<div class="line__head"><span class="line__no">#' + (i + 1) + '</span>' +
        '<button type="button" class="linkish line__rm" data-rm="' + i + '" aria-label="' + esc(t('remove')) + ' #' + (i + 1) + '">' + esc(t('remove')) + '</button></div>' +
        '<div class="line__grid">' +
        '<label class="field line__cat"><span>' + esc(t('cat')) + '</span><select data-l="' + i + '" data-k="cat">' + catOptions(l.cat) + '</select></label>' +
        f('label', 'line__label') + f('total', '', 'decimal') +
        '<label class="field"><span>' + esc(t('key')) + '</span><select data-l="' + i + '" data-k="key">' + keyOptions(l.key || 'flaeche') + '</select></label>' +
        f('all', '', 'decimal') + f('mine', '', 'decimal') + f('share', 'line__share', 'decimal') +
        '</div></div>';
    }).join('');
  }

  function onInput(e) {
    var el = e.target;
    if (el.hasAttribute('data-l')) {
      var i = +el.getAttribute('data-l');
      st.lines[i][el.getAttribute('data-k')] = el.value;
    } else if (el.hasAttribute('data-f')) {
      setP(el.getAttribute('data-f'), el.type === 'checkbox' ? el.checked : el.value);
    } else if (el.type === 'radio') {
      setP(el.name, el.value);
    } else return;
    syncVisibility();
    update();
  }

  // ---------- result ----------
  function lineLabel(i) {
    var l = st.lines[i] || {};
    var c = L.CAT[l.cat] || L.CAT.andere;
    return l.label ? l.label : c[lang];
  }
  function findingText(f) {
    var p = f.p || {};
    var v = {};
    Object.keys(p).forEach(function (k) { v[k] = p[k]; });
    ['due', 'received', 'maxEnd'].forEach(function (k) { if (p[k]) v[k] = fmtDate(p[k]); });
    ['share', 'expected', 'base', 'amount'].forEach(function (k) { if (typeof p[k] === 'number') v[k] = money(p[k]); });
    if (typeof p.diff === 'number') v.diff = (p.diff > 0 ? '+' : '') + money(p.diff);
    if (typeof p.perM2 === 'number') { v.perM2 = money(p.perM2); v.avg = money(p.avg); v.top = p.top ? t('top_part', { top: money(p.top) }) : ''; }
    if (p.values) v.values = p.values.map(numFmt).join(' / ');
    ['kg', 'used', 'area', 'mine', 'all', 'pct', 'stated'].forEach(function (k) { if (typeof p[k] === 'number') v[k] = numFmt(p[k]); });
    if (typeof f.line === 'number') v.label = lineLabel(f.line);
    if (f.id.indexOf('cat_no_') === 0) return t('f_cat_no', { label: v.label, why: t('why_' + f.rule) });
    return t('f_' + f.id, v);
  }
  function chip(sev) { return '<span class="sev sev--' + sev + '">[' + esc(t('sev_' + sev)) + ']</span>'; }

  function renderResult() {
    var body = $('#resultBody');
    var dl = res.dl;
    if (!dl.valid && !dl.order) {
      body.innerHTML = '<p class="dim">' + esc(t('empty')) + '</p>';
      return;
    }
    var h = '';
    var tot = res.totals;
    var sum = [];
    if (tot.errors) sum.push('<span class="sev--error">' + esc(t('sum_errors', { n: tot.errors })) + '</span>');
    if (tot.warnings) sum.push('<span class="sev--warn">' + esc(t('sum_warn', { n: tot.warnings })) + '</span>');
    h += '<p class="verdict">' + (sum.length ? sum.join(' · ') : esc(t('sum_none'))) + '</p>';
    if (tot.billLate) {
      var late = res.findings.filter(function (f) { return f.id === 'bill_late'; })[0];
      h += '<p class="big">' + esc(t('sum_late', { amount: money(late.amount) })) + '</p>';
    }
    if (tot.reduction > 0) h += '<p class="big">' + esc(t('sum_reduction', { amount: money(tot.reduction) })) + '</p>';

    if (dl.valid) {
      h += '<ol class="tl">';
      h += '<li class="tl__row' + (dl.late ? ' tl__row--bad' : '') + '"><span class="tl__date">' + esc(fmtDate(dl.billDue)) + '</span><span class="tl__what">' + esc(t('tl_bill')) + '</span></li>';
      if (dl.received) {
        h += '<li class="tl__row' + (dl.late ? ' tl__row--bad' : '') + '"><span class="tl__date">' + esc(fmtDate(dl.received)) + '</span><span class="tl__what">' + esc(t('tl_received')) + '</span></li>';
        h += '<li class="tl__row tl__row--key"><span class="tl__date">' + esc(fmtDate(dl.objectDue)) + '</span><span class="tl__what">' + esc(t('tl_object')) +
          ' <span class="chip">[' + esc(dl.objectExpired ? t('days_over') : t('days_left', { n: dl.objectDaysLeft })) + ']</span></span></li>';
      }
      h += '</ol>';
    }

    h += '<ul class="findings" role="list">' + res.findings.map(function (f) {
      var r = L.RULES[f.rule];
      return '<li class="finding finding--' + f.sev + '">' + chip(f.sev) + ' <span class="finding__t">' + esc(findingText(f)) + '</span>' +
        (r ? '<span class="finding__src"><a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.cite) + '</a> · ' + esc(t('as_of', { date: L.fmtDE(L.AS_OF) })) + '</span>' : '') + '</li>';
    }).join('') + '</ul>';

    // next steps, reminder, email (second use)
    h += '<h3 class="h3">' + esc(t('next_h')) + '</h3><ul class="todo">';
    if (dl.objectDue && !dl.objectExpired) h += '<li>' + esc(t('next_1', { date: fmtDate(dl.objectDue) })) + '</li>';
    h += '<li>' + esc(t('next_2')) + '</li><li>' + esc(t('next_3')) + '</li></ul>';
    var rem = dl.objectDue ? L.reminderDate(dl.objectDue, today) : null;
    h += '<div class="actions">';
    if (rem) h += '<button type="button" class="btn btn--line" id="icsBtn">' + esc(t('ics')) + '</button>';
    h += '<a class="btn btn--line" href="#letter">' + esc(t('letter_h')) + ' &darr;</a></div>';
    if (meta.uses >= 2 || meta.sent > 0) {
      h += '<div class="mail"><p class="h3">' + esc(t('mail_h')) + '</p><p class="small">' + esc(t('mail_p')) + '</p>' +
        '<a class="btn btn--line" href="' + esc(link((lang === 'de' ? '/de/newsletter/' : '/subscribe/') + '?topic=nebenkosten-reminder' +
          (dl.objectDue && !dl.objectExpired ? '&date=' + dl.objectDue + '&label=' + encodeURIComponent(t('tl_object')) : ''))) + '">' + esc(t('mail_btn')) + '</a></div>';
    }
    body.innerHTML = h;
    var ib = $('#icsBtn');
    if (ib) ib.addEventListener('click', function () { downloadICS(rem, dl.objectDue); });
  }

  // ---------- letter ----------
  function letterText() { return L.buildLetter(st, res, { mode: st.letterMode || 'objection', today: today }); }
  function renderLetter() {
    var ta = $('#letterText');
    if (st.letterCustom == null) ta.value = letterText();
    else if (document.activeElement !== ta) ta.value = st.letterCustom;
    $('#letterEdited').hidden = st.letterCustom == null;
  }

  function update() {
    res = L.analyze(st, today);
    renderResult();
    renderLetter();
    $('#linesSum').textContent = res.totals.lines ? t('lines_sum', { sum: money(res.totals.lines) }) : '';
    save();
  }

  function downloadICS(date, due) {
    var url = 'https://hmsk.life' + (lang === 'de' ? '/de' : '') + '/tools/nebenkosten-check/?utm_source=ics&utm_medium=calendar&utm_campaign=nebenkosten-check';
    var ics = L.buildICS({
      date: date,
      summary: t('ics_sum', { date: L.fmtDE(due) }),
      description: t('ics_desc', { date: L.fmtDE(due), url: url }),
      url: url,
    });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    a.download = 'einwendungsfrist-nebenkosten.ics';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function markSent() { meta.sent = (meta.sent || 0) + 1; save(); renderResult(); }

  // ---------- example ----------
  function example() {
    var y = +today.slice(0, 4) - 1;
    return {
      tenant: { name: 'Erika Mustermann', street: 'Lindenstraße 12', city: '10969 Berlin' },
      landlord: { name: 'Beispiel Hausverwaltung GmbH', street: 'Am Ring 3', city: '10117 Berlin' },
      object: 'Lindenstraße 12, 2. OG links', area: '62',
      start: y + '-01-01', end: y + '-12-31', received: L.addDays(today, -20), resultType: 'nach', resultAmount: '486,20',
      heatOn: true, heat: { hkv: 'y', consBased: 'y', consPct: '70', remote: 'y', info: 'n' }, co2: { fossil: 'y', shown: 'n' },
      letterMode: 'objection', letterCustom: null,
      lines: [
        { cat: 'grundsteuer', total: '2.160,00', key: 'flaeche', all: '720', mine: '62', share: '186,00' },
        { cat: 'wasser', total: '4.680,00', key: 'personen', all: '24', mine: '2', share: '390,00' },
        { cat: 'muell', total: '1.440,00', key: 'flaeche', all: '720', mine: '65', share: '130,00' },
        { cat: 'versicherung', total: '3.240,00', key: 'flaeche', all: '720', mine: '62', share: '279,00' },
        { cat: 'verwaltung', label: 'Verwaltergebühr', total: '3.600,00', key: 'einheiten', all: '12', mine: '1', share: '300,00' },
        { cat: 'antenne', label: 'Kabel-TV', total: '1.080,00', key: 'einheiten', all: '12', mine: '1', share: '90,00' },
        { cat: 'heizung', total: '14.400,00', key: 'verbrauch', all: '1000', mine: '68', share: '979,20' },
      ],
    };
  }

  // ---------- events ----------
  $('#form').addEventListener('input', onInput);
  $('#form').addEventListener('change', onInput);
  $('#letter').addEventListener('change', function (e) {
    if (e.target.name === 'letterMode') { st.letterMode = e.target.value; st.letterCustom = null; update(); }
  });
  $('#letterText').addEventListener('input', function (e) { st.letterCustom = e.target.value; $('#letterEdited').hidden = false; save(); });
  $('#regenBtn').addEventListener('click', function () { st.letterCustom = null; update(); });
  $('#addLine').addEventListener('click', function () {
    st.lines.push({ cat: '', key: 'flaeche' });
    renderLines();
    update();
    var sel = $$('#lines select[data-k="cat"]').pop();
    if (sel) sel.focus();
  });
  $('#lines').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rm]');
    if (!b) return;
    st.lines.splice(+b.getAttribute('data-rm'), 1);
    renderLines();
    update();
  });
  $('#exampleBtn').addEventListener('click', function () { st = Object.assign(blank(), example()); fillForm(); update(); });
  $('#clearBtn').addEventListener('click', function () {
    if (!window.confirm(t('clear_confirm'))) return;
    store.del(KEY);
    st = blank(); meta = { uses: 0, sent: 0 };
    fillForm(); update();
  });
  $('#printBtn').addEventListener('click', function () {
    $('#printLetter').textContent = $('#letterText').value;
    markSent();
    window.print();
  });
  $('#copyBtn').addEventListener('click', function () {
    var b = $('#copyBtn');
    var done = function () { b.textContent = t('copied'); setTimeout(function () { b.textContent = t('copy'); }, 1500); markSent(); };
    var txt = $('#letterText').value;
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { $('#letterText').select(); });
    else { $('#letterText').select(); document.execCommand('copy'); done(); }
  });
  window.addEventListener('beforeprint', function () { $('#printLetter').textContent = $('#letterText').value; });
  $$('.lang button').forEach(function (b) {
    b.addEventListener('click', function () {
      lang = b.getAttribute('data-lang');
      var u = new URL(location.href);
      u.searchParams.set('lang', lang);
      history.replaceState(null, '', u.pathname + u.search + u.hash);
      applyLang(); fillForm(); update();
    });
  });

  // a "use" = a visit with something entered; the email offer comes from the second one
  if (st.start || st.received || (st.lines[0] && st.lines[0].cat)) meta.uses = (meta.uses || 0) + 1;
  // #example opens the tool with the sample statement (used for the screenshot on the tool page)
  if (location.hash === '#example') st = Object.assign(blank(), example());
  applyLang();
  fillForm();
  update();
})();
