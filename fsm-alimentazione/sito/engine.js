/* FSM · Motore di calcolo dei piani alimentari.
   Nessuna dipendenza: funziona nel browser (window.FSMEngine) e in Node (require). */
(function (root) {
  'use strict';

  // ───────────────────────── Costanti ─────────────────────────
  var NUTR = ['kcal', 'carboidrati_g', 'proteine_g', 'grassi_g', 'fibra_g', 'zuccheri_g', 'grassi_saturi_g',
    'sodio_mg', 'potassio_mg', 'calcio_mg', 'ferro_mg', 'vit_d_ug'];
  var MICRO = [
    { key: 'fibra_g', label: 'Fibra', unit: 'g', ref: 25, type: 'min', src: 'EFSA ≥ 25 g' },
    { key: 'sodio_mg', label: 'Sodio', unit: 'mg', ref: 2000, type: 'max', src: 'OMS < 2000 mg' },
    { key: 'calcio_mg', label: 'Calcio', unit: 'mg', ref: 1000, type: 'min', src: 'LARN PRI 1000 mg' },
    { key: 'ferro_mg', label: 'Ferro', unit: 'mg', ref: null, type: 'min', src: 'LARN PRI 10 mg (M) · 18 mg (F)' },
    { key: 'potassio_mg', label: 'Potassio', unit: 'mg', ref: 3500, type: 'min', src: 'EFSA AI 3500 mg' },
    { key: 'vit_d_ug', label: 'Vitamina D', unit: 'µg', ref: 15, type: 'min', src: 'LARN/EFSA 15 µg' },
    { key: 'zuccheri_g', label: 'Zuccheri totali', unit: 'g', ref: null, type: 'maxPct', pct: 15, src: 'LARN < 15% kcal' },
    { key: 'grassi_saturi_g', label: 'Grassi saturi', unit: 'g', ref: null, type: 'maxPct', pct: 10, src: 'OMS < 10% kcal' }
  ];
  var DEFAULT_FLAGS = [
    ['all_glutine', 'Glutine / celiachia', '#C6EFCE'], ['all_latte', 'Latte (proteine del latte)', '#F4B183'],
    ['int_lattosio', 'Lattosio (intolleranza)', '#FBE2D5'], ['all_uova', 'Uova', '#BDD7EE'], ['all_pesce', 'Pesce', '#8EB4E3'],
    ['all_crostacei', 'Crostacei', '#F4CCCC'], ['all_molluschi', 'Molluschi', '#D9D2E9'],
    ['all_frutta_guscio', 'Frutta a guscio', '#C9A27E'], ['all_arachidi', 'Arachidi', '#E2C9A6'], ['all_soia', 'Soia', '#A9D08E'],
    ['all_sesamo', 'Sesamo', '#D0CECE'], ['all_sedano', 'Sedano', '#9FD8D0'], ['all_senape', 'Senape', '#FFD966'],
    ['all_solfiti', 'Anidride solforosa / solfiti', '#BFBFBF'], ['all_lupini', 'Lupini', '#E4C1F9'],
    ['nichel', 'Nichel (alto contenuto)', '#FFFF00'], ['fodmap_alto', 'FODMAP alto (colon irritabile)', '#FF99CC']
  ];
  var MEAL_LABEL = { col: 'COLAZIONE', s1: 'SPUNTINO 1', pra: 'PRANZO', s2: 'SPUNTINO 2', cen: 'CENA', ser: 'SPUNTINO SERALE' };
  var DEFAULT_DIST = {
    3: [['col', 25], ['pra', 40], ['cen', 35]],
    4: [['col', 20], ['pra', 35], ['s2', 15], ['cen', 30]],
    5: [['col', 18], ['s1', 6], ['pra', 30], ['s2', 16], ['cen', 30]],
    6: [['col', 16.6], ['s1', 5.5], ['pra', 27.6], ['s2', 14.7], ['cen', 27.6], ['ser', 8]]
  };
  var DAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
  var TOL = { dayK: 50, dayP: 10, dayF: 10, mealKpct: 0.08, mealP: 5 };

  var RED_IDS = ['manzo_magro_girello_fesa', 'macinato_di_manzo_magro_5_grassi', 'vitello_fesa', 'cavallo', 'lonza_di_maiale',
    'filetto_di_maiale', 'bresaola', 'prosciutto_crudo_sgrassato', 'prosciutto_cotto_alta_qualita'];
  var PORK_IDS = ['lonza_di_maiale', 'filetto_di_maiale', 'prosciutto_crudo_sgrassato', 'prosciutto_cotto_alta_qualita'];
  var RAW_SMOKED_IDS = ['salmone_affumicato'];
  var SALUMI_IDS = ['bresaola', 'prosciutto_crudo_sgrassato', 'prosciutto_cotto_alta_qualita', 'fesa_di_tacchino_al_forno_affettato'];
  var PROCESSED_IDS = ['bresaola', 'prosciutto_crudo_sgrassato', 'prosciutto_cotto_alta_qualita'];
  var FATTY_FISH = ['salmone_allevamento', 'salmone_affumicato', 'sgombro', 'alici_acciughe_fresche', 'trota_allevamento'];
  var FREE_SUGAR_IDS = ['miele', 'confettura_light_tipo_hero_light', 'zucchero', 'cornflakes', 'rice_krispies', 'choco_krispies',
    'muesli_croccante_granola', 'biscotti_secchi_tipo_oro_saiwa', 'barretta_proteica_generica', 'cioccolato_fondente_85',
    'dessert_proteico_pudding_high_protein', 'bevanda_di_riso', 'bevanda_di_avena'];
  var DAIRY_IDS = ['latte_intero', 'latte_parzialmente_scremato', 'latte_scremato', 'yogurt_bianco_intero', 'yogurt_greco_0_grassi',
    'yogurt_greco_2_grassi', 'skyr_naturale', 'kefir_di_latte_parz_scremato', 'dessert_proteico_pudding_high_protein', 'fiocchi_di_latte',
    'ricotta_vaccina', 'ricotta_light', 'mozzarella_vaccina_fior_di_latte', 'mozzarella_light', 'parmigiano_reggiano', 'grana_padano', 'feta',
    'bevanda_di_soia_senza_zuccheri'];

  // Nomi brevi usati nel documento
  var SHORT = {
    latte_intero: 'latte intero', latte_parzialmente_scremato: 'latte parz. scremato', latte_scremato: 'latte scremato',
    yogurt_bianco_intero: 'yogurt bianco intero', yogurt_greco_0_grassi: 'yogurt greco 0%', yogurt_greco_2_grassi: 'yogurt greco 2%',
    skyr_naturale: 'skyr', kefir_di_latte_parz_scremato: 'kefir', dessert_proteico_pudding_high_protein: 'dessert proteico (es. High Protein Pudding/Milk Pro)',
    fiocchi_di_latte: 'fiocchi di latte', ricotta_vaccina: 'ricotta vaccina', ricotta_light: 'ricotta light',
    mozzarella_vaccina_fior_di_latte: 'mozzarella', mozzarella_light: 'mozzarella light', parmigiano_reggiano: 'parmigiano', grana_padano: 'grana',
    feta: 'feta', albume_d_uovo: 'albume d’uovo', albume_liquido_pastorizzato_brick: 'albume', tuorlo_d_uovo: 'tuorlo',
    petto_di_pollo_senza_pelle: 'petto di pollo', petto_di_tacchino: 'petto di tacchino', coscia_di_pollo_senza_pelle: 'coscia di pollo (senza pelle)',
    manzo_magro_girello_fesa: 'manzo magro (girello/fesa)', macinato_di_manzo_magro_5_grassi: 'macinato magro di manzo', vitello_fesa: 'vitello (fesa)',
    lonza_di_maiale: 'lonza di suino', filetto_di_maiale: 'filetto di maiale', coniglio: 'coniglio', cavallo: 'cavallo', bresaola: 'bresaola',
    fesa_di_tacchino_al_forno_affettato: 'fesa di tacchino (affettato)', prosciutto_crudo_sgrassato: 'prosciutto crudo sgrassato',
    prosciutto_cotto_alta_qualita: 'prosciutto cotto di alta qualità', merluzzo: 'merluzzo', nasello: 'nasello', platessa: 'platessa',
    sogliola: 'sogliola', orata_allevamento: 'orata', spigola_branzino: 'spigola/branzino', salmone_allevamento: 'salmone',
    salmone_affumicato: 'salmone affumicato', tonno_fresco: 'tonno fresco', tonno_al_naturale_sgocciolato: 'tonno al naturale',
    tonno_sott_olio_sgocciolato: 'tonno sott’olio', alici_acciughe_fresche: 'alici o acciughe fresche', sgombro: 'sgombro',
    pesce_spada: 'pesce spada', trota_allevamento: 'trota', baccala_ammollato: 'baccalà', gamberi_gamberetti: 'gamberi/gamberetti',
    calamari: 'calamari', polpo: 'polpo', seppia: 'seppie', cozze_sgusciate: 'cozze', vongole_sgusciate: 'vongole',
    tofu_compatto_naturale: 'tofu compatto', tempeh: 'tempeh', seitan: 'seitan', soia_gialla_secca: 'soia gialla secca',
    edamame_surgelati: 'edamame', lupini_in_salamoia_sgocciolati: 'lupini', ceci_secchi: 'ceci', fagioli_borlotti_secchi: 'fagioli borlotti',
    fagioli_cannellini_secchi: 'fagioli cannellini', lenticchie_secche: 'lenticchie', lenticchie_rosse_decorticate: 'lenticchie rosse decorticate',
    ceci_in_barattolo_sgocciolati: 'ceci in barattolo', fagioli_in_barattolo_sgocciolati: 'fagioli in barattolo', piselli_surgelati: 'piselli',
    pasta_di_semola: 'pasta', pasta_integrale: 'pasta integrale', riso_bianco: 'riso', riso_basmati: 'riso basmati', riso_integrale: 'riso integrale',
    couscous: 'couscous', quinoa: 'quinoa', farro: 'farro', orzo_perlato: 'orzo', grano_saraceno: 'grano saraceno',
    fiocchi_farina_d_avena: 'fiocchi d’avena', farina_di_frumento_tipo_00: 'farina 00', pane_comune_tipo_0: 'pane', pane_integrale: 'pane integrale',
    pane_di_segale: 'pane di segale', pan_bauletto_bianco: 'pan bauletto', fette_biscottate: 'fette biscottate', gallette_di_riso: 'gallette di riso',
    gallette_di_mais: 'gallette di mais', crema_di_riso: 'crema di riso', cornflakes: 'cornflakes', rice_krispies: 'rice krispies',
    choco_krispies: 'choco krispies', muesli_croccante_granola: 'muesli croccante (granola)', muesli_classico_non_tostato: 'muesli classico',
    biscotti_secchi_tipo_oro_saiwa: 'biscotti secchi (tipo Oro Saiwa)', crackers_classici: 'crackers', gnocchi_di_patate: 'gnocchi di patate',
    patate: 'patate', patate_dolci_batata: 'patate dolci (batata)', noci: 'noci', mandorle: 'mandorle', nocciole: 'nocciole', anacardi: 'anacardi',
    pistacchi: 'pistacchi', arachidi: 'arachidi', burro_crema_d_arachidi_100: 'crema d’arachidi 100%', crema_di_mandorle_100: 'crema di mandorle 100%',
    semi_di_chia: 'semi di chia', semi_di_lino: 'semi di lino', semi_di_zucca: 'semi di zucca', semi_di_sesamo: 'semi di sesamo',
    olio_extravergine_d_oliva: 'olio d’oliva', olio_di_semi_di_lino: 'olio di semi di lino', avocado: 'avocado',
    cioccolato_fondente_85: 'cioccolato fondente 85%', cacao_amaro_in_polvere: 'cacao amaro', miele: 'miele',
    confettura_light_tipo_hero_light: 'marmellata HERO LIGHT', proteine_whey_concentrate_wpc_80: 'proteine whey',
    proteine_whey_isolate: 'proteine whey isolate', barretta_proteica_generica: 'barretta proteica',
    bevanda_di_soia_senza_zuccheri: 'bevanda di soia senza zuccheri', bevanda_di_avena: 'bevanda di avena',
    bevanda_di_mandorla_senza_zuccheri: 'bevanda di mandorla', bevanda_di_riso: 'bevanda di riso', banana: 'banana'
  };
  var UNIT_LABEL = {
    uovo_intero: ['uovo intero', 'uova intere'], gallette_di_riso: ['galletta di riso', 'gallette di riso'],
    gallette_di_mais: ['galletta di mais', 'gallette di mais'], biscotti_secchi_tipo_oro_saiwa: ['biscotto secco (tipo Oro Saiwa)', 'biscotti secchi (tipo Oro Saiwa)'],
    fette_biscottate: ['fetta biscottata', 'fette biscottate'], pan_bauletto_bianco: ['fetta di pan bauletto', 'fette di pan bauletto'],
    barretta_proteica_generica: ['barretta proteica', 'barrette proteiche'], tuorlo_d_uovo: ['tuorlo', 'tuorli']
  };
  var UNIT_RE = /uovo|galletta|biscott|fetta|barretta|tuorlo/i;

  // ───────────────────────── Utility ─────────────────────────
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v).trim().replace(',', '.');
    if (s === '' || s.charAt(0) === '=') return null;
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }
  function str(v) { return v === null || v === undefined ? '' : String(v).trim(); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function rng(seed) { // mulberry32
    var a = (seed >>> 0) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function shuffle(arr, rnd) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uniq(a) { var s = {}, o = []; a.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o; }

  // ───────────────────────── Database ─────────────────────────
  // rows: array di oggetti {nome_colonna: valore} (lettura per NOME colonna)
  function buildDB(rows, dict, legend) {
    var flags = [];
    if (dict && dict.length) dict.forEach(function (d) { if (str(d['unità'] || d.unita).toLowerCase() === 'flag') flags.push(str(d.colonna)); });
    if (!flags.length) flags = DEFAULT_FLAGS.map(function (f) { return f[0]; });
    var flagInfo = {};
    DEFAULT_FLAGS.forEach(function (f) { flagInfo[f[0]] = { key: f[0], label: f[1], color: f[2] }; });
    (legend || []).forEach(function (l) {
      if (!l || !l.col) return;
      flagInfo[l.col] = { key: l.col, label: l.label || (flagInfo[l.col] && flagInfo[l.col].label) || l.col, color: l.color || (flagInfo[l.col] && flagInfo[l.col].color) || '#eeeeee' };
    });
    flags.forEach(function (k) { if (!flagInfo[k]) flagInfo[k] = { key: k, label: k, color: '#eeeeee' }; });
    var foods = {}, order = [];
    rows.forEach(function (r) {
      var id = str(r.id); if (!id) return;
      var f = {
        id: id, name: str(r.alimento), cat: str(r.categoria), ruolo: str(r.ruolo).toLowerCase(), stato: str(r.stato).toLowerCase(),
        gpm: num(r.g_per_ml), unitG: num(r.porzione_unitaria_g), unitDescr: str(r.porzione_unitaria_descr), note: str(r.note), n: {}, flags: {}
      };
      NUTR.forEach(function (k) { f.n[k] = num(r[k]); });
      flags.forEach(function (k) { f.flags[k] = num(r[k]); });
      f.K = f.n.kcal || 0; f.P = f.n.proteine_g || 0; f.C = f.n.carboidrati_g || 0; f.F = f.n.grassi_g || 0;
      f.isUnit = !!(f.unitG && UNIT_RE.test(f.unitDescr));
      f.isOil = /olio/.test(id);
      foods[id] = f; order.push(id);
    });
    return { foods: foods, order: order, flags: flags, flagInfo: flagInfo };
  }

  // ───────────────────────── Esclusioni ─────────────────────────
  function makeFilter(db, prefs) {
    prefs = prefs || {};
    var fl = prefs.flags || [], ex = {};
    (prefs.exclude || []).forEach(function (id) { ex[id] = 1; });
    var cache = {};
    return function (id) {
      if (id in cache) return cache[id];
      var f = db.foods[id], ok = !!f;
      if (ok && ex[id]) ok = false;
      if (ok) for (var i = 0; i < fl.length; i++) { var v = f.flags[fl[i]]; if (v === 1 || v === 2 || v === null || v === undefined) { ok = false; break; } }
      if (ok && (prefs.vegetarian || prefs.vegan) && /^(Carni|Salumi|Pesce|Crostacei e molluschi)$/.test(f.cat)) ok = false;
      if (ok && prefs.vegan && (/^(Latte e latticini|Uova)$/.test(f.cat) || f.flags.all_latte === 1 || f.flags.all_uova === 1 || id === 'miele' || id === 'burro')) ok = false;
      if (ok && prefs.noRed && RED_IDS.indexOf(id) >= 0) ok = false;
      if (ok && prefs.noPork && PORK_IDS.indexOf(id) >= 0) ok = false;
      if (ok && prefs.noRawSmoked && RAW_SMOKED_IDS.indexOf(id) >= 0) ok = false;
      cache[id] = ok; return ok;
    };
  }

  // ───────────────────────── Quantità e arrotondamenti ─────────────────────────
  var SEQ = (function () { var s = []; for (var v = 0; v <= 100; v += 5) s.push(v); for (v = 110; v <= 1200; v += 10) s.push(v); return s; })();
  var OIL_SEQ = (function () { var s = []; for (var v = 0; v <= 80; v += 5) s.push(v); return s; })();

  function grid(f, min, max) {
    min = min || 0; max = max === undefined ? 1000 : max;
    var out = [];
    if (f.isUnit) {
      for (var u = 0; u * f.unitG <= max + 1e-9 && u <= 30; u++) { var g = u * f.unitG; if (g >= min - 1e-9) out.push(g); }
    } else if (f.gpm) {
      (f.isOil ? OIL_SEQ : SEQ).forEach(function (ml) { var g = ml * f.gpm; if (g >= min - 1e-9 && g <= max + 1e-9) out.push(g); });
    } else {
      SEQ.forEach(function (g) { if (g >= min - 1e-9 && g <= max + 1e-9) out.push(g); });
    }
    if (!out.length) out.push(min);
    return out;
  }
  function roundQ(f, g) {
    var gr = grid(f, 0, Math.max(g * 2 + 50, 100)), best = gr[0];
    gr.forEach(function (v) { if (Math.abs(v - g) < Math.abs(best - g)) best = v; });
    return best;
  }
  function qty(f, g) { // {n, unit, text}
    if (f.isUnit) { var u = Math.round(g / f.unitG); return { n: u, unit: 'pz', text: String(u) }; }
    if (f.gpm) { var ml = Math.round(g / f.gpm); return { n: ml, unit: 'ml', text: ml + 'ml' }; }
    return { n: Math.round(g), unit: 'g', text: Math.round(g) + 'g' };
  }

  // ───────────────────────── Totali nutrizionali ─────────────────────────
  function totals(db, items) {
    var t = { K: 0, P: 0, C: 0, F: 0, micro: {}, missing: {} };
    NUTR.forEach(function (k) { t.micro[k] = 0; t.missing[k] = 0; });
    items.forEach(function (it) {
      var f = db.foods[it.id]; if (!f || !it.g) return;
      var m = it.g / 100;
      t.K += f.K * m; t.P += f.P * m; t.C += f.C * m; t.F += f.F * m;
      NUTR.forEach(function (k) { var v = f.n[k]; if (v === null || v === undefined) t.missing[k]++; else t.micro[k] += v * m; });
    });
    return t;
  }
  function addT(a, b) {
    var t = { K: a.K + b.K, P: a.P + b.P, C: a.C + b.C, F: a.F + b.F, micro: {}, missing: {} };
    NUTR.forEach(function (k) { t.micro[k] = (a.micro ? a.micro[k] : 0) + (b.micro ? b.micro[k] : 0); t.missing[k] = (a.missing ? a.missing[k] : 0) + (b.missing ? b.missing[k] : 0); });
    return t;
  }
  function zeroT() { return totals({ foods: {} }, []); }
  function objective(t, tg) {
    var dk = (t.K - tg.K) / Math.max(12, 0.03 * tg.K), dp = (t.P - tg.P) / 2, df = (t.F - tg.F) / 2.5, dc = (t.C - tg.C) / Math.max(4, 0.1 * Math.abs(tg.C));
    return dk * dk + dp * dp + df * df + 0.5 * dc * dc;
  }
  function mealOk(t, tg) { return Math.abs(t.K - tg.K) <= TOL.mealKpct * tg.K + 0.5 && Math.abs(t.P - tg.P) <= TOL.mealP + 0.05; }
  function mealDev(t, tg) { return { K: t.K - tg.K, P: t.P - tg.P, C: t.C - tg.C, F: t.F - tg.F, Kpct: tg.K ? (t.K - tg.K) / tg.K : 0 }; }
  function dayOk(t, tg) { return Math.abs(t.K - tg.K) <= TOL.dayK && Math.abs(t.P - tg.P) <= TOL.dayP && Math.abs(t.F - tg.F) <= TOL.dayF; }
  function light(dev, tol) { var a = Math.abs(dev); return a <= tol ? 'green' : (a <= 2 * tol ? 'yellow' : 'red'); }

  // ───────────────────────── Risolutore (minimi quadrati con vincoli) ─────────────────────────
  // vars: [{f, min, max}], base: totali fissi, tg: target. Restituisce grammi discreti.
  function solve(db, vars, base, tg, opt) {
    opt = opt || {};
    var W = [1 / Math.pow(Math.max(12, 0.03 * tg.K), 2), 1 / 4, 0.5 / Math.pow(Math.max(4, 0.1 * Math.abs(tg.C)), 2), 1 / 6.25];
    var T = [tg.K - base.K, tg.P - base.P, tg.C - base.C, tg.F - base.F];
    var A = vars.map(function (v) { return [v.f.K / 100, v.f.P / 100, v.f.C / 100, v.f.F / 100]; });
    var g = vars.map(function (v) { return Math.max(v.min || 0, Math.min(v.max, v.start !== undefined ? v.start : (v.min + v.max) / 3)); });
    for (var it = 0; it < 300; it++) {
      for (var j = 0; j < vars.length; j++) {
        var num_ = 0, den = 0;
        for (var k = 0; k < 4; k++) {
          var r = -T[k]; for (var i = 0; i < vars.length; i++) r += A[i][k] * g[i];
          num_ += W[k] * A[j][k] * r; den += W[k] * A[j][k] * A[j][k];
        }
        if (den > 0) g[j] = Math.max(vars[j].min || 0, Math.min(vars[j].max, g[j] - num_ / den));
      }
    }
    // discretizzazione + ricerca locale
    var grids = vars.map(function (v) { return grid(v.f, v.min || 0, v.max); });
    var cur = g.map(function (x, j) { var best = grids[j][0]; grids[j].forEach(function (v) { if (Math.abs(v - x) < Math.abs(best - x)) best = v; }); return best; });
    function ev(arr) {
      var t = base; var items = arr.map(function (x, j) { return { id: vars[j].f.id, g: x }; });
      t = addT(base, totals(db, items));
      return objective(t, tg) + (opt.penalty ? opt.penalty(arr) : 0);
    }
    var bestVal = ev(cur);
    for (var round = 0; round < 6; round++) {
      var improved = false;
      for (j = 0; j < vars.length; j++) {
        for (var q = 0; q < grids[j].length; q++) {
          var cand = cur.slice(); cand[j] = grids[j][q];
          var val = ev(cand); if (val < bestVal - 1e-9) { bestVal = val; cur = cand; improved = true; }
        }
      }
      // coppie (per compensare due ingredienti insieme)
      for (j = 0; j < vars.length; j++) for (var l = j + 1; l < vars.length; l++) {
        var ij = grids[j].indexOf(cur[j]), il = grids[l].indexOf(cur[l]);
        for (var a = -2; a <= 2; a++) for (var b = -2; b <= 2; b++) {
          if (!a && !b) continue;
          var x = grids[j][ij + a], y = grids[l][il + b]; if (x === undefined || y === undefined) continue;
          var c2 = cur.slice(); c2[j] = x; c2[l] = y; var v2 = ev(c2);
          if (v2 < bestVal - 1e-9) { bestVal = v2; cur = c2; improved = true; }
        }
      }
      if (!improved) break;
    }
    return cur;
  }

  // ───────────────────────── Modelli di colazioni e spuntini ─────────────────────────
  // comp: {ids, min, max, label?, alts:[{ids,label?}], eq: 'C'|'F'|'P', opt: componente facoltativa, suffix}
  var WHEY = ['proteine_whey_concentrate_wpc_80', 'proteine_whey_isolate'];
  var YOG = ['yogurt_greco_0_grassi', 'skyr_naturale', 'yogurt_greco_2_grassi'];
  var NUTS = ['noci', 'mandorle', 'nocciole', 'anacardi'];
  var CEREALS = ['cornflakes', 'rice_krispies', 'choco_krispies'];
  var BREAD = ['pane_di_segale', 'pane_integrale', 'pane_comune_tipo_0'];
  var GALL = ['gallette_di_riso', 'gallette_di_mais'];
  var MILK = ['latte_parzialmente_scremato', 'bevanda_di_soia_senza_zuccheri'];
  var ALB = ['albume_d_uovo', 'albume_liquido_pastorizzato_brick'];
  var TEMPLATES = [
    // ── Colazioni ──
    { key: 'yog_cer', meals: ['col'], group: 'Dolci con yogurt', comps: [
      { ids: YOG, label: 'yogurt greco 0%', min: 150, max: 350, note: '(anche fruttato, basta che ci siano 8g minimo di proteine!)' },
      { ids: CEREALS, min: 0, max: 70, eq: 'C', alts: [{ ids: ['fette_biscottate'] }, { ids: ['pan_bauletto_bianco'], note: '(con marmellata HERO LIGHT q.b.)' }] },
      { ids: NUTS.slice(0, 2), min: 0, max: 30, eq: 'F', alts: [{ ids: ['crema_di_mandorle_100', 'burro_crema_d_arachidi_100'], label: 'crema 100% frutta secca' }] },
      { ids: WHEY, label: 'proteine whey', min: 0, max: 25, opt: true }] },
    { key: 'yog_bisc', meals: ['col'], group: 'Dolci con yogurt', comps: [
      { ids: YOG, label: 'yogurt greco 0%', min: 150, max: 350 }, { ids: ['biscotti_secchi_tipo_oro_saiwa'], min: 12, max: 80 },
      { ids: ['noci', 'anacardi'], label: 'noci o anacardi', min: 0, max: 30 }, { free: 'Marmellata HERO LIGHT q.b.' }] },
    { key: 'yog_gran', meals: ['col'], group: 'Dolci con yogurt', comps: [
      { ids: YOG, label: 'yogurt greco 0%', min: 150, max: 350 }, { ids: ['muesli_croccante_granola', 'muesli_classico_non_tostato'], label: 'muesli croccante (granola)', min: 20, max: 70 },
      { ids: ['cioccolato_fondente_85'], min: 0, max: 25 }, { ids: WHEY, label: 'proteine whey', min: 0, max: 25 }] },
    { key: 'dess_cer', meals: ['col'], group: 'Dolci con yogurt', comps: [
      { ids: ['dessert_proteico_pudding_high_protein'], min: 200, max: 400 }, { ids: CEREALS, label: 'cereali (cornflakes/rice krispies)', min: 15, max: 60, eq: 'C', alts: [{ ids: GALL, label: ['galletta di riso/mais sbriciolata', 'gallette di riso/mais sbriciolate'] }] },
      { ids: ['noci', 'nocciole'], label: 'noci/nocciole', min: 0, max: 30 }, { ids: WHEY, label: 'proteine whey', min: 0, max: 20 }] },
    { key: 'pancake', meals: ['col', 's2'], group: 'A base di avena', name: 'Pancake proteico', comps: [
      { ids: ALB, label: 'albume d’uovo', min: 100, max: 350 }, { ids: ['fiocchi_farina_d_avena'], label: 'farina d’avena', min: 15, max: 90 },
      { ids: ['burro_crema_d_arachidi_100', 'crema_di_mandorle_100'], label: 'crema d’arachidi 100%', min: 0, max: 30 }, { ids: WHEY, label: 'proteine whey', min: 0, max: 20 }],
      prep: 'Unisci la farina d’avena all’albume e cuoci in padella antiaderente con coperchio, la crema va sopra a fine cottura. NB. Puoi preparare l’impasto la sera prima e conservarlo in frigo!' },
    { key: 'mugcake', meals: ['col'], group: 'A base di avena', name: 'Mug Cake', comps: [
      { ids: ALB, label: 'albume d’uovo', min: 100, max: 350 }, { ids: ['fiocchi_farina_d_avena'], label: 'farina d’avena aromatizzata', min: 15, max: 90 },
      { ids: ['cioccolato_fondente_85'], min: 5, max: 30, note: '(sminuzzato dentro o sopra)' }, { ids: WHEY, label: 'proteine whey', min: 0, max: 20 }],
      prep: 'Mescola tutto e cuoci in tazza al microonde per circa 2 minuti alla massima potenza.' },
    { key: 'porridge', meals: ['col'], group: 'A base di avena', name: 'Porridge proteico', comps: [
      { ids: ['fiocchi_farina_d_avena'], label: 'fiocchi d’avena', min: 20, max: 90, note: '(cotti in acqua)' },
      { ids: WHEY, label: 'proteine whey', min: 15, max: 40, note: '(mescolate a fine cottura, a fuoco spento)' }, { ids: NUTS.slice(0, 2), label: 'noci o mandorle', min: 0, max: 30, note: '(+ cannella a piacere)' }] },
    { key: 'overnight', meals: ['col'], group: 'A base di avena', name: 'Overnight oats', comps: [
      { ids: ['fiocchi_farina_d_avena'], label: 'fiocchi d’avena', min: 20, max: 90 }, { ids: WHEY, label: 'proteine whey', min: 10, max: 35 },
      { ids: MILK, label: 'latte parz. scremato (o bevanda di soia senza zuccheri)', min: 100, max: 250 }, { ids: ['semi_di_chia'], min: 0, max: 25 }],
      prep: 'Mescola tutto in un barattolo e lascia in frigo per tutta la notte.' },
    { key: 'whey_latte', meals: ['col'], group: 'Whey e latte', comps: [
      { ids: WHEY, label: 'proteine whey', min: 15, max: 40, note: 'sciolte nel latte' }, { ids: MILK, label: 'latte parz. scremato (o bevanda di soia senza zuccheri)', min: 100, max: 250 },
      { ids: CEREALS, min: 10, max: 70, eq: 'C', alts: [{ ids: ['biscotti_secchi_tipo_oro_saiwa'] }, { ids: ['fette_biscottate'], note: '(con marmellata HERO LIGHT q.b.)' }] },
      { ids: ['cioccolato_fondente_85'], min: 0, max: 25, eq: 'F', alts: [{ ids: ['mandorle', 'nocciole'], label: 'mandorle o nocciole' }] }] },
    { key: 'chia', meals: ['col', 'ser'], group: 'Whey e latte', name: 'Chia pudding', comps: [
      { ids: WHEY, label: 'proteine whey', min: 10, max: 35 }, { ids: MILK, label: 'latte parz. scremato (o bevanda di soia senza zuccheri)', min: 100, max: 250 },
      { ids: ['semi_di_chia'], min: 10, max: 30 }],
      prep: 'Mescola tutto e lascia in frigo almeno 2 ore (meglio tutta la notte).' },
    { key: 'uova_pane', meals: ['col', 's2'], group: 'Salati', comps: [
      { ids: ['uovo_intero'], min: 55, max: 165 }, { ids: ALB, min: 0, max: 300, label: 'albume', note: '(strapazzati o in omelette)' },
      { ids: BREAD, label: 'pane di segale/integrale', min: 20, max: 120, eq: 'C', alts: [{ ids: ['pan_bauletto_bianco'], note: 'tostato' }] }] },
    { key: 'fiocchi_pane', meals: ['col'], group: 'Salati', comps: [
      { ids: ['fiocchi_di_latte', 'ricotta_light'], label: 'fiocchi di latte', min: 150, max: 350 }, { ids: ['pane_integrale', 'pane_di_segale'], label: 'pane integrale o di segale tostato', min: 20, max: 120 },
      { ids: ['miele'], min: 0, max: 16, eq: 'C', alts: [{ ids: ['confettura_light_tipo_hero_light'] }] }, { ids: NUTS, min: 0, max: 20 }],
      tail: '(oppure versione salata con pomodorini e origano)' },
    { key: 'omelette', meals: ['col', 'ser'], group: 'Salati', name: 'Omelette', comps: [
      { ids: ['uovo_intero'], min: 55, max: 165 }, { ids: ALB, label: 'albume d’uovo', min: 0, max: 300 }, { ids: ['parmigiano_reggiano', 'grana_padano'], label: 'parmigiano grattugiato', min: 0, max: 25 },
      { ids: BREAD, label: 'pane tostato', min: 0, max: 100 }, { free: 'Verdure a piacere' }] },
    { key: 'toast_salmone', meals: ['col', 's2'], group: 'Salati', name: 'Toast al salmone', comps: [
      { ids: BREAD, label: 'pane tostato', min: 20, max: 100 }, { ids: ['salmone_affumicato'], min: 40, max: 120 },
      { ids: ['avocado'], min: 0, max: 60 }, { ids: ALB, label: 'albume d’uovo', min: 0, max: 200, note: '(frittatina)' }] },
    // ── Spuntini ──
    { key: 'sn_whey_pane', meals: ['s2'], group: 'Veloci da portare con te', comps: [
      { ids: WHEY, label: 'proteine whey', min: 15, max: 40, note: 'in 60ml d’acqua' }, { ids: ['pane_di_segale', 'pan_bauletto_bianco'], label: 'pane di segale', min: 20, max: 100 },
      { ids: ['burro_crema_d_arachidi_100', 'crema_di_mandorle_100'], label: 'crema d’arachidi 100%', min: 0, max: 30, eq: 'F', alts: [{ ids: ['mandorle'] }] }] },
    { key: 'sn_whey_cer', meals: ['s2'], group: 'Veloci da portare con te', comps: [
      { ids: WHEY, label: 'proteine whey', min: 15, max: 40, note: 'in 60ml d’acqua' }, { ids: CEREALS, min: 0, max: 60, eq: 'C', alts: [{ ids: GALL, label: ['galletta di riso/mais', 'gallette di riso/mais'] }] },
      { ids: ['noci', 'nocciole'], label: 'noci sgusciate/nocciole', min: 0, max: 30, eq: 'F', alts: [{ ids: ['cioccolato_fondente_85'] }] }] },
    { key: 'sn_barretta', meals: ['s2'], group: 'Veloci da portare con te', comps: [
      { ids: ['barretta_proteica_generica'], min: 60, max: 60, note: '(minimo 20g di proteine, massimo 200 kcal)' },
      { ids: GALL, label: ['galletta di riso/mais', 'gallette di riso/mais'], min: 0, max: 40 }, { ids: NUTS, label: 'frutta secca', min: 0, max: 20 }] },
    { key: 'sn_tonno', meals: ['s2'], group: 'Veloci da portare con te', comps: [
      { ids: ['tonno_al_naturale_sgocciolato'], min: 80, max: 200 }, { ids: GALL, label: ['galletta di riso/mais', 'gallette di riso/mais'], min: 0, max: 56 },
      { ids: ['olio_extravergine_d_oliva'], min: 0, max: 15 }, { ids: ['avocado'], min: 0, max: 60, opt: true }] },
    { key: 'sn_yog_nuts', meals: ['s2', 'ser'], group: 'Veloci da portare con te', comps: [
      { ids: YOG, label: 'yogurt greco 0%', min: 150, max: 350 }, { ids: NUTS, label: 'noci/mandorle', min: 0, max: 30 }, { ids: ['cioccolato_fondente_85'], min: 0, max: 15 },
      { ids: WHEY, label: 'proteine whey', min: 0, max: 20 }] },
    { key: 'sn_cremariso', meals: ['s2'], group: 'Da preparare', name: 'Crema di riso proteica', comps: [
      { ids: ['crema_di_riso'], min: 10, max: 70 }, { ids: WHEY, label: 'proteine whey', min: 15, max: 40 }, { ids: ['burro_crema_d_arachidi_100', 'crema_di_mandorle_100'], label: 'crema d’arachidi 100%', min: 0, max: 30 }] },
    { key: 'sn_bresaola', meals: ['s2'], group: 'Salati', name: '', cap: '(bresaola max 1 volta a settimana)', comps: [
      { ids: BREAD, label: 'pane', min: 20, max: 100 }, { ids: ['bresaola'], min: 30, max: 120, eq: 'P', alts: [{ ids: ['fesa_di_tacchino_al_forno_affettato'] }] },
      { ids: ['noci'], min: 0, max: 25 }] },
    { key: 'sn_uova_yog', meals: ['s2'], group: 'Salati', comps: [
      { ids: ['uovo_intero'], label: ['uovo sodo', 'uova sode'], min: 55, max: 110 }, { ids: YOG, label: 'yogurt greco 0%', min: 0, max: 250 }, { ids: GALL, label: ['galletta di riso/mais', 'gallette di riso/mais'], min: 0, max: 40 }] },
    { key: 'sn_fiocchi', meals: ['s2', 'ser'], group: 'Salati', comps: [
      { ids: ['fiocchi_di_latte'], min: 150, max: 350 }, { ids: GALL, label: ['galletta di riso/mais', 'gallette di riso/mais'], min: 0, max: 40 }, { ids: ['noci', 'mandorle'], min: 0, max: 25 }] },
    { key: 'sn_dessert', meals: ['s2', 'ser'], group: 'Veloci da portare con te', comps: [
      { ids: ['dessert_proteico_pudding_high_protein'], min: 200, max: 400 }, { ids: ['noci', 'nocciole'], label: 'noci/nocciole', min: 0, max: 30 }] },
    { key: 'ser_ricotta', meals: ['ser'], group: 'Serali', comps: [
      { ids: ['ricotta_light'], min: 100, max: 300 }, { ids: ['cacao_amaro_in_polvere'], min: 5, max: 10 }, { ids: NUTS, min: 0, max: 20 }] },
    { key: 'ser_tofu', meals: ['s2', 'ser', 'col'], group: 'Salati', name: 'Tofu strapazzato', comps: [
      { ids: ['tofu_compatto_naturale'], min: 100, max: 300 }, { ids: BREAD, label: 'pane', min: 0, max: 100 }, { free: 'Verdure a piacere' }] },
    { key: 'sn_soia_drink', meals: ['s2', 'col', 'ser'], group: 'Veloci da portare con te', name: 'Shake vegetale', comps: [
      { ids: ['bevanda_di_soia_senza_zuccheri'], min: 200, max: 400 }, { ids: ['fiocchi_farina_d_avena'], label: 'fiocchi d’avena', min: 0, max: 70 },
      { ids: ['semi_di_chia', 'semi_di_lino'], min: 0, max: 25 }] }
  ];
  var GROUP_ORDER = ['Dolci con yogurt', 'A base di avena', 'Whey e latte', 'Salati', 'Veloci da portare con te', 'Da preparare', 'Serali'];

  // ───────────────────────── Contesto ─────────────────────────
  function makeCtx(db, input, settings) {
    var allowed = makeFilter(db, input.prefs);
    var ctx = { db: db, input: input, settings: settings, allowed: allowed, warnings: [] };
    ctx.first = function (ids) { for (var i = 0; i < ids.length; i++) if (allowed(ids[i])) return ids[i]; return null; };
    ctx.all = function (ids) { return ids.filter(allowed); };
    // verdura "media" per i calcoli dei pasti principali (contorno non pesato ≈ 200 g)
    var vegIds = db.order.filter(function (id) { var f = db.foods[id]; return f.cat === 'Verdure' && allowed(id) && ['aglio', 'cipolla', 'sedano'].indexOf(id) < 0; });
    var vf = { id: '_verdura', name: 'Verdura a scelta', cat: 'Verdure', ruolo: 'verdura', stato: 'crudo', n: {}, flags: {}, K: 0, P: 0, C: 0, F: 0 };
    NUTR.forEach(function (k) {
      var s = 0, c = 0; vegIds.forEach(function (id) { var v = db.foods[id].n[k]; if (v !== null && v !== undefined) { s += v; c++; } });
      vf.n[k] = c ? s / c : null;
    });
    vf.K = vf.n.kcal || 0; vf.P = vf.n.proteine_g || 0; vf.C = vf.n.carboidrati_g || 0; vf.F = vf.n.grassi_g || 0;
    db.foods._verdura = vf;
    ctx.vegIds = vegIds;
    // frutta: porzione di riferimento = 1 banana media
    var fruitIds = db.order.filter(function (id) { return db.foods[id].cat === 'Frutta' && allowed(id); });
    ctx.fruitIds = fruitIds;
    var banana = db.foods.banana;
    ctx.fruitKcal = banana ? banana.K * (banana.unitG || 120) / 100 : 105;
    ctx.fruitRef = allowed('banana') ? { id: 'banana', g: banana.unitG || 120 } : (fruitIds.length ? { id: fruitIds[0], g: roundQ(db.foods[fruitIds[0]], ctx.fruitKcal / db.foods[fruitIds[0]].K * 100) } : null);
    return ctx;
  }

  function label(ctx, comp, id, plural) {
    var f = ctx.db.foods[id];
    if (comp && comp.label) {
      if (Array.isArray(comp.label)) return plural ? comp.label[1] : comp.label[0];
      if (comp.ids && comp.ids.length > 1) return (id !== comp.ids[0] && comp.label.indexOf('/') < 0 && comp.label.indexOf(' o ') < 0 && SHORT[id]) ? SHORT[id] : comp.label;
      if (!f.isUnit) return comp.label;
    }
    if (f && f.isUnit && UNIT_LABEL[id]) return plural ? UNIT_LABEL[id][1] : UNIT_LABEL[id][0];
    if (comp && comp.ids && comp.ids.length > 1) {
      var al = ctx.all(comp.ids).map(function (x) { return SHORT[x] || ctx.db.foods[x].name.toLowerCase(); });
      return al.join('/');
    }
    return SHORT[id] || (f ? f.name.toLowerCase() : id);
  }
  function stateNote(f) {
    if (!f) return '';
    if (f.stato === 'sgocciolato') return '(peso sgocciolato)';
    if (f.stato === 'ammollato') return '(peso ammollato)';
    if (f.stato === 'secco' && /Legumi|Proteine vegetali/.test(f.cat)) return '(peso a crudo)';
    return '';
  }
  function itemText(ctx, comp, id, g) {
    var f = ctx.db.foods[id], q = qty(f, g);
    if (f.isUnit) {
      var t = q.n + ' ' + label(ctx, comp, id, q.n !== 1);
      if (id === 'pan_bauletto_bianco') t += ' (' + Math.round(g) + 'g)';
      return t;
    }
    return q.text + ' ' + label(ctx, comp, id);
  }

  // ───────────────────────── Target giornalieri e per pasto ─────────────────────────
  function dayTarget(t) { return { K: +t.kcal, P: +t.P, F: +t.F, C: (+t.kcal - t.P * 4 - t.F * 9) / 4 }; }
  function mealPlan(nMeals, settings) {
    var d = (settings && settings.dist && settings.dist[nMeals]) || DEFAULT_DIST[nMeals];
    return d.map(function (x) { return { key: x[0], pct: +x[1], label: MEAL_LABEL[x[0]] }; });
  }
  function mealTargets(ctx, day, meals, opts) {
    opts = opts || {};
    var out = {}, db = ctx.db;
    var hasFruit = meals.some(function (m) { return m.key === 's1'; });
    var fruitT = ctx.fruitRef ? totals(db, [ctx.fruitRef]) : zeroT();
    // con 3-4 pasti la frutta è dentro la colazione: il target della colazione la comprende già
    var rest = hasFruit ? { K: day.K - fruitT.K, P: day.P - fruitT.P, C: day.C - fruitT.C, F: day.F - fruitT.F } : { K: day.K, P: day.P, C: day.C, F: day.F };
    var others = meals.filter(function (m) { return m.key !== 's1'; });
    var sum = others.reduce(function (s, m) { return s + m.pct; }, 0);
    meals.forEach(function (m) {
      if (m.key === 's1') { out.s1 = { K: fruitT.K, P: fruitT.P, C: fruitT.C, F: fruitT.F, fixed: true }; return; }
      var s = m.pct / sum;
      out[m.key] = { K: rest.K * s, P: rest.P * s, C: rest.C * s, F: rest.F * s };
    });
    if (!hasFruit && ctx.fruitRef && out.col) out.col.fruitInside = true; // 3-4 pasti: frutta a colazione
    // spostamento carboidrati sul pasto post-allenamento (solo piano giorno per giorno, giorni ON)
    if (opts.shiftTo && out[opts.shiftTo] && out.pra && out.cen) {
      var other = opts.shiftTo === 'pra' ? 'cen' : 'pra', dC = Math.min(15, out[other].C * 0.3);
      out[opts.shiftTo].C += dC; out[opts.shiftTo].K += dC * 4; out[other].C -= dC; out[other].K -= dC * 4;
    }
    return out;
  }

  // ───────────────────────── Costruzione di un'opzione da modello ─────────────────────────
  function buildOption(ctx, tpl, tg, opts) {
    opts = opts || {};
    var db = ctx.db, base = zeroT(), fixed = [];
    if (tg.fruitInside && ctx.fruitRef) { fixed.push({ fruit: true, id: ctx.fruitRef.id, g: ctx.fruitRef.g }); base = totals(db, [ctx.fruitRef]); }
    var comps = [], vars = [];
    for (var i = 0; i < tpl.comps.length; i++) {
      var c = tpl.comps[i];
      if (c.free) { comps.push({ free: c.free }); continue; }
      var id = ctx.first(c.ids);
      if (!id) { if (c.min > 0 && !c.opt) return null; continue; }
      if (c.max === 0) continue;
      var v = { f: db.foods[id], min: c.min, max: c.max, comp: c };
      if (opts.bounds && opts.bounds[i]) { v.min = opts.bounds[i][0]; v.max = opts.bounds[i][1]; }
      vars.push(v); comps.push({ ci: i, id: id, comp: c });
    }
    if (!vars.length) return null;
    var g = solve(db, vars, base, tg, {
      penalty: function (arr) { // preferisci opzioni "pulite": niente ingredienti minuscoli
        var p = 0; arr.forEach(function (x, j) { var f = vars[j].f; if (x > 0 && !f.isUnit && x < 10 && !f.isOil) p += 3; }); return p;
      }
    });
    var items = [], k = 0;
    comps.forEach(function (c) { if (c.free) return; c.g = g[k++]; });
    var out = { tpl: tpl.key, name: tpl.name || '', group: tpl.group, prep: tpl.prep || '', cap: tpl.cap || '', tail: tpl.tail || '', fixed: fixed, comps: [] };
    comps.forEach(function (c) {
      if (c.free) { out.comps.push({ free: c.free }); return; }
      if (!c.g) return;
      var o = { ci: c.ci, id: c.id, g: c.g, alts: [] };
      out.comps.push(o); items.push({ id: c.id, g: c.g });
    });
    var tot = addT(base, totals(db, items));
    // alternative equivalenti ("oppure")
    out.comps.forEach(function (o) {
      if (o.free) return;
      var c = tpl.comps[o.ci]; if (!c.alts) return;
      var f = db.foods[o.id], eq = c.eq || 'K';
      c.alts.forEach(function (a) {
        var aid = ctx.first(a.ids); if (!aid) return;
        var af = db.foods[aid]; if (!af[eq]) return;
        var ag = roundQ(af, o.g * f[eq] / af[eq]); if (!ag) return;
        var its = items.map(function (x) { return x.id === o.id ? { id: aid, g: ag } : x; });
        var t2 = addT(base, totals(db, its));
        if (mealOk(t2, tg)) o.alts.push({ ai: c.alts.indexOf(a), id: aid, g: ag, tot: t2 });
      });
    });
    // l'opzione deve avere almeno 2 alimenti pesati e nessun componente obbligatorio a zero
    var weighed = out.comps.filter(function (c) { return !c.free; });
    if (weighed.length < 2) return null;
    for (i = 0; i < tpl.comps.length; i++) {
      var cc = tpl.comps[i]; if (cc.free || cc.opt) continue;
      if (cc.min > 0 && ctx.first(cc.ids) && !weighed.some(function (w) { return w.ci === i; })) return null;
    }
    out.tot = tot; out.ok = mealOk(tot, tg); out.dev = mealDev(tot, tg);
    return out;
  }
  function recomputeOption(ctx, o, tg) {
    var db = ctx.db, items = o.comps.filter(function (c) { return !c.free && c.g; }).map(function (c) { return { id: c.id, g: c.g }; });
    var base = o.fixed && o.fixed.length ? totals(db, o.fixed) : zeroT();
    o.tot = addT(base, totals(db, items)); o.ok = mealOk(o.tot, tg); o.dev = mealDev(o.tot, tg);
    return o;
  }
  // dopo una modifica manuale: ricalcola le alternative equivalenti e i totali
  function refreshOption(ctx, o, tg) {
    var db = ctx.db, tpl = TEMPLATES.filter(function (t) { return t.key === o.tpl; })[0];
    o.comps.forEach(function (c) {
      if (c.free || !tpl) return;
      var comp = tpl.comps[c.ci], f = db.foods[c.id], eq = comp.eq || 'K';
      (c.alts || []).forEach(function (a) { var af = db.foods[a.id]; if (af[eq]) a.g = roundQ(af, c.g * f[eq] / af[eq]); });
    });
    return recomputeOption(ctx, o, tg);
  }
  function optionSignature(o) { return o.comps.filter(function (c) { return !c.free; }).map(function (c) { return c.id; }).sort().join('|'); }

  // ───────────────────────── Pasti principali (scelte multiple) ─────────────────────────
  var PRIMI = [
    { ids: ['riso_bianco', 'pasta_di_semola', 'couscous', 'quinoa', 'farro', 'orzo_perlato', 'riso_basmati', 'pasta_integrale', 'riso_integrale', 'grano_saraceno'] },
    { ids: ['pane_comune_tipo_0', 'pane_integrale', 'pane_di_segale'] },
    { ids: ['patate', 'patate_dolci_batata'] },
    { ids: ['gnocchi_di_patate'] },
    { ids: ['gallette_di_riso', 'gallette_di_mais'], label: ['galletta di riso/mais', 'gallette di riso/mais'], unitGroup: true }
  ];
  var PRIMO_REF = ['pasta_di_semola', 'riso_bianco', 'riso_basmati', 'quinoa', 'patate', 'gallette_di_riso', 'pane_comune_tipo_0', 'patate_dolci_batata'];
  var SECONDI = [
    { key: 'pollo', ids: ['petto_di_pollo_senza_pelle', 'petto_di_tacchino'], label: 'petto di pollo/tacchino', tag: 'bianca' },
    { key: 'manzo', ids: ['manzo_magro_girello_fesa', 'vitello_fesa'], label: 'carne rossa magrissima (manzo, vitello..)', tag: 'rossa' },
    { key: 'lonza', ids: ['lonza_di_maiale', 'filetto_di_maiale'], label: 'lonza di suino', tag: 'rossa' },
    { key: 'fesa', ids: ['fesa_di_tacchino_al_forno_affettato'], label: 'fesa di tacchino (affettato)', tag: 'bianca' },
    { key: 'bresaola', ids: ['bresaola'], label: 'bresaola', note: '(massimo una volta a settimana)', tag: 'salume' },
    { key: 'pesce_magro', ids: ['merluzzo', 'nasello', 'platessa', 'sogliola'], label: 'pesce magro', note: '(elenco in basso!)', tag: 'pesce' },
    { key: 'gamberi', ids: ['gamberi_gamberetti'], label: 'gamberi/gamberetti', tag: 'pesce' },
    { key: 'salmone', ids: ['salmone_allevamento'], label: 'salmone', tag: 'pesce_grasso' },
    { key: 'tonno', ids: ['tonno_al_naturale_sgocciolato'], label: 'tonno al naturale', tag: 'pesce' },
    { key: 'alici', ids: ['alici_acciughe_fresche'], label: 'alici o acciughe fresche', tag: 'pesce_grasso' },
    { key: 'molluschi', ids: ['calamari', 'polpo', 'seppia'], label: 'totani, polpo, calamari o seppie', tag: 'pesce' },
    { key: 'cozze', ids: ['cozze_sgusciate', 'vongole_sgusciate'], label: 'cozze o vongole', note: '(peso sgusciato)', tag: 'pesce' },
    { key: 'uova', combo: [{ id: 'uovo_intero', units: [2, 1, 3] }, { ids: ALB }], label: 'uova', tag: 'uova' },
    { key: 'fiocchi', ids: ['fiocchi_di_latte'], label: 'fiocchi di latte', tag: 'latticini' },
    { key: 'mozzarella', ids: ['mozzarella_light'], label: 'mozzarella light', tag: 'latticini' },
    { key: 'ricotta', combo: [{ id: 'ricotta_light', ratio: 1 }, { ids: ALB, ratio: 1 }], label: 'ricotta light + albume', note: 'sformato al forno', tag: 'latticini' },
    { key: 'tofu', ids: ['tofu_compatto_naturale'], label: 'tofu compatto', tag: 'vegetale' },
    { key: 'tempeh', ids: ['tempeh'], label: 'tempeh', tag: 'vegetale' },
    { key: 'seitan', ids: ['seitan'], label: 'seitan', tag: 'vegetale' },
    { key: 'soia', ids: ['soia_gialla_secca'], label: 'soia gialla secca', tag: 'vegetale' }
  ];
  var LEGUMI_DRY = ['lenticchie_secche', 'ceci_secchi', 'fagioli_cannellini_secchi', 'fagioli_borlotti_secchi', 'lenticchie_rosse_decorticate'];
  var LEGUMI_CAN = ['ceci_in_barattolo_sgocciolati', 'fagioli_in_barattolo_sgocciolati'];
  var OIL = 'olio_extravergine_d_oliva';

  function secondoItems(ctx, entry, gMain, extra) {
    if (!entry.combo) return [{ id: ctx.first(entry.ids), g: gMain }];
    return extra;
  }

  // Calcola il pasto principale di riferimento e tutte le liste di equivalenze.
  // ov: {primoG, secG, oilMl} per le modifiche manuali dal riepilogo coach
  function mainMeal(ctx, tg, ov) {
    ov = ov || {};
    var db = ctx.db, veg = { id: '_verdura', g: 200 };
    var primoId = ctx.first(PRIMO_REF.concat(PRIMI[0].ids));
    var secEntry = null;
    for (var i = 0; i < SECONDI.length; i++) if (!SECONDI[i].combo && ctx.first(SECONDI[i].ids)) { secEntry = SECONDI[i]; break; }
    if (!secEntry) { ctx.warnings.push('Nessun secondo disponibile con le esclusioni scelte.'); return null; }
    var secId = ctx.first(secEntry.ids), oilOk = ctx.allowed(OIL);
    var vars = [];
    if (primoId) vars.push({ f: db.foods[primoId], min: 0, max: 250 });
    vars.push({ f: db.foods[secId], min: 60, max: 400 });
    if (oilOk) vars.push({ f: db.foods[OIL], min: 0, max: 60 * db.foods[OIL].gpm });
    var base = totals(db, [veg]);
    var g = solve(db, vars, base, tg);
    var k = 0, ref = { primo: null, sec: null, oil: 0 };
    if (primoId) { ref.primo = { id: primoId, g: ov.primoG !== undefined ? ov.primoG : g[k] }; k++; }
    ref.sec = { id: secId, g: ov.secG !== undefined ? ov.secG : g[k] }; k++;
    if (oilOk) { ref.oil = ov.oilMl !== undefined ? ov.oilMl * db.foods[OIL].gpm : g[k]; }
    if (ref.primo && ref.primo.g < 20) ref.primo.g = 0;
    var oilMl = Math.round(ref.oil / (db.foods[OIL] ? db.foods[OIL].gpm : 1));
    var refItems = [veg, ref.sec].concat(ref.primo && ref.primo.g ? [ref.primo] : []).concat(ref.oil ? [{ id: OIL, g: ref.oil }] : []);
    var refTot = totals(db, refItems);
    var res = { tg: tg, ref: ref, oilMl: oilMl, refTot: refTot, ok: mealOk(refTot, tg), dev: mealDev(refTot, tg), primi: [], secondi: [], condimenti: [], legumi: null };
    var secP = db.foods[secId].P * ref.sec.g / 100;
    res.secProt = secP;
    function mealWith(repl) { // repl: {primo:item|null, sec:[items], oil:g}
      var its = [veg].concat(repl.sec);
      if (repl.primo && repl.primo.g) its.push(repl.primo);
      if (repl.oil) its.push({ id: OIL, g: repl.oil });
      if (repl.extra) its = its.concat(repl.extra);
      return totals(db, its);
    }
    // PRIMI (a parità di carboidrati)
    if (ref.primo && ref.primo.g) {
      var refC = db.foods[ref.primo.id].C * ref.primo.g / 100;
      res.primoC = refC;
      PRIMI.forEach(function (grp, gi) {
        var rows = [];
        ctx.all(grp.ids).forEach(function (id) {
          var f = db.foods[id], gg = roundQ(f, refC / f.C * 100); if (!gg) return;
          var t = mealWith({ primo: { id: id, g: gg }, sec: [ref.sec], oil: ref.oil });
          if (!mealOk(t, tg)) return;
          rows.push({ id: id, g: gg, tot: t });
        });
        // raggruppa per grammatura uguale
        var byG = {};
        rows.forEach(function (r) { (byG[r.g] = byG[r.g] || []).push(r); });
        Object.keys(byG).forEach(function (gg) {
          var rs = byG[gg];
          res.primi.push({ grp: gi, ids: rs.map(function (r) { return r.id; }), g: +gg, tot: rs[0].tot, ok: true, unitGroup: grp.unitGroup, label: grp.label });
        });
      });
    }
    // SECONDI (a parità di proteine, con correzione olio/primo)
    var oilG = ref.oil, oilGpm = db.foods[OIL] ? db.foods[OIL].gpm : 0.91;
    var oilLevels = []; for (var ml = 0; ml <= oilMl; ml += 5) oilLevels.push(ml);
    var primoStep = ref.primo && ref.primo.g ? (ref.primo.g >= 40 ? 10 : 5) : 0;
    SECONDI.forEach(function (e) {
      var cands = [];
      if (e.combo) {
        var parts = e.combo.map(function (p) { return { id: p.id && ctx.allowed(p.id) ? p.id : (p.ids ? ctx.first(p.ids) : null), p: p }; });
        if (parts.some(function (p) { return !p.id; })) return;
        if (e.combo[0].units) {
          var eggF = db.foods[parts[0].id], albF = db.foods[parts[1].id];
          e.combo[0].units.forEach(function (u) {
            var eg = u * eggF.unitG, restP = secP - eggF.P * eg / 100;
            var ag = roundQ(albF, Math.max(0, restP / albF.P * 100));
            [-1, 0, 1].forEach(function (d) {
              var gr = grid(albF, 0, 600), idx = gr.indexOf(ag) + d; if (idx < 0 || idx >= gr.length) return;
              cands.push([{ id: parts[0].id, g: eg }, { id: parts[1].id, g: gr[idx] }]);
            });
          });
        } else {
          var fa = db.foods[parts[0].id], fb = db.foods[parts[1].id];
          var gg = secP / ((fa.P + fb.P) / 100);
          grid(fa, 0, 600).filter(function (x) { return x > gg * 0.7 && x < gg * 1.3; }).forEach(function (x) {
            cands.push([{ id: parts[0].id, g: x }, { id: parts[1].id, g: roundQ(fb, x) }]);
          });
        }
      } else {
        var id = ctx.first(e.ids); if (!id) return;
        var f = db.foods[id], g0 = secP / f.P * 100;
        grid(f, 0, 800).filter(function (x) { return x >= g0 * 0.75 && x <= g0 * 1.2; }).forEach(function (x) { cands.push([{ id: id, g: x }]); });
      }
      var best = null, secF = db.foods[secId].F * ref.sec.g / 100, secC = db.foods[secId].C * ref.sec.g / 100;
      var primoCg = ref.primo && ref.primo.g ? db.foods[ref.primo.id].C / 100 : 0;
      // 1) regola esplicita: grassi in più → "togli X ml di olio"; carboidrati in più → "togli X g di primo"
      cands.forEach(function (items) {
        var t0 = totals(db, items), fatDiff = t0.F - secF, carbDiff = t0.C - secC;
        var ml = Math.max(0, oilMl - Math.max(0, Math.round(fatDiff / oilGpm / 5) * 5));
        var pr = 0;
        if (carbDiff >= 5 && primoCg) pr = Math.min(ref.primo.g, Math.round(carbDiff / primoCg / (primoStep || 5)) * (primoStep || 5));
        var t = mealWith({ primo: ref.primo ? { id: ref.primo.id, g: ref.primo.g - pr } : null, sec: items, oil: ml * oilGpm });
        if (!mealOk(t, tg)) return;
        var eggPen = e.combo && e.combo[0].units && items[0].g !== 2 * db.foods[items[0].id].unitG ? 2 : 0;
        var score = Math.abs(t.P - tg.P) / 2 + Math.abs(t.K - tg.K) / 25 + eggPen;
        if (!best || score < best.score) best = { items: items, ml: ml, pr: pr, t: t, score: score };
      });
      // 2) se la regola non basta (es. pesce grasso), cerca la combinazione valida più semplice
      if (!best) cands.forEach(function (items) {
        oilLevels.forEach(function (ml) {
          var maxPr = primoStep ? ref.primo.g : 0;
          for (var pr = 0; pr <= maxPr; pr += (primoStep || 1)) {
            var t = mealWith({ primo: ref.primo ? { id: ref.primo.id, g: ref.primo.g - pr } : null, sec: items, oil: ml * oilGpm });
            if (!mealOk(t, tg)) { if (!primoStep) break; continue; }
            var score = objective(t, tg) + (oilMl - ml) / 5 * 0.25 + (pr ? 0.6 + pr / 10 * 0.3 : 0);
            if (!best || score < best.score) best = { items: items, ml: ml, pr: pr, t: t, score: score };
            if (!primoStep) break;
          }
        });
      });
      if (!best) return;
      var notes = [];
      var rem = oilMl - best.ml;
      if (oilMl > 0 && best.ml === 0) notes.push('no olio');
      else if (rem > 0 && rem * 2 === oilMl && oilMl >= 10) notes.push('dimezza l’olio');
      else if (rem > 0) notes.push('togli ' + rem + 'ml di olio');
      if (best.pr) notes.push('togli ' + best.pr + 'g di primo');
      res.secondi.push({ key: e.key, entry: e, items: best.items, oilMl: best.ml, pr: best.pr, notes: notes, tot: best.t, ok: true, tag: e.tag });
    });
    // CONDIMENTI (equivalenze dell'olio)
    if (oilOk && oilMl > 0) {
      res.condimenti.push({ key: 'olio', items: [{ id: OIL, g: ref.oil }], tot: refTot });
      // altro grasso al posto di parte dell'olio (stessi grassi): frac = quota di olio che resta
      var addCond = function (key, otherIds, gridMax, frac) {
        var oid = ctx.first(otherIds); if (!oid) return;
        var of = db.foods[oid], best = null;
        grid(of, 10, gridMax).forEach(function (x) {
          var m2 = oilMl - Math.round(of.F * x / 100 / oilGpm / 5) * 5;
          if (m2 < 0 || m2 >= oilMl) return;
          var t = mealWith({ primo: ref.primo, sec: [ref.sec], oil: m2 * oilGpm, extra: [{ id: oid, g: x }] });
          if (!mealOk(t, tg)) return;
          var sc = Math.abs(m2 - oilMl * frac) / 5 + objective(t, tg) * 0.2;
          if (!best || sc < best.sc) best = { m2: m2, x: x, t: t, sc: sc, oid: oid };
        });
        if (best && !res.condimenti.some(function (c) { return c.items.length === (best.m2 ? 2 : 1) && c.items[c.items.length - 1].id === best.oid && c.items[c.items.length - 1].g === best.x; }))
          res.condimenti.push({ key: key, items: (best.m2 ? [{ id: OIL, g: best.m2 * oilGpm }] : []).concat([{ id: best.oid, g: best.x }]), tot: best.t });
      };
      addCond('parmigiano', ['parmigiano_reggiano', 'grana_padano'], 40, 0.5);
      addCond('avocado', ['avocado'], 200, 0.5);
      if (oilMl <= 25) addCond('avocado_solo', ['avocado'], 250, 0);
      if (oilMl >= 20) addCond('noci', ['noci', 'mandorle'], 30, 0.6);
    }
    // LEGUMI (sostituiscono il primo, riducono il secondo)
    var dry = ctx.all(LEGUMI_DRY.slice(0, 4)), can = ctx.all(LEGUMI_CAN);
    if (ref.primo && ref.primo.g && (dry.length || can.length)) {
      var refC2 = db.foods[ref.primo.id].C * ref.primo.g / 100;
      var avg = function (ids) { var s = 0; ids.forEach(function (x) { s += refC2 / db.foods[x].C * 100; }); return s / ids.length; };
      var gd = dry.length ? roundQ(db.foods[dry[0]], avg(dry)) : 0, gc = can.length ? roundQ(db.foods[can[0]], avg(can)) : 0;
      var legItems = dry.length ? [{ id: dry[0], g: gd }] : [{ id: can[0], g: gc }];
      var fr = [[0.25, 'togli 1/4 del secondo'], [1 / 3, 'togli 1/3 del secondo'], [0.5, 'dimezza il secondo'], [2 / 3, 'togli 2/3 del secondo'],
        [0.75, 'togli 3/4 del secondo'], [0, 'mantieni il secondo']];
      var bestL = null, lf = db.foods[legItems[0].id], lgr = grid(lf, 0, 400), li = lgr.indexOf(legItems[0].g);
      [0, -1, -2, 1].forEach(function (dg) {
        var lg = lgr[li + dg]; if (!lg) return;
        fr.forEach(function (x) {
          var t = mealWith({ primo: null, sec: [{ id: ref.sec.id, g: ref.sec.g * (1 - x[0]) }], oil: ref.oil, extra: [{ id: lf.id, g: lg }] });
          if (!mealOk(t, tg)) return;
          var sc = objective(t, tg) + Math.abs(dg) * 0.5;
          if (!bestL || sc < bestL.sc) bestL = { frac: x[0], text: x[1], t: t, sc: sc, lg: lg };
        });
      });
      if (bestL) {
        var ratio = bestL.lg / legItems[0].g;
        if (dry.length) { gd = bestL.lg; gc = gc ? roundQ(db.foods[can[0]], gc * ratio) : 0; } else gc = bestL.lg;
        res.legumi = { dryG: gd, canG: gc, dry: dry, can: can, frac: bestL.frac, text: bestL.text, tot: bestL.t };
      }
    }
    return res;
  }

  // ───────────────────────── Piano a scelte multiple ─────────────────────────
  function buildMultiMeal(ctx, m, tgByDay, dayTypes, opts) {
    opts = opts || {};
    var meal = { key: m.key, label: m.label, pct: m.pct, targets: tgByDay, kind: kindOf(m.key), options: [], warnings: [] };
    if (meal.kind === 'fruit') return meal;
    if (meal.kind === 'main') {
      meal.main = {};
      dayTypes.forEach(function (d) { meal.main[d] = mainMeal(ctx, tgByDay[d], opts.override && opts.override[d]); });
      dayTypes.forEach(function (d) {
        var mm = meal.main[d];
        if (!mm) { meal.warnings.push('Nessuna combinazione valida per ' + m.label + ' (' + d + ').'); return; }
        if (!mm.ok) meal.warnings.push(m.label + ' ' + d + ': il pasto di riferimento è fuori tolleranza.');
        if (mm.refTot.P < 25) meal.warnings.push(m.label + ' ' + d + ': proteine del pasto sotto 25 g (' + r1(mm.refTot.P) + ' g).');
        if (mm.refTot.P > 60) meal.warnings.push(m.label + ' ' + d + ': proteine del pasto oltre 60 g (' + r1(mm.refTot.P) + ' g): porzioni di secondo molto grandi.');
      });
      return meal;
    }
    var nWanted = opts.nOptions || (m.key === 'col' ? 10 : 8);
    var pool = TEMPLATES.filter(function (t) { return t.meals.indexOf(m.key === 's2' && opts.isSnack4 ? 's2' : m.key) >= 0 || (m.key === 's2' && t.meals.indexOf('s2') >= 0); });
    if (opts.excludeTpl) pool = pool.filter(function (t) { return opts.excludeTpl.indexOf(t.key) < 0; });
    var cands = [];
    pool.forEach(function (tpl) {
      var byDay = {}, okAll = true;
      dayTypes.forEach(function (d) { var o = buildOption(ctx, tpl, tgByDay[d]); byDay[d] = o; if (!o || !o.ok) okAll = false; });
      if (okAll) cands.push({ tpl: tpl.key, group: tpl.group, byDay: byDay, locked: false });
    });
    // niente doppioni: stessi alimenti = stessa opzione
    var seen = {};
    cands = cands.filter(function (c) { var s = optionSignature(c.byDay[dayTypes[0]]); if (seen[s]) return false; seen[s] = 1; return true; });
    meal.pool = cands.map(function (c) { return c.tpl; });
    meal.cands = cands;
    var keep = (opts.locked || []).slice();
    var chosen = keep.concat(cands.filter(function (c) { return !keep.some(function (k) { return k.tpl === c.tpl; }); })).slice(0, Math.max(nWanted, keep.length));
    chosen.sort(function (a, b) { return GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group); });
    meal.options = chosen;
    if (!chosen.length) meal.warnings.push('Nessuna opzione valida per ' + m.label + ': rivedi target o esclusioni.');
    else if (chosen.length < Math.min(nWanted, 8)) meal.warnings.push(m.label + ': solo ' + chosen.length + ' opzioni valide (richieste ' + nWanted + ').');
    return meal;
  }
  function kindOf(key) { return key === 's1' ? 'fruit' : (key === 'pra' || key === 'cen' ? 'main' : 'small'); }

  function generateMulti(db, input, settings, seed) {
    var ctx = makeCtx(db, input, settings);
    var dayTypes = input.onoff ? ['ON', 'OFF'] : ['STD'];
    var targets = {};
    if (input.onoff) { targets.ON = dayTarget(input.on); targets.OFF = dayTarget(input.off); } else targets.STD = dayTarget(input.std);
    var meals = mealPlan(input.nMeals, settings);
    var mt = {}; dayTypes.forEach(function (d) { mt[d] = mealTargets(ctx, targets[d], meals); });
    var plan = { type: 'multi', onoff: !!input.onoff, dayTypes: dayTypes, targets: targets, mealDefs: meals, meals: [], warnings: ctx.warnings, seed: seed || 1 };
    var locked = (input._locked || {});
    // pasti piccoli prima, poi i principali (che assorbono lo scarto medio dei pasti piccoli)
    var smallAvg = {}; dayTypes.forEach(function (d) { smallAvg[d] = { K: 0, P: 0, C: 0, F: 0 }; });
    var interchangeable = false;
    var col = meals.filter(function (m) { return m.key === 'col'; })[0], s2 = meals.filter(function (m) { return m.key === 's2'; })[0];
    if (col && s2) interchangeable = dayTypes.every(function (d) { return Math.abs(mt[d].col.K - mt[d].s2.K) <= 0.05 * mt[d].col.K && !mt[d].col.fruitInside; });
    plan.interchangeable = interchangeable;
    var built = {};
    meals.forEach(function (m) {
      if (kindOf(m.key) !== 'small') return;
      var tg = {}; dayTypes.forEach(function (d) { tg[d] = mt[d][m.key]; });
      var o = { nOptions: m.key === 'col' ? (settings.nCol || 10) : (settings.nSnack || 8), locked: locked[m.key] };
      if (m.key === 's2' && interchangeable && built.col) o.excludeTpl = built.col.options.map(function (x) { return x.tpl; });
      if (m.key === 'ser') o.nOptions = Math.min(o.nOptions, 6);
      built[m.key] = buildMultiMeal(ctx, m, tg, dayTypes, o);
    });
    dayTypes.forEach(function (d) {
      meals.forEach(function (m) {
        if (kindOf(m.key) !== 'small' || !built[m.key] || !built[m.key].options.length) return;
        var opts = built[m.key].options, n = opts.length;
        ['K', 'P', 'C', 'F'].forEach(function (k) { smallAvg[d][k] += opts.reduce(function (s, o) { return s + o.byDay[d].tot[k]; }, 0) / n - mt[d][m.key][k]; });
      });
      // lo scarto medio dei pasti piccoli viene compensato da pranzo e cena
      var mains = meals.filter(function (m) { return kindOf(m.key) === 'main'; });
      var sp = mains.reduce(function (s, m) { return s + m.pct; }, 0);
      mains.forEach(function (m) { ['K', 'P', 'C', 'F'].forEach(function (k) { mt[d][m.key][k] -= smallAvg[d][k] * m.pct / sp; }); });
    });
    meals.forEach(function (m) {
      var tg = {}; dayTypes.forEach(function (d) { tg[d] = mt[d][m.key]; });
      if (built[m.key]) { plan.meals.push(built[m.key]); return; }
      var mm = buildMultiMeal(ctx, m, tg, dayTypes, { override: input._override && input._override[m.key] });
      if (mm.kind === 'fruit') mm.fruit = ctx.fruitRef;
      plan.meals.push(mm);
    });
    plan.ctx = ctx;
    evaluateMulti(plan);
    return plan;
  }

  // Giornata tipo (opzione più vicina al target per ogni pasto) e range
  function evaluateMulti(plan) {
    var ctx = plan.ctx, db = ctx.db;
    plan.days = {};
    plan.dayTypes.forEach(function (d) {
      var tot = zeroT(), lo = 0, hi = 0, parts = [];
      plan.meals.forEach(function (m) {
        var t = null, tl = 0, th = 0;
        if (m.kind === 'fruit') { t = totals(db, [ctx.fruitRef]); tl = th = t.K; }
        else if (m.kind === 'main') { var mm = m.main[d]; if (mm) { t = mm.refTot; var ks = mm.secondi.map(function (s) { return s.tot.K; }).concat([t.K]); tl = Math.min.apply(null, ks); th = Math.max.apply(null, ks); } }
        else if (m.options.length) {
          var best = null; m.options.forEach(function (o) { var od = o.byDay[d]; if (!best || Math.abs(od.tot.K - m.targets[d].K) < Math.abs(best.tot.K - m.targets[d].K)) best = od; });
          t = best.tot; var ks2 = m.options.map(function (o) { return o.byDay[d].tot.K; }); tl = Math.min.apply(null, ks2); th = Math.max.apply(null, ks2);
        }
        if (t) { tot = addT(tot, t); lo += tl; hi += th; parts.push({ key: m.key, tot: t }); }
      });
      var tg = plan.targets[d];
      plan.days[d] = { tot: tot, ok: dayOk(tot, tg), range: [lo, hi], parts: parts, micro: microReport(tot, tg, plan.ctx.input) };
    });
  }

  // ───────────────────────── Micronutrienti ─────────────────────────
  function microReport(tot, tg, input) {
    return MICRO.map(function (m) {
      var v = tot.micro[m.key], ref = m.ref, status;
      if (m.key === 'ferro_mg') ref = input && input.sex === 'F' ? 18 : 10;
      if (m.type === 'maxPct') { ref = tot.K * m.pct / 100 / (m.key === 'zuccheri_g' ? 4 : 9); status = v <= ref ? 'green' : (v <= ref * 1.2 ? 'yellow' : 'red'); }
      else if (m.type === 'max') status = v <= ref ? 'green' : (v <= ref * 1.2 ? 'yellow' : 'red');
      else status = v >= ref ? 'green' : (v >= ref * 0.75 ? 'yellow' : 'red');
      return { key: m.key, label: m.label, unit: m.unit, value: v, ref: ref, type: m.type, src: m.src, status: status, missing: tot.missing[m.key] };
    });
  }

  // ───────────────────────── Piano giorno per giorno ─────────────────────────
  var DAY_SECONDI = [
    { ids: ['petto_di_pollo_senza_pelle'], tag: 'bianca' }, { ids: ['petto_di_tacchino'], tag: 'bianca' }, { ids: ['coscia_di_pollo_senza_pelle'], tag: 'bianca' },
    { ids: ['coniglio'], tag: 'bianca' }, { ids: ['fesa_di_tacchino_al_forno_affettato'], tag: 'bianca' },
    { ids: ['manzo_magro_girello_fesa'], tag: 'rossa' }, { ids: ['vitello_fesa'], tag: 'rossa' }, { ids: ['macinato_di_manzo_magro_5_grassi'], tag: 'rossa' },
    { ids: ['lonza_di_maiale'], tag: 'rossa' }, { ids: ['filetto_di_maiale'], tag: 'rossa' }, { ids: ['cavallo'], tag: 'rossa' },
    { ids: ['bresaola'], tag: 'salume' },
    { ids: ['merluzzo'], tag: 'pesce' }, { ids: ['nasello'], tag: 'pesce' }, { ids: ['platessa'], tag: 'pesce' }, { ids: ['sogliola'], tag: 'pesce' },
    { ids: ['spigola_branzino'], tag: 'pesce' }, { ids: ['orata_allevamento'], tag: 'pesce' }, { ids: ['tonno_fresco'], tag: 'pesce' },
    { ids: ['pesce_spada'], tag: 'pesce' }, { ids: ['baccala_ammollato'], tag: 'pesce' }, { ids: ['tonno_al_naturale_sgocciolato'], tag: 'pesce' },
    { ids: ['gamberi_gamberetti'], tag: 'pesce' }, { ids: ['calamari'], tag: 'pesce' }, { ids: ['polpo'], tag: 'pesce' }, { ids: ['seppia'], tag: 'pesce' },
    { ids: ['salmone_allevamento'], tag: 'pesce_grasso' }, { ids: ['sgombro'], tag: 'pesce_grasso' }, { ids: ['alici_acciughe_fresche'], tag: 'pesce_grasso' },
    { ids: ['trota_allevamento'], tag: 'pesce_grasso' },
    { ids: ['uovo_intero', 'albume_d_uovo'], tag: 'uova', combo: true },
    { ids: ['fiocchi_di_latte'], tag: 'latticini' }, { ids: ['mozzarella_light'], tag: 'latticini' }, { ids: ['ricotta_light'], tag: 'latticini' },
    { ids: ['tofu_compatto_naturale'], tag: 'vegetale' }, { ids: ['tempeh'], tag: 'vegetale' }, { ids: ['seitan'], tag: 'vegetale' },
    { ids: ['lupini_in_salamoia_sgocciolati'], tag: 'vegetale' }
  ];
  var DAY_PRIMI = ['pasta_di_semola', 'riso_basmati', 'patate', 'pasta_integrale', 'riso_bianco', 'pane_integrale', 'couscous', 'quinoa', 'farro',
    'orzo_perlato', 'patate_dolci_batata', 'gnocchi_di_patate', 'riso_integrale', 'pane_di_segale', 'grano_saraceno', 'gallette_di_riso', 'pane_comune_tipo_0'];
  var VEG_G = { lattuga: 150, insalata_iceberg: 150, rucola: 100, radicchio: 150, indivia: 150, carote: 200, fagiolini: 250, carciofi: 250 };

  function weeklySchedule(ctx, slots, rnd, input) {
    // slots: [{day, meal}] (pasto libero già escluso). Restituisce tag per ogni slot.
    var avail = {};
    DAY_SECONDI.forEach(function (s) { if (ctx.allowed(s.ids[0]) && (!s.combo || ctx.allowed(s.ids[1]))) (avail[s.tag] = avail[s.tag] || []).push(s); });
    var legOk = ctx.all(LEGUMI_DRY.concat(LEGUMI_CAN)).length > 0;
    var n = slots.length, want = [];
    var fishLean = (avail.pesce || []).length, fishFat = (avail.pesce_grasso || []).length;
    if (fishFat) want.push('pesce_grasso');
    for (var i = 0; i < 2 && fishLean; i++) want.push('pesce');
    if (!fishLean && fishFat) want.push('pesce_grasso');
    if ((avail.rossa || []).length) want.push('rossa');
    if ((avail.uova || []).length) want.push('uova');
    if ((avail.latticini || []).length) want.push('latticini');
    if ((avail.salume || []).length) want.push('salume');
    if ((avail.vegetale || []).length) { want.push('vegetale'); if (input.prefs.vegetarian || input.prefs.vegan) want.push('vegetale', 'vegetale'); }
    var filler = (avail.bianca || []).length ? 'bianca' : ((avail.vegetale || []).length ? 'vegetale' : ((avail.latticini || []).length ? 'latticini' : (avail.uova ? 'uova' : 'pesce')));
    while (want.length < n) {
      if (filler === 'bianca' && want.filter(function (x) { return x === 'bianca'; }).length >= 5 && (avail.pesce || []).length && want.filter(function (x) { return x === 'pesce'; }).length < 4) want.push('pesce');
      else if ((input.prefs.vegetarian || input.prefs.vegan)) want.push(['vegetale', 'latticini', 'uova'][want.length % 3] in avail ? ['vegetale', 'latticini', 'uova'][want.length % 3] : filler);
      else want.push(filler);
    }
    want = want.slice(0, n);
    var best = null;
    for (var tr = 0; tr < 200; tr++) {
      var w = shuffle(want, rnd), bad = 0, byDay = {};
      w.forEach(function (t, j) { var d = slots[j].day; byDay[d] = byDay[d] || []; if (byDay[d].indexOf(t) >= 0 && t !== 'bianca' && t !== 'vegetale') bad++; byDay[d].push(t); });
      if (!best || bad < best.bad) best = { w: w, bad: bad };
      if (!bad) break;
    }
    // legumi: 2-3 pasti, mai nello stesso giorno
    var legSlots = [];
    if (legOk) {
      var nl = Math.min(3, Math.max(2, Math.round(n / 5)));
      var order = shuffle(slots.map(function (_, j) { return j; }), rnd), daysUsed = {};
      order.forEach(function (j) { if (legSlots.length < nl && !daysUsed[slots[j].day] && best.w[j] !== 'salume') { legSlots.push(j); daysUsed[slots[j].day] = 1; } });
    }
    return { tags: best.w, legSlots: legSlots, avail: avail };
  }

  function solveDayMain(ctx, tg, choice) {
    var db = ctx.db, veg = { id: choice.veg, g: choice.vegG };
    var vars = [], fixed = [veg];
    if (choice.primo) vars.push({ f: db.foods[choice.primo], min: choice.legume ? 30 : 0, max: 280, role: 'primo' });
    if (choice.sec.length === 2) { // uova + albume
      fixed.push({ id: choice.sec[0], g: choice.eggs * db.foods[choice.sec[0]].unitG });
      vars.push({ f: db.foods[choice.sec[1]], min: 0, max: 400, role: 'sec2' });
    } else vars.push({ f: db.foods[choice.sec[0]], min: choice.legume ? 30 : 60, max: 400, role: 'sec' });
    if (ctx.allowed(OIL)) vars.push({ f: db.foods[OIL], min: 0, max: 50 * db.foods[OIL].gpm, role: 'oil' });
    var g = solve(db, vars, totals(db, fixed), tg);
    var items = fixed.slice(1).map(function (x) { return { id: x.id, g: x.g, role: 'sec' }; });
    vars.forEach(function (v, j) { if (g[j] > 0) items.push({ id: v.f.id, g: g[j], role: v.role === 'sec2' ? 'sec' : v.role }); });
    items.push({ id: veg.id, g: veg.g, role: 'veg' });
    return items;
  }

  function generateDaily(db, input, settings, seed) {
    var ctx = makeCtx(db, input, settings), rnd = rng(seed || 1);
    var meals = mealPlan(input.nMeals, settings);
    var targets = {}; if (input.onoff) { targets.ON = dayTarget(input.on); targets.OFF = dayTarget(input.off); } else targets.STD = dayTarget(input.std);
    var dayTypes = input.onoff ? ['ON', 'OFF'] : ['STD'];
    var shift = input.training === 'mattina' ? 'pra' : (input.training === 'nessuno' ? null : 'cen');
    var mt = {}; dayTypes.forEach(function (d) { mt[d] = mealTargets(ctx, targets[d], meals, d === 'ON' ? { shiftTo: shift } : {}); });
    // opzioni valide per pasti piccoli
    var smallOpts = {};
    meals.forEach(function (m) {
      if (kindOf(m.key) !== 'small') return;
      smallOpts[m.key] = {};
      dayTypes.forEach(function (d) {
        smallOpts[m.key][d] = TEMPLATES.filter(function (t) { return t.meals.indexOf(m.key) >= 0; })
          .map(function (t) { return buildOption(ctx, t, mt[d][m.key]); }).filter(function (o) { return o && o.ok; });
        if (!smallOpts[m.key][d].length) ctx.warnings.push('Nessuna opzione valida per ' + m.label + ' (' + d + ').');
      });
    });
    var onDays = input.onDays || [];
    var plan = { type: 'daily', onoff: !!input.onoff, dayTypes: dayTypes, targets: targets, mealDefs: meals, mt: mt, days: [], warnings: ctx.warnings, ctx: ctx, seed: seed || 1, smallOpts: smallOpts };
    var free = input.freeMeal && input.freeMeal.day !== null && input.freeMeal.day !== undefined && input.freeMeal.day !== '' ? input.freeMeal : null;
    var slots = [];
    for (var d = 0; d < 7; d++) ['pra', 'cen'].forEach(function (mk) { if (!(free && +free.day === d && free.meal === mk)) slots.push({ day: d, meal: mk }); });
    var sched = weeklySchedule(ctx, slots, rnd, input);
    plan.schedule = sched;
    // scelta concreta degli alimenti con i vincoli di varietà
    var secCount = {}, primoCount = {}, vegI = Math.floor(rnd() * 10);
    var vegPool = shuffle(ctx.vegIds.filter(function (id) { return ['aglio', 'cipolla', 'sedano'].indexOf(id) < 0; }), rnd);
    var primoPool = DAY_PRIMI.filter(ctx.allowed);
    var dryLeg = ctx.all(LEGUMI_DRY), canLeg = ctx.all(LEGUMI_CAN), legI = 0;
    var choices = {};
    slots.forEach(function (s, j) {
      var tag = sched.tags[j], pool = (sched.avail[tag] || []).slice();
      var dayUsed = Object.keys(choices).filter(function (k) { return choices[k].day === s.day; }).map(function (k) { return choices[k].sec[0]; });
      pool = shuffle(pool, rnd).filter(function (x) { return (secCount[x.ids[0]] || 0) < 2 && dayUsed.indexOf(x.ids[0]) < 0; });
      if (!pool.length) { Object.keys(sched.avail).forEach(function (t) { sched.avail[t].forEach(function (x) { if ((secCount[x.ids[0]] || 0) < 2 && dayUsed.indexOf(x.ids[0]) < 0) pool.push(x); }); }); pool = shuffle(pool, rnd); }
      var sec = pool[0] || sched.avail[tag][0];
      secCount[sec.ids[0]] = (secCount[sec.ids[0]] || 0) + 1;
      var legume = sched.legSlots.indexOf(j) >= 0;
      var primo = null;
      if (legume) { var all = dryLeg.concat(canLeg); primo = all[legI++ % all.length]; }
      else {
        var pp = shuffle(primoPool, rnd).filter(function (p) { return (primoCount[p] || 0) < 3; });
        var dayPr = Object.keys(choices).filter(function (k) { return choices[k].day === s.day; }).map(function (k) { return choices[k].primo; });
        pp = pp.filter(function (p) { return dayPr.indexOf(p) < 0; }).concat(pp);
        primo = pp[0] || null; if (primo) primoCount[primo] = (primoCount[primo] || 0) + 1;
      }
      var veg = vegPool[vegI++ % vegPool.length];
      choices[s.day + s.meal] = { day: s.day, meal: s.meal, tag: legume ? 'legumi+' + sec.tag : sec.tag, sec: sec.ids, eggs: sec.combo ? 2 : 0, primo: primo, legume: legume, veg: veg, vegG: VEG_G[veg] || 200 };
    });
    // giorni
    for (d = 0; d < 7; d++) {
      var dt = input.onoff ? (onDays.indexOf(d) >= 0 ? 'ON' : 'OFF') : 'STD';
      plan.days.push(buildDay(plan, d, dt, choices, rnd));
    }
    weeklyChecks(plan);
    // giornate che violano le regole (sodio, fibra, latticini, tolleranze…): nuovi tentativi, si tiene il migliore
    for (d = 0; d < 7; d++) improveDay(plan, d, (seed || 1) * 31 + d * 101);
    weeklyChecks(plan);
    return plan;
  }

  function buildDay(plan, d, dt, choices, rnd) {
    var ctx = plan.ctx, db = ctx.db, input = ctx.input;
    var free = input.freeMeal && input.freeMeal.day !== '' && input.freeMeal.day !== null && input.freeMeal.day !== undefined && +input.freeMeal.day === d ? input.freeMeal.meal : null;
    var day = { idx: d, name: DAYS[d], type: dt, meals: [] };
    plan.mealDefs.forEach(function (m, mi) {
      var tg = plan.mt[dt][m.key], kind = kindOf(m.key);
      var meal = { key: m.key, label: m.label, kind: kind, tg: tg, items: [], free: free === m.key };
      if (meal.free) { day.meals.push(meal); return; }
      if (kind === 'fruit') {
        var fi = ctx.fruitIds.length ? ctx.fruitIds[(d * 3 + 1) % ctx.fruitIds.length] : null;
        if (fi) { var ff = db.foods[fi]; meal.items = [{ id: fi, g: roundQ(ff, ctx.fruitKcal / ff.K * 100), role: 'frutta' }]; }
      } else if (kind === 'small') {
        var opts = plan.smallOpts[m.key][dt];
        if (opts.length) {
          var o = clone(opts[(d * 7 + mi * 3 + Math.floor(rnd() * opts.length)) % opts.length]);
          meal.tpl = o.tpl; meal.name = o.name; meal.prep = o.prep;
          meal.items = (o.fixed || []).map(function (x) { return { id: x.id, g: x.g, role: 'frutta' }; })
            .concat(o.comps.filter(function (c) { return !c.free; }).map(function (c) { return { id: c.id, g: c.g, ci: c.ci, tpl: o.tpl }; }));
          meal.freeText = o.comps.filter(function (c) { return c.free; }).map(function (c) { return c.free; });
        }
      } else {
        var ch = choices[d + m.key];
        if (ch) { meal.choice = ch; meal.items = solveDayMain(ctx, tg, ch); }
      }
      day.meals.push(meal);
    });
    recomputeDay(plan, day);
    fixDay(plan, day);
    return day;
  }
  function recomputeDay(plan, day) {
    var ctx = plan.ctx, db = ctx.db, tot = zeroT(), tg = plan.targets[day.type], freeK = 0;
    day.meals.forEach(function (m) {
      if (m.free) { freeK += m.tg.K; return; }
      m.tot = totals(db, m.items); m.ok = mealOk(m.tot, m.tg); m.dev = mealDev(m.tot, m.tg);
      tot = addT(tot, m.tot);
    });
    day.tot = tot;
    day.hasFree = day.meals.some(function (m) { return m.free; });
    var tgEff = day.hasFree ? { K: tg.K - freeK, P: tg.P, C: tg.C, F: tg.F } : tg;
    if (day.hasFree) { var fm = day.meals.filter(function (m) { return m.free; })[0]; tgEff = { K: tg.K - fm.tg.K, P: tg.P - fm.tg.P, C: tg.C - fm.tg.C, F: tg.F - fm.tg.F }; }
    day.tgEff = tgEff;
    day.ok = dayOk(tot, tgEff);
    day.micro = microReport(tot, tgEff, ctx.input);
    return day;
  }
  // corregge lo scarto della giornata agendo su olio e primo della cena (o del pranzo)
  function fixDay(plan, day) {
    if (day.ok) return;
    var db = plan.ctx.db;
    ['cen', 'pra'].some(function (mk) {
      var m = day.meals.filter(function (x) { return x.key === mk && !x.free; })[0];
      if (!m) return false;
      var adj = m.items.filter(function (it) { return it.role === 'oil' || it.role === 'primo' || it.role === 'sec'; });
      var best = { v: objDay(), items: clone(m.items) };
      function objDay() { recomputeDay(plan, day); return objective(day.tot, day.tgEff) + (m.ok ? 0 : 50); }
      for (var round = 0; round < 3; round++) {
        adj.forEach(function (it) {
          var gr = grid(db.foods[it.id], 0, 400), i0 = gr.indexOf(it.g);
          for (var dlt = -3; dlt <= 3; dlt++) {
            if (!dlt || gr[i0 + dlt] === undefined) continue;
            var old = it.g; it.g = gr[i0 + dlt];
            var v = objDay(); if (v < best.v) { best = { v: v, items: clone(m.items) }; } else it.g = old;
          }
        });
      }
      m.items = best.items; recomputeDay(plan, day);
      return day.ok;
    });
  }

  function weeklyChecks(plan) {
    var ctx = plan.ctx, db = ctx.db, ex = [];
    var cnt = { pesce: 0, pesce_grasso: 0, legumi: 0, rossa: 0, salume: 0, uova: 0, rossaG: 0 }, secUse = {}, primoUse = {};
    plan.days.forEach(function (day) {
      var fv = 0, dairy = 0, freeS = 0;
      day.meals.forEach(function (m) {
        if (m.free) return;
        m.items.forEach(function (it) {
          var f = db.foods[it.id]; if (!f) return;
          if (f.cat === 'Frutta' || f.cat === 'Verdure') fv += it.g;
          if (it.id === 'uovo_intero') cnt.uova += Math.round(it.g / f.unitG);
          if (DAIRY_IDS.indexOf(it.id) >= 0 && it.g >= (/parmigiano|grana/.test(it.id) ? 10 : 50)) dairy++;
          if (FREE_SUGAR_IDS.indexOf(it.id) >= 0 && f.n.zuccheri_g) freeS += f.n.zuccheri_g * it.g / 100;
        });
        if (m.kind === 'main' && m.choice) {
          var ch = m.choice, s0 = ch.sec[0];
          secUse[s0] = (secUse[s0] || 0) + 1;
          if (!ch.legume && ch.primo) primoUse[ch.primo] = (primoUse[ch.primo] || 0) + 1;
          if (ch.legume) cnt.legumi++;
          var tag = ch.tag.replace('legumi+', '');
          if (tag === 'pesce' || tag === 'pesce_grasso') cnt.pesce++;
          if (tag === 'pesce_grasso') cnt.pesce_grasso++;
          if (RED_IDS.indexOf(s0) >= 0) { cnt.rossa++; var it2 = m.items.filter(function (x) { return x.id === s0; })[0]; if (it2) cnt.rossaG += it2.g * (PROCESSED_IDS.indexOf(s0) >= 0 ? 1 : 0.75); }
          if (PROCESSED_IDS.indexOf(s0) >= 0) cnt.salume++;
          var secDay = day.meals.filter(function (x) { return x.kind === 'main' && x.choice && x !== m && x.choice.sec[0] === s0; });
          if (secDay.length) ex.push(day.name + ': lo stesso secondo (' + (SHORT[s0] || s0) + ') compare due volte.');
        }
        if (m.kind === 'main' && m.tot && m.tot.P < 25) ex.push(day.name + ' ' + m.label.toLowerCase() + ': proteine sotto 25 g (' + r1(m.tot.P) + ' g).');
      });
      day.checks = { fv: fv, dairy: dairy, freeSugar: freeS };
      if (day.hasFree) return;
      var K = day.tot.K;
      if (fv < 400) ex.push(day.name + ': frutta + verdura ' + Math.round(fv) + ' g (< 400 g OMS).');
      if (day.tot.micro.fibra_g < 25) ex.push(day.name + ': fibra ' + r1(day.tot.micro.fibra_g) + ' g (< 25 g EFSA).');
      if (freeS * 4 > 0.1 * K) ex.push(day.name + ': zuccheri liberi stimati ' + r1(freeS) + ' g (> 10% kcal OMS).');
      if (day.tot.micro.grassi_saturi_g * 9 > 0.1 * K) ex.push(day.name + ': grassi saturi ' + r1(day.tot.micro.grassi_saturi_g) + ' g (> 10% kcal).');
      if (day.tot.micro.sodio_mg > 2000) ex.push(day.name + ': sodio ' + Math.round(day.tot.micro.sodio_mg) + ' mg (> 2000 mg OMS).');
      var dairyOk = !ctx.input.prefs.vegan && ctx.allowed('yogurt_greco_0_grassi') || ctx.allowed('latte_parzialmente_scremato') || ctx.allowed('bevanda_di_soia_senza_zuccheri');
      if (dairyOk && dairy < 2) ex.push(day.name + ': ' + dairy + ' porzioni di latticini (consigliate 2-3' + (ctx.input.prefs.flags.indexOf('int_lattosio') >= 0 ? '; lattosio escluso' : '') + ').');
    });
    var fishAllowed = ctx.allowed('merluzzo') || ctx.allowed('salmone_allevamento');
    if (fishAllowed && cnt.pesce < 2) ex.push('Pesce ' + cnt.pesce + ' volte a settimana (consigliato ≥ 2-3).');
    if (fishAllowed && cnt.pesce_grasso < 1 && (ctx.allowed('salmone_allevamento') || ctx.allowed('sgombro'))) ex.push('Nessun pesce grasso nella settimana.');
    var legAllowed = ctx.all(LEGUMI_DRY.concat(LEGUMI_CAN)).length > 0;
    if (legAllowed && (cnt.legumi < 2 || cnt.legumi > 4)) ex.push('Legumi ' + cnt.legumi + ' volte a settimana (consigliato 2-4).');
    if (!legAllowed) ex.push('Legumi non presenti: esclusi da allergie/intolleranze.');
    if (cnt.rossa > 2) ex.push('Carne rossa ' + cnt.rossa + ' volte a settimana (max 2).');
    if (cnt.rossaG > 500) ex.push('Carne rossa ≈ ' + Math.round(cnt.rossaG) + ' g cotti a settimana (> 500 g WCRF).');
    if (cnt.salume > 2) ex.push('Salumi ' + cnt.salume + ' volte a settimana (max 1-2).');
    if (cnt.uova > 10) ex.push('Uova ' + cnt.uova + ' a settimana (max 7-10).');
    Object.keys(secUse).forEach(function (k) { if (secUse[k] > 2) ex.push('Il secondo "' + (SHORT[k] || k) + '" compare ' + secUse[k] + ' volte (max 2).'); });
    Object.keys(primoUse).forEach(function (k) { if (primoUse[k] > 3) ex.push('Il primo "' + (SHORT[k] || k) + '" compare ' + primoUse[k] + ' volte (max 3).'); });
    plan.weekly = { counts: cnt, exceptions: ex, secUse: secUse, primoUse: primoUse };
    // micronutrienti medi settimanali
    var acc = zeroT(), nd = 0;
    plan.days.forEach(function (day) { if (!day.hasFree) { acc = addT(acc, day.tot); nd++; } });
    if (nd) { ['K', 'P', 'C', 'F'].forEach(function (k) { acc[k] /= nd; }); NUTR.forEach(function (k) { acc.micro[k] /= nd; }); }
    plan.weekly.avgMicro = microReport(acc, null, ctx.input);
    return plan.weekly;
  }

  function dayScore(plan, day) {
    var ctx = plan.ctx, db = ctx.db, sc = 0, fv = 0, dairy = 0, freeS = 0;
    day.meals.forEach(function (m) {
      if (m.free) return;
      if (!m.ok) sc += 3;
      (m.items || []).forEach(function (it) {
        var f = db.foods[it.id]; if (!f) return;
        if (f.cat === 'Frutta' || f.cat === 'Verdure') fv += it.g;
        if (DAIRY_IDS.indexOf(it.id) >= 0 && it.g >= (/parmigiano|grana/.test(it.id) ? 10 : 50)) dairy++;
        if (FREE_SUGAR_IDS.indexOf(it.id) >= 0 && f.n.zuccheri_g) freeS += f.n.zuccheri_g * it.g / 100;
      });
    });
    if (!day.ok) sc += 10;
    if (day.hasFree) return sc;
    var mi = day.tot.micro, K = day.tot.K;
    sc += Math.max(0, mi.sodio_mg - 2000) / 300 + Math.max(0, 25 - mi.fibra_g) / 3 + Math.max(0, 400 - fv) / 100;
    sc += Math.max(0, mi.grassi_saturi_g * 9 - 0.1 * K) / 20 + Math.max(0, freeS * 4 - 0.1 * K) / 20;
    var dairyOk = ctx.allowed('yogurt_greco_0_grassi') || ctx.allowed('latte_parzialmente_scremato') || ctx.allowed('bevanda_di_soia_senza_zuccheri');
    if (dairyOk && !ctx.input.prefs.vegan) sc += Math.max(0, 2 - dairy) * 1.5;
    return sc;
  }
  function improveDay(plan, d, seed) {
    var best = plan.days[d], bestSc = dayScore(plan, best);
    for (var t = 1; t <= 12 && bestSc > 0.01; t++) {
      var nd = regenerateDay(plan, d, seed + t * 7, true), sc = dayScore(plan, nd);
      if (sc < bestSc) { best = nd; bestSc = sc; }
      plan.days[d] = best;
    }
    plan.days[d] = best;
    return best;
  }
  function regenerateDay(plan, d, seed, noImprove) {
    if (!noImprove) { // dal riepilogo coach: prova più varianti e tieni la migliore (diversa da quella attuale)
      var cur = plan.days[d], best = null, bestSc = Infinity;
      for (var t = 0; t < 8; t++) {
        var nd0 = regenerateDay(plan, d, seed + t * 13, true), sc0 = dayScore(plan, nd0);
        if (sc0 < bestSc) { best = nd0; bestSc = sc0; }
        plan.days[d] = cur;
      }
      plan.days[d] = best; weeklyChecks(plan); return best;
    }
    var rnd = rng(seed), ctx = plan.ctx;
    var old = plan.days[d], choices = {};
    // nuove scelte per i pasti principali del giorno rispettando i conteggi degli altri giorni
    var used = {}, primoUsed = {};
    plan.days.forEach(function (day, i) { if (i === d) return; day.meals.forEach(function (m) { if (m.choice) { used[m.choice.sec[0]] = (used[m.choice.sec[0]] || 0) + 1; if (m.choice.primo) primoUsed[m.choice.primo] = (primoUsed[m.choice.primo] || 0) + 1; } }); });
    var dayUsed = [];
    old.meals.forEach(function (m) {
      if (!m.choice || m.locked) { if (m.choice) choices[d + m.key] = m.choice; return; }
      var tag = m.choice.tag.replace('legumi+', '');
      var pool = shuffle((plan.schedule.avail[tag] || []), rnd).filter(function (x) { return (used[x.ids[0]] || 0) < 2 && dayUsed.indexOf(x.ids[0]) < 0; });
      var sec = pool[0] || (plan.schedule.avail[tag] || [])[0];
      dayUsed.push(sec.ids[0]);
      var primo = m.choice.legume ? m.choice.primo : (shuffle(DAY_PRIMI.filter(ctx.allowed), rnd).filter(function (p) { return (primoUsed[p] || 0) < 3; })[0] || m.choice.primo);
      var veg = shuffle(ctx.vegIds, rnd)[0];
      choices[d + m.key] = { day: d, meal: m.key, tag: m.choice.tag, sec: sec.ids, eggs: sec.combo ? 2 : 0, primo: primo, legume: m.choice.legume, veg: veg, vegG: VEG_G[veg] || 200 };
    });
    var nd = buildDay(plan, d, old.type, choices, rnd);
    nd.meals.forEach(function (m, i) { if (old.meals[i] && old.meals[i].locked) { nd.meals[i] = old.meals[i]; } });
    recomputeDay(plan, nd);
    plan.days[d] = nd;
    weeklyChecks(plan);
    return nd;
  }

  // ───────────────────────── API ─────────────────────────
  function generate(db, input, settings, seed) {
    settings = settings || {};
    return input.planType === 'daily' ? generateDaily(db, input, settings, seed) : generateMulti(db, input, settings, seed);
  }

  var api = {
    NUTR: NUTR, MICRO: MICRO, DEFAULT_FLAGS: DEFAULT_FLAGS, DEFAULT_DIST: DEFAULT_DIST, MEAL_LABEL: MEAL_LABEL, DAYS: DAYS, TOL: TOL,
    TEMPLATES: TEMPLATES, SECONDI: SECONDI, PRIMI: PRIMI, SHORT: SHORT, UNIT_LABEL: UNIT_LABEL, LEGUMI_DRY: LEGUMI_DRY, LEGUMI_CAN: LEGUMI_CAN,
    FATTY_FISH: FATTY_FISH, RED_IDS: RED_IDS, OIL: OIL,
    buildDB: buildDB, makeFilter: makeFilter, makeCtx: makeCtx, grid: grid, roundQ: roundQ, qty: qty, totals: totals, addT: addT, zeroT: zeroT,
    dayTarget: dayTarget, mealPlan: mealPlan, mealTargets: mealTargets, buildOption: buildOption, recomputeOption: recomputeOption, refreshOption: refreshOption, GROUP_ORDER: GROUP_ORDER,
    mainMeal: mainMeal, generate: generate, generateMulti: generateMulti, generateDaily: generateDaily, evaluateMulti: evaluateMulti,
    recomputeDay: recomputeDay, weeklyChecks: weeklyChecks, dayScore: dayScore, regenerateDay: regenerateDay, buildMultiMeal: buildMultiMeal,
    mealOk: mealOk, dayOk: dayOk, mealDev: mealDev, light: light, microReport: microReport, label: label, itemText: itemText,
    stateNote: stateNote, kindOf: kindOf, rng: rng, r1: r1, clone: clone, uniq: uniq, objective: objective, optionSignature: optionSignature
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FSMEngine = api;
})(this);
