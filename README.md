> **Nuovo:** il tool FSM per i piani alimentari è nella cartella [`fsm-alimentazione/`](fsm-alimentazione/README.md).

# GDN · Tool programmi di allenamento

Strumento web (un solo file: `netlify/index.html`) per creare i programmi di allenamento delle clienti
con lo stesso stile del modello GDN e scaricarli in PDF, con ogni nome di esercizio collegato al suo video.

## Pubblicare su Netlify (drag & drop)

1. Scarica la cartella **`netlify`** (contiene solo `index.html`). In alternativa usa il file `GDN_tool_netlify.zip`.
2. Vai su **https://app.netlify.com/drop** e accedi (account gratuito).
3. Trascina la cartella `netlify` (o lo zip) nel riquadro tratteggiato.
4. In pochi secondi Netlify ti dà un indirizzo tipo `https://nome-casuale.netlify.app`.
   In *Site configuration → Change site name* puoi cambiarlo, ad es. `gdn-programmi.netlify.app`.
5. Sul telefono apri l’indirizzo e usa *Condividi → Aggiungi a schermata Home* per averlo come un’app.

**Aggiornamenti:** apri il sito su Netlify → scheda *Deploys* → trascina di nuovo la cartella nel riquadro
“Need to update your site? Drag and drop your site output folder here”. L’indirizzo resta lo stesso.

> Il file funziona anche offline: puoi aprire `index.html` direttamente dal computer.

## Come si usa

1. **Nuovo programma**: nome, cognome, n° programmazione, giorni a settimana, fase del percorso.
2. Dalla schermata del programma scegli la sezione:
   - **Pre-workout**: esercizio → modalità → serie x reps
   - **Giorno N**: distretti (Lower, Upper… scegli o scrivi), poi esercizio → serie → ripetizioni → recupero → note
     - `＋ Unisci (jumpset/superset)`: il prossimo esercizio va nella stessa riga del precedente (es. Pushdown + Hammer curl)
     - `♥ Cardio`: riga evidenziata come il Tapis roulant
   - **Scarico post workout** (sotto ogni giorno): elenco puntato esercizio + indicazioni, `↳ Sotto-punto` per le voci con trattino; “Copia da” per riusare lo scarico di un altro giorno
   - **Routine scarico giorni off**: sottosezioni (Fase 1, Fase 2, Bonus…) ognuna con il suo elenco
   - **Testi**: premessa (con `{nome}`), titoli, nota finale, frase finale, legenda e “Come interpretare”
3. Nella chat scrivi il nome dell’esercizio: compare il menù con i suggerimenti, tocca o premi **Invio** per scegliere.
   Premi Invio a vuoto (o “Salta”) per lasciare un campo vuoto.
4. **Sviluppa protocollo** → anteprima impaginata A4 → **Scarica PDF** (oppure **Condividi** dal telefono, ad es. su WhatsApp).

Nei testi liberi puoi scrivere `**grassetto**`, `[Nome esercizio]` per inserire il link al video
e `[Respirazione alta|alta]` per un link che mostra solo la parola “alta”.

### Archivio e backup
I programmi si salvano da soli **nel browser del dispositivo**. Dall’archivio puoi *Duplicare come nuova programmazione*
(il numero aumenta di 1) o per un’altra cliente. Con *Esporta backup / Importa backup* sposti i programmi tra telefono e computer.
Se svuoti i dati del browser i programmi si perdono: esporta un backup ogni tanto.

### Database video
Il database dei video è incluso nel file (da `data/esercizi.csv`). I nomi si confrontano senza distinguere maiuscole e minuscole.
Per aggiornarlo senza toccare il codice: *Database video esercizi → Importa CSV* (colonna A nome, colonna B link).
Il nuovo elenco resta salvato su quel dispositivo.

## Per lo sviluppo
- Sorgente: `src/index.html` · risorse: `assets/` (font Gelasio/Carlito OFL, filigrana, jsPDF, html2canvas) · dati: `data/esercizi.csv`
- `python3 build.py` rigenera `netlify/index.html` con tutto incorporato.
