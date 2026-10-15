# FSM · Tool piani alimentari

Pagina web unica (HTML + JavaScript, senza server) per generare i piani alimentari dei clienti nel formato del
modello **FSM_ALIMENTAZIONE.docx**. Tutti i calcoli avvengono nel browser: nessun dato viene inviato a server esterni.

## Pubblicare su Netlify (drag & drop)

1. Scarica la cartella **`sito`** (contiene `index.html`, `app.js`, `engine.js`, `docgen.js`, `style.css`,
   `Database_alimenti.xlsx`, `FSM_ALIMENTAZIONE.docx` e la cartella `lib/`).
2. Vai su **https://app.netlify.com/drop** e accedi (l'account gratuito basta).
3. Trascina la cartella `sito` nel riquadro tratteggiato.
4. Dopo pochi secondi Netlify ti dà un indirizzo tipo `https://nome-casuale.netlify.app`.
   In *Site configuration → Change site name* puoi rinominarlo (es. `fsm-piani.netlify.app`).
5. Su tablet apri l'indirizzo e usa *Condividi → Aggiungi a schermata Home* per averlo come un'app.

**Aggiornare il sito:** apri il sito su Netlify → scheda *Deploys* → trascina di nuovo la cartella `sito` nel riquadro
“Need to update your site? Drag and drop your site output folder here”. L'indirizzo resta lo stesso.

> Se apri `index.html` direttamente dal computer (senza Netlify) il browser può bloccare la lettura dei file inclusi:
> in quel caso usa *Aggiorna database* e *Impostazioni → Carica modello Word* per sceglierli a mano.

## Come si usa

1. **Dati cliente**: nome, obiettivo/fase, giorni ON/OFF, kcal (±50), proteine (±10), grassi (±10).
   I carboidrati si calcolano da soli: (kcal − P×4 − G×9) / 4. Avvisi se scendono sotto 50 g o se le proteine
   superano 2,5 g/kg (inserisci il peso). Numero di pasti, allergie/intolleranze (stessi nomi e colori dell'Excel),
   preferenze, alimenti da escludere e tipo di piano (giorno per giorno / scelte multiple).
2. **Genera anteprima** → riepilogo coach (non va nel documento): target ed effettivi con semaforo, ogni opzione con
   kcal/macro e scostamento, micronutrienti (fibra, sodio, calcio, ferro, potassio, vitamina D, zuccheri, saturi)
   rispetto ai riferimenti LARN/EFSA/OMS. Puoi bloccare un'opzione 🔒, rigenerarla ↻, rigenerare un giorno,
   modificare una grammatura (i totali si ricalcolano subito).
3. **Genera piano (.docx)** → `Consigli_alimentari_Nome_Cognome_FASEx.docx`. **Scarica PDF** apre la stampa del
   browser: scegli “Salva come PDF”.

Il file Word si crea aprendo il modello con JSZip e sostituendo **solo** il corpo di `word/document.xml`:
intestazione, piè di pagina, logo, filigrana e stili restano quelli del modello.

### Archivio, impostazioni e database
- **Salva profilo** / **Archivio clienti**: profili salvati nel browser, con *Fase successiva* (porta la fase a N+1),
  *Esporta* e *Importa* in JSON.
- **Impostazioni**: distribuzione delle kcal per 3–6 pasti, numero di opzioni (colazione 10, spuntino 8), litri d'acqua,
  testo dei pasti liberi.
- **Aggiorna database**: carica una nuova versione di `Database_alimenti.xlsx` senza toccare il codice (le colonne si
  leggono per nome). Resta salvata in quel browser; *Torna al database incluso* la annulla. Per aggiornarla per tutti,
  sostituisci il file nella cartella `sito` e ripubblica.

## Per lo sviluppo
- `sito/engine.js`: calcoli (esclusioni, risolutore, opzioni, equivalenze, piano settimanale, controlli).
- `sito/docgen.js`: contenuto del documento, XML Word, anteprima HTML/PDF.
- `sito/app.js`: interfaccia. Librerie da CDN con versione fissa (JSZip 3.10.1, SheetJS 0.18.5), con copia locale in
  `sito/lib/` se il CDN non risponde.
- Test: `test/run_tests.js` (casi del capitolato, richiede `jszip` e `xlsx` da npm in `NPM_DIR`),
  `test/check_docx.py` (controllo dei .docx con python-docx e LibreOffice), `test/ui.js` (interfaccia con Playwright).
  Esito in [TEST_REPORT.md](TEST_REPORT.md); i documenti dei test sono in `esempi/`.
