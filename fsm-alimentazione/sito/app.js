/* FSM · Interfaccia del tool. Tutto resta nel browser: nessun dato viene inviato a server esterni. */
(function () {
  'use strict';
  var E = window.FSMEngine, D = window.FSMDoc;
  var $ = function (id) { return document.getElementById(id); };
  var S = { db: null, dbInfo: '', tpl: null, img: {}, settings: null, plan: null, input: null, exclude: [], seed: 1, onDays: [0, 2, 4] };
  var LS = { settings: 'fsm_settings_v1', profiles: 'fsm_profiles_v1', db: 'fsm_db_v1', tpl: 'fsm_tpl_v1', last: 'fsm_last_v1' };
  var DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast('Spazio del browser esaurito: esporta e pulisci l’archivio.', 'err'); return false; } }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function r0(x) { return Math.round(x); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function sgn(x, d) { var v = d ? r1(x) : r0(x); return (v > 0 ? '+' : '') + v; }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function toast(msg, cls) { var el = $('status'); el.innerHTML = '<div class="' + (cls || 'ok') + '">' + esc(msg) + '</div>'; clearTimeout(toast.t); toast.t = setTimeout(function () { el.innerHTML = ''; }, 6000); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function dot(c) { return '<span class="dot ' + c + '"></span>'; }
  function worst(a, b) { var o = { green: 0, yellow: 1, red: 2 }; return o[a] >= o[b] ? a : b; }

  // ───────────────────────── impostazioni ─────────────────────────
  function defaultSettings() { return { dist: E.clone(E.DEFAULT_DIST), nCol: 10, nSnack: 8, water: 2.5, freeMealText: 'PER LE PRIME 2 SETTIMANE NO PASTI LIBERI, DALLA 3a SETTIMANA SI INSERISCE 1-2 PASTI LIBERI A SETTIMANA COME DA PROTOCOLLO!' }; }
  S.settings = Object.assign(defaultSettings(), lsGet(LS.settings, {}));

  // ───────────────────────── database Excel ─────────────────────────
  function parseWorkbook(wb) {
    var X = window.XLSX;
    var sh = wb.Sheets.Alimenti || wb.Sheets[wb.SheetNames[0]];
    var rows = X.utils.sheet_to_json(sh, { defval: null });
    if (!rows.length || !('id' in rows[0]) || !('kcal' in rows[0])) throw new Error('Il foglio "Alimenti" non ha le colonne attese (id, kcal…).');
    var dict = wb.Sheets.Dizionario_colonne ? X.utils.sheet_to_json(wb.Sheets.Dizionario_colonne, { defval: null }) : [];
    var legend = [], lg = wb.Sheets.Legenda;
    if (lg) {
      var range = X.utils.decode_range(lg['!ref']), start = -1;
      for (var r = range.s.r; r <= range.e.r; r++) {
        var a = lg[X.utils.encode_cell({ r: r, c: 0 })];
        if (a && String(a.v).trim().toLowerCase() === 'colonna') { start = r + 1; continue; }
        if (start >= 0 && a && a.v) {
          var b = lg[X.utils.encode_cell({ r: r, c: 1 })], c = lg[X.utils.encode_cell({ r: r, c: 2 })];
          var col = c && c.s && c.s.fgColor && c.s.fgColor.rgb ? '#' + String(c.s.fgColor.rgb).slice(-6) : null;
          if (/^(all_|int_|nichel|fodmap)/.test(String(a.v))) legend.push({ col: String(a.v).trim(), label: b ? String(b.v) : '', color: col });
        }
      }
    }
    return { rows: rows, dict: dict, legend: legend };
  }
  function loadDbData(data, info) {
    S.db = E.buildDB(data.rows, data.dict, data.legend);
    S.dbInfo = info + ' · ' + S.db.order.length + ' alimenti';
    renderFlags(); updateDbInfo();
  }
  function initDb() {
    var saved = lsGet(LS.db, null);
    if (saved && saved.rows) { loadDbData(saved, 'Database aggiornato il ' + saved.date + (saved.name ? ' (' + saved.name + ')' : '')); return Promise.resolve(); }
    return fetch('Database_alimenti.xlsx').then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(function (buf) { loadDbData(parseWorkbook(XLSX.read(buf, { type: 'array', cellStyles: true })), 'Database incluso'); })
      .catch(function () { toast('Non riesco a leggere Database_alimenti.xlsx (se apri il file dal computer, caricalo con “Aggiorna database”).', 'warn'); });
  }
  function onDbFile(file) {
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var data = parseWorkbook(XLSX.read(new Uint8Array(rd.result), { type: 'array', cellStyles: true }));
        var d = new Date(); data.date = d.toLocaleDateString('it-IT') + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); data.name = file.name;
        lsSet(LS.db, data);
        loadDbData(data, 'Database aggiornato il ' + data.date + ' (' + file.name + ')');
        toast('Database aggiornato: ' + S.db.order.length + ' alimenti letti da "' + file.name + '".');
      } catch (e) { toast('File non valido: ' + e.message, 'err'); }
    };
    rd.readAsArrayBuffer(file);
  }
  function updateDbInfo() { var el = $('dbInfo'); if (el) el.textContent = (S.dbInfo || 'Database non caricato') + ' · Modello Word: ' + (S.tpl ? S.tplInfo : 'non caricato'); }

  // ───────────────────────── modello Word ─────────────────────────
  function b64ToBuf(b64) { var bin = atob(b64), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a.buffer; }
  function bufToB64(buf) { var a = new Uint8Array(buf), s = ''; for (var i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); }
  function setTemplate(buf, info) {
    S.tpl = buf; S.tplInfo = info;
    JSZip.loadAsync(buf).then(function (zip) {
      var rels = zip.file('word/_rels/header1.xml.rels'), hdr = zip.file('word/header1.xml');
      if (!rels || !hdr) return;
      return Promise.all([rels.async('string'), hdr.async('string')]).then(function (x) {
        var map = {}; x[0].replace(/Id="([^"]+)"[^>]*Target="([^"]+)"/g, function (_, id, t) { map[id] = t; });
        x[0].replace(/Target="([^"]+)"[^>]*Id="([^"]+)"/g, function (_, t, id) { map[id] = t; });
        var anchors = x[1].split('<wp:anchor').slice(1), jobs = [];
        anchors.forEach(function (a) {
          var m = /r:embed="([^"]+)"/.exec(a); if (!m || !map[m[1]]) return;
          var key = /behindDoc="1"/.test(a) ? 'wm' : 'logo', f = zip.file('word/' + map[m[1]]);
          if (f) jobs.push(f.async('base64').then(function (b) { S.img[key] = 'data:image/png;base64,' + b; }));
        });
        return Promise.all(jobs);
      });
    }).catch(function () { });
    updateDbInfo();
  }
  function initTpl() {
    var saved = null; try { saved = localStorage.getItem(LS.tpl); } catch (e) { }
    if (saved) { setTemplate(b64ToBuf(saved), 'caricato manualmente'); return Promise.resolve(); }
    return fetch('FSM_ALIMENTAZIONE.docx').then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(function (b) { setTemplate(b, 'FSM_ALIMENTAZIONE.docx incluso'); })
      .catch(function () { updateDbInfo(); });
  }

  // ───────────────────────── form: dati cliente ─────────────────────────
  function renderFlags() {
    if (!S.db) return;
    var cur = currentFlags();
    $('flags').innerHTML = S.db.flags.map(function (k) {
      var f = S.db.flagInfo[k] || { label: k, color: '#eee' };
      return '<label class="chip" title="' + esc(k) + '"><input type="checkbox" data-flag="' + esc(k) + '"' + (cur.indexOf(k) >= 0 ? ' checked' : '') + '><span class="sw" style="background:' + esc(f.color) + '"></span>' + esc(f.label) + '</label>';
    }).join('');
  }
  function currentFlags() { return Array.prototype.map.call(document.querySelectorAll('[data-flag]:checked'), function (x) { return x.getAttribute('data-flag'); }); }
  function tgtBox(key, title, vals) {
    vals = vals || {};
    return '<div class="tgt" data-t="' + key + '"><h4>' + title + '</h4><div class="grid3">' +
      '<label>Kcal (±50)<input type="number" inputmode="numeric" data-k="kcal" value="' + esc(vals.kcal || '') + '"></label>' +
      '<label>Proteine g (±10)<input type="number" inputmode="numeric" data-k="P" value="' + esc(vals.P || '') + '"></label>' +
      '<label>Grassi g (±10)<input type="number" inputmode="numeric" data-k="F" value="' + esc(vals.F || '') + '"></label>' +
      '</div><div class="carb" data-carb></div><div data-tw></div></div>';
  }
  function renderTargets(vals) {
    vals = vals || {};
    $('targets').innerHTML = $('onoff').checked ? tgtBox('on', 'Giorni ON', vals.on) + tgtBox('off', 'Giorni OFF', vals.off) : tgtBox('std', 'Target giornaliero', vals.std);
    updateCarbs(); renderDaily();
  }
  function readT(key) {
    var box = document.querySelector('.tgt[data-t="' + key + '"]'); if (!box) return null;
    var g = function (k) { var v = parseFloat(box.querySelector('[data-k="' + k + '"]').value); return isFinite(v) ? v : null; };
    return { kcal: g('kcal'), P: g('P'), F: g('F') };
  }
  function updateCarbs() {
    var w = parseFloat($('weight').value);
    Array.prototype.forEach.call(document.querySelectorAll('.tgt'), function (box) {
      var t = readT(box.getAttribute('data-t')), out = box.querySelector('[data-carb]'), tw = box.querySelector('[data-tw]'), msgs = [];
      if (t.kcal && t.P !== null && t.F !== null) {
        var c = (t.kcal - t.P * 4 - t.F * 9) / 4;
        out.innerHTML = 'Carboidrati calcolati: <b>' + r0(c) + ' g</b> <span class="muted">= (kcal − P×4 − G×9) / 4</span>';
        if (c < 0) msgs.push('<div class="err">I carboidrati risultano negativi: controlla kcal, proteine e grassi.</div>');
        else if (c < 50) msgs.push('<div class="warn">Carboidrati sotto 50 g/giorno.</div>');
      } else out.innerHTML = '<span class="muted">Inserisci kcal, proteine e grassi: i carboidrati si calcolano da soli.</span>';
      if (t.P) {
        if (w) { var gk = t.P / w; if (gk > 2.5) msgs.push('<div class="warn">Proteine a ' + r1(gk) + ' g/kg: oltre 2,5 g/kg.</div>'); }
        else if (t.P > 180) msgs.push('<div class="warn">Proteine alte: inserisci il peso corporeo per verificare il limite di 2,5 g/kg.</div>');
      }
      tw.innerHTML = msgs.join('');
    });
  }
  function renderDaily() {
    var daily = planType() === 'daily';
    $('dailyOpts').hidden = !daily;
    $('onDaysBox').hidden = !$('onoff').checked;
    $('onDays').innerHTML = DAYS_SHORT.map(function (d, i) { return '<button type="button" data-day="' + i + '" class="' + (S.onDays.indexOf(i) >= 0 ? 'on' : '') + '">' + d + '</button>'; }).join('');
  }
  function planType() { var r = document.querySelector('input[name="planType"]:checked'); return r ? r.value : 'multi'; }
  function renderDistView() {
    var n = +$('nMeals').value, d = (S.settings.dist && S.settings.dist[n]) || E.DEFAULT_DIST[n];
    $('distView').innerHTML = d.map(function (x) { return '<span class="d">' + esc(cap(E.MEAL_LABEL[x[0]])) + ' ' + String(x[1]).replace('.', ',') + '%' + (x[0] === 's1' ? ' (frutta fissa)' : '') + '</span>'; }).join('');
  }
  function cap(s) { s = String(s).toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }

  function renderExclude() {
    $('exList').innerHTML = S.exclude.map(function (id) {
      var f = S.db && S.db.foods[id];
      return '<span class="chip x">No ' + esc(f ? f.name : id) + ' <button type="button" data-unex="' + esc(id) + '" aria-label="Rimuovi">✕</button></span>';
    }).join('');
  }
  function searchFoods(q) {
    q = norm(q).trim(); if (!q || !S.db) return [];
    var words = q.split(/\s+/);
    return S.db.order.filter(function (id) { var f = S.db.foods[id], t = norm(f.name + ' ' + id + ' ' + f.cat); return S.exclude.indexOf(id) < 0 && words.every(function (w) { return t.indexOf(w) >= 0; }); }).slice(0, 12);
  }

  function readInput() {
    var onoff = $('onoff').checked;
    var inp = {
      name: $('name').value.trim(), goal: $('goal').value.trim(), weight: parseFloat($('weight').value) || null, sex: $('sex').value,
      onoff: onoff, nMeals: +$('nMeals').value, planType: planType(),
      prefs: { flags: currentFlags(), vegetarian: $('p_vegetarian').checked, vegan: $('p_vegan').checked, noRed: $('p_noRed').checked, noPork: $('p_noPork').checked, noRawSmoked: $('p_noRawSmoked').checked, exclude: S.exclude.slice() },
      onDays: S.onDays.slice(), freeMeal: { day: $('freeDay').value, meal: $('freeMeal').value }, training: $('training').value
    };
    if (onoff) { inp.on = readT('on'); inp.off = readT('off'); } else inp.std = readT('std');
    return inp;
  }
  function fillForm(inp) {
    $('name').value = inp.name || ''; $('goal').value = inp.goal || ''; $('weight').value = inp.weight || ''; $('sex').value = inp.sex || '';
    $('onoff').checked = !!inp.onoff; $('nMeals').value = inp.nMeals || 5;
    Array.prototype.forEach.call(document.querySelectorAll('input[name="planType"]'), function (r) { r.checked = r.value === (inp.planType || 'multi'); });
    var p = inp.prefs || {};
    ['vegetarian', 'vegan', 'noRed', 'noPork', 'noRawSmoked'].forEach(function (k) { $('p_' + k).checked = !!p[k]; });
    S.exclude = (p.exclude || []).slice();
    Array.prototype.forEach.call(document.querySelectorAll('[data-flag]'), function (x) { x.checked = (p.flags || []).indexOf(x.getAttribute('data-flag')) >= 0; });
    S.onDays = (inp.onDays || [0, 2, 4]).slice();
    $('freeDay').value = inp.freeMeal ? inp.freeMeal.day : ''; $('freeMeal').value = inp.freeMeal && inp.freeMeal.meal || 'cen';
    $('training').value = inp.training || 'sera';
    renderTargets({ on: inp.on, off: inp.off, std: inp.std }); renderExclude(); renderDistView();
  }
  function validate(inp) {
    var errs = [];
    if (!inp.name) errs.push('Inserisci nome e cognome.');
    var sets = inp.onoff ? [['ON', inp.on], ['OFF', inp.off]] : [['', inp.std]];
    sets.forEach(function (s) {
      var t = s[1], l = s[0] ? ' (' + s[0] + ')' : '';
      if (!t || !t.kcal || !t.P || t.F === null) { errs.push('Completa kcal, proteine e grassi' + l + '.'); return; }
      if ((t.kcal - t.P * 4 - t.F * 9) / 4 < 0) errs.push('Carboidrati negativi' + l + ': controlla i target.');
    });
    if (!S.db) errs.push('Database alimenti non caricato.');
    return errs;
  }

  // ───────────────────────── generazione e revisione ─────────────────────────
  function generate(keep) {
    var inp = keep ? S.input : readInput();
    var errs = validate(inp);
    if (errs.length) { toast(errs.join(' '), 'err'); return; }
    if (!keep) { inp._locked = {}; inp._override = {}; }
    S.input = inp;
    lsSet(LS.last, inp);
    try { S.plan = E.generate(S.db, inp, S.settings, S.seed); }
    catch (e) { console.error(e); toast('Errore durante il calcolo: ' + e.message, 'err'); return; }
    show('review'); renderReview();
  }
  function lightRow(label, tg, act, tol) {
    var d = act - tg, l = tol ? E.light(d, tol) : 'green';
    return '<tr><td>' + label + '</td><td class="n">' + r0(tg) + '</td><td class="n">' + r0(act) + '</td><td class="n">' + sgn(d) + '</td><td>' + (tol ? dot(l) + '±' + tol : '<span class="muted">calcolati</span>') + '</td></tr>';
  }
  function dayTable(tg, tot) {
    return '<table class="r"><tr><th>Valore</th><th>Target</th><th>Effettivo</th><th>Scarto</th><th>Tolleranza</th></tr>' +
      lightRow('Kcal', tg.K, tot.K, 50) + lightRow('Proteine (g)', tg.P, tot.P, 10) + lightRow('Carboidrati (g)', tg.C, tot.C, 0) + lightRow('Grassi (g)', tg.F, tot.F, 10) + '</table>';
  }
  function microTable(mr) {
    return '<table class="r"><tr><th>Micronutriente</th><th>Giornata</th><th>Riferimento</th><th></th></tr>' + mr.map(function (m) {
      var ref = m.type === 'max' || m.type === 'maxPct' ? '< ' + r0(m.ref) : '≥ ' + r0(m.ref);
      return '<tr><td>' + esc(m.label) + '</td><td class="n">' + (m.unit === 'µg' ? r1(m.value) : r0(m.value)) + ' ' + m.unit + '</td><td>' + ref + ' ' + m.unit + ' <span class="muted">(' + esc(m.src) + ')</span></td><td>' + dot(m.status) + (m.missing ? '<span class="muted">' + m.missing + ' alimenti senza dato</span>' : '') + '</td></tr>';
    }).join('') + '</table>';
  }
  function macroCell(t, tg) {
    var lk = E.light(t.K - tg.K, 0.08 * tg.K), lp = E.light(t.P - tg.P, 5), l = worst(lk, lp);
    return dot(l) + r0(t.K) + ' kcal (' + sgn(t.K - tg.K) + ') · P ' + r1(t.P) + ' (' + sgn(t.P - tg.P, 1) + ') · C ' + r0(t.C) + ' · G ' + r0(t.F);
  }
  function tgCell(tg) { return r0(tg.K) + ' kcal · P ' + r0(tg.P) + ' · C ' + r0(tg.C) + ' · G ' + r0(tg.F); }
  function fname(id) { var f = S.db.foods[id]; return f ? (E.SHORT[id] || f.name) : id; }
  function qtyInput(attrs, f, g) {
    var q = E.qty(f, g), unit = f.isUnit ? 'pz' : (f.gpm ? 'ml' : 'g');
    return '<input class="qin" type="number" inputmode="decimal" min="0" step="' + (f.isUnit ? 1 : 5) + '" value="' + q.n + '" ' + attrs + '> ' + unit;
  }
  function fromQty(f, v) { v = +v || 0; return f.isUnit ? v * f.unitG : (f.gpm ? v * f.gpm : v); }

  function renderReview() {
    var p = S.plan, h = '', ctx = p.ctx;
    var warns = (p.warnings || []).slice();
    if (p.type === 'multi') p.meals.forEach(function (m) { warns = warns.concat(m.warnings || []); });
    h += '<div class="card"><h2>Riepilogo coach <span class="tag">non va nel documento</span></h2>';
    h += '<p class="muted">' + esc(S.input.name) + ' · ' + esc(S.input.goal || '') + ' · ' + S.input.nMeals + ' pasti · ' + (p.type === 'multi' ? 'scelte multiple' : 'giorno per giorno') + '</p>';
    if (warns.length) h += warns.map(function (w) { return '<div class="warn">' + esc(w) + '</div>'; }).join('');
    if (p.type === 'multi') {
      h += '<div class="daygrid">' + p.dayTypes.map(function (d) {
        var dd = p.days[d];
        return '<div><h4>' + (d === 'STD' ? 'Giornata tipo' : 'Giornata tipo ' + d) + ' ' + dot(dd.ok ? 'green' : 'red') + '</h4>' + dayTable(p.targets[d], dd.tot) +
          '<p class="muted">Giornata tipo = opzione più vicina al target per ogni pasto. Combinando le opzioni la giornata varia tra ' + r0(dd.range[0]) + ' e ' + r0(dd.range[1]) + ' kcal.</p>' +
          '<h4>Micronutrienti</h4>' + microTable(dd.micro) + '</div>';
      }).join('') + '</div></div>';
      p.meals.forEach(function (m, mi) { h += renderMultiMeal(m, mi); });
    } else {
      var w = p.weekly;
      h += w.exceptions.length ? '<h4>Eccezioni alle regole di bilanciamento</h4>' + w.exceptions.map(function (x) { return '<div class="warn">' + esc(x) + '</div>'; }).join('') : '<div class="ok">Tutte le regole di bilanciamento della settimana sono rispettate.</div>';
      var c = w.counts;
      h += '<p class="muted">Settimana: pesce ' + c.pesce + ' (grasso ' + c.pesce_grasso + ') · legumi ' + c.legumi + ' · carne rossa ' + c.rossa + ' · salumi ' + c.salume + ' · uova ' + c.uova + '</p>';
      h += '<h4>Micronutrienti (media dei giorni)</h4>' + microTable(w.avgMicro) + '</div>';
      h += '<div class="daygrid">' + p.days.map(function (day, di) { return renderDay(day, di); }).join('') + '</div>';
    }
    $('review').innerHTML = h;
  }
  function renderMultiMeal(m, mi) {
    var p = S.plan, ctx = p.ctx, dts = p.dayTypes;
    var h = '<div class="card meal"><h3>' + esc(m.label) + '</h3>';
    h += '<p class="muted">Target: ' + dts.map(function (d) { return (d !== 'STD' ? d + ' ' : '') + tgCell(m.targets[d]); }).join(' &nbsp;|&nbsp; ') + '</p>';
    if (m.kind === 'fruit') { h += '<p>1 banana media oppure 1 porzione di frutta (fissa ≈ ' + r0(ctx.fruitKcal) + ' kcal).</p></div>'; return h; }
    if (m.kind === 'small') {
      if (!m.options.length) h += '<div class="err">Nessuna opzione valida: rivedi i target o le esclusioni.</div>';
      m.options.forEach(function (o, oi) {
        var od0 = o.byDay[dts[0]];
        h += '<div class="opt' + (o.locked ? ' locked' : '') + '"><div class="hd"><b>Opzione ' + (oi + 1) + (od0.name ? ' “' + esc(od0.name) + '”' : '') + '</b> <span class="tag">' + esc(o.group) + '</span><span class="grow"></span>' +
          '<button class="mini' + (o.locked ? ' on' : '') + '" data-act="lock" data-m="' + mi + '" data-o="' + oi + '">' + (o.locked ? '🔒 Bloccata' : '🔓 Blocca') + '</button>' +
          '<button class="mini" data-act="regen" data-m="' + mi + '" data-o="' + oi + '"' + (o.locked ? ' disabled' : '') + '>↻ Rigenera</button></div>';
        h += '<div class="scroll"><table class="r"><tr><th>Alimento</th>' + dts.map(function (d) { return '<th>' + (d === 'STD' ? 'Quantità' : d) + '</th>'; }).join('') + '</tr>';
        var tpl = E.TEMPLATES.filter(function (t) { return t.key === o.tpl; })[0];
        tpl.comps.forEach(function (comp, ci) {
          if (comp.free) return;
          var any = null; dts.forEach(function (d) { var c = o.byDay[d].comps.filter(function (x) { return x.ci === ci; })[0]; if (c && !any) any = c; });
          if (!any) return;
          h += '<tr><td>' + esc(fname(any.id)) + (any.alts && any.alts.length ? '<br><span class="muted">oppure ' + any.alts.map(function (a) { return esc(fname(a.id)); }).join(', ') + '</span>' : '') + '</td>' + dts.map(function (d) {
            var c = o.byDay[d].comps.filter(function (x) { return x.ci === ci; })[0];
            return '<td>' + (c ? qtyInput('data-act="qo" data-m="' + mi + '" data-o="' + oi + '" data-d="' + d + '" data-ci="' + ci + '"', S.db.foods[c.id], c.g) : '—') + '</td>';
          }).join('') + '</tr>';
        });
        h += '<tr><td><b>Totale</b></td>' + dts.map(function (d) { return '<td>' + macroCell(o.byDay[d].tot, m.targets[d]) + '</td>'; }).join('') + '</tr></table></div></div>';
      });
      h += '</div>'; return h;
    }
    // pasto principale
    dts.forEach(function (d) {
      var mm = m.main[d];
      h += '<h4>' + (d !== 'STD' ? 'Giorno ' + d : 'Composizione') + '</h4>';
      if (!mm) { h += '<div class="err">Nessuna combinazione valida.</div>'; return; }
      var ref = mm.ref, oilF = S.db.foods[E.OIL];
      h += '<div class="rowx">Riferimento: ' + (ref.primo ? qtyInput('data-act="qm" data-k="primoG" data-m="' + mi + '" data-d="' + d + '"', S.db.foods[ref.primo.id], ref.primo.g) + ' ' + esc(fname(ref.primo.id)) + ' + ' : '') +
        qtyInput('data-act="qm" data-k="secG" data-m="' + mi + '" data-d="' + d + '"', S.db.foods[ref.sec.id], ref.sec.g) + ' ' + esc(fname(ref.sec.id)) + ' + ' +
        (oilF ? qtyInput('data-act="qm" data-k="oilMl" data-m="' + mi + '" data-d="' + d + '"', oilF, ref.oil) + ' olio' : '') + ' + verdura ~200 g</div>';
      h += '<p>' + macroCell(mm.refTot, mm.tg) + '</p>';
      h += '<div class="scroll"><table class="r"><tr><th>PRIMO (stessi carboidrati)</th><th>Quantità</th><th>Pasto risultante</th></tr>' + mm.primi.map(function (x) {
        var f = S.db.foods[x.ids[0]];
        return '<tr><td>' + esc(x.ids.map(fname).join(', ')) + '</td><td class="n">' + E.qty(f, x.g).text + (f.isUnit ? ' pz' : '') + '</td><td>' + macroCell(x.tot, mm.tg) + '</td></tr>';
      }).join('') + '</table>';
      h += '<table class="r"><tr><th>SECONDO (stesse proteine ≈ ' + r0(mm.secProt) + ' g)</th><th>Quantità</th><th>Correzione</th><th>Pasto risultante</th></tr>' + mm.secondi.map(function (s) {
        return '<tr><td>' + esc(s.entry.label) + '</td><td class="n">' + s.items.map(function (it) { return E.qty(S.db.foods[it.id], it.g).text; }).join(' + ') + '</td><td>' + esc(s.notes.join(', ') || '—') + '</td><td>' + macroCell(s.tot, mm.tg) + '</td></tr>';
      }).join('') + '</table>';
      h += '<table class="r"><tr><th>CONDIMENTO</th><th>Quantità</th><th>Pasto risultante</th></tr>' + mm.condimenti.map(function (c) {
        return '<tr><td>' + esc(c.items.map(function (it) { return fname(it.id); }).join(' + ')) + '</td><td class="n">' + c.items.map(function (it) { return E.qty(S.db.foods[it.id], it.g).text; }).join(' + ') + '</td><td>' + macroCell(c.tot, mm.tg) + '</td></tr>';
      }).join('') + '</table></div>';
      if (mm.legumi) h += '<p><b>Legumi:</b> ' + (mm.legumi.dryG ? mm.legumi.dryG + ' g secchi' : '') + (mm.legumi.canG ? ' / ' + mm.legumi.canG + ' g in barattolo' : '') + ' al posto del primo, ' + esc(mm.legumi.text) + ' → ' + macroCell(mm.legumi.tot, mm.tg) + '</p>';
      else h += '<p class="muted">Legumi non inseriti (esclusi o fuori tolleranza).</p>';
    });
    h += '</div>'; return h;
  }
  function renderDay(day, di) {
    var p = S.plan, tg = day.tgEff;
    var l = worst(worst(E.light(day.tot.K - tg.K, 50), E.light(day.tot.P - tg.P, 10)), E.light(day.tot.F - tg.F, 10));
    var h = '<div class="card meal"><div class="rowx"><h3 style="margin:0">' + esc(day.name) + (p.onoff ? ' · ' + day.type : '') + '</h3><span class="grow"></span><button class="mini" data-act="regday" data-d="' + di + '">↻ Rigenera giorno</button></div>';
    h += '<p>' + dot(l) + r0(day.tot.K) + '/' + r0(tg.K) + ' kcal · P ' + r0(day.tot.P) + '/' + r0(tg.P) + ' · C ' + r0(day.tot.C) + '/' + r0(tg.C) + ' · G ' + r0(day.tot.F) + '/' + r0(tg.F) + (day.hasFree ? ' <span class="tag">pasto libero escluso</span>' : '') + '</p>';
    h += '<p class="muted">Frutta+verdura ' + r0(day.checks ? day.checks.fv : 0) + ' g · fibra ' + r1(day.tot.micro.fibra_g) + ' g · sodio ' + r0(day.tot.micro.sodio_mg) + ' mg · latticini ' + (day.checks ? day.checks.dairy : 0) + '</p>';
    day.meals.forEach(function (m, mi) {
      h += '<div class="opt' + (m.locked ? ' locked' : '') + '"><div class="hd"><b>' + esc(m.label) + '</b>' + (m.name ? ' <span class="tag">' + esc(m.name) + '</span>' : '') + '<span class="grow"></span>' +
        (m.free ? '' : '<button class="mini' + (m.locked ? ' on' : '') + '" data-act="lockm" data-d="' + di + '" data-mi="' + mi + '">' + (m.locked ? '🔒' : '🔓') + '</button>') + '</div>';
      if (m.free) { h += '<p>PASTO LIBERO</p></div>'; return; }
      h += '<table class="r">' + m.items.map(function (it, ii) {
        return '<tr><td>' + esc(fname(it.id)) + '</td><td class="n">' + qtyInput('data-act="qd" data-d="' + di + '" data-mi="' + mi + '" data-ii="' + ii + '"', S.db.foods[it.id], it.g) + '</td></tr>';
      }).join('') + '</table>' + (m.tot ? '<div>' + macroCell(m.tot, m.tg) + '</div>' : '') + '</div>';
    });
    return h + '</div>';
  }

  // azioni nel riepilogo
  function onReviewClick(e) {
    var b = e.target.closest('button[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act'), p = S.plan, ctx = p.ctx;
    if (act === 'lock') {
      var m = p.meals[+b.getAttribute('data-m')], o = m.options[+b.getAttribute('data-o')];
      o.locked = !o.locked;
      S.input._locked[m.key] = m.options.filter(function (x) { return x.locked; });
      renderReview();
    } else if (act === 'regen') {
      var m2 = p.meals[+b.getAttribute('data-m')], oi = +b.getAttribute('data-o');
      var shown = m2.options.map(function (x) { return x.tpl; });
      var next = (m2.cands || []).filter(function (c) { return shown.indexOf(c.tpl) < 0; })[0];
      if (!next) { // variante della stessa opzione: forza un ingrediente diverso nelle quantità
        var cur = m2.options[oi], tpl = E.TEMPLATES.filter(function (t) { return t.key === cur.tpl; })[0], ok = true, byDay = {};
        var bounds = {}; S.seed++;
        var rnd = E.rng(S.seed);
        tpl.comps.forEach(function (c, i) { if (!c.free && c.max > c.min) { var a = c.min + (c.max - c.min) * rnd() * 0.6; bounds[i] = [Math.max(c.min, a * 0.8), Math.min(c.max, a * 1.6 + 10)]; } });
        p.dayTypes.forEach(function (d) { var x = E.buildOption(ctx, tpl, m2.targets[d], { bounds: bounds }); byDay[d] = x; if (!x || !x.ok) ok = false; });
        if (!ok) { toast('Non ci sono altre opzioni valide per questo pasto.', 'warn'); return; }
        next = { tpl: cur.tpl, group: cur.group, byDay: byDay, locked: false };
      }
      m2.options[oi] = next;
      E.evaluateMulti(p); renderReview();
    } else if (act === 'regday') {
      S.seed++; E.regenerateDay(p, +b.getAttribute('data-d'), S.seed * 7919); renderReview();
    } else if (act === 'lockm') {
      var mm = p.days[+b.getAttribute('data-d')].meals[+b.getAttribute('data-mi')]; mm.locked = !mm.locked; renderReview();
    }
  }
  function onReviewChange(e) {
    var t = e.target; if (!t.matches('input[data-act]')) return;
    var act = t.getAttribute('data-act'), p = S.plan, ctx = p.ctx;
    if (act === 'qo') {
      var m = p.meals[+t.getAttribute('data-m')], o = m.options[+t.getAttribute('data-o')], d = t.getAttribute('data-d'), ci = +t.getAttribute('data-ci');
      var od = o.byDay[d], c = od.comps.filter(function (x) { return x.ci === ci; })[0];
      c.g = fromQty(S.db.foods[c.id], t.value);
      E.refreshOption(ctx, od, m.targets[d]);
      if (!od.ok) toast('Attenzione: con questa modifica l’opzione è fuori tolleranza (±8% kcal, ±5 g proteine).', 'warn');
      E.evaluateMulti(p);
    } else if (act === 'qm') {
      var m2 = p.meals[+t.getAttribute('data-m')], d2 = t.getAttribute('data-d'), k = t.getAttribute('data-k');
      var ov = (S.input._override[m2.key] = S.input._override[m2.key] || {}); ov[d2] = ov[d2] || {};
      var mm = m2.main[d2];
      ov[d2].primoG = mm.ref.primo ? mm.ref.primo.g : undefined; ov[d2].secG = mm.ref.sec.g; ov[d2].oilMl = mm.oilMl;
      ov[d2][k] = k === 'oilMl' ? +t.value || 0 : fromQty(S.db.foods[k === 'primoG' ? mm.ref.primo.id : mm.ref.sec.id], t.value);
      ctx.warnings.length = 0;
      m2.main[d2] = E.mainMeal(ctx, m2.targets[d2], ov[d2]);
      E.evaluateMulti(p);
    } else if (act === 'qd') {
      var day = p.days[+t.getAttribute('data-d')], ml = day.meals[+t.getAttribute('data-mi')], it = ml.items[+t.getAttribute('data-ii')];
      it.g = fromQty(S.db.foods[it.id], t.value);
      E.recomputeDay(p, day); E.weeklyChecks(p);
    }
    renderReview();
  }

  // ───────────────────────── documento ─────────────────────────
  function blocks() { return D.buildDocModel(S.plan, S.settings); }
  function invalidCheck() {
    var p = S.plan, bad = [];
    if (p.type === 'multi') {
      p.meals.forEach(function (m) {
        if (m.kind === 'small' && !m.options.length) bad.push(m.label + ': nessuna opzione');
        if (m.kind === 'small') m.options.forEach(function (o, i) { p.dayTypes.forEach(function (d) { if (!o.byDay[d].ok) bad.push(m.label + ' opzione ' + (i + 1) + ' (' + d + ') fuori tolleranza'); }); });
        if (m.kind === 'main') p.dayTypes.forEach(function (d) { if (!m.main[d]) bad.push(m.label + ' ' + d + ': nessuna combinazione'); });
      });
      p.dayTypes.forEach(function (d) { if (!p.days[d].ok) bad.push('Giornata tipo ' + d + ' fuori tolleranza'); });
    } else p.days.forEach(function (d) { if (!d.ok) bad.push(d.name + ' fuori tolleranza'); });
    return bad;
  }
  function confirmIssues() {
    var bad = invalidCheck();
    return !bad.length || window.confirm('Ci sono valori da controllare:\n• ' + bad.slice(0, 8).join('\n• ') + (bad.length > 8 ? '\n…' : '') + '\n\nGenerare comunque il documento?');
  }
  function download(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  function makeDocx() {
    if (!S.tpl) { toast('Modello Word non caricato: scegli il file FSM_ALIMENTAZIONE.docx.', 'warn'); $('fileTpl').click(); return; }
    if (!confirmIssues()) return;
    var name = D.fileName(S.input);
    D.makeDocx(window.JSZip, S.tpl, blocks(), { title: 'Consigli alimentari ' + S.input.name }).then(function (blob) {
      download(blob, name); toast('Creato ' + name);
    }).catch(function (e) { toast('Errore nella creazione del Word: ' + e.message, 'err'); });
  }
  function printCss() {
    return '@page{size:A4;margin:0}' +
      'html,body{margin:0;padding:0}body{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:15pt;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      '.band{position:fixed;left:0;right:0;height:1.1cm;background:#002060}.band.t{top:0}.band.b{bottom:0;color:#fff;text-align:center;font-size:12pt;line-height:1.1cm}' +
      '.logo{position:fixed;top:0.15cm;left:50%;width:2.4cm;margin-left:-1.2cm}.wm{position:fixed;top:6.2cm;left:3.9cm;width:13.6cm;z-index:-1}' +
      'table.page{width:100%;border-collapse:collapse}table.page>thead td{height:3cm}table.page>tfoot td{height:1.8cm}table.page>tbody>tr>td{padding:0 2cm}' +
      'p{margin:0}.kn{break-after:avoid}.pb{break-after:page}table.t{width:100%;border-collapse:collapse;font-size:13pt;margin-bottom:8pt}' +
      'table.t th{background:#002060;color:#F5BA02;text-align:left;padding:2pt 4pt}table.t td{border:1px solid #BFBFBF;padding:2pt 4pt}table.t tr{break-inside:avoid}';
  }
  function docHtml() {
    return '<!doctype html><html lang="it"><head><meta charset="utf-8"><title>' + esc(D.fileName(S.input).replace('.docx', '')) + '</title><style>' + printCss() + '</style></head><body>' +
      '<div class="band t"></div>' + (S.img.logo ? '<img class="logo" src="' + S.img.logo + '">' : '') + (S.img.wm ? '<img class="wm" src="' + S.img.wm + '">' : '') +
      '<div class="band b">www.fisicosumisura.it</div>' +
      '<table class="page"><thead><tr><td></td></tr></thead><tfoot><tr><td></td></tr></tfoot><tbody><tr><td>' + D.toHtml(blocks()) + '</td></tr></tbody></table></body></html>';
  }
  function makePdf() {
    if (!confirmIssues()) return;
    var fr = document.createElement('iframe');
    fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(fr);
    var doc = fr.contentWindow.document; doc.open(); doc.write(docHtml()); doc.close();
    toast('Nella finestra di stampa scegli “Salva come PDF”.');
    setTimeout(function () { fr.contentWindow.focus(); fr.contentWindow.print(); setTimeout(function () { fr.remove(); }, 60000); }, 600);
  }
  function preview() {
    $('modalBody').innerHTML = '<div class="docprev">' + D.toHtml(blocks()) + '</div>';
    $('modal').hidden = false;
  }

  // ───────────────────────── archivio profili ─────────────────────────
  function profiles() { return lsGet(LS.profiles, {}); }
  function saveProfile() {
    var inp = readInput();
    if (!inp.name) { toast('Inserisci nome e cognome per salvare il profilo.', 'warn'); return; }
    var all = profiles(), id = norm(inp.name).replace(/[^a-z0-9]+/g, '_') + '__' + norm(inp.goal).replace(/[^a-z0-9]+/g, '_');
    all[id] = { id: id, name: inp.name, goal: inp.goal, savedAt: new Date().toISOString(), input: inp };
    if (lsSet(LS.profiles, all)) toast('Profilo salvato: ' + inp.name + (inp.goal ? ' · ' + inp.goal : ''));
  }
  function renderArchive() {
    var all = profiles(), ids = Object.keys(all).sort(function (a, b) { return all[b].savedAt < all[a].savedAt ? -1 : 1; });
    $('archive').innerHTML = ids.length ? '<table class="r"><tr><th>Cliente</th><th>Obiettivo / fase</th><th>Salvato</th><th></th></tr>' + ids.map(function (id) {
      var p = all[id];
      return '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.goal || '') + '</td><td>' + new Date(p.savedAt).toLocaleDateString('it-IT') + '</td><td>' +
        '<button class="mini" data-pact="load" data-id="' + esc(id) + '">Apri</button> <button class="mini" data-pact="next" data-id="' + esc(id) + '">Fase successiva</button> <button class="mini" data-pact="del" data-id="' + esc(id) + '">Elimina</button></td></tr>';
    }).join('') + '</table>' : '<p class="muted">Nessun profilo salvato.</p>';
  }
  function onArchiveClick(e) {
    var b = e.target.closest('button[data-pact]'); if (!b) return;
    var all = profiles(), p = all[b.getAttribute('data-id')], act = b.getAttribute('data-pact');
    if (!p) return;
    if (act === 'del') { if (confirm('Eliminare il profilo di ' + p.name + '?')) { delete all[p.id]; lsSet(LS.profiles, all); renderArchive(); } return; }
    var inp = E.clone(p.input);
    if (act === 'next') inp.goal = (inp.goal || '').replace(/fase\s*(\d+)/i, function (_, n) { return 'Fase ' + (+n + 1); });
    fillForm(inp); show('client');
    toast(act === 'next' ? 'Dati di ' + p.name + ' caricati per la fase successiva: aggiorna i target.' : 'Profilo di ' + p.name + ' caricato.');
  }
  function exportProfiles() {
    var blob = new Blob([JSON.stringify({ tipo: 'FSM profili clienti', esportato: new Date().toISOString(), profili: profiles(), impostazioni: S.settings }, null, 2)], { type: 'application/json' });
    download(blob, 'FSM_profili_' + new Date().toISOString().slice(0, 10) + '.json');
  }
  function importProfiles(file) {
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var data = JSON.parse(rd.result), inc = data.profili || data, all = profiles(), n = 0;
        Object.keys(inc).forEach(function (k) { if (inc[k] && inc[k].input) { all[k] = inc[k]; n++; } });
        lsSet(LS.profiles, all); renderArchive(); toast('Importati ' + n + ' profili.');
      } catch (e) { toast('File JSON non valido.', 'err'); }
    };
    rd.readAsText(file);
  }

  // ───────────────────────── impostazioni ─────────────────────────
  function renderSettings() {
    var s = S.settings;
    $('distEdit').innerHTML = [3, 4, 5, 6].map(function (n) {
      var d = s.dist[n] || E.DEFAULT_DIST[n];
      return '<div class="tgt"><h4>' + n + ' pasti <span class="muted" data-sum="' + n + '"></span></h4><div class="grid3">' + d.map(function (x, i) {
        return '<label>' + esc(cap(E.MEAL_LABEL[x[0]])) + '<input type="number" step="0.1" min="0" max="80" data-dist="' + n + '" data-i="' + i + '" value="' + x[1] + '"></label>';
      }).join('') + '</div></div>';
    }).join('');
    $('s_nCol').value = s.nCol; $('s_nSnack').value = s.nSnack; $('s_water').value = s.water; $('s_freeText').value = s.freeMealText;
    sumDist(); updateDbInfo();
  }
  function sumDist() {
    [3, 4, 5, 6].forEach(function (n) {
      var t = 0; Array.prototype.forEach.call(document.querySelectorAll('[data-dist="' + n + '"]'), function (x) { t += parseFloat(x.value) || 0; });
      var el = document.querySelector('[data-sum="' + n + '"]'); if (el) { el.textContent = '· totale ' + r1(t) + '%'; el.style.color = Math.abs(t - 100) > 0.5 ? '#d64545' : ''; }
    });
  }
  function saveSettings() {
    var s = E.clone(S.settings), bad = false;
    [3, 4, 5, 6].forEach(function (n) {
      var d = (s.dist[n] || E.DEFAULT_DIST[n]).map(function (x) { return x.slice(); }), t = 0;
      Array.prototype.forEach.call(document.querySelectorAll('[data-dist="' + n + '"]'), function (x) { var v = parseFloat(x.value) || 0; d[+x.getAttribute('data-i')][1] = v; t += v; });
      if (Math.abs(t - 100) > 0.5) bad = true;
      s.dist[n] = d;
    });
    if (bad) { toast('Ogni distribuzione deve sommare a 100%.', 'err'); return; }
    s.nCol = Math.max(8, Math.min(12, +$('s_nCol').value || 10)); s.nSnack = Math.max(8, Math.min(12, +$('s_nSnack').value || 8));
    s.water = Math.max(1, Math.min(5, parseFloat($('s_water').value) || 2.5)); s.freeMealText = $('s_freeText').value.trim() || defaultSettings().freeMealText;
    S.settings = s; lsSet(LS.settings, s); renderDistView(); toast('Impostazioni salvate.');
  }

  // ───────────────────────── navigazione ─────────────────────────
  function show(v) {
    ['client', 'review', 'archive', 'settings'].forEach(function (x) { $('view-' + x).hidden = x !== v; });
    Array.prototype.forEach.call(document.querySelectorAll('.nav[data-view]'), function (b) { b.classList.toggle('on', b.getAttribute('data-view') === v || (v === 'review' && b.getAttribute('data-view') === 'client')); });
    if (v === 'archive') renderArchive();
    if (v === 'settings') renderSettings();
    window.scrollTo(0, 0);
  }

  function bind() {
    Array.prototype.forEach.call(document.querySelectorAll('.nav[data-view]'), function (b) { b.onclick = function () { show(b.getAttribute('data-view')); }; });
    $('btnDb').onclick = $('btnDb2').onclick = function () { $('fileDb').click(); };
    $('fileDb').onchange = function () { if (this.files[0]) onDbFile(this.files[0]); this.value = ''; };
    $('btnDbReset').onclick = function () { try { localStorage.removeItem(LS.db); } catch (e) { } initDb().then(function () { toast('Ripristinato il database incluso.'); }); };
    $('btnTpl').onclick = function () { $('fileTpl').click(); };
    $('fileTpl').onchange = function () {
      var f = this.files[0]; if (!f) return; var rd = new FileReader();
      rd.onload = function () { setTemplate(rd.result, f.name + ' (caricato)'); try { localStorage.setItem(LS.tpl, bufToB64(rd.result)); } catch (e) { } toast('Modello Word caricato.'); };
      rd.readAsArrayBuffer(f); this.value = '';
    };
    $('onoff').onchange = function () { var v = { std: readT('std'), on: readT('on') || readT('std'), off: readT('off') || readT('std') }; renderTargets(v); };
    $('targets').oninput = updateCarbs; $('weight').oninput = updateCarbs;
    $('nMeals').onchange = renderDistView;
    Array.prototype.forEach.call(document.querySelectorAll('input[name="planType"]'), function (r) { r.onchange = renderDaily; });
    $('onDays').onclick = function (e) { var b = e.target.closest('[data-day]'); if (!b) return; var d = +b.getAttribute('data-day'), i = S.onDays.indexOf(d); if (i >= 0) S.onDays.splice(i, 1); else S.onDays.push(d); renderDaily(); };
    $('freeDay').innerHTML = '<option value="">Nessun pasto libero</option>' + E.DAYS.map(function (d, i) { return '<option value="' + i + '">' + d + '</option>'; }).join('');
    // esclusioni
    var sugIdx = -1;
    $('exSearch').oninput = function () {
      var res = searchFoods(this.value), box = $('exSug'); sugIdx = -1;
      box.innerHTML = res.map(function (id) { return '<div data-ex="' + esc(id) + '">' + esc(S.db.foods[id].name) + ' <span class="muted">· ' + esc(S.db.foods[id].cat) + '</span></div>'; }).join('');
      box.style.display = res.length ? 'block' : 'none';
    };
    $('exSearch').onkeydown = function (e) {
      var items = $('exSug').querySelectorAll('[data-ex]'); if (!items.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sugIdx = (sugIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; Array.prototype.forEach.call(items, function (x, i) { x.classList.toggle('act', i === sugIdx); }); }
      if (e.key === 'Enter') { e.preventDefault(); addEx(items[Math.max(0, sugIdx)].getAttribute('data-ex')); }
    };
    $('exSug').onclick = function (e) { var d = e.target.closest('[data-ex]'); if (d) addEx(d.getAttribute('data-ex')); };
    document.addEventListener('click', function (e) { if (!e.target.closest('.search')) $('exSug').style.display = 'none'; });
    $('exList').onclick = function (e) { var b = e.target.closest('[data-unex]'); if (!b) return; S.exclude = S.exclude.filter(function (x) { return x !== b.getAttribute('data-unex'); }); renderExclude(); };
    function addEx(id) { if (S.exclude.indexOf(id) < 0) S.exclude.push(id); $('exSearch').value = ''; $('exSug').style.display = 'none'; renderExclude(); }
    // azioni
    $('btnSave').onclick = saveProfile;
    $('btnGenerate').onclick = function () { S.seed = 1; generate(false); };
    $('btnBack').onclick = function () { show('client'); };
    $('btnRegenAll').onclick = function () { S.seed++; generate(true); toast('Piano rigenerato (le opzioni bloccate restano).'); };
    $('btnDocx').onclick = makeDocx; $('btnPdf').onclick = makePdf; $('btnPreview').onclick = preview;
    $('review').onclick = onReviewClick; $('review').onchange = onReviewChange;
    $('modalX').onclick = function () { $('modal').hidden = true; };
    $('modal').onclick = function (e) { if (e.target === this) this.hidden = true; };
    $('archive').onclick = onArchiveClick;
    $('btnExport').onclick = exportProfiles; $('btnImport').onclick = function () { $('fileImport').click(); };
    $('fileImport').onchange = function () { if (this.files[0]) importProfiles(this.files[0]); this.value = ''; };
    $('distEdit').oninput = sumDist;
    $('btnSetSave').onclick = saveSettings;
    $('btnSetReset').onclick = function () { S.settings = defaultSettings(); lsSet(LS.settings, S.settings); renderSettings(); renderDistView(); toast('Valori predefiniti ripristinati.'); };
  }

  function init() {
    if (!window.JSZip || !window.XLSX) toast('Librerie non caricate: controlla la connessione o la cartella lib/.', 'err');
    bind();
    var last = lsGet(LS.last, null);
    renderTargets(); renderDistView(); renderDaily();
    Promise.all([initDb(), initTpl()]).then(function () { if (last) fillForm(last); else renderFlags(); });
  }
  init();
})();
