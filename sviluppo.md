# Sviluppo — ProjectoTps

Piano delle funzionalità da implementare.

**Ultimo aggiornamento:** 16/10/2026

**Legenda:** ✅ fatto · 🔄 in corso · ⬜ da fare · ⛔ bloccato

---

## 1. Stato attuale

| Area | Situazione |
|---|---|
| Combattimento locale 2 giocatori | ✅ funziona (attacco, parata, vita, stamina, timer, fine partita) |
| Canvas + game loop | ✅ 1500×850, `requestAnimationFrame` |
| Schermata di caricamento | ✅ implementata |
| Morte + schermata vincitore | ✅ funzionano |
| Interfaccia | ⚠️ tutti gli stili sono inline dentro `index.html` |
| Menu / selezione personaggio | ⬜ non esistono: la partita parte da sola |
| CPU / online | ⬜ non esistono |

**Bug aperti che impattano il piano** (dettagli in `bugs.md`):
- **BUG-03** (sfondo diviso in 5 frame) → critico, va chiuso prima di lavorare sulla grafica.
- **BUG-04 / BUG-07** (game loop basato sui *frame*, non sul *tempo*) → vanno chiusi **prima** delle meccaniche con finestre temporali (perfect block).

---

## 2. Funzionalità richieste

### F1 — CSS esterno
Spostare gli stili inline di `index.html` in un file dedicato.
- ⬜ creare `css/style.css` e collegarlo con `<link>`
- ⬜ rimuovere gli attributi `style="..."` dal markup
- ⬜ usare classi (`.hud`, `.barra`, `.menu`…) invece di stili ripetuti

### F2 — Menu principale
All'apertura non si gioca più subito: compare un menu a schermo intero con il nome del gioco e le voci sotto.
- ⬜ schermata menu full screen: titolo + voci
- ⬜ due voci: **Play** e **Settings**
- ⬜ navigazione da tastiera (frecce + Invio) con evidenziazione della voce attiva

### F3 — Menu Play
- ⬜ **vs locale** — 2 giocatori sulla stessa tastiera (già esistente, va solo collegato)
- ⬜ **vs CPU** — contro l'IA: *facile*, *difficile*, *guissè* (molto difficile)
- ⬜ **vs online** — per ultimo: server semplice con creazione/ingresso in stanze

### F4 — Settings
- ⬜ **keybinds** — rimappatura dei tasti per entrambi i giocatori
- ⬜ **fullscreen** — attiva/disattiva schermo intero

### F5 — Selezione personaggio
- ⬜ schermata di selezione (per P1 e P2) prima della partita
- ⬜ almeno **6 personaggi**, ognuno con **statistiche proprie** e **ultimate unica**
- ⬜ configurazione dei personaggi in un file dati dedicato (non a mano nel game loop)

### F6 — Nuove meccaniche di combattimento
- ⬜ **perfect block** — parando entro **100 ms** dall'impatto, l'avversario resta **stunnato 1 s**
- ⬜ **ultimate** — una per personaggio, con **barra dedicata nella HUD**
- ⬜ **attacco caricato** — rompe la parata e stunna l'avversario per **1 s**

---

## 3. Piano a fasi

| Fase | Contenuto | Perché ora | Prerequisiti |
|---|---|---|---|
| **0. Fondamenta** | Fix BUG-03, BUG-05, BUG-06, BUG-09 + CSS esterno (F1) | Il CSS tocca `index.html`, lo stesso file del menu; i fix rendono l'HUD affidabile prima della barra ultimate | — |
| **1. Stati di gioco** | Macchina a stati: `caricamento → menu → selezione → partita → fine` | Sblocca tutto: oggi `animate()` parte subito e non esiste un "prima della partita" | Fase 0 |
| **2. Menu + Settings** | F2, F4 | Il menu è l'ingresso a ogni modalità | Fase 1 |
| **3. Selezione personaggio** | F5 | Definisce su cosa agiranno ultimate e bilanciamento | Fase 2 |
| **4. Meccaniche** | F6 (deltaTime, perfect block, ultimate + barra, attacco caricato) | Servono base temporale affidabile e personaggi già definiti | Fase 3 |
| **5. CPU** | F3 vs CPU, 3 difficoltà | L'IA userà personaggi e meccaniche esistenti | Fase 4 |
| **6. Online** | F3 vs online: server + stanze | Richiede tutto il resto stabile | Fase 5 |

### Criteri di completamento

- **Fase 0** → `index.html` senza stili inline, sfondo corretto, barre HUD che non sballano, timer che parte da 60.
- **Fase 1** → all'avvio compare il menu; la partita parte solo dopo la selezione.
- **Fase 2** → si naviga il menu con la tastiera, "vs locale" avvia la partita, i tasti si rimappano, il fullscreen funziona.
- **Fase 3** → si scelgono 6 personaggi diversi e ognuno entra in partita con le proprie statistiche.
- **Fase 4** → perfect block entro 100 ms stunna 1 s; l'ultimate si carica e si scarica dalla barra; l'attacco caricato rompe la parata.
- **Fase 5** → si gioca contro l'IA a 3 difficoltà.
- **Fase 6** → due giocatori su macchine diverse creano/entrano in una stanza e combattono.

---

## 4. Decisioni aperte

| # | Domanda | Fase | Impatto |
|---|---|---|---|
| D1 | I 6 personaggi: **nuove sprite** o riuso di Player/Enemy con variazioni? | 3 | Enorme: fino a ~48 file immagine. Determina la durata della fase |
| D2 | Dove vive lo stato di gioco: nuovo `js/Stato.js` o variabili in `index.js`? | 1 | Architettura: da decidere prima di scrivere il menu |
| D3 | I keybinds rimappati sostituiscono `keys`/`lastKey` o si affiancano? | 2 | Richiede di rifare il sistema di input |
| D4 | L'online richiede un **server**: Node? PHP? Dove gira? | 6 | Finora il progetto non ha backend né npm |
| D5 | Fullscreen su quale elemento: canvas, wrapper o pagina intera? | 2 | Estetica |
| D6 | Le finestre da 100 ms richiedono un loop basato sul **tempo**: ok rifattorizzare `animate()`? | 4 | Prerequisito tecnico del perfect block |
| D7 | Ultimate: come si caricano (a tempo? subendo colpi?), quanto durano, quanto danno? | 4 | Bilanciamento |

---

## 5. Regole di lavoro

- Ogni bug incontrato va annotato in `bugs.md` con causa e fix.
- Nessuna modifica ai valori di bilanciamento (danno, stamina, gravità, velocità, timer) senza concordanza.
- Niente framework, bundler o npm senza concordanza esplicita.
- Il gioco deve restare funzionante dopo ogni fase: se una fase lo rompe, si torna indietro.

