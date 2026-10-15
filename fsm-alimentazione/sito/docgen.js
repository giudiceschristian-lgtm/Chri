/* FSM · Costruzione del documento cliente.
   1) buildDocModel(plan) → elenco di blocchi (titoli, paragrafi, tabelle…)
   2) toBodyXml(blocks)   → XML WordprocessingML con la stessa formattazione del modello FSM
   3) makeDocx(JSZip, modello, blocks) → sostituisce SOLO il corpo di word/document.xml
   4) toHtml(blocks)      → anteprima/stampa PDF con lo stesso aspetto */
(function (root) {
  'use strict';
  var E = (typeof module !== 'undefined' && module.exports) ? require('./engine.js') : root.FSMEngine;

  var BLUE = '002060', GOLD = 'F5BA02', ORANGE = 'FDAD00', FAQBLUE = '004B7E';
  var DISCLAIMER = 'Si declinano ogni responsabilità derivanti da un uso scorretto di queste informazioni.';

  // ───────────────────────── helper di testo ─────────────────────────
  function R(text, o) { var r = { text: text }; if (o) for (var k in o) r[k] = o[k]; return r; }
  function BR() { return { br: true }; }
  function P(runs, o) { var b = { t: 'p', runs: runs }; if (o) for (var k in o) b[k] = o[k]; return b; }
  function H(text, o) { return { t: 'h', text: text, i: !!(o && o.i) }; }
  function SUB(text) { return { t: 'sub', text: text }; }
  function NB(text, o) { return { t: 'nb', label: (o && o.label) || 'NB. ', text: text, plain: !!(o && o.plain) }; }
  function PB() { return { t: 'pb' }; }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function fmtN(x) { return String(Math.round(x)); }
  function joinAnd(a) { return a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1]; }

  // ───────────────────────── etichette alimenti ─────────────────────────
  function lbl(ctx, comp, id, plural) { return E.label(ctx, comp, id, plural); }
  function q(ctx, id, g) { // testo quantità
    var f = ctx.db.foods[id], qq = E.qty(f, g);
    if (f.isUnit) return String(qq.n);
    return qq.text;
  }
  function itemLine(ctx, comp, id, g, extraNote) { // "200g yogurt greco 0%"
    var t = E.itemText(ctx, comp, id, g);
    var notes = [];
    if (comp && comp.note) notes.push(comp.note);
    var sn = E.stateNote(ctx.db.foods[id]); if (sn && !(comp && comp.note && comp.note.indexOf('peso') >= 0)) notes.push(sn);
    if (extraNote) notes.push(extraNote);
    return t + (notes.length ? ' ' + notes.join(' ') : '');
  }
  function unitNoun(ctx, comp, id, n) { return lbl(ctx, comp, id, n !== 1); }

  // ───────────────────────── opzioni (colazioni e spuntini) ─────────────────────────
  function optionTitle(n, o) {
    var runs = [R('OPZIONE ' + n + (o.name ? ' “' + o.name + '”' : ''), { b: 1, u: 1 })];
    if (o.cap) runs.push(R(' ' + o.cap, { b: 1 }));
    return runs;
  }
  function optionRunsSingle(ctx, o) { // per piani senza ON/OFF: elenco puntato come nel modello
    var tpl = E.TEMPLATES.filter(function (t) { return t.key === o.tpl; })[0];
    var runs = [];
    (o.fixed || []).forEach(function () { runs.push(BR(), R('• 1 porzione di frutta (in basso trovi le sostituzioni)')); });
    o.comps.forEach(function (c) {
      runs.push(BR());
      if (c.free) { runs.push(R('• ' + c.free)); return; }
      var comp = tpl.comps[c.ci];
      runs.push(R('• ' + itemLine(ctx, comp, c.id, c.g)));
      c.alts.forEach(function (a) {
        var ac = comp.alts[a.ai];
        runs.push(R(' oppure ', { b: 1 }), R(itemLine(ctx, ac, a.id, a.g)));
      });
    });
    if (tpl.tail) runs.push(R(' ' + tpl.tail));
    return runs;
  }
  // tabella Alimento | Giorno ON | Giorno OFF
  function optionTable(ctx, opt, dayTypes) {
    var tpl = E.TEMPLATES.filter(function (t) { return t.key === opt.tpl; })[0];
    var rows = [];
    var first = opt.byDay[dayTypes[0]];
    if ((first.fixed || []).length) rows.push(['1 porzione di frutta (vedi sostituzioni)', '1', '1']);
    tpl.comps.forEach(function (comp, ci) {
      if (comp.free) { if (first.comps.some(function (c) { return c.free === comp.free; })) rows.push([comp.free, 'q.b.', 'q.b.']); return; }
      var per = dayTypes.map(function (d) { return opt.byDay[d].comps.filter(function (c) { return c.ci === ci; })[0]; });
      var any = per.filter(Boolean)[0]; if (!any) return;
      var f = ctx.db.foods[any.id];
      var name = f.isUnit ? cap(unitNoun(ctx, comp, any.id, 2)) : cap(lbl(ctx, comp, any.id));
      var notes = [comp.note, E.stateNote(f)].filter(Boolean).join(' ');
      rows.push([name + (notes ? ' ' + notes : '')].concat(per.map(function (c) { return c ? cellQty(ctx, c.id, c.g) : '—'; })));
      (comp.alts || []).forEach(function (ac, ai) {
        var pa = per.map(function (c) { return c ? c.alts.filter(function (a) { return a.ai === ai; })[0] : null; });
        var aa = pa.filter(Boolean)[0]; if (!aa) return;
        var af = ctx.db.foods[aa.id];
        var an = af.isUnit ? unitNoun(ctx, ac, aa.id, 2) : lbl(ctx, ac, aa.id);
        rows.push([{ runs: [R('oppure ', { b: 1 }), R(an + (ac.note ? ' ' + ac.note : ''))] }].concat(pa.map(function (a) { return a ? cellQty(ctx, a.id, a.g) : '—'; })));
      });
    });
    return rows;
  }
  function cellQty(ctx, id, g) {
    var f = ctx.db.foods[id], qq = E.qty(f, g);
    if (f.isUnit) return qq.n + (id === 'pan_bauletto_bianco' ? ' (' + Math.round(g) + 'g)' : '');
    return qq.text;
  }

  function smallMealBlocks(ctx, plan, m, blocks) {
    var dayTypes = plan.dayTypes, onoff = plan.onoff;
    blocks.push(H(m.label));
    if (m.key === 'col' && plan.interchangeable) blocks.push(NB('Colazione e Spuntino 2 si equivalgono: puoi usare un’opzione della colazione anche come spuntino e viceversa.'));
    if (m.key === 's2' && plan.interchangeable) blocks.push(NB('Puoi scegliere anche una qualsiasi opzione della COLAZIONE.'));
    if (m.key === 'col' && m.targets[dayTypes[0]].fruitInside) blocks.push(NB('La porzione di frutta è già inclusa in ogni opzione: puoi mangiarla a colazione o a metà mattina.'));
    if (onoff) blocks.push(P([R('Scegli 1 opzione: le grammature cambiano tra giorno ON e giorno OFF.', { i: 1 })]));
    var lastGroup = null, n = 0;
    m.options.forEach(function (o) {
      n++;
      if (o.group !== lastGroup) { blocks.push(SUB(o.group.toUpperCase())); lastGroup = o.group; }
      var od = o.byDay[dayTypes[0]];
      if (onoff) {
        blocks.push(P(optionTitle(n, od), { keepNext: 1, after: 80 }));
        blocks.push({ t: 'table', header: ['Alimento', 'Giorno ON', 'Giorno OFF'], widths: [5838, 1900, 1900], rows: optionTable(ctx, o, dayTypes) });
      } else {
        blocks.push(P(optionTitle(n, od).concat(optionRunsSingle(ctx, od))));
      }
      if (od.prep) blocks.push(P([R('PREPARAZIONE:', { u: 1 }), BR(), R(od.prep)]));
    });
    if (!m.options.length) blocks.push(P([R('Opzioni in definizione con il tuo coach.', { i: 1 })]));
  }

  // ───────────────────────── pasti principali (scelte multiple) ─────────────────────────
  function primoRows(ctx, plan, m) {
    var dts = plan.dayTypes, map = {}, order = [];
    dts.forEach(function (d, di) {
      var mm = m.main[d]; if (!mm) return;
      mm.primi.forEach(function (p) { p.ids.forEach(function (id) { if (!map[id]) { map[id] = { id: id, grp: p.grp, g: {} }; order.push(id); } map[id].g[d] = p.g; }); });
    });
    var groups = {}, gorder = [];
    order.forEach(function (id) {
      var x = map[id], key = x.grp + '|' + dts.map(function (d) { return x.g[d] || 0; }).join('|');
      if (!groups[key]) { groups[key] = { grp: x.grp, ids: [], g: x.g }; gorder.push(key); }
      groups[key].ids.push(id);
    });
    return gorder.map(function (k) { return groups[k]; });
  }
  function primoLabel(ctx, grp) {
    var pg = E.PRIMI[grp.grp], f = ctx.db.foods[grp.ids[0]];
    if (pg.unitGroup) return 'gallette di ' + grp.ids.map(function (id) { return id.indexOf('mais') >= 0 ? 'mais' : 'riso'; }).join('/');
    var names = grp.ids.map(function (id) { return E.SHORT[id] || ctx.db.foods[id].name.toLowerCase(); });
    var t = names.join(', ');
    if (grp.ids[0] === 'gnocchi_di_patate') t += ' (i condimenti li trovi in basso!)';
    return t;
  }
  function primoQty(ctx, grp, g) {
    var f = ctx.db.foods[grp.ids[0]];
    if (!g) return '—';
    if (f.isUnit) return String(Math.round(g / f.unitG));
    return Math.round(g) + 'g';
  }
  function secLabel(ctx, s) {
    var e = s.entry;
    if (e.combo) {
      if (e.combo[0].units) return 'uova intere + albume';
      return e.label;
    }
    var ids = ctx.all(e.ids);
    if (e.key === 'pollo') return ids.map(function (x) { return x === 'petto_di_pollo_senza_pelle' ? 'petto di pollo' : 'tacchino'; }).join('/');
    return e.label;
  }
  function secQty(ctx, s) {
    var e = s.entry;
    if (e.combo && e.combo[0].units) {
      var eg = s.items[0], al = s.items[1], ef = ctx.db.foods[eg.id];
      var n = Math.round(eg.g / ef.unitG);
      return n + (n === 1 ? ' uovo' : ' uova') + ' + ' + E.qty(ctx.db.foods[al.id], al.g).text;
    }
    if (e.combo) return s.items.map(function (it) { return E.qty(ctx.db.foods[it.id], it.g).text; }).join(' + ');
    return E.qty(ctx.db.foods[s.items[0].id], s.items[0].g).text;
  }
  function secNotes(ctx, s) {
    var n = [];
    var f = ctx.db.foods[s.items[0].id];
    var sn = E.stateNote(f); if (sn) n.push(sn.replace(/[()]/g, ''));
    if (s.entry.note) n.push(s.entry.note.replace(/[()]/g, ''));
    return n;
  }
  function adjText(s) { return s.notes.length ? s.notes.join(' e ') + '!' : ''; }

  function mainMealBlocks(ctx, plan, m, blocks, settings) {
    var dts = plan.dayTypes, onoff = plan.onoff, ref = m.main[dts[0]];
    blocks.push(H(m.label, { i: 1 }));
    if (!ref) { blocks.push(P([R('Pasto da definire con il tuo coach.', { i: 1 })])); return; }
    var hasPrimo = dts.some(function (d) { return m.main[d] && m.main[d].primi.length; });
    blocks.push(P([R('A tua preferenza componi un piatto unico o piatti divisi'), BR(),
      R(hasPrimo ? '(Componi il tuo piatto in 3 passi: 1 primo, 1 secondo e 1 condimento)' : '(Componi il tuo piatto: 1 secondo e 1 condimento)', { b: 1, i: 1, u: 1 }),
      R(' → Contorno di verdura a scelta non pesato')]));
    var step = 0;
    // PRIMO
    if (hasPrimo) {
      step++;
      var pr = primoRows(ctx, plan, m);
      var head = [R('PASSO ' + step + ' · PRIMO', { b: 1, i: 1, u: 1 }), R(' – scegli 1 di questi, si equivalgono (pesi a crudo)', { i: 1 })];
      if (onoff) {
        blocks.push(P(head, { keepNext: 1, after: 80 }));
        blocks.push({ t: 'table', header: ['Alimento', 'Giorno ON', 'Giorno OFF'], widths: [5838, 1900, 1900],
          rows: pr.map(function (g) { return [cap(primoLabel(ctx, g))].concat(dts.map(function (d) { return primoQty(ctx, g, g.g[d]); })); }) });
      } else {
        var runs = head.slice();
        pr.forEach(function (g) {
          var f = ctx.db.foods[g.ids[0]], gg = g.g[dts[0]];
          runs.push(BR(), R('• ' + (f.isUnit ? Math.round(gg / f.unitG) + ' ' : Math.round(gg) + 'g ') + primoLabel(ctx, g)));
        });
        blocks.push(P(runs));
      }
    }
    // SECONDO
    step++;
    var protTxt = dts.map(function (d) { return m.main[d] ? Math.round(m.main[d].secProt / 5) * 5 : 0; });
    var protLabel = onoff && protTxt[0] !== protTxt[1] ? 'porzione da circa ' + protTxt[0] + 'g di proteine nei giorni ON e ' + protTxt[1] + 'g nei giorni OFF' : 'porzione da circa ' + protTxt[0] + 'g di proteine';
    var sh = [R('PASSO ' + step + ' · SECONDO', { b: 1, i: 1, u: 1 }), R(' (' + protLabel + ') – scegli 1 di questi, si equivalgono', { i: 1 })];
    var keys = []; dts.forEach(function (d) { if (m.main[d]) m.main[d].secondi.forEach(function (s) { if (keys.indexOf(s.key) < 0) keys.push(s.key); }); });
    if (onoff) {
      blocks.push(P(sh, { keepNext: 1, after: 80 }));
      var rows = keys.map(function (k) {
        var per = dts.map(function (d) { return m.main[d] ? m.main[d].secondi.filter(function (s) { return s.key === k; })[0] : null; });
        var s0 = per.filter(Boolean)[0];
        var notes = secNotes(ctx, s0);
        var adj = per.map(function (s) { return s ? adjText(s) : ''; });
        var same = adj[0] === adj[1];
        var name = cap(secLabel(ctx, s0)) + (notes.length ? ' (' + notes.join(', ') + ')' : '');
        var nameCell = same && adj[0] ? { runs: [R(name + ' '), R('(' + adj[0] + ')', { b: 1 })] } : name;
        return [nameCell].concat(per.map(function (s, i) {
          if (!s) return '—';
          var t = secQty(ctx, s);
          return !same && adj[i] ? { runs: [R(t), BR(), R(adj[i], { b: 1, sz: 22 })] } : t;
        }));
      });
      blocks.push({ t: 'table', header: ['Alimento', 'Giorno ON', 'Giorno OFF'], widths: [5438, 2100, 2100], rows: rows });
    } else {
      var sr = sh.slice();
      m.main[dts[0]].secondi.forEach(function (s) {
        var notes = secNotes(ctx, s), a = adjText(s);
        var line = '• ' + secQty(ctx, s) + ' ' + secLabel(ctx, s);
        if (s.entry.combo && s.entry.combo[0].units) line = '• ' + secQty(ctx, s).replace(' + ', ' intere + ') + ' di albume';
        if (s.entry.combo && !s.entry.combo[0].units) line = '• ' + s.items.map(function (it) { return E.qty(ctx.db.foods[it.id], it.g).text + ' ' + (E.SHORT[it.id] || it.id); }).join(' + ');
        if (notes.length) line += ' (' + notes.join(', ') + ')';
        sr.push(BR(), R(line));
        if (a) sr.push(R(' (' + a + ')', { b: 1 }));
      });
      blocks.push(P(sr));
    }
    // LEGUMI
    var leg = dts.map(function (d) { return m.main[d] && m.main[d].legumi; });
    if (leg.some(Boolean)) blocks.push(NB(legumiText(ctx, plan, leg)));
    // CONDIMENTO
    step++;
    var ch = [R('PASSO ' + step + ' · CONDIMENTO', { b: 1, i: 1, u: 1 }), R(' – scegli 1 di questi, si equivalgono', { i: 1 })];
    var ckeys = []; dts.forEach(function (d) { if (m.main[d]) m.main[d].condimenti.forEach(function (c) { if (ckeys.indexOf(c.key) < 0) ckeys.push(c.key); }); });
    var condName = function (c) { return c.items.map(function (it) { return E.SHORT[it.id] || it.id; }).join(' + '); };
    var condQty = function (c) { return c.items.map(function (it) { return E.qty(ctx.db.foods[it.id], it.g).text; }).join(' + '); };
    if (!ckeys.length) blocks.push(P(ch.concat([BR(), R('• Nessun olio aggiunto in questo pasto (i grassi sono già negli alimenti).')])));
    else if (onoff) {
      blocks.push(P(ch, { keepNext: 1, after: 80 }));
      blocks.push({ t: 'table', header: ['Alimento', 'Giorno ON', 'Giorno OFF'], widths: [5438, 2100, 2100], rows: ckeys.map(function (k) {
        var per = dts.map(function (d) { return m.main[d] ? m.main[d].condimenti.filter(function (c) { return c.key === k; })[0] : null; });
        var c0 = per.filter(Boolean)[0];
        return [cap(condName(c0))].concat(per.map(function (c) { return c ? condQty(c) : '—'; }));
      }) });
    } else {
      var cr = ch.slice();
      m.main[dts[0]].condimenti.forEach(function (c) { cr.push(BR(), R('• ' + c.items.map(function (it) { return E.qty(ctx.db.foods[it.id], it.g).text + ' ' + (E.SHORT[it.id] || it.id); }).join(' + '))); });
      blocks.push(P(cr));
    }
    if (m.key === 'cen' || (m.key === 'pra' && !plan.mealDefs.some(function (x) { return x.key === 'cen'; }))) {
      if (onoff) blocks.push(NB('Il pasto post allenamento consumalo entro circa 1-2 ore dalla fine della seduta: non serve aspettare.', { plain: true }));
    }
  }
  function legNames(ctx, ids) {
    var n = [];
    ids.forEach(function (id) { var s = E.SHORT[id] || id; s = s.replace(/ (borlotti|cannellini|rosse decorticate)$/, ''); if (n.indexOf(s) < 0) n.push(s); });
    return n;
  }
  function legumiText(ctx, plan, leg) {
    var l0 = leg.filter(Boolean)[0];
    var names = legNames(ctx, l0.dry.length ? l0.dry : l0.can);
    var part = function (l) {
      var t = [];
      if (l.dryG) t.push(l.dryG + 'g secchi (peso a crudo)');
      if (l.canG) t.push(l.canG + 'g in barattolo sgocciolati');
      return t.join(' oppure ');
    };
    if (!plan.onoff) return 'Legumi (' + names.join(', ') + '): ' + part(l0) + ' prendono il posto del primo; in quel caso ' + l0.text + '.';
    var s = 'Legumi (' + names.join(', ') + ') al posto del primo: ';
    var ps = plan.dayTypes.map(function (d, i) { var l = leg[i]; return l ? 'giorni ' + d + ' ' + part(l) + ' e ' + l.text : 'giorni ' + d + ' non previsti'; });
    return s + ps.join('; ') + '.';
  }

  // ───────────────────────── frutta ─────────────────────────
  var FRUIT_NAMES = { mela: 'Mele', pera: 'Pere', arancia: 'Arance', mandarino: 'Mandarini', ananas: 'Ananas', fragole: 'Fragole', kiwi: 'Kiwi',
    melone: 'Melone', anguria: 'Anguria', uva: 'Uva', mango: 'Mango', mirtilli: 'Mirtilli', lamponi: 'Lamponi', pesca: 'Pesche',
    prugna_susina: 'Prugne', cachi_kaki: 'Cachi', papaya: 'Papaya', banana: 'Banana' };
  function fruitAllowed(ctx, id) { // FODMAP: segnalato col simbolo, non escluso dall'elenco
    var f = ctx.db.foods[id], fl = (ctx.input.prefs && ctx.input.prefs.flags) || [];
    for (var i = 0; i < fl.length; i++) { if (fl[i] === 'fodmap_alto') continue; var v = f.flags[fl[i]]; if (v === 1 || v === 2) return false; }
    return !(ctx.input.prefs.exclude || []).some(function (x) { return x === id; });
  }
  function fruitSubs(ctx) {
    var db = ctx.db, ref = ctx.fruitKcal;
    var fod = (ctx.input.prefs.flags || []).indexOf('fodmap_alto') >= 0;
    var ids = db.order.filter(function (id) { return db.foods[id].cat === 'Frutta' && id !== 'banana' && fruitAllowed(ctx, id); });
    return ids.map(function (id) {
      var f = db.foods[id], g = E.roundQ({ isUnit: false }, ref / f.K * 100);
      var warn = fod && (f.flags.fodmap_alto === 1 || f.flags.fodmap_alto === 2);
      return { id: id, name: (warn ? '⚠ ' : '') + (FRUIT_NAMES[id] || f.name), kcal: Math.round(f.K), g: g };
    });
  }

  // ───────────────────────── sezioni fisse ─────────────────────────
  var VEG_LIST = [['Zucchine', 250, 'zucchine'], ['Carote', 150, 'carote'], ['Spinaci', 250, 'spinaci'], ['Melanzane', 250, 'melanzane'], ['Zucca', 250, 'zucca'],
    ['Fagiolini', 300, 'fagiolini'], ['Lattuga', 100, 'lattuga'], ['Iceberg', 100, 'insalata_iceberg'], ['Rucola', 100, 'rucola'], ['Radicchio', 100, 'radicchio'],
    ['Cetrioli', 250, 'cetrioli'], ['Bietole', 250, 'bietole'], ['Pomodori', 250, 'pomodori'], ['Peperoni', 250, 'peperoni_rossi'], ['Finocchi', 200, 'finocchi'],
    ['Cicoria', 250, 'cicoria'], ['Cime di rapa', 250, 'cime_di_rapa'], ['Funghi', 200, 'funghi_champignon'], ['Indivia', 100, 'indivia'], ['Rapa', 250, 'rapa'],
    ['Cavolo nero', 200, 'cavolo_nero'], ['Asparagi', 200, 'asparagi'], ['Cavolini di Bruxelles', 250, 'cavolini_di_bruxelles'], ['Cavolfiori', 250, 'cavolfiore'],
    ['Broccoli', 250, 'broccoli'], ['Verza', 250, 'verza'], ['Carciofi', 300, 'carciofi']];
  var LEAN_FISH = ['Merluzzo/nasello', 'Platessa', 'Sogliola', 'Halibut (ippoglosso)', 'Baccalà (peso ammollato)', 'Cernia', 'Dentice', 'Pagello', 'Rombo', 'Sarago',
    'Scorfano', 'S.Pietro', 'Mormora', 'Corvina', 'Orata*', 'Spigola*', 'Triglia*', 'Cefalo*'];
  var RECIPES = [
    { name: 'Riso con pollo e verdure', primo: ['riso_basmati', 'riso_bianco'], sec: 'pollo', veg: 'zucchine e carote', prep: 'Cuoci il riso. Salta il pollo in padella antiaderente, aggiungi le verdure a julienne e a fine cottura condisci con l’olio a crudo.' },
    { name: 'Pasta al ragù di tacchino', primo: ['pasta_di_semola', 'pasta_integrale'], sec: 'pollo', secName: 'macinato di tacchino', veg: 'passata di pomodoro e cipolla', prep: 'Fai appassire la cipolla con un filo d’acqua, aggiungi il tacchino e la passata. Cuoci la pasta, condisci e aggiungi l’olio a crudo.' },
    { name: 'Patate al forno con merluzzo', primo: ['patate'], sec: 'pesce_magro', veg: 'pomodorini e prezzemolo', prep: 'Cuoci in forno patate a spicchi e filetto di pesce con pomodorini ed erbe; l’olio va aggiunto a crudo.' },
    { name: 'Cous cous con fesa di tacchino e zucchine', primo: ['couscous'], sec: 'fesa', veg: 'zucchine', prep: 'Cuoci il cous cous seguendo le indicazioni. Griglia fesa di tacchino e zucchine, tagliale a pezzetti e unisci al cous cous.' },
    { name: 'Riso con salmone e zucchine', primo: ['riso_basmati', 'riso_bianco'], sec: 'salmone', veg: 'zucchine', prep: 'Cuoci il riso. Cuoci il salmone in padella o al forno e uniscilo al riso con le zucchine saltate.' },
    { name: 'Pane integrale con bresaola, rucola e grana', primo: ['pane_integrale', 'pane_comune_tipo_0', 'pane_di_segale'], sec: 'bresaola', veg: 'rucola', cond: 'parmigiano', prep: 'Disponi la bresaola sul pane, aggiungi rucola, scaglie di grana e una spruzzata di limone (usa l’equivalenza olio + parmigiano).' },
    { name: 'Patate al forno con lonza di maiale', primo: ['patate'], sec: 'lonza', veg: 'rosmarino', prep: 'Cuoci le patate a spicchi in forno con il rosmarino e griglia la lonza; l’olio a fine cottura.' },
    { name: 'Gnocchi al ragù di manzo', primo: ['gnocchi_di_patate'], sec: 'manzo', veg: 'passata di pomodoro e cipolla', prep: 'Prepara un ragù semplice con macinato magro e passata e condisci gli gnocchi lessati.' },
    { name: 'Quinoa con gamberi e peperoni', primo: ['quinoa'], sec: 'gamberi', veg: 'peperoni', prep: 'Cuoci la quinoa, salta peperoni e gamberi in padella e mescola tutto.' },
    { name: 'Riso saltato con tofu e verdure', primo: ['riso_basmati', 'riso_bianco'], sec: 'tofu', veg: 'carote e zucchine', prep: 'Rosola il tofu a cubetti in padella antiaderente, aggiungi le verdure e il riso già cotto.' },
    { name: 'Frittata di albumi con patate', primo: ['patate'], sec: 'uova', veg: 'spinaci', prep: 'Cuoci le patate a cubetti, uniscile a uova e albume sbattuti e cuoci in padella con coperchio.' },
    { name: 'Farro con mozzarella light e pomodorini', primo: ['farro', 'orzo_perlato'], sec: 'mozzarella', veg: 'pomodorini e basilico', prep: 'Cuoci il farro, lascialo intiepidire e condiscilo con mozzarella a cubetti, pomodorini e basilico.' },
    { name: 'Pasta con tonno e pomodorini', primo: ['pasta_di_semola', 'pasta_integrale'], sec: 'tonno', veg: 'pomodorini', prep: 'Salta i pomodorini in padella con un filo d’acqua, aggiungi il tonno e condisci la pasta.' },
    { name: 'Seitan alla piastra con patate dolci', primo: ['patate_dolci_batata', 'patate'], sec: 'seitan', veg: 'insalata mista', prep: 'Cuoci al forno le patate dolci e griglia il seitan; servi con l’insalata.' }
  ];

  function hasFlag(input, k) { return ((input.prefs && input.prefs.flags) || []).indexOf(k) >= 0; }
  function freeMealText(input, settings, plan) {
    if (plan.type === 'daily') {
      var fm = input.freeMeal;
      if (!fm || fm.day === '' || fm.day === null || fm.day === undefined) return { short: 'NESSUN PASTO LIBERO PREVISTO IN QUESTA FASE', n: 0 };
      return { short: 'PASTO LIBERO: ' + E.DAYS[+fm.day].toUpperCase() + ' A ' + (fm.meal === 'pra' ? 'PRANZO' : 'CENA') + ' (1 A SETTIMANA)', n: 1, day: E.DAYS[+fm.day].toLowerCase(), meal: fm.meal === 'pra' ? 'pranzo' : 'cena' };
    }
    return { short: (settings.freeMealText || 'PER LE PRIME 2 SETTIMANE NO PASTI LIBERI, DALLA 3a SETTIMANA SI INSERISCE 1-2 PASTI LIBERI A SETTIMANA COME DA PROTOCOLLO!'), n: 2, multi: true };
  }

  function planFacts(ctx, plan) {
    var f = { legumi: null, patate: false, creme: false, soyDrink: false, ricotta: false };
    if (plan.type === 'multi') {
      plan.meals.forEach(function (m) {
        if (m.main) plan.dayTypes.forEach(function (d) { var mm = m.main[d]; if (!mm) return; if (mm.legumi) f.legumi = f.legumi || []; if (mm.primi.some(function (p) { return p.ids.indexOf('patate') >= 0; })) f.patate = true; });
        (m.options || []).forEach(function (o) { plan.dayTypes.forEach(function (d) { o.byDay[d].comps.forEach(function (c) { if (/crema_d/.test(c.id)) f.creme = true; if (c.id === 'bevanda_di_soia_senza_zuccheri') f.soyDrink = true; (c.alts || []).forEach(function (a) { if (/crema_d/.test(a.id)) f.creme = true; }); }); }); });
      });
      var mains = plan.meals.filter(function (m) { return m.main; });
      if (f.legumi) { var leg = plan.dayTypes.map(function (d) { return mains[0].main[d] && mains[0].main[d].legumi; }); f.legumiText = legumiText(ctx, plan, leg); }
    } else {
      plan.days.forEach(function (day) { day.meals.forEach(function (m) { (m.items || []).forEach(function (it) {
        if (E.LEGUMI_DRY.concat(E.LEGUMI_CAN).indexOf(it.id) >= 0) f.legumi = true;
        if (it.id === 'patate' || it.id === 'patate_dolci_batata') f.patate = true;
        if (/crema_d/.test(it.id)) f.creme = true;
        if (it.id === 'bevanda_di_soia_senza_zuccheri') f.soyDrink = true;
      }); }); });
      if (f.legumi) f.legumiText = 'Nel menù i legumi compaiono ' + plan.weekly.counts.legumi + ' volte a settimana al posto del primo, con il secondo già ridotto: segui le grammature del giorno.';
    }
    return f;
  }

  function faqList(ctx, plan, settings) {
    var input = ctx.input, facts = planFacts(ctx, plan), water = (settings.water || 2.5);
    var fm = freeMealText(input, settings, plan), multi = plan.type === 'multi', fod = hasFlag(input, 'fodmap_alto');
    var L = [];
    L.push(['Le quantità si riferiscono al peso cotto o crudo?', 'Sempre al peso a crudo, salvo diversa indicazione accanto all’alimento: tonno e legumi in barattolo si pesano sgocciolati; pane, gallette, affettati e prodotti pronti così come sono.']);
    if (multi) L.push(['Come combino le opzioni?', 'Per colazione e spuntini scegli una sola OPZIONE. A pranzo e cena componi il piatto con 1 primo + 1 secondo + 1 condimento dalle liste (dentro ogni lista si equivalgono) e aggiungi verdura a piacere.' + (plan.onoff ? ' Usa sempre la colonna del giorno ON o OFF.' : '') + (plan.interchangeable ? ' Colazione e Spuntino 2 sono intercambiabili.' : '')]);
    else L.push(['Posso scambiare i pasti o i giorni del menù?', 'Sì: puoi scambiare pranzo e cena dello stesso giorno oppure due giorni dello stesso tipo' + (plan.onoff ? ' (ON con ON, OFF con OFF)' : '') + ', mantenendo le grammature indicate.']);
    L.push(['Posso sostituire le verdure?', fod ? 'Sì, con altre verdure non amidacee, seguendo i simboli ✔ ⚠ ❌ dell’elenco verdure (colon irritabile).' : 'Sì, con qualsiasi verdura non amidacea (zucchine, spinaci, lattuga, melanzane…). Varia il più possibile durante la settimana.']);
    if (facts.legumi) L.push(['Come gestisco i legumi?', (facts.legumiText || '') + ' Se secchi si pesano da crudi, se in barattolo sciacquati e sgocciolati. Non sono un contorno libero.']);
    if (facts.patate) L.push(['Le patate sono verdura?', 'No: patate e batata sono carboidrati amidacei e si gestiscono come PRIMO, non come contorno.']);
    if (hasFlag(input, 'int_lattosio')) L.push(['Sono intollerante al lattosio: cosa devo controllare?', 'Nel piano trovi solo alimenti senza lattosio (es. parmigiano/grana stagionati, whey isolate, bevande vegetali). Per i prodotti “senza lattosio” controlla sempre l’etichetta.']);
    if (hasFlag(input, 'all_glutine')) L.push(['Il piano è senza glutine?', 'Sì. Scegli sempre prodotti con la dicitura “senza glutine” o la spiga barrata, anche per riso soffiato, gallette e avena, che possono contenere tracce.']);
    if (hasFlag(input, 'nichel')) L.push(['Come gestisco il nichel?', 'Il piano esclude gli alimenti ad alto contenuto di nichel (legumi, cereali integrali, cacao, pomodoro, spinaci, frutta secca…). Evita anche cibi in scatola e la cottura di cibi acidi in pentole d’acciaio.']);
    if (fod) L.push(['Ho il colon irritabile: cosa devo sapere?', 'Gli alimenti ricchi di FODMAP sono esclusi dal piano. Per frutta e verdura segui i simboli ⚠ e ❌; in caso di gonfiore riduci le porzioni e preferisci verdure cotte.']);
    L.push(['Quanta acqua devo bere?', 'Almeno ' + String(water).replace('.', ',') + ' litri al giorno' + (plan.onoff ? ', di più nei giorni di allenamento' : '') + ' e quando fa caldo. Acqua naturale o frizzante, tisane e infusi senza zucchero sono liberi.']);
    if (fm.n === 0) L.push(['Sono previsti pasti liberi?', 'In questa fase non sono previsti pasti liberi: segui il piano tutti i giorni.']);
    else if (fm.multi) L.push(['Come gestisco i pasti liberi?', 'Per le prime 2 settimane niente pasti liberi; dalla 3a settimana 1-2 pasti liberi a settimana, come da protocollo. È un singolo pasto, non una giornata libera.']);
    else L.push(['Come gestisco il pasto libero?', 'È previsto 1 pasto libero a settimana: ' + fm.day + ' a ' + fm.meal + '. È un singolo pasto, non una giornata libera; il resto della giornata resta invariato.']);
    L.push(['Posso bere alcolici?', fm.n === 0 ? 'Gli alcolici non sono previsti in questa fase.' : 'Gli alcolici non sono previsti nel piano: se occasionalmente consumati, vanno inseriti nel pasto libero.']);
    L.push(['Posso bere caffè o tè?', 'Sì, senza zucchero. Se serve puoi usare dolcificanti ipocalorici (stevia, eritritolo, sucralosio) con moderazione.']);
    L.push(['Quali condimenti e cotture posso usare?', 'Olio extravergine sempre a crudo e nelle quantità indicate; passata di pomodoro, erbe e spezie a piacere. Cotture: piastra, griglia, forno, vapore, lessatura o padella antiaderente.']);
    if (facts.soyDrink || hasFlag(input, 'all_latte') || hasFlag(input, 'int_lattosio') || input.prefs.vegan) L.push(['Posso usare il latte vegetale?', 'Sì, preferisci la bevanda di soia senza zuccheri, che ha proteine simili al latte. Avena, riso e mandorla hanno poche proteine e più carboidrati.']);
    if (facts.creme && !hasFlag(input, 'all_frutta_guscio')) L.push(['Le creme di frutta secca sono ammesse?', 'Sì, al posto della frutta secca e allo stesso peso, purché 100% frutta secca senza zuccheri o oli aggiunti.']);
    L.push(['Posso mangiare fuori casa?', 'Sì: scegli piatti semplici (carne, pesce o uova alla griglia, verdure, riso o patate) ed evita fritti, panature e salse.']);
    L.push(['Devo pesare sempre gli alimenti?', 'All’inizio sì, per imparare le porzioni; con il tempo potrai regolarti a occhio senza scostamenti importanti.']);
    L.push(['Se non ho un alimento del piano?', multi ? 'Sostituiscilo con uno della stessa lista (PRIMO, SECONDO o CONDIMENTO), usando la grammatura indicata accanto.' : 'Sostituiscilo con un alimento simile di un altro giorno, con la stessa grammatura, oppure chiedi al tuo coach.']);
    L.push(['È obbligatorio assumere integratori?', 'No: eventuali integrazioni si valutano caso per caso con il tuo coach.']);
    return L.slice(0, 12);
  }

  function fixedSections(ctx, plan, settings, blocks) {
    var input = ctx.input, multi = plan.type === 'multi', fod = hasFlag(input, 'fodmap_alto');
    // SOSTITUZIONI FRUTTA
    blocks.push(PB());
    blocks.push(H('SOSTITUZIONI FRUTTA', { i: 1 }));
    var subs = fruitSubs(ctx);
    blocks.push(P([R('Queste sono le sostituzioni di frutta in rapporto ad 1 banana media (circa 120g di polpa, ~' + Math.round(ctx.fruitKcal) + ' kcal):', { b: 1, i: 1, u: 1, sz: 30 })], { align: 'center' }));
    var rows = [];
    for (var i = 0; i < subs.length; i += 2) {
      var a = subs[i], b = subs[i + 1];
      rows.push([a.name, a.g + 'g', b ? b.name : '', b ? b.g + 'g' : '']);
    }
    blocks.push({ t: 'table', header: ['Frutto', '1 porzione', 'Frutto', '1 porzione'], widths: [2919, 1900, 2919, 1900], rows: rows });
    if (fod && subs.some(function (s) { return s.name.indexOf('⚠') === 0; })) blocks.push(NB('⚠ = frutta ricca di FODMAP: con il colon irritabile limitala o evitala se ti dà gonfiore.'));
    // FAQ
    blocks.push(PB());
    blocks.push(H('Domande e Risposte Frequenti sui Consigli Alimentari', { i: 1 }));
    faqList(ctx, plan, settings).forEach(function (qa, k) {
      blocks.push(P([R((k + 1) + '. ' + qa[0], { b: 1, color: FAQBLUE }), BR(), R(qa[1])], { after: 160 }));
    });
    // ESEMPI PASTI (solo scelte multiple)
    if (multi) examples(ctx, plan, blocks);
    // FREQUENZA (solo scelte multiple: nel giorno per giorno è già nel menù)
    if (multi) {
      blocks.push(H('FREQUENZA CONSUMO ALIMENTI', { i: 1 }));
      var fr = [];
      fr.push(['FRUTTA', ': 1 porzione al dì (come da piano);']);
      fr.push(['VERDURA', ': almeno 2 porzioni al dì;']);
      if (ctx.allowed('manzo_magro_girello_fesa') || ctx.allowed('bresaola')) fr.push(['CARNE ROSSA', ': massimo 2 volte a settimana, bresaola compresa;']);
      if (ctx.allowed('petto_di_pollo_senza_pelle')) fr.push(['CARNE BIANCA', ': fino a 4-5 volte a settimana;']);
      if (ctx.allowed('merluzzo') || ctx.allowed('salmone_allevamento')) fr.push(['PESCE', ': almeno 2-3 volte a settimana, di cui 1 pesce grasso (salmone, sgombro, alici);']);
      if (ctx.allowed('uovo_intero')) fr.push(['UOVA', ': fino a 7-10 uova a settimana;']);
      if (ctx.all(E.LEGUMI_DRY.concat(E.LEGUMI_CAN)).length) fr.push(['LEGUMI', ': 2-4 volte a settimana, se ben tollerati;']);
      if (ctx.allowed('yogurt_greco_0_grassi') || ctx.allowed('latte_parzialmente_scremato')) fr.push(['LATTICINI', ': 2-3 porzioni al giorno (yogurt, latte, formaggi magri).']);
      var runs = [];
      fr.forEach(function (x, k) { if (k) runs.push(BR()); runs.push(R(x[0], { b: 1 }), R(x[1])); });
      blocks.push(P(runs));
    }
    // MEAL PREP
    blocks.push(H('SUGGERIMENTI MEAL PREP', { i: 1 }));
    var riso = null;
    if (multi) plan.meals.forEach(function (m) { if (m.main && !riso) { var mm = m.main[plan.dayTypes[0]]; if (mm) mm.primi.forEach(function (p) { if (p.ids.indexOf('riso_basmati') >= 0 || p.ids.indexOf('riso_bianco') >= 0) riso = p.g; }); } });
    blocks.push(P([R('• Verdure: ', { b: 1 }), R('preparale la domenica in quantità maggiori e conservale in frigo in contenitori ermetici.'), BR(),
      R('• Pane: ', { b: 1 }), R('taglia il pane fresco a fette, pesale e congelale in monoporzioni.'), BR(),
      R('• Riso e cereali: ', { b: 1 }), R('puoi cuocerli in anticipo e tenerli in frigo: 100g crudi ≈ 260g cotti' + (riso ? ', quindi ' + riso + 'g crudi ≈ ' + Math.round(riso * 2.6 / 5) * 5 + 'g cotti.' : '.')), BR(),
      R('• Patate: ', { b: 1 }), R('lessate o al vapore il peso resta quasi uguale; al forno calano, quindi pesale da crude.')]));
    // VERDURE (scelte multiple: contorno a scelta)
    if (multi) {
      blocks.push(H('ELENCO VERDURE CON EQUIVALENZA 200G', { i: 1 }));
      blocks.push(P([R('NB. NON È IMPORTANTE IL PESO DELLA VERDURA, QUESTO È SOLO UNO SCHEMA RAPPRESENTATIVO', { b: 1 })]));
      var vr = VEG_LIST.filter(function (v) { var f = ctx.db.foods[v[2]]; return f && fruitAllowed(ctx, v[2]); }).map(function (v) {
        var f = ctx.db.foods[v[2]], sym = '•';
        if (fod) sym = f.flags.fodmap_alto === 1 ? '❌' : (f.flags.fodmap_alto === 2 || /moderato/i.test(f.note) || f.flags.nichel === 1 && false ? '⚠' : '✔');
        return { sym: sym, t: v[0] + ' ' + v[1] + 'g' };
      });
      if (fod) { var ordS = { '✔': 0, '⚠': 1, '❌': 2 }; vr.sort(function (a, b) { return ordS[a.sym] - ordS[b.sym]; }); }
      var vrows = [];
      for (i = 0; i < vr.length; i += 3) vrows.push([0, 1, 2].map(function (j) { return vr[i + j] ? vr[i + j].sym + ' ' + vr[i + j].t : ''; }));
      blocks.push({ t: 'table', widths: [3212, 3213, 3213], rows: vrows, noHeader: true });
      if (fod) blocks.push(P([R('✔ consumare a piacere · ⚠ attenzionare e limitare il consumo · ❌ sconsigliati per colon irritabile', { i: 1 })]));
      var hasLean = plan.meals.some(function (m) { return m.main && plan.dayTypes.some(function (d) { return m.main[d] && m.main[d].secondi.some(function (s) { return s.key === 'pesce_magro'; }); }); });
      if (hasLean) {
        blocks.push(H('ELENCO PESCI MAGRI', { i: 1 }));
        var fr2 = [];
        for (i = 0; i < LEAN_FISH.length; i += 3) fr2.push([LEAN_FISH[i] || '', LEAN_FISH[i + 1] || '', LEAN_FISH[i + 2] || '']);
        blocks.push({ t: 'table', widths: [3212, 3213, 3213], rows: fr2, noHeader: true });
        blocks.push(NB('*Orata, spigola (soprattutto d’allevamento), triglia e cefalo sono un po’ più grassi: quando li scegli togli 5ml di olio.'));
      }
    }
    blocks.push(P([R(DISCLAIMER, { b: 1 })], { after: 240 }));
  }

  function examples(ctx, plan, blocks) {
    var mm = null, dts = plan.dayTypes;
    plan.meals.forEach(function (m) { if (m.main && !mm) mm = m; });
    if (!mm) return;
    var mains = dts.map(function (d) { return mm.main[d]; });
    if (!mains[0]) return;
    var out = [], usedSec = {};
    RECIPES.forEach(function (rc) {
      if (out.length >= 5 || usedSec[rc.sec]) return;
      var per = mains.map(function (m) {
        if (!m) return null;
        var pid = null, pg = 0;
        m.primi.forEach(function (p) { rc.primo.forEach(function (id) { if (!pid && p.ids.indexOf(id) >= 0) { pid = id; pg = p.g; } }); });
        var s = m.secondi.filter(function (x) { return x.key === rc.sec; })[0];
        var c = rc.cond ? m.condimenti.filter(function (x) { return x.key === rc.cond; })[0] : m.condimenti[0];
        return { pid: pid, pg: pg, s: s, c: c };
      });
      var noPrimo = mains.every(function (m) { return !m || !m.primi.length; });
      if (!per[0] || !per[0].s || (!per[0].pid && !noPrimo)) return;
      usedSec[rc.sec] = 1;
      var f = per[0].pid ? ctx.db.foods[per[0].pid] : null;
      var both = function (fn) { return dts.length > 1 ? per.map(function (p, i) { return p && p.pid ? fn(p) + ' (' + dts[i] + ')' : '— (' + dts[i] + ')'; }).join(' / ') : fn(per[0]); };
      var ing = [];
      if (f) ing.push(both(function (p) { return f.isUnit ? Math.round(p.pg / f.unitG) + ' ' + E.label(ctx, null, p.pid, true) : Math.round(p.pg) + 'g'; }) + (f.isUnit ? '' : ' ' + (E.SHORT[per[0].pid] || per[0].pid)));
      var sname = rc.secName || secLabel(ctx, per[0].s);
      ing.push(both(function (p) { return p.s ? secQty(ctx, p.s) : '—'; }) + ' ' + sname + (per[0].s.notes.length ? ' (' + per[0].s.notes.join(' e ') + ')' : ''));
      ing.push(rc.veg + ' a piacere');
      if (per[0].c) ing.push(both(function (p) { return p.c ? p.c.items.map(function (it) { return E.qty(ctx.db.foods[it.id], it.g).text; }).join(' + ') : '—'; }) + ' ' + per[0].c.items.map(function (it) { return E.SHORT[it.id]; }).join(' + '));
      out.push({ name: f ? rc.name : rc.name.replace(/^(Riso|Pasta|Cous cous|Quinoa|Farro|Gnocchi|Patate al forno|Patate|Pane integrale) (con |al |e )?/i, '').replace(/^./, function (c) { return c.toUpperCase(); }), ing: ing, prep: rc.prep });
    });
    if (!out.length) return;
    blocks.push(PB());
    blocks.push(P([R('ESEMPI PASTI (PRANZO-CENA)', { b: 1, i: 1, color: GOLD, sz: 40, shd: BLUE }), BR(),
      R('Ecco alcuni pasti costruiti con le tue grammature' + (plan.onoff ? ' (giorno ON / giorno OFF)' : '') + ' di ' + mm.label.toLowerCase() + '!', { b: 1 })], { align: 'center' }));
    out.forEach(function (x, k) {
      blocks.push(P([R((k + 1) + '. ' + x.name, { b: 1, u: 1 }), BR(), R('• Ingredienti: ', { b: 1 }), R(x.ing.join(', ') + '.'), BR(), R('• Preparazione: ', { b: 1 }), R(x.prep)]));
    });
    blocks.push(P([R('*Sono semplicemente dei consigli, usa gli alimenti che hai a disposizione come meglio preferisci.', { i: 1 })]));
  }

  // ───────────────────────── modello del documento ─────────────────────────
  function targetLine(prefix, t) {
    return P([R(prefix + ': ' + fmtN(t.K) + 'kcal ', { b: 1, i: 1, hl: 1, u: 1 }), R(fmtN(t.P) + 'p/' + fmtN(t.C) + 'c/' + fmtN(t.F) + 'g', { i: 1, hl: 1, u: 1 })]);
  }
  function header(plan, input, blocks) {
    blocks.push({ t: 'title', text: 'CONSIGLI ALIMENTARI' });
    blocks.push({ t: 'name', text: (input.name || '').toUpperCase() });
    blocks.push({ t: 'goal', text: (input.goal || '').toUpperCase() });
    if (plan.onoff) { blocks.push(targetLine('GIORNI ON', plan.targets.ON)); blocks.push(targetLine('GIORNI OFF', plan.targets.OFF)); }
    else blocks.push(targetLine('PIANO GIORNALIERO', plan.targets.STD));
  }
  function waterLines(plan, input, settings, blocks) {
    var w = String(settings.water || 2.5).replace('.', ',');
    blocks.push(P([R('ACQUA: MIN ' + w + 'LT AL GIORNO' + (plan.onoff ? ' (DI PIÙ NEI GIORNI DI ALLENAMENTO)' : ''), { b: 1 })]));
    blocks.push(P([R(freeMealText(input, settings, plan).short, { b: 1, u: 1 })]));
  }

  function buildDocModel(plan, settings) {
    settings = settings || {};
    var ctx = plan.ctx, input = ctx.input, blocks = [];
    header(plan, input, blocks);
    if (plan.type === 'multi') {
      plan.meals.forEach(function (m) {
        if (m.kind === 'fruit') {
          blocks.push(H(m.label));
          blocks.push(P([R('• 1 banana media '), R('oppure', { b: 1 }), R(' 1 porzione di frutta (in basso trovi le sostituzioni)'), BR(),
            R('N.B.', { b: 1, u: 1 }), R(' puoi mangiarla insieme alla colazione oppure a metà mattina, come preferisci.', { b: 1 })]));
        } else if (m.kind === 'main') mainMealBlocks(ctx, plan, m, blocks, settings);
        else smallMealBlocks(ctx, plan, m, blocks);
      });
      waterLines(plan, input, settings, blocks);
    } else dailyBlocks(ctx, plan, settings, blocks);
    fixedSections(ctx, plan, settings, blocks);
    return blocks;
  }

  // ── giorno per giorno ──
  function dayItemLine(ctx, it) {
    var f = ctx.db.foods[it.id]; if (!f) return '';
    if (it.role === 'veg') return Math.round(it.g) + 'g ' + (E.SHORT[it.id] || f.name.toLowerCase());
    var t = E.itemText(ctx, null, it.id, it.g);
    var st = '';
    if (it.role === 'primo' || it.role === 'sec') {
      if (f.stato === 'crudo' || f.stato === 'secco') st = ' (peso a crudo)';
      else if (f.stato === 'sgocciolato') st = ' (peso sgocciolato)';
      else if (f.stato === 'ammollato') st = ' (peso ammollato)';
    }
    if (it.id === E.OIL) st = ' (a crudo)';
    if (it.role === 'frutta' && f.cat === 'Frutta') return t + ' (oppure 1 porzione di frutta, vedi sostituzioni)';
    return t + st;
  }
  function dailyBlocks(ctx, plan, settings, blocks) {
    var input = ctx.input;
    plan.days.forEach(function (day, di) {
      blocks.push(PB());
      blocks.push(H(day.name.toUpperCase() + (plan.onoff ? ' · GIORNO ' + day.type : '')));
      var t = day.tot;
      blocks.push(P([R('Riepilogo del giorno' + (day.hasFree ? ' (pasto libero escluso)' : '') + ': ', { b: 1, i: 1, hl: 1, u: 1 }),
        R(fmtN(t.K) + 'kcal ' + fmtN(t.P) + 'p/' + fmtN(t.C) + 'c/' + fmtN(t.F) + 'g', { i: 1, hl: 1, u: 1 })], { after: 160 }));
      day.meals.forEach(function (m) {
        var runs = [R(m.label, { b: 1, u: 1 })];
        if (m.free) { runs.push(BR(), R('PASTO LIBERO', { b: 1, color: ORANGE }), R(' – un singolo pasto a tua scelta, con equilibrio.')); blocks.push(P(runs, { after: 120 })); return; }
        if (m.name) runs.push(R(' “' + m.name + '”', { b: 1 }));
        (m.items || []).forEach(function (it) { runs.push(BR(), R('• ' + dayItemLine(ctx, it))); });
        (m.freeText || []).forEach(function (x) { runs.push(BR(), R('• ' + x)); });
        if (m.prep) runs.push(BR(), R(m.prep, { i: 1, sz: 24 }));
        blocks.push(P(runs, { after: 120 }));
      });
    });
    blocks.push(PB());
    waterLines(plan, input, settings, blocks);
    blocks.push(P([R('Spezie, erbe aromatiche, aceto e limone sono liberi. Caffè e tè senza zucchero.', { i: 1 })]));
  }

  // ───────────────────────── XML (WordprocessingML) ─────────────────────────
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var FONT = '<w:rFonts w:ascii="Helvetica Neue" w:hAnsi="Helvetica Neue" w:cs="Helvetica"/>';
  function rPr(o, sz) {
    var s = FONT;
    if (o.b) s += '<w:b/><w:bCs/>';
    if (o.i) s += '<w:i/><w:iCs/>';
    if (o.color) s += '<w:color w:val="' + o.color + '"/>';
    var z = o.sz || sz || 30;
    s += '<w:sz w:val="' + z + '"/><w:szCs w:val="' + z + '"/>';
    if (o.hl) s += '<w:highlight w:val="yellow"/>';
    if (o.u) s += '<w:u w:val="single"/>';
    if (o.shd) s += '<w:shd w:val="clear" w:color="auto" w:fill="' + o.shd + '"/>';
    return '<w:rPr>' + s + '</w:rPr>';
  }
  function runXml(r, sz) {
    if (r.br) return '<w:r>' + rPr({}, sz) + '<w:br/></w:r>';
    return '<w:r>' + rPr(r, sz) + '<w:t xml:space="preserve">' + esc(r.text) + '</w:t></w:r>';
  }
  function pXml(runs, o, sz) {
    o = o || {};
    var ppr = (o.keepNext ? '<w:keepNext/>' : '') + '<w:spacing w:after="' + (o.after !== undefined ? o.after : 240) + '"/>' + (o.align === 'center' ? '<w:jc w:val="center"/>' : '');
    return '<w:p><w:pPr>' + ppr + '</w:pPr>' + runs.map(function (r) { return runXml(r, sz); }).join('') + '</w:p>';
  }
  function cellXml(c, w, head, sz) {
    var runs = typeof c === 'string' || typeof c === 'number' ? [R(String(c), head ? { b: 1, color: GOLD } : {})] : c.runs;
    var shd = head ? '<w:shd w:val="clear" w:color="auto" w:fill="' + BLUE + '"/>' : '';
    return '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>' + shd + '<w:vAlign w:val="center"/></w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="40" w:after="40"/>' + '</w:pPr>' + runs.map(function (r) { return runXml(r, sz); }).join('') + '</w:p></w:tc>';
  }
  function tableXml(b) {
    var sz = 26, bc = 'BFBFBF';
    var borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function (k) { return '<w:' + k + ' w:val="single" w:sz="4" w:space="0" w:color="' + bc + '"/>'; }).join('');
    var x = '<w:tbl><w:tblPr><w:tblW w:w="' + b.widths.reduce(function (a, c) { return a + c; }, 0) + '" w:type="dxa"/><w:tblBorders>' + borders + '</w:tblBorders>' +
      '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid>' +
      b.widths.map(function (w) { return '<w:gridCol w:w="' + w + '"/>'; }).join('') + '</w:tblGrid>';
    if (b.header && !b.noHeader) x += '<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>' + b.header.map(function (h, i) { return cellXml(h, b.widths[i], true, sz); }).join('') + '</w:tr>';
    b.rows.forEach(function (row) { x += '<w:tr><w:trPr><w:cantSplit/></w:trPr>' + row.map(function (c, i) { return cellXml(c, b.widths[i], false, sz); }).join('') + '</w:tr>'; });
    x += '</w:tbl>';
    return x + '<w:p><w:pPr><w:spacing w:after="160"/></w:pPr></w:p>';
  }
  function blockXml(b) {
    switch (b.t) {
      case 'title': return pXml([R(b.text, { b: 1, color: GOLD, sz: 42, shd: BLUE })], { align: 'center' });
      case 'name': return pXml([R(b.text, { b: 1, sz: 40 })], { align: 'center' });
      case 'goal': return pXml([R('OBIETTIVO:', { b: 1, color: ORANGE, sz: 26 }), BR(), R(b.text, { b: 1, sz: 26 }), BR(), R('_______________', { b: 1, sz: 42 })], { align: 'center' });
      case 'h': return pXml([R(b.text, { b: 1, i: b.i, color: GOLD, sz: 40, shd: BLUE })], { align: 'center', keepNext: 1 });
      case 'sub': return pXml([R('▸ ' + b.text, { b: 1, color: ORANGE })], { keepNext: 1, after: 120 });
      case 'nb': return pXml(b.plain ? [R(b.label, { b: 1 }), R(b.text, { u: 1 })] : [R(b.label, { b: 1, color: ORANGE }), R(b.text, { b: 1, i: 1, u: 1 })]);
      case 'p': return pXml(b.runs, b);
      case 'table': return tableXml(b);
      case 'pb': return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    }
    return '';
  }
  function toBodyXml(blocks) { return blocks.map(blockXml).join(''); }

  // Sostituisce solo il corpo del documento del modello (intestazione, piè di pagina, immagini e stili restano intatti)
  function makeDocx(JSZip, templateData, blocks, opts) {
    return JSZip.loadAsync(templateData).then(function (zip) {
      return zip.file('word/document.xml').async('string').then(function (xml) {
        var b0 = xml.indexOf('<w:body>'), s0 = xml.lastIndexOf('<w:sectPr');
        if (b0 < 0 || s0 < 0) throw new Error('Modello Word non valido: corpo o sezione non trovati.');
        var out = xml.slice(0, b0 + 8) + toBodyXml(blocks) + xml.slice(s0);
        zip.file('word/document.xml', out);
        var t = (opts && opts.title) || 'Consigli alimentari';
        return zip.file('docProps/core.xml').async('string').then(function (core) {
          core = core.replace(/<dc:title>[^<]*<\/dc:title>/, '<dc:title>' + esc(t) + '</dc:title>');
          zip.file('docProps/core.xml', core);
          return zip.generateAsync({ type: (opts && opts.type) || 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
        });
      });
    });
  }

  // ───────────────────────── HTML (anteprima e PDF) ─────────────────────────
  function runHtml(r) {
    if (r.br) return '<br>';
    var st = [];
    if (r.b) st.push('font-weight:700'); if (r.i) st.push('font-style:italic'); if (r.u) st.push('text-decoration:underline');
    if (r.color) st.push('color:#' + r.color); if (r.sz) st.push('font-size:' + (r.sz / 2) + 'pt');
    if (r.hl) st.push('background:#FFFF00'); if (r.shd) st.push('background:#' + r.shd);
    return '<span' + (st.length ? ' style="' + st.join(';') + '"' : '') + '>' + esc(r.text) + '</span>';
  }
  function pHtml(runs, o, cls) {
    o = o || {};
    var st = 'margin:0 0 ' + ((o.after !== undefined ? o.after : 240) / 20) + 'pt 0;' + (o.align === 'center' ? 'text-align:center;' : '');
    return '<p class="' + (cls || '') + (o.keepNext ? ' kn' : '') + '" style="' + st + '">' + runs.map(runHtml).join('') + '</p>';
  }
  function toHtml(blocks) {
    return blocks.map(function (b) {
      switch (b.t) {
        case 'title': return pHtml([R(b.text, { b: 1, color: GOLD, sz: 42, shd: BLUE })], { align: 'center' }, 'hd');
        case 'name': return pHtml([R(b.text, { b: 1, sz: 40 })], { align: 'center' });
        case 'goal': return pHtml([R('OBIETTIVO:', { b: 1, color: ORANGE, sz: 26 }), BR(), R(b.text, { b: 1, sz: 26 }), BR(), R('_______________', { b: 1, sz: 42 })], { align: 'center' });
        case 'h': return pHtml([R(b.text, { b: 1, i: b.i, color: GOLD, sz: 40, shd: BLUE })], { align: 'center', keepNext: 1 }, 'hd');
        case 'sub': return pHtml([R('▸ ' + b.text, { b: 1, color: ORANGE })], { keepNext: 1, after: 120 });
        case 'nb': return pHtml(b.plain ? [R(b.label, { b: 1 }), R(b.text, { u: 1 })] : [R(b.label, { b: 1, color: ORANGE }), R(b.text, { b: 1, i: 1, u: 1 })]);
        case 'p': return pHtml(b.runs, b);
        case 'pb': return '<div class="pb"></div>';
        case 'table':
          var h = '<table class="t">';
          if (b.header && !b.noHeader) h += '<thead><tr>' + b.header.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') + '</tr></thead>';
          h += '<tbody>' + b.rows.map(function (r) { return '<tr>' + r.map(function (c, i) {
            var inner = typeof c === 'string' || typeof c === 'number' ? esc(String(c)) : c.runs.map(runHtml).join('');
            return '<td style="width:' + Math.round(b.widths[i] / 96.38) + '%">' + inner + '</td>';
          }).join('') + '</tr>'; }).join('') + '</tbody></table>';
          return h;
      }
      return '';
    }).join('\n');
  }

  function fileName(input) {
    var clean = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); };
    var m = /fase\s*(\d+)/i.exec(input.goal || '');
    var fase = m ? 'FASE' + m[1] : clean((input.goal || 'Piano').split(/[-–—,]/)[0]).toUpperCase();
    return 'Consigli_alimentari_' + clean(input.name || 'Cliente') + '_' + (fase || 'PIANO') + '.docx';
  }

  var api = { buildDocModel: buildDocModel, toBodyXml: toBodyXml, makeDocx: makeDocx, toHtml: toHtml, fileName: fileName, faqList: faqList, fruitSubs: fruitSubs, DISCLAIMER: DISCLAIMER };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FSMDoc = api;
})(this);
