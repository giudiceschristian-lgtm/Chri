// Esegue i casi di test del txt e salva i .docx in test/out + un report JSON
const fs = require('fs'), path = require('path');
const { E, loadDB } = require('./load.js');
const D = require('../sito/docgen.js');
const JSZip = require(process.env.NPM_DIR + '/node_modules/jszip');
const TPL = fs.readFileSync(path.join(__dirname, '../sito/FSM_ALIMENTAZIONE.docx'));
const db = loadDB();
const settings = { water: 2.5 };

function planItems(plan) { // tutti gli alimenti che compaiono nel piano (anche alternative ed equivalenze)
  const ids = new Set();
  if (plan.type === 'multi') plan.meals.forEach(m => {
    if (m.kind === 'fruit' && plan.ctx.fruitRef) ids.add(plan.ctx.fruitRef.id);
    (m.options || []).forEach(o => plan.dayTypes.forEach(d => { const od = o.byDay[d]; (od.fixed || []).forEach(f => ids.add(f.id)); od.comps.forEach(c => { if (c.id) ids.add(c.id); (c.alts || []).forEach(a => ids.add(a.id)); }); }));
    if (m.main) plan.dayTypes.forEach(d => { const mm = m.main[d]; if (!mm) return;
      mm.primi.forEach(p => p.ids.forEach(i => ids.add(i))); mm.secondi.forEach(s => s.items.forEach(i => ids.add(i.id)));
      mm.condimenti.forEach(c => c.items.forEach(i => ids.add(i.id))); if (mm.legumi) { mm.legumi.dry.slice(0, 1).forEach(i => ids.add(i)); } });
  });
  else plan.days.forEach(day => day.meals.forEach(m => (m.items || []).forEach(it => ids.add(it.id))));
  ids.delete('_verdura');
  return [...ids];
}
function checkTolerances(plan) {
  const out = { days: [], badOptions: [], badMeals: [] };
  if (plan.type === 'multi') {
    plan.dayTypes.forEach(d => { const dd = plan.days[d], tg = plan.targets[d]; out.days.push({ d, K: Math.round(dd.tot.K), P: E.r1(dd.tot.P), C: E.r1(dd.tot.C), F: E.r1(dd.tot.F), tK: tg.K, tP: tg.P, tF: tg.F, tC: E.r1(tg.C), ok: dd.ok, range: dd.range.map(Math.round) }); });
    plan.meals.forEach(m => {
      (m.options || []).forEach((o, i) => plan.dayTypes.forEach(d => { if (!o.byDay[d].ok) out.badOptions.push(m.label + ' ' + (i + 1) + ' ' + d); }));
      if (m.main) plan.dayTypes.forEach(d => { const mm = m.main[d]; if (!mm) { out.badMeals.push(m.label + ' ' + d + ' nessuna combinazione'); return; }
        if (!mm.ok) out.badMeals.push(m.label + ' ' + d + ' riferimento');
        mm.primi.concat(mm.secondi, mm.condimenti).forEach(x => { if (!E.mealOk(x.tot, mm.tg)) out.badMeals.push(m.label + ' ' + d + ' ' + (x.key || x.ids)); });
        if (mm.legumi && !E.mealOk(mm.legumi.tot, mm.tg)) out.badMeals.push(m.label + ' ' + d + ' legumi'); });
    });
  } else {
    plan.days.forEach(day => { const tg = day.tgEff; out.days.push({ d: day.name + ' ' + day.type, K: Math.round(day.tot.K), P: E.r1(day.tot.P), C: E.r1(day.tot.C), F: E.r1(day.tot.F), tK: Math.round(tg.K), tP: Math.round(tg.P), tF: Math.round(tg.F), ok: day.ok, free: day.hasFree });
      day.meals.forEach(m => { if (!m.free && m.tot && !m.ok) out.badMeals.push(day.name + ' ' + m.label); }); });
  }
  return out;
}
function flagViolations(plan, flags) {
  const v = [];
  planItems(plan).forEach(id => { const f = db.foods[id]; flags.forEach(k => { if (f.flags[k] === 1 || f.flags[k] === 2) v.push(id + ' (' + k + '=' + f.flags[k] + ')'); }); });
  // anche la tabella sostituzioni frutta del documento
  D.fruitSubs(plan.ctx).forEach(s => flags.forEach(k => { if (k !== 'fodmap_alto' && (db.foods[s.id].flags[k] === 1 || db.foods[s.id].flags[k] === 2)) v.push('frutta ' + s.id + ' ' + k); }));
  return v;
}
function prefViolations(plan, prefs) {
  const v = [];
  planItems(plan).forEach(id => { const f = db.foods[id];
    if ((prefs.vegetarian || prefs.vegan) && /^(Carni|Salumi|Pesce|Crostacei e molluschi)$/.test(f.cat)) v.push(id);
    if (prefs.vegan && (f.flags.all_latte === 1 || f.flags.all_uova === 1)) v.push(id);
    (prefs.exclude || []).forEach(x => { if (x === id) v.push(id); }); });
  return v;
}
async function runCase(c) {
  const t0 = Date.now();
  let plan, err = null;
  try { plan = E.generate(db, c.input, settings, c.seed || 1); } catch (e) { err = e.stack; }
  const r = { name: c.name, ms: 0, error: err, type: c.input.planType };
  if (!plan) return r;
  r.ms = Date.now() - t0;
  r.warnings = plan.warnings.concat(plan.type === 'multi' ? plan.meals.flatMap(m => m.warnings || []) : []);
  r.tol = checkTolerances(plan);
  r.flagViol = flagViolations(plan, (c.input.prefs.flags || []));
  r.prefViol = prefViolations(plan, c.input.prefs);
  r.items = planItems(plan);
  if (plan.type === 'multi') r.options = plan.meals.filter(m => m.kind === 'small').map(m => ({ meal: m.label, n: m.options.length, groups: [...new Set(m.options.map(o => o.group))] }));
  else r.weekly = plan.weekly;
  const blocks = D.buildDocModel(plan, settings);
  r.faq = D.faqList(plan.ctx, plan, settings).map(x => x[0] + ' → ' + x[1]);
  r.docText = blocks.map(b => b.text || (b.runs || []).map(x => x.text || '\n').join('') || (b.rows ? b.rows.map(rw => rw.map(cl => typeof cl === 'string' ? cl : (cl.runs || []).map(x => x.text || ' ').join('')).join(' | ')).join('\n') : '')).join('\n');
  const buf = await D.makeDocx(JSZip, TPL, blocks, { type: 'nodebuffer', title: 'Consigli alimentari' });
  r.file = path.join(__dirname, 'out', c.file || D.fileName(c.input));
  fs.writeFileSync(r.file, buf);
  r.plan = plan;
  return r;
}
const CASES = [
  { name: 'Caso Filippo (ON/OFF, 5 pasti, scelte multiple)', input: { name: 'Filippo Messineo', goal: 'Ricomposizione corporea - Fase 2 - Estremizzazione', onoff: true, on: { kcal: 2000, P: 165, F: 65 }, off: { kcal: 1820, P: 165, F: 85 }, nMeals: 5, prefs: { flags: [] }, planType: 'multi' } },
  { name: 'Caso allergie (3 pasti, giorno per giorno, glutine+lattosio+nichel)', input: { name: 'Test Allergie', goal: 'Dimagrimento - Fase 1', onoff: false, std: { kcal: 1700, P: 130, F: 60 }, nMeals: 3, prefs: { flags: ['all_glutine', 'int_lattosio', 'nichel'] }, planType: 'daily', freeMeal: { day: 5, meal: 'cen' } } },
  { name: 'Caso vegetariano (6 pasti, 1500 kcal, scelte multiple)', input: { name: 'Test Vegetariano', goal: 'Dimagrimento - Fase 1', onoff: false, std: { kcal: 1500, P: 100, F: 50 }, nMeals: 6, prefs: { flags: [], vegetarian: true }, planType: 'multi' } },
  { name: 'Caso vegetariano (6 pasti, 1500 kcal, giorno per giorno)', file: 'Consigli_alimentari_Test_Vegetariano_GIORNO.docx', input: { name: 'Test Vegetariano', goal: 'Dimagrimento - Fase 1', onoff: false, std: { kcal: 1500, P: 100, F: 50 }, nMeals: 6, prefs: { flags: [], vegetarian: true }, planType: 'daily', freeMeal: { day: '', meal: 'cen' } } },
  { name: 'Limite: proteine alte e carboidrati < 50 g', input: { name: 'Test Limite', goal: 'Performance', weight: 80, onoff: false, std: { kcal: 1600, P: 220, F: 60 }, nMeals: 4, prefs: { flags: [] }, planType: 'multi' } },
  { name: 'Limite: nessuna opzione valida (vegano + soia, glutine, frutta a guscio, arachidi, 2800 kcal / 230 P)', input: { name: 'Test Impossibile', goal: 'Massa', onoff: false, std: { kcal: 2800, P: 230, F: 70 }, nMeals: 5, prefs: { flags: ['all_soia', 'all_glutine', 'all_frutta_guscio', 'all_arachidi'], vegan: true }, planType: 'multi' } },
  { name: 'Extra: ON/OFF giorno per giorno con FODMAP e esclusione tonno', file: 'Consigli_alimentari_Test_ONOFF_GIORNO.docx', input: { name: 'Test OnOff', goal: 'Ricomposizione corporea - Fase 1', onoff: true, on: { kcal: 2200, P: 160, F: 70 }, off: { kcal: 1900, P: 160, F: 80 }, nMeals: 5, onDays: [0, 2, 4], training: 'sera', prefs: { flags: ['fodmap_alto'], exclude: ['tonno_al_naturale_sgocciolato', 'seitan'] }, planType: 'daily', freeMeal: { day: 5, meal: 'cen' } } }
];
(async () => {
  const res = [];
  for (const c of CASES) { const r = await runCase(c); res.push(r); }
  const slim = res.map(r => { const o = Object.assign({}, r); delete o.plan; return o; });
  fs.writeFileSync(path.join(__dirname, 'out', 'report.json'), JSON.stringify(slim, null, 1));
  // Filippo: confronto con il documento di riferimento
  const fil = res[0].plan, pr = fil.meals.find(m => m.key === 'pra');
  const cmp = ['ON', 'OFF'].map(d => { const mm = pr.main[d]; const s = k => mm.secondi.find(x => x.key === k);
    return { d, primo: mm.primi.map(p => p.ids.join('/') + ' ' + p.g).join('; '), pollo: s('pollo') && s('pollo').items[0].g, salmone: s('salmone') && (s('salmone').items[0].g + ' ' + s('salmone').notes.join(', ')), lonza: s('lonza') && (s('lonza').items[0].g + ' ' + s('lonza').notes.join(', ')), olio: mm.oilMl, legumi: mm.legumi && (mm.legumi.dryG + 'g secchi/' + mm.legumi.canG + 'g barattolo, ' + mm.legumi.text) }; });
  fs.writeFileSync(path.join(__dirname, 'out', 'filippo_cmp.json'), JSON.stringify(cmp, null, 1));
  for (const r of res) {
    console.log('\n### ' + r.name + (r.error ? ' ERRORE ' + r.error : '') + ' (' + r.ms + ' ms)');
    if (r.error) continue;
    console.log('giorni:', r.tol.days.map(x => `${x.d}:${x.K}/${x.tK} P${x.P}/${x.tP} F${x.F}/${x.tF} C${x.C} ${x.ok ? 'OK' : 'FUORI'}${x.free ? ' (libero)' : ''}`).join(' | '));
    console.log('opzioni fuori tolleranza:', r.tol.badOptions.length, ' pasti fuori:', r.tol.badMeals);
    console.log('violazioni allergeni:', r.flagViol, ' violazioni preferenze:', r.prefViol);
    if (r.options) console.log('opzioni:', r.options.map(o => o.meal + '=' + o.n).join(', '));
    if (r.weekly) console.log('eccezioni settimana:', r.weekly.exceptions);
    console.log('warning:', r.warnings);
  }
  console.log('\nFilippo vs documento:', JSON.stringify(cmp, null, 1));
})();
