# Report dei test – FSM Tool piani alimentari

Eseguiti con `test/run_tests.js` (calcoli e .docx), `test/check_docx.py` (apertura con python-docx, XML valido,
confronto con il modello, conversione in PDF con LibreOffice, coerenza delle FAQ) e `test/ui.js` / `test/ui_pdf.js`
(interfaccia in Chromium con Playwright). I documenti generati sono nella cartella `esempi/`.

Tolleranze: giornata kcal ±50, proteine ±10 g, grassi ±10 g · ogni opzione ±8% kcal del pasto e ±5 g di proteine.

| Caso | Giornate (effettivo/target) | Opzioni fuori tolleranza | Allergeni/preferenze violati | .docx |
|---|---|---|---|---|
| **Filippo** ON 2000/165/65, OFF 1820/165/85, 5 pasti, scelte multiple | ON 2024 kcal · P 164 · G 64 ✔ · OFF 1811 · P 167 · G 78 ✔ | 0 (colazione 10, spuntino 8) | — | ✔ 17 pagine |
| **Allergie** glutine + lattosio + nichel, 3 pasti, giorno per giorno, pasto libero sabato cena | 6/6 giorni ✔ (1689–1707 kcal su 1700); sabato ✔ con pasto libero escluso | 0 | **0 alimenti con flag 1 o 2** (anche alternative e tabella frutta) | ✔ 12 pagine |
| **Vegetariano** 1500 kcal, 6 pasti, scelte multiple | 1506 kcal · P 97 · G 46 ✔ | 0 | 0 carni/pesce | ✔ 12 pagine |
| **Vegetariano** 1500 kcal, 6 pasti, giorno per giorno | 7/7 giorni ✔ (1479–1520 kcal) | 0 | 0 | ✔ 12 pagine |
| **Limite**: 1600 kcal, P 220 (2,75 g/kg), carboidrati 45 g | 1625 kcal · P 219 · G 59 ✔ | 0 | — | ✔ 11 pagine |
| **Limite**: nessuna opzione valida (vegano + soia, glutine, frutta a guscio, arachidi) | ✖ volutamente impossibile | — | — | ✔ 5 pagine, si genera |
| Extra: ON/OFF giorno per giorno, FODMAP, senza tonno e seitan | 7/7 giorni ✔ | 0 | 0 | ✔ 12 pagine |

## Caso Filippo rispetto al documento di riferimento (pranzo)

| | Documento Filippo | Tool |
|---|---|---|
| Primo ON | 70 g riso/pasta/couscous… | 60 g riso · 65 g pasta/couscous · 70 g pasta integrale |
| Secondo ON | 175 g pollo (~40 g proteine) | 170 g pollo (~40 g proteine) |
| Olio ON / OFF | 20 ml / 25 ml | 20 ml / 25 ml |
| Lonza | “togli 10ml di olio” | ON “dimezza l’olio” (= 10 ml), OFF “togli 10ml di olio” |
| Salmone | “no olio” | “no olio” (ON anche “togli 10g di primo”) |
| Legumi ON | 100 g secchi / 300 g barattolo, dimezza il secondo | 95 g secchi / 280 g barattolo, dimezza il secondo |
| Legumi OFF | 60 g secchi / 180 g barattolo, togli 1/3 | 40 g secchi / 130 g barattolo, togli 1/4 |
| Primo OFF | 30 g | 25–30 g |

I valori sono calcolati dal database (non copiati dal documento): le piccole differenze vengono dai valori nutrizionali
dell'Excel e dalle regole di arrotondamento (5 g, 10 g sopra i 100 g).

## Controlli sui file
- Tutti i .docx si aprono con python-docx e LibreOffice (conversione in PDF riuscita per tutti i 7 casi).
- Intestazione, piè di pagina (www.fisicosumisura.it), logo, filigrana, stili, tema e impostazioni: **byte per byte
  identici al modello**. Cambia solo il corpo di `word/document.xml`.
- FAQ: al massimo 12; l'acqua è la stessa nel piano e nelle FAQ; FAQ sui legumi solo se i legumi sono nel piano;
  FAQ sul lattosio solo con il flag lattosio; “come combinare le opzioni” solo nelle scelte multiple; il pasto libero
  (giorno e pasto) coincide con quello del piano. Esempi pasti solo nelle scelte multiple, con le grammature reali.
- Interfaccia: dati cliente → anteprima → blocco/rigenerazione/modifica grammatura → download .docx (scelte multiple e
  giorno per giorno) → archivio profili → impostazioni, senza errori JavaScript. La stampa PDF è stata verificata
  catturando la pagina di stampa e salvandola in PDF (intestazione, logo, filigrana e piè di pagina su ogni pagina).

## Eccezioni segnalate al coach (non bloccanti)
- Allergie (lattosio escluso): 1 porzione di latticini al giorno invece di 2-3; domenica fibra 24,7 g; legumi assenti
  perché esclusi dal nichel.
- Extra FODMAP: mercoledì sodio 2075 mg, fibra 20–24 g in due giorni, legumi esclusi dal FODMAP.
- Vegetariano 6 pasti: lo spuntino serale (≈120 kcal) ha 3 opzioni valide invece di 6.
- Limite proteine alte: avviso 2,75 g/kg, colazione con 3 opzioni valide, pranzo/cena oltre 60 g di proteine.
- Caso impossibile: il tool mostra “Nessun secondo disponibile…” e “Nessuna opzione valida…”, e chiede conferma
  prima di generare il documento.
