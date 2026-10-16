# Sviluppo — ProjectoTps

Piano delle funzionalità da implementare.

**Ultimo aggiornamento:** 16/10/2026
**Fase in corso:** **1 — Menu**

**Legenda**

| Marcatore | Significato |
|---|---|
| `[OK]` | fatto e disponibile |
| `WIP` | non ancora disponibile (da fare o in lavorazione) |
| `BLOCCATO` | in attesa di un prerequisito |

> **Regola WIP:** tutto ciò che non è ancora disponibile va contrassegnato **WIP**, sia in questo piano sia nel menu: le voci non attive si mostrano ma non sono selezionabili, con un'etichetta "WIP" accanto al testo.

---

## 1. Stato attuale

| Area | Stato |
|---|---|
| Combattimento locale 2 giocatori | `[OK]` disponibile (attacco, parata, vita, stamina, timer, fine partita) |
| Canvas + game loop | `[OK]` a misura di finestra, `requestAnimationFrame` |
| Schermata di caricamento | `[OK]` disponibile |
| Morte + schermata vincitore | `[OK]` disponibile |
| Stili | `[OK]` tutti in `css/style.css` |
| Menu principale / Play / Settings | `[OK]` (keybinds ancora `WIP`) |
| Selezione personaggio | `[OK]` 9 personaggi con statistiche proprie |
| vs CPU | `WIP` |
| vs online | `WIP` |
| Perfect block / ultimate / attacco caricato | `WIP` |

**Debito tecnico da saldare** (dettagli in `bugs.md`):

| Bug | Quando va chiuso |
|---|---|
| **BUG-03** sfondo diviso in 5 frame | `[OK]` risolto in Fase 1 |
| **BUG-09** timer off-by-one | `[OK]` risolto in Fase 1 |
| **BUG-05** vita/stamina mai clampate | **Fase 3**, prima della barra ultimate |
| **BUG-06** parata da morti, **BUG-07** stamina per-frame | **Fase 3**, bilanciamento combattimento |

---

## 2. Funzionalità richieste

Ogni voce resta marcata `WIP` finché non è disponibile nel gioco.

### F1 — CSS esterno  ·  `[OK]` (Fase 1)
Spostare gli stili inline di `index.html` in un file dedicato.
- `[OK]` creare `css/style.css` e collegarlo con `<link>`
- `[OK]` rimuovere gli attributi `style="..."` dal markup
- `[OK]` usare classi (`.hud`, `.barra`, `.menu`...) invece di stili ripetuti

### F2 — Menu principale  ·  `[OK]` (Fase 1)
All'apertura non si gioca più subito: compare un menu a schermo intero con il nome del gioco e le voci sotto.
- `[OK]` schermata menu full screen: titolo (logo `img/UVSF7-logo.png`) con le voci sotto
- `[OK]` due voci: **Play** e **Settings**
- `[OK]` navigazione da tastiera (frecce + Invio) con evidenziazione della voce attiva
- `[OK]` le voci non disponibili mostrate con etichetta **WIP**, non selezionabili

> Il logo `assets/UVSF7-logo.png` è usato nel titolo del menu e nella schermata di caricamento.

### F3 — Menu Play  ·  `[OK]` la struttura (Fase 1)
- `[OK]` **vs locale** — 2 giocatori sulla stessa tastiera: la voce apre la selezione del personaggio
- `WIP` **vs CPU** — contro l'IA: *facile*, *difficile*, *guissè* (molto difficile) — Fase 4
- `WIP` **vs online** — server su VPS con creazione/ingresso in stanze — Fase 5

### F4 — Settings  ·  `[OK]` parziale (Fase 1)
- `[OK]` **fullscreen** — attiva/disattiva schermo intero sull'**intera pagina**
- `WIP` **keybinds** — rimappatura dei tasti per entrambi i giocatori, con variabili affiancate a `keys`/`lastKey`

### F5 — Selezione personaggio  ·  `[OK]` (Fase 2)
- `[OK]` schermata di selezione (per P1 e P2) prima della partita
- `[OK]` **9 personaggi**, ognuno con **statistiche proprie** (l'ultimate unica arriva con la Fase 3)
- `[OK]` sprite dedicati in `assets/Personaggi/<Nome>/`, rinominati con nomi africani
- `[OK]` configurazione dei personaggi in un file dati dedicato (`js/Personaggi.js`)
- `WIP` animazioni di parata: `parry.png` è ancora un segnaposto (copia di idle)
- `WIP` salto e caduta di **Bakari Traore** (assenti nel pacchetto originale)

### F6 — Nuove meccaniche di combattimento  ·  `WIP` (Fase 3)
- `WIP` **perfect block** — parando **nell'esatto frame d'impatto** dell'attacco, l'avversario resta **stunnato 1 s** (controllo sui frame, non sul tempo)
- `WIP` **ultimate** — una per personaggio, con **barra dedicata nella HUD**; si carica **col tempo** e con le **parate perfette**, e si **perde carica** quando si viene stunnati
- `WIP` **attacco caricato** — rompe la parata e stunna l'avversario per **1 s**

---f7 efetti sonori, musica in lobby suoni per attacco danno ricevuto ecc

## 3. Piano a fasi

Ordine concordato: **si parte dal menu**.

| Fase | Contenuto | Stato | Prerequisiti |
|---|---|---|---|
| **1. Menu** | CSS esterno (F1), `js/Stato.js`, menu principale, sottomenu Play, Settings, fullscreen | `COMPLETATA` | — |
| **2. Selezione personaggio** | F5: 9 personaggi con sprite dedicati, statistiche, scelta di P1 e P2 | `COMPLETATA` | Fase 1 |
| **3. Meccaniche** | F6: perfect block (per frame), ultimate e barra, attacco caricato | `WIP` | Fase 2 |
| **4. CPU** | F3 vs CPU: facile, difficile, guissè | `WIP` | Fase 3 |
| **5. Online** | F3 vs online: server su VPS, stanze | `WIP` | Fase 4 |

### Dettaglio

**Fase 1 — Menu** (implementata, da verificare nel browser)

1. Estrazione del CSS in `css/style.css` e pulizia di `index.html` (nessuno stile inline).
2. Fix rapidi: BUG-03 (sfondo statico) e BUG-09 (timer da 60).
3. `js/Stato.js`: stato unico del gioco (`caricamento`, `menu`, `partita`). La partita **non parte più da sola**: `animate()` gira solo nello stato `partita`.
4. `js/Menu.js`: menu come dati, navigazione con frecce o `W`/`S`, Invio per confermare, Esc per tornare indietro.
5. Sottomenu **Play**: VS LOCALE attivo; VS CPU e VS ONLINE visibili con etichetta **WIP** e non selezionabili.
6. **Settings**: fullscreen attivo; keybinds marcati **WIP**.

*Restano da fare:* keybinds, inserimento del logo nel titolo, ritorno al menu a fine partita.

*Completata quando:* all'avvio compare il menu, "Play - vs locale" avvia la partita, il fullscreen funziona, le voci non disponibili sono visibili ma non selezionabili.

**Fase 2 — Selezione personaggio**
*Completata quando:* si scelgono 6 personaggi diversi e ognuno entra in partita con le proprie statistiche.

**Fase 3 — Meccaniche**
*Completata quando:* il perfect block sull'esatto frame d'impatto stunna 1 s, l'ultimate si carica (tempo + parate perfette) e si scarica dalla barra, l'attacco caricato rompe la parata.

**Fase 4 — CPU**
*Completata quando:* si gioca contro l'IA a 3 difficoltà.

**Fase 5 — Online**
*Completata quando:* due giocatori su macchine diverse creano o entrano in una stanza e combattono.

---

## 4. Decisioni prese

| # | Domanda | Decisione |
|---|---|---|
| D1 | Sprite dei personaggi | **Cambiata**: niente riuso, ma sprite dedicati dai pacchetti `luizmelo`, rinominati con nomi africani in `assets/Personaggi/` |
| D2 | Dove vive lo stato di gioco | **Nuovo `js/Stato.js`**: si preferisce dividere il codice in più file |
| D3 | Keybinds rimappati | **Si affiancano** a `keys`/`lastKey`, tramite variabili dedicate |
| D4 | Server online | Gira su una **VPS**; sviluppato **per ultimo** (Fase 5) |
| D5 | Fullscreen | Sull'**intera pagina** |
| D6 | Finestra del perfect block: tempo o frame? | **Basata sui frame**: la logica d'attacco è già per-frame, quindi il perfect block è un **controllo sull'esatto frame d'impatto** (nessun refactor con deltaTime) |
| D7 | Ultimate | Si carica **col tempo** e con le **parate perfette**; quando si viene stunnati si **perde un po' di carica** |

---

## 5. Regole di lavoro

- Ogni bug incontrato va annotato in `bugs.md` con causa e fix.
- Nessuna modifica ai valori di bilanciamento (danno, stamina, gravità, velocità, timer) senza concordanza.
- Niente framework, bundler o npm senza concordanza esplicita.
- Il gioco deve restare funzionante dopo ogni fase: se una fase lo rompe, si torna indietro.
- Tutto ciò che non è ancora disponibile va marcato **WIP**, sia nel piano sia nel menu (voce visibile ma non selezionabile).
- Nessuna emoji, in nessun file e in nessun messaggio: al loro posto si usano marcatori testuali come `[OK]`, `WIP`, `Alto`, `Risolto`.

