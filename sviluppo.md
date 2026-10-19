# Sviluppo — UVSTF7

Piano delle funzionalità da implementare.

**Ultimo aggiornamento:** 17/10/2026
**Fase in corso:** Fase 5 completata — VS ONLINE attivo (server sulla VPS)

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
| Sfondo animato | `[OK]` foglio di 5 frame (384 × 221) animato come gli sprite, scala "cover" sul singolo frame |
| Schermata di caricamento | `[OK]` disponibile |
| Morte + schermata vincitore | `[OK]` disponibile |
| Stili | `[OK]` tutti in `css/style.css` |
| Menu principale / Play / Settings | `[OK]` (keybinds compresi) |
| Menu di pausa | `[OK]` con `Esc`: Riprendi, Impostazioni, Esci al menu (funziona anche a partita finita) |
| Report bug | `[OK]` pulsante nel menu di pausa, invio al server (`POST /report`) con copia locale di riserva |
| Selezione personaggio | `[OK]` 9 personaggi con statistiche proprie |
| vs CPU | `[OK]` tre difficoltà: Facile, Difficile, Guissè |
| vs online | `[OK]` stanze con codice, host che simula e ospite collegato (Fase 5) |
| Perfect block / ultimate / attacco caricato | `[OK]` disponibili (Fase 3) |
| Keybinds | `[OK]` rimappatura per i due giocatori, salvata nel browser |
| Rivincita | `[OK]` menu di fine partita: stessi personaggi o cambio personaggi |
| Selezione per modalità | `[OK]` schede e istruzioni diverse in VS LOCALE, VS CPU e VS ONLINE |
| Versione mobile | `[OK]` layout responsive, selezione a tocchi, lottatori scalati, comandi touch |

**Debito tecnico da saldare** (dettagli in `bugs.md`):

| Bug | Quando va chiuso |
|---|---|
| **BUG-03** sfondo diviso in 5 frame | `[OK]` risolto in Fase 1 |
| **BUG-09** timer off-by-one | `[OK]` risolto in Fase 1 |
| **BUG-23** attacco bloccato dopo il primo colpo | `[OK]` risolto |
| **BUG-24** hitbox verticale uguale per tutti | `[OK]` risolto |
| **BUG-05** vita/stamina mai clampate | `[OK]` risolto in Fase 3 |
| **BUG-06** parata da morti, **BUG-07** stamina per-frame | `[OK]` risolti in Fase 3 |
| **BUG-19** querySelector nel game loop | `[OK]` risolto in Fase 3 (HUD in cache) |
| **BUG-27/28/29** loop di fine partita, perfect block, carica | `[OK]` risolti il 17/10/2026 |
| **BUG-30** CPU bloccata in `TakeHit` | `[OK]` risolto il 17/10/2026 |

**Strumenti disponibili**

| Strumento | Come si usa |
|---|---|
| Hitbox visibili | Tasto **U** in partita: mostra corpo (blu), area di attacco (rossa) e un pannello con frame corrente e stati di ogni lottatore |

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
- `[OK]` **vs CPU** — contro l'IA a *facile*, *difficile* e *guissè*: sottomenu dedicato, avversario scelto dal computer e tre profili di comportamento
- `[OK]` **vs online** — server su VPS con creazione/ingresso in stanze — Fase 5

### F4 — Settings  ·  `[OK]` (Fase 1 e sezione 12)
- `[OK]` **fullscreen** — attiva/disattiva schermo intero sull'**intera pagina**
- `[OK]` **keybinds** — schermata di rimappatura per entrambi i giocatori (6 azioni ciascuno), salvataggio nel browser e ripristino dei valori predefiniti. I tasti non sono più scritti nel codice: `js/Keybinds.js` traduce tasto -> azione e `premiAzione()` esegue

### F5 — Selezione personaggio  ·  `[OK]` (Fase 2)
- `[OK]` schermata di selezione (per P1 e P2) prima della partita
- `[OK]` **9 personaggi**, ognuno con **statistiche proprie** e **ultimate propria** (nome e danno in `js/Personaggi.js`)
- `[OK]` sprite dedicati in `assets/Personaggi/<Nome>/`, rinominati con nomi africani
- `[OK]` configurazione dei personaggi in un file dati dedicato (`js/Personaggi.js`)
- `WIP` animazioni di parata: `parry.png` è ancora un segnaposto (copia di idle)
- `WIP` salto e caduta di **Bakari Traore** (assenti nel pacchetto originale)

### F6 — Nuove meccaniche di combattimento  ·  `[OK]` (Fase 3)

- `[OK]` **perfect block** — parando entro **3 frame** dall'inizio della parata, l'attaccante resta **stunnato 1 s** (60 frame) e mostra l'animazione di danno `TakeHit` per tutta la durata, il difensore non subisce danno e guadagna **+15** di carica ultimate. Un avviso "PERFECT BLOCK" compare al centro dello schermo.
- `[OK]` **ultimate** — una per personaggio, con **barra dedicata nella HUD** sotto la stamina. Si carica **col tempo** (barra piena in circa 20 s), con le **parate perfette** (+15) e si **perde carica** quando si viene stunnati (-25). Tasto **G** per P1, **L** per P2. Ogni ultimate ha un **tipo** (mischia, proiettile, buff) e un **effetto unico**: vedi sezione 9.
- `[OK]` **attacco caricato** — tenere premuto `H`/`Ù` per **1 secondo (60 frame)**: la barra sopra il lottatore si riempie e appare `CARICATO`. Al **rilascio** parte il colpo, che **rompe la parata**, infligge danno e stunna l'avversario per **1 s**. Rilascio anticipato: attacco normale. Durante la carica non si può muoversi, saltare, parare o usare l'ultimate. Costo stamina: **1,5x** per il caricato.
- `[OK]` **stun** — blocca movimento, salto, attacco, parata e ultimate del lottatore colpito; gli input premuti durante lo stun vengono ignorati.
- `[OK]` **clamp** di vita e stamina e HUD in cache (BUG-05, BUG-19).

**Controlli Fase 3:**

| Azione | P1 | P2 |
|---|---|---|
| Attacco (tieni premuto 1 s, rilascia per caricare) | `H` | `Ù` |
| Parata (perfetta se premuta entro 3 frame dall'impatto) | `J` | `À` |
| Ultimate (solo a barra piena) | `G` | `L` |

### F7 — Hitbox e frame d'attacco per personaggio  ·  `[OK]` (Fase 3)
- `[OK]` **area di attacco propria** per personaggio (larghezza, altezza, spostamento dal centro del corpo)
- `[OK]` **area verticale misurata** per personaggio (`dy` / `altezza`) sui pixel reali del frame d'impatto (BUG-24)
- `[OK]` **frame d'impatto** proprio per personaggio, ricavato dal frame in cui il colpo arriva più lontano
- `[OK]` **riquadro del corpo** proprio per personaggio (dai pixel reali dello sprite)
- `[OK]` rimossi i valori fissi dalle collisioni in `index.js`
- `[OK]` durata dell'attacco normalizzata (da 4 a 13 frame: tutti circa mezzo secondo)
- `[OK]` risolto il disallineamento dei personaggi girati a sinistra (ribaltamento attorno al centro del corpo)

---f7 efetti sonori, musica in lobby suoni per attacco danno ricevuto ecc

## 3. Piano a fasi

Ordine concordato: **si parte dal menu**.

| Fase | Contenuto | Stato | Prerequisiti |
|---|---|---|---|
| **1. Menu** | CSS esterno (F1), `js/Stato.js`, menu principale, sottomenu Play, Settings, fullscreen | `COMPLETATA` | — |
| **2. Selezione personaggio** | F5: 9 personaggi con sprite dedicati, statistiche, scelta di P1 e P2 | `COMPLETATA` | Fase 1 |
| **3. Meccaniche** | F6: perfect block (per frame), ultimate e barra, attacco caricato | `COMPLETATA` | Fase 2 |
| **4. CPU** | F3 vs CPU: facile, difficile, guissè | `COMPLETATA` | Fase 3 |
| **5. Online** | F3 vs online: server su VPS, stanze | `COMPLETATA` | Fase 4 |

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

**Fase 3 — Meccaniche** (implementata)
Perfect block (finestra di 3 frame, stun 1 s), ultimate con barra HUD (tempo + parate perfette, perdita di carica dallo stun), attacco caricato che rompe la parata. Verificata con test a frame manuali in browser.

**Fase 4 — CPU** (implementata)
Menu **VS CPU** con tre difficoltà, avversario scelto dal computer e controller `js/CPU.js` che usa gli stessi comandi del giocatore. Dettagli nella sezione 7.

**Fase 5 — Online** (implementata)
Menu **VS ONLINE** con **CREA STANZA** (codice di 4 caratteri) e **ENTRA CON CODICE**. L'host simula la partita e manda 30 fotogrammi di stato al secondo all'ospite, che disegna lo stato ricevuto e gli rimanda i propri tasti. Dettagli nella sezione 10.

*Completata quando:* due giocatori su macchine diverse creano o entrano in una stanza e combattono. — verificato il 17/10/2026 con due schede collegate al server sulla VPS.

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

---

## 6. Bilanciamento attacchi — 17/10/2026

Regola applicata: **attacco più veloce e corto = meno danno e meno stamina; attacco più lento e con hitbox più grande = più danno e più costo**.

- **Avvio** = frame d'impatto × `framesHold`: quanti frame di gioco passano prima che il colpo possa colpire.
- **Durata** = frame dell'animazione × `framesHold`.
- **Hitbox** = portata orizzontale (`dx + larghezza`) × altezza verticale, in pixel di gioco.
- Il costo è letto da `statistiche.costoStamina` (non è più fisso a 20); il danno da `statistiche.danno`.

| Personaggio | Avvio | Durata | Hitbox (L × A) | Danno | Costo stamina |
|---|---|---|---|---|---|
| Ousmane Diouf | 12 | 28 | 155 × 202 | 8 | 14 |
| Amara Diallo | 16 | 32 | 325 × 218 | 9 | 17 |
| Zuri Nkosi | 18 | 30 | 250 × 285 | 10 | 18 |
| Kwame Mensah | 20 | 30 | 269 × 242 | 11 | 19 |
| Tarisai Moyo | 16 | 28 | 313 × 371 | 11 | 21 |
| Sekou Camara | 16 | 32 | 222 × 219 | 12 | 19 |
| Bakari Traore | 16 | 32 | 260 × 141 | 13 | 20 |
| Ayo Adebayo | 22 | 26 | 256 × 32 | 14 | 22 |
| Chidi Okonkwo | 20 | 30 | 386 × 242 | 14 | 24 |

**Criteri e compensazioni:**

- **Ousmane** ha il colpo più rapido ma la portata più corta: danno e costo più bassi.
- **Chidi** ha l'hitbox più grande e un avvio lento: danno e costo più alti.
- **Tarisai** ha un'area enorme (arco magico) ma avvio rapido: costo alto, danno medio.
- **Ayo** ha l'avvio più lento e un'hitbox verticale sottile: danno alto ma costo inferiore a Chidi perché è più difficile da mettere a segno.
- **Mages** (Bakari, Sekou, Ayo) compensano il danno alto con vita più bassa.
- **Amara e Zuri** restano leggere: danno e costo contenuti nonostante la portata, per non premiare troppo la loro velocità di movimento.

I valori si leggono nella schermata di selezione (Vita, Stamina, Danno, Costo, Velocità, Salto) e possono essere ritoccati in `js/Personaggi.js`.

---

## 7. CPU — Fase 4 (17/10/2026)

L'IA vive in `js/CPU.js` e controlla il giocatore 2 **scrivendo sugli stessi input del giocatore umano** (`keys`, `Enemy.lastKey`) e chiamando i comandi condivisi di `index.js` (`salta`, `attacca`, `iniziaParata`, `finisciParata`, `attivaUltimate`). Non esiste una seconda logica di combattimento.

| Difficoltà | Reazione (frame) | Aggressività | Parata | Perfect block | Caricato | Ultimate | Ritiro |
|---|---|---|---|---|---|---|---|
| Facile | 20 | 0.35 | 0.20 | 0 | 0.05 | 0.10 | 0.05 |
| Difficile | 11 | 0.62 | 0.50 | 0.45 | 0.35 | 0.55 | 0.12 |
| Guissè | 5 | 0.88 | 0.85 | 0.90 | 0.70 | 0.95 | 0.18 |

**Come si comporta:**

- **Movimento:** si avvicina se fuori portata, arretra ogni tanto, si ferma per attaccare o parare e guarda sempre il giocatore.
- **Attacco:** quando è a portata, con probabilità pari all'aggressività; con probabilità `carica` tiene premuto per 1 secondo e rilascia l'attacco caricato (restando fermo e vulnerabile).
- **Difesa:** la reazione non è istantanea: dopo `reazione` frame dall'inizio dell'attacco avversario può decidere di parare. Se punta al perfect block aspetta l'ultimo frame prima dell'impatto; altrimenti para subito (blocco normale).
- **Ultimate:** viene usata appena la barra è piena, con probabilità `ultimate`.
- **Stun:** la CPU non agisce e rilascia tutti gli input.

**Flusso:** `PLAY -> VS CPU -> difficoltà -> selezione` (il personaggio della CPU è casuale e già confermato) `-> conferma P1 -> partita`. In VS CPU i tasti del giocatore 2 sono ignorati.

**Verifiche:** avvicinamento e attacco a distanza, parata con perfect block, uso dell'ultimate, tasti P2 ignorati, VS locale invariato, nessun errore JS.

---

## 9. Ultimate uniche (17/10/2026)

Ogni personaggio ha la sua ultimate, con un **tipo** e un **effetto** distinti. Le ultimate atterrano sempre (rompono la parata) e applicano lo stato al difensore; l'effetto è mostrato nella scheda di selezione.

| Personaggio | Ultimate | Tipo | Danno | Effetto | Durata |
|---|---|---|---|---|---|
| Ousmane Diouf | Radici del Baobab | Mischia | 20 | Rallentamento: velocità -50%, animazioni +80% | 4 s |
| Kwame Mensah | Vortice di Vento | Mischia | 18 | Inversione dei comandi | 3 s |
| Chidi Okonkwo | Ruggito del Leone | Mischia | 24 | Congelamento: nessuna azione | 1,5 s |
| Amara Diallo | Danza Fulminea | Buff | 0 | Velocità +50%, animazioni -40% | 5 s |
| Tarisai Moyo | Cerchio Ancestrale | Mischia | 20 | Veleno: 12 danni nel tempo | 4 s |
| Zuri Nkosi | Freccia della Savana | Mischia | 18 | Marchio: +30% danni subiti | 5 s |
| Bakari Traore | Pioggia di Stelle | Proiettile | 24 | Bruciatura: 14 danni + blocco rigenerazione stamina | 4 s |
| Sekou Camara | Giudizio degli Antenati | Proiettile | 22 | Silenzio: niente ultimate, stamina in calo | 4 s |
| Ayo Adebayo | Eclissi Arcana | Proiettile | 26 | Eclissi: inversione + rallentamento | 3 s |

**Dettagli:**

- I **proiettili** (Bakari, Sekou, Ayo) sono sfere animate disegnate sul canvas, viaggiano in avanti, rompono la parata e applicano danno + stato. L'attacco di mischia della stessa ultimate non fa danno doppio.
- Le ultimate **mischia** usano l'animazione `Attack1`, colpiscono una sola volta per attivazione e applicano lo stato al primo colpo.
- **Amara** non attacca: la sua ultimate è un potenziamento personale.
- Gli stati sono mostrati sopra i lottatori (`CONGELATO`, `VELENO`, `BRUCIATO`, `INVERSO`, `RALLENTATO`, `MARCHIATO`, `SILENZIO`, `VELOCE`).
- Il **congelamento** blocca movimento, salto, attacco, parata, carica e ultimate.
- Il **silenzio** impedisce di attivare l'ultimate e drena stamina.
- La **bruciatura** blocca anche la rigenerazione della stamina.
- Il **marchio** aumenta del 30% tutti i danni subiti, compresi proiettili e attacchi normali.

**File coinvolti:** `js/Personaggi.js` (dati), `js/Classi.js` (stati e moltiplicatori), `index.js` (effetti, proiettili, movimento), `js/Utili.js` (blocco rigenerazione), `js/Selezione.js` + `css/style.css` (scheda ultimate).

---

## 8. Menu di pausa e report bug (17/10/2026)

### Menu di pausa — `Esc`

- Si apre con `Esc` durante la partita **e a partita finita**, quindi non serve più ricaricare la pagina.
- Il gioco e il timer si fermano (`STATI.PAUSA`); il risultato finale resta visibile dietro al menu.
- Voci: **RIPRENDI**, **IMPOSTAZIONI**, **ESCI AL MENU**.
- `Esc` nel menu di pausa riprende la partita; `Esc` nelle impostazioni torna alla pausa.
- **ESCI AL MENU** ferma il timer, azzera `gameOver`, nasconde il risultato, rilascia gli input, disattiva la CPU e torna al menu principale senza ricaricare.
- Il menu riutilizza `#menu` con la classe `.pausa`: sfondo semitrasparente sopra la partita.

### Report bug

- Pulsante **REPORT BUG** nell'angolo in basso a destra, visibile solo nel menu di pausa.
- Il pannello contiene una textarea e allega automaticamente: stato, modalità, difficoltà CPU, timer, ultimo tasto P1 e stato dei due lottatori (posizione, vita, stamina, ultimate, attacco, parata, stun, frame).
- I report sono salvati in `localStorage` sotto la chiave `uvsf7-report-bug` (sopravvivono al ricaricamento).
- **ESPORTA MD** scarica tutti i report come `report-bug-AAAA-MM-GG_HHMM.md`; **COPIA** li mette negli appunti; **Esc** chiude il pannello e torna alla pausa.
- Il gioco resta in pausa anche con il pannello aperto.


---

## 10. VS ONLINE — Fase 5 (17/10/2026)

Due giocatori su macchine diverse, stanza con codice, combattimento in rete. Il combattimento **non** gira sul server: lo simula il browser di chi crea la stanza.

### Ruoli

| Ruolo | Chi è | Cosa fa |
|---|---|---|
| **host** | chi crea la stanza | simula la partita come in VS locale e manda lo stato all'ospite |
| **ospite** | chi entra col codice | non simula nulla: disegna lo stato ricevuto e manda i propri tasti all'host |
| **server** | `server/server.js` sulla VPS | serve i file del gioco e inoltra i messaggi dentro la stanza |

### Flusso

1. `PLAY -> VS ONLINE -> CREA STANZA`: il server genera un codice di 4 caratteri, mostrato nel badge in alto.
2. L'host sceglie il personaggio (tasti del giocatore 1); l'ospite entra col codice e sceglie il suo (tasti del giocatore 2).
3. Ognuno conferma: la scelta parte come messaggio `scelta`. Quando l'host ha entrambe le scelte manda `avvia` con i due personaggi e le **misure del campo** (`canvas.width` / `canvas.height`).
4. L'ospite adotta quelle misure: le posizioni che riceve sono pixel del campo dell'host, quindi i due schermi mostrano la stessa cosa anche con finestre di dimensioni diverse (il canvas viene scalato via CSS, non ridimensionato).
5. L'host manda un **fotogramma** ogni due frame (30 al secondo): posizione, velocità verticale, direzione, vita, stamina, ultimate, sprite e frame, parata, stun, morte, stati alterati, proiettili, timer, avviso centrale e risultato finale.
6. L'ospite manda `tasto` a ogni pressione e rilascio; l'host li applica al giocatore 2 chiamando gli stessi comandi condivisi del gioco (`salta`, `iniziaCarica`, `rilasciaCarica`, `iniziaParata`, `finisciParata`, `attivaUltimate`). Nessuna seconda logica di combattimento.

### File

| File | Ruolo |
|---|---|
| `server/server.js` | HTTP statico + WebSocket + stanze, **senza dipendenze npm** |
| `server/LEGGIMI.md` | installazione sulla VPS, servizio systemd, firewall |
| `js/Rete.js` | unico punto di contatto col WebSocket |
| `js/Online.js` | stanze, messaggi, fotogrammi, disegno lato ospite, tasti |
| `js/Menu.js` | sottomenu `online` (CREA STANZA / ENTRA CON CODICE) |
| `js/Selezione.js` | in VS ONLINE ogni browser comanda solo il proprio cursore |
| `index.js` | aggancio nel game loop: l'ospite disegna invece di simulare, l'host invia il fotogramma |

### Scelte tecniche

- **Un solo simulatore** (l'host): niente rollback, niente predizione, niente doppia fisica da tenere allineata. L'ospite vede lo stato con la latenza della rete, che su server italiano è di pochi millisecondi.
- **Nessuna dipendenza**: il WebSocket è implementato a mano nel server (handshake + frame di testo, ping/pong, close), come chiedono le regole di lavoro.
- **Campo fisso per partita**: in VS ONLINE il canvas non segue più il ridimensionamento della finestra, altrimenti le posizioni divergerebbero.
- **La pausa è locale**: `Esc` ferma solo il browser in cui viene premuto. L'host è l'unico che simula, quindi se mette in pausa si ferma la partita per entrambi.

### Verifiche fatte (17/10/2026)

- creazione stanza, ingresso col codice, errore su codice sbagliato e su stanza piena;
- scelta dei personaggi su due browser distinti e avvio della partita;
- movimento, parata, attacco caricato e attacco dell'ospite applicati dall'host;
- fotogrammi ricevuti dall'ospite con posizioni, timer e HUD coerenti;
- uscita dell'ospite: l'host torna al menu con l'avviso "L'AVVERSARIO HA LASCIATO LA STANZA";
- nessun errore JavaScript nelle due pagine.

---

## 11. Comandi touch — telefono e tablet (17/10/2026)

In partita, su un dispositivo touch, compaiono leva virtuale e tasti a schermo. Non esiste una seconda logica di input: i comandi virtuali mandano gli **stessi eventi di tastiera** dei tasti veri, quindi menu, selezione, partita e VS ONLINE funzionano senza modifiche.

### Disposizione

| Modalità | Comandi |
|---|---|
| VS CPU | un solo gruppo: leva a sinistra, ATT/PAR/ULT a destra (tasti del giocatore 1) |
| VS ONLINE | un solo gruppo, con i tasti del giocatore che sta usando il telefono: P1 per l'host, P2 per l'ospite |
| VS LOCALE | due gruppi con sigla P1 / P2, uno per lato |

### Comandi

- **leva**: il pomello si trascina (corsa 46 px, zona morta 14 px). Orizzontale = movimento, verticale verso l'alto = salto (uno per trascinamento).
- **ATT**: `pointerdown` avvia la carica, `pointerup` chiude il colpo: identico al tasto tenuto premuto.
- **PAR**: parata finché il dito resta sul tasto.
- **ULT**: colpo singolo.

### Quando compaiono

`js/Touch.js` li costruisce e li mostra solo con `statoCorrente === STATI.PARTITA` e su dispositivo touch: `navigator.maxTouchPoints > 0` **e** `hover: none` (o `pointer: coarse`). Un PC con schermo touch ma con mouse resta a tastiera. In pausa, a partita finita e nei menu spariscono, e `rilasciTuttoTouch()` manda i `keyup` per non lasciare tasti premuti.

### File

| File | Ruolo |
|---|---|
| `js/Touch.js` | rilevamento del dispositivo, costruzione della leva e dei tasti, invio degli eventi di tastiera |
| `css/style.css` | stili dei comandi, versione compatta per due giocatori e per schermi stretti |
| `js/Stato.js` | `cambiaStato()` richiama `aggiornaComandiTouch()` |
| `index.html` | contenitore `#comandiTouch`, script `js/Touch.js`, viewport senza zoom |

### Verifiche fatte (17/10/2026)

Con emulazione telefono (430 x 830) e su link pubblico HTTPS:

- comparsa dei comandi solo in partita e solo su touch; nessun comando sul PC con mouse;
- leva: `keys.a` premuto in movimento, personaggio spostato, rilascio corretto;
- ATT: carica a 60 frame e colpo caricato al rilascio; PAR del giocatore 2; ULT con avviso del nome;
- VS LOCALE: due gruppi con sigla, disposti su due file senza uscire dallo schermo;
- VS ONLINE da ospite: tasti `ù` / `à` / `l` (giocatore 2);
- pausa: comandi nascosti e tasti rilasciati, di nuovo visibili alla ripresa;
- nessun errore JavaScript.

---

## 12. Keybinds — rimappatura dei tasti (17/10/2026)

I tasti non sono più scritti dentro l'handler della tastiera: sono dati modificabili per ognuno dei due giocatori, salvati nel browser.

### Come si usa

`SETTINGS -> KEYBINDS` (anche da `Esc -> IMPOSTAZIONI` in partita):

| Tasto | Effetto |
|---|---|
| frecce su/giù o `W`/`S` | sposta la selezione tra le dodici azioni e la riga `RIPRISTINA PREDEFINITI` |
| `Invio` | aspetta il tasto da assegnare (`PREMI UN TASTO`) |
| `Esc` | annulla l'assegnazione in corso, oppure torna al menu di provenienza |

Assegnare un tasto già usato da un'altra azione lo toglie all'altra: non esistono doppioni. `Esc`, `Invio`, `Tab` e `U` (hitbox) sono riservati e vengono rifiutati.

### Valori predefiniti

| Azione | Giocatore 1 | Giocatore 2 |
|---|---|---|
| Sinistra | `A` | `←` |
| Destra | `D` | `→` |
| Salto | `W` | `↑` |
| Attacco | `H` | `Ù` |
| Parata | `J` | `À` |
| Ultimate | `G` | `L` |

La configurazione vive in `localStorage` (`uvsf7-keybinds`) e vale per tutte le modalità, touch compreso. Restano fissi la conferma nella selezione del personaggio (`H` / `Ù`) e la navigazione dei menu.

### Come funziona

- `js/Keybinds.js` contiene i dati (`tastiComandi`), la lettura/scrittura su `localStorage`, `azioneDaTasto()` e `premiAzione()`.
- `index.js` non conosce più nessun tasto: `keydown` e `keyup` traducono il tasto in `{ giocatore, azione }` e chiamano `premiAzione()`.
- `premiAzione()` scrive i flag di movimento letti dal game loop (`keys.a`, `keys.d`, `keys.ArrowLeft`, `keys.ArrowRight`, `lastKey`) e per il resto chiama i comandi condivisi (`salta`, `iniziaCarica`, `rilasciaCarica`, `iniziaParata`, `finisciParata`, `attivaUltimate`).
- In **VS ONLINE** l'ospite non simula: manda l'**azione** all'host (`{ t: 'azione', g: 'p2', a, giu }`), che la esegue sul giocatore 2. Viaggia l'azione e non il tasto, quindi ogni giocatore può avere keybinds diversi.
- I **comandi touch** chiamano `premiAzione()` direttamente: sono indipendenti dai tasti fisici.

### File

| File | Ruolo |
|---|---|
| `js/Keybinds.js` | dati, salvataggio, traduzione tasto -> azione, esecuzione, schermata di rimappatura |
| `index.html` | schermata `#keybinds` e ordine degli script |
| `js/Stato.js` | stato `STATI.KEYBINDS` e visibilità della schermata |
| `js/Menu.js` | `KEYBINDS` non è più `WIP`: apre la schermata da menu e pausa |
| `js/Online.js` | messaggio `azione` al posto di `tasto` |
| `js/Touch.js` | leva e tasti chiamano `premiAzione()` |
| `css/style.css` | stili della schermata |

### Verifiche fatte (17/10/2026)

- rimappatura, persistenza dopo il ricaricamento, ripristino dei predefiniti;
- nuovo tasto funzionante in partita, vecchio tasto inerte;
- doppioni impediti, tasti riservati rifiutati;
- keybinds aperti dalla pausa con ritorno corretto;
- touch e VS ONLINE con keybinds personalizzati;
- nessun errore JavaScript.

---

## 13. Richieste dei giocatori — 17/10/2026

Cinque richieste arrivate dopo le prime prove in classe, più il debito tecnico rimasto in `bugs.md` (dettagli nel "Fix #12").

### Tasto indietro nei menu

Il menu `PLAY` era l'unico senza voce di ritorno: ora ha `INDIETRO` come gli altri. Sotto le voci compare `#menuSuggerimento`, una riga che dice cosa fa `Esc` in quel menu ("Esc per tornare indietro", "Esc per riprendere la partita", "Esc per uscire al menu principale").

### Rivincita

A fine partita si apre da sola la schermata `FINE PARTITA` (stato `PAUSA`, il risultato resta visibile dietro):

| Voce | Effetto |
|---|---|
| `RIVINCITA` | nuova partita con gli stessi personaggi (`ultimiPersonaggi`), timer a 60, vita e stamina piene |
| `CAMBIA PERSONAGGI` | torna alla selezione del personaggio della stessa modalità |
| `ESCI AL MENU` | menu principale |

La schermata compare sia quando un lottatore finisce la vita sia quando scade il tempo (BUG-32, corretto il 17/10/2026).

In **VS ONLINE**: l'host che sceglie `RIVINCITA` rimanda `avvia` (l'ospite riparte da solo); l'ospite che la sceglie manda `rivincita` e l'host riavvia entrambi. `CAMBIA PERSONAGGI` manda `selezione`: la schermata si apre su tutti e due, così la scelta resta condivisa.

### Selezione del personaggio diversa per modalità

| Modalità | Cosa si vede |
|---|---|
| VS LOCALE | due schede attive (P1 e P2) e istruzioni per entrambi |
| VS CPU | la propria scheda e quella dell'avversario già scelto, con `CPU Facile/Difficile/Guissè` |
| VS ONLINE | la propria scheda marcata `TU` e l'altra come `AVVERSARIO`: nome e statistiche compaiono solo dopo la sua conferma, prima dice "in attesa della scelta" |

Le istruzioni in fondo cambiano di conseguenza (`A / D` e `H` per P1, frecce e `ù` per P2, `Esc` per uscire dalla stanza).

### Versione mobile

- CSS responsive (max 820 px di larghezza o 620 di altezza): menu, schede, griglia, keybinds e pannelli si rimpiccioliscono; la selezione può scorrere.
- Selezione giocabile **senza tastiera**: cella toccabile e pulsanti `P1/P2` con `<`, `>`, `CONFERMA` (`#selezioneComandi`, creati solo su dispositivi touch).
- Lottatori ridotti in proporzione al campo con `fattoreScalaCampo()`: su 390 px di larghezza il corpo passa da 194x210 a 52x88 e velocità/salto scalano con lo stesso fattore, così le collisioni restano coerenti.
- Comandi touch invariati (leva + ATT/PAR/ULT), visibili solo in partita.

### Report bug salvati sul server

Il pannello (`Esc` → `REPORT BUG`) ora invia il report con `POST /report`; il server lo aggiunge a `/var/lib/uvsf7/reports/report-AAAA-MM-GG.md` con data, IP e user agent. Nessun file da scaricare. Se il server non risponde il report resta in `localStorage` e viene reinviato alla riapertura del pannello; `ESPORTA MD` e `COPIA` restano come riserva.

Lettura dei report (chiave obbligatoria):

```
curl "http://<server>/reports?chiave=<CHIAVE>"
curl "http://<server>/reports/file?chiave=<CHIAVE>&nome=report-2026-10-17.md"
```

La chiave si imposta con `REPORT_CHIAVE` nel servizio systemd; la cartella con `REPORT_DIR` (default `/var/lib/uvsf7/reports`).

## 14. Reattività, ritmo stabile ed effetti (19/10/2026)

Il racconto completo — diagnosi, scelte, misure — sta in `gameplay_rework.md`.
Qui solo le regole da non dimenticare.

### Ritmo: timestep fisso a 60 Hz

`js/Tempo.js` + il pianificatore in `index.js`: `animate()` gira a ogni
fotogramma dello schermo, ma la simulazione fa **60 passi al secondo sempre**
(tetto di 5 passi per fotogramma, `dt` massimo 250 ms). Prima ogni fotogramma
dello schermo valeva un frame di gioco: a 144 Hz il gioco andava 2,4 volte più
veloce del previsto. **Un frame di gioco vale 1/60 di secondo**: le costanti in
frame (`STUN_FRAMI`, `CARICA_ATTACCO_FRAMI`, …) sono veritiere così come sono, non
vanno convertite in secondi.

Il vecchio corpo del loop si chiama ora `passoSimulazione()`: chi aggiunge una
meccanica la mette lì dentro, e sa che vale 1/60 di secondo.

### Input: coda dei comandi da 9 frame

`js/Buffer.js`: un'azione che non può partire (recupero attacco, atterraggio,
colpo subito) entra in coda per 150 ms e `riprovaBuffer()` la esegue al primo
momento utile. **Lo stun non è coperto** (`js/Regole.js` → `puoBufferizzare`) e la
CPU non passa dalla coda: chiama `iniziaParata` / `iniziaCarica` direttamente.

Ogni nuova azione passa da `eseguiAzione()` in `index.js`: è il punto unico in cui
un tasto diventa gioco. Non aggiungere `salta()` o `iniziaCarica()` direttamente
in `premiAzione()`.

### Colpo: finestra, non uguaglianza

`js/Regole.js` → `colpoVaRegistrato()` + campo `attaccoHaColpito` sul lottatore
(azzerato in `avviaAttacco()` e quando si viene colpiti). Un attacco fa centro una
volta sola, anche se il frame d'impatto viene saltato.

### Effetti

`js/Effetti.js`: particelle, onde, tinte, scosse e le stelle dello stun. **Non
toccano la simulazione**: si aggiornano per passo e si disegnano sopra la scena.
Colori da `personaggio.ultimate.colore`. Gli sprite stanno in `assets/Effetti/`
(Kenney Particle Pack, CC0): se mancano, `spriteEffettoPronto()` è `false` e si
disegnano forme geometriche — il gioco funziona identico.

Libri contabili: `MASSIMO_PARTICELLE = 220`; con `prefers-reduced-motion` le
particelle dimezzano e la scossa si spegne.

### Verifiche nuove (sempre, prima di dire «fatto»)

```bash
node tools/prova_motore.js        # 33 verifiche: timestep, coda, finestra, effetti
node tools/prova_invarianti.js    # 16 verifiche: il bilanciamento non si è mosso
```

`prova_invarianti.js` è il guardiano: se qualcuno tocca una costante di gioco, il
test diventa rosso. Quando si cambia **davvero** una regola, si aggiorna il test
nello stesso commit e si scrive il perché.

Per misurare il ritmo nel browser vero:

```js
uvsf7Debug()   // { frame, passiUltimoFotogramma, attesaMs, comandiInCoda, particelle, scossa }
```

`frame` deve crescere di ~60 al secondo, non di 144.

## 15. Menu principale a griglia (19/10/2026)

Il menu principale non è più un elenco unico: è **tre colonne raggruppate** più una **scheda del
giocatore**, sull'esempio di Tekken 8 / Street Fighter 6 / Guilty Gear Strive.

- **Il modello sta in `js/MenuModello.js`** (`GRUPPI_PRINCIPALE`): colonne GIOCA / SOCIALE / IL TUO
  PROFILO, nove voci in tutto. Le azioni sono **stringhe**, non funzioni: la mappa stringa → funzione
  è `AZIONI_MENU_PRINCIPALE` in `js/Menu.js`. Così il modello si prova con Node
  (`node tools/prova_menu.js`, 17 controlli: colonne, voci, movimento, voci non duplicate).
- **Movimento**: su/giù dentro la colonna (in tondo, saltando i `wip`), sinistra/destra fra le colonne
  con l'indice riportato dentro i limiti della nuova colonna. `window.uvsf7MenuDebug()` dice dove sta la
  selezione, e serve alle verifiche nel browser.
- **La scheda** (`disegnaPannelloGiocatore` in `js/Menu.js`) mostra nick, lega con il suo colore, ELO e
  i punti che mancano alla lega dopo; da sloggati mostra l'invito ad accedere. I dati arrivano da
  `datiPannelloGiocatore()` in `js/Account.js`, e `aggiornaSchedaMenu()` la ridisegna dopo accesso e
  uscita — chiamata **in fondo** ad `applicaProfilo`, dopo aver copiato tutto il profilo.
- **Il sottomenu `PLAY` non esiste più**: le tre modalità stanno nel menu principale. I ritorni da
  `js/Selezione.js` e `js/Online.js` puntano a `principale`. Se qualcuno reintroduce `apriMenu('play')`
  la schermata resta vuota: il controllo `grep -rn "apriMenu('play')" js/ index.js` deve uscire vuoto.
- **Layout**: `#menuCorpo` (flex) con `#menuVoci` a griglia 3 colonne su desktop; su telefono la griglia
  diventa `repeat(auto-fit, minmax(180px, 1fr))` (3 colonne in orizzontale, 1 in verticale) e la scheda
  passa sopra le voci (`column-reverse`). Il menu vive **dentro `#areaGioco`** (riquadro 16:9), quindi su
  un telefono in verticale l'area è alta solo ~219 px: lì il menu scorre (`overflow-y: auto`) invece di
  tagliare le ultime voci, e la media query `max-height: 720px` stringe tutto.

## 16. Combattimento fluido e cerimonia di fine partita (19/10/2026)

### I comandi non si incastrano più

Tre difetti toglievano reattività, e il più grave era invisibile nel codice:

1. `iniziaParata()` forza `keys.j.pressed = true`: se la parata parte **dalla coda dei comandi**
   dopo che il tasto è già stato rilasciato, nessun `keyup` arriva più e `isParata` resta acceso —
   e `iniziaCarica()` ha il guard `isParata`, quindi **non si può più attaccare**. Ora
   `controllaComandiFisici()` (index.js) chiude la parata (e rilascia la carica) appena il tasto non è
   più premuto, usando lo **stato fisico dei tasti** (`tastiFisici` in `js/Keybinds.js`).
2. La coda riazzera la scadenza a ogni tentativo fallito: i comandi restavano vivi per sempre. Ora
   `consuma()` restituisce la voce e vale `comandoAncoraValido(voce, frame, tenuto)` — il comando è
   tenuto in vita **solo se il tasto è ancora giù**.
3. `stunna()` azzera i flag dei tasti: chi teneva premuto l'attacco perdeva l'intenzione. Ora
   `controllaComandiFisici()` riprende la carica appena il lottatore torna libero.

Aggiunta la **finestra di cancellazione** (`js/Comandi.js` → `FINESTRA_RECUPERO = 16` passi, 0,27 s):
dopo il frame d'impatto si può già riattaccare o saltare, invece di aspettare la fine dell'animazione
(0,5 s). `framesAttacco` viene ora incrementato in `Lottatore.update()` (prima veniva azzerato e mai
contato).

Sui colpi c'è la **spinta** (`spinta` sul lottatore, `spingiIndietro()` in index.js): 3 px quando si
para, 4 su perfect block, 5 sull'attacco caricato, 7 su un colpo pieno. È simulazione, quindi vale
identica in VS ONLINE.

### Fine partita: la cerimonia

Prima il menu si apriva **nella stessa riga** in cui la vita arrivava a zero: il K.O. non si vedeva.
Ora `js/CerimoniaFine.js` (modulo puro, 16 controlli in `tools/prova_cerimonia.js`) guida tre fasi
contate in passi (1/60 s):

| Fase | Passi | Cosa si vede |
|---|---|---|
| `colpo` | 12 | flash bianco, scossa, colpo animato sul perdente |
| `caduta` | 54 | animazione di morte + scritta «K.O.» grande |
| `esito` | 70 | cartello `.esito`: motivo, vincitore, vita rimasta, durata |

Alla fine si apre il menu FINE PARTITA. **Invio o Spazio saltano la cerimonia**; in VS ONLINE l'ospite
fa la sua cerimonia quando arriva il fotogramma con `over`. `determineWinner()` non scrive più il testo
(`#displayText` lo riempie `disegnaEsito()`), e `avviaPartita()` azzera `cerimoniaFine`.

### Sfondo del menu

`assets/menu-background.png` (1920×1080, fornito dall'autore) è usato come sfondo del menu principale.
In `assets/menu-background.jpg` c'è la stessa immagine a 300 KB: l'originale è opaco, quindi il JPEG non
toglie niente a video e risparmia 2 MB di download a ogni visita. Il CSS usa il JPG, con una vignettatura
interna (`box-shadow: inset`) per tenere leggibili le colonne; `#menu.pausa` non ha sfondo (lì il menu sta
sopra la partita).

### Cose da sapere per il prossimo che tocca il codice

- Nel browser i moduli nuovi sono **funzioni globali**, non namespace: si chiama `puoCancellareAttacco()`,
  non `Comandi.puoCancellareAttacco()` (un `const Comandi = {...}` non esiste e la chiamata con prefisso
  fa ReferenceError a ogni passo del ciclo, congelando il gioco).
- `controllaComandiFisici()` vale solo per i lottatori comandati da una persona: la CPU ha i suoi tempi in
  `js/CPU.js` e non deve passare dalle protezioni "fisiche".

## 17. Verdellinesi: il nome e la chiave tecnica

I lottatori si chiamano **verdellinesi**. Nel codice:

- il modulo `js/Personaggi.js` è diventato **`js/Verdellinesi.js`** e l'array `PERSONAGGI` è
  **`VERDELLINESI`**;
- le costanti `NOME_VERDELLINESE` / `NOME_VERDELLINESI` stanno in cima a quel file, e le scritte
  dell'interfaccia le usano invece di scrivere la parola a mano;
- `tools/prova_nomi.js` legge i file dell'interfaccia e **boccia** ogni stringa visibile che contenga
  ancora "personaggio". I commenti non contano.

La chiave `personaggio` di `dati/negozio.json`, dei payload `/api/negozio/acquisto` e il campo
`lottatore.personaggio` **restano invariati**: sono identificativi salvati nei profili e nei dati del
server, non parole da leggere. Rinominarli obbligherebbe a migrare i dati online e a rompere i client
già installati senza alcun vantaggio per chi gioca. Gli sprite restano in `assets/Personaggi/` per lo
stesso motivo: i percorsi sono scritti nei dati, e rinominare la cartella significa toccare nove
cartelle di immagini per niente.

## 18. Identità: l'ospite esiste anche senza account

Prima chi non faceva il login non aveva né id né nome: il pannello del menu diceva solo "Accedi…",
la selezione motivava i blocchi come se il giocatore fosse un utente incompleto e in VS ONLINE i due
giocatori non sapevano con chi stavano giocando (il server non scambiava nessun nome).

Ora `js/Identita.js`:

- `ospite()` crea la prima volta e ricorda nel browser (`localStorage`, chiave `uvsf7.ospite`) un id
  `ospite-3F2A` e il nome **"Ospite 3F2A"**;
- `identitaCorrente()` risponde sempre: account (nick) se collegato, ospite altrimenti;
- `nomeGiocatore('p1'|'p2')` dà il nome giusto in ogni modalità: nick, nome ospite, `GIOCATORE 1/2`
  in VS LOCALE (due persone sullo stesso schermo) e `CPU` per l'avversario del computer;
- `contaPartitaOspite()` conta le partite giocate da ospite: il numero resta nel browser, perché
  senza account non c'è un profilo sul server a cui scriverlo.

Dove si vede: pannello del menu ("Ospite 3F2A · 3 partite giocate"), intestazione della selezione,
badge della stanza online, cartello di fine partita.

In VS ONLINE il server (`server/server.js`) ora scambia i nomi: `crea`/`entra` portano un campo
`nome`, e `entrato`/`avversario` lo restituiscono all'altro. Sono campi **additivi**: un client
vecchio li ignora, quindi non c'è bisogno di coordinare i rilasci. Il nome viene ripulito
(`pulisciNome`: via a capo e tabulazioni, massimo 24 caratteri) perché non è un dato di fiducia,
serve solo a leggere con chi si gioca.

## 19. Versione mobile: file separati

Dettagli e misure in **`mobile.md`**. In breve:

- `css/mobile.css` contiene **solo** le regole che dipendono dal dito (`pointer: coarse`,
  `hover: none`, portrait, safe area del notch, dimensione minima dei tasti). Le regole che dipendono
  soltanto dalla dimensione (per esempio `max-height: 720px`) restano in `css/style.css`, perché
  valgono anche per una finestra desktop ridotta: spostarle cambierebbe il desktop.
- `js/Mobile.js` possiede il dispositivo (`dispositivoTouch()`, `schermoVerticale()`,
  `aggiornaMobile()`, `segnaTastieraFisica()`, `comandiTouchUtili()`); `js/Touch.js` resta il disegno
  dei comandi a schermo.
- tasti con minimo 64 px, comandi spenti semi-trasparenti (i pollici non coprono i lottatori),
  safe area laterale per comandi e HUD, comandi che spariscono appena si usa una tastiera vera.
- `tools/prova_mobile.js` (26 controlli) verifica la separazione, il desktop intatto e il
  comportamento del rilevamento.

## 20. Cartello di fine partita con i due nomi

`testoEsito(esito)` restituisce `giocatore` e `verdellinese`: il cartello mostra **sopra** chi ha
vinto (nick dell'account, nome dell'ospite, `GIOCATORE 1/2` o `CPU`) e **sotto** il verdellinese che
ha usato. I nomi di entrambi viaggiano dentro l'esito (`nomeP1`, `nomeP2`, `verdellineseP1`,
`verdellineseP2`) fin dalla creazione della cerimonia, così `js/CerimoniaFine.js` resta un modulo puro
e `disegnaEsito()` in `index.js` non deve indovinare niente.
