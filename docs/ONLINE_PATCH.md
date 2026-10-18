# Sviluppo della patch online

Documento di lavoro della patch che porta Ultra Verdello Street Fight 7 da
"due persone nella stessa stanza" a gioco online completo: account, punti,
negozio dei lottatori, amici, ranked, tornei.

Regola del documento: **una casella si spunta solo quando il controllo che la
copre passa.** Niente caselle spuntate "a occhio".

## Come è fatto

- **Server**: un solo processo Node (`server/server.js`, CommonJS, zero
  dipendenze) che serve i file del gioco, fa da centralino WebSocket per le
  stanze e risponde alle API JSON su `/api/`.
- **Stato**: file JSON in `dati/runtime/` (ignorata da git). Scrittura atomica
  su file temporaneo e poi `rename`: non può esistere un file mezzo scritto.
- **Password**: mai salvate. Si salva `scrypt(password, sale)` con un sale
  diverso per ogni giocatore, e il confronto avviene in tempo costante.
- **Sessione**: token casuale da 32 byte, valido 7 giorni, revocabile con
  l'uscita.
- **Punti ed ELO**: li calcola il server dai risultati che riceve. Il client
  non può dichiarare quanti punti ha guadagnato.
- **Mobile**: leva virtuale e tre tasti a destra ci sono già (`js/Touch.js`),
  costruiti sopra le azioni di `js/Keybinds.js`. Il layout ha già i due blocchi
  `@media` in `css/style.css`.

## 1. Account e sessioni

- [x] Iscrizione con nickname univoco e password (minimo 10 caratteri)
- [x] Accesso, uscita, sessione con token che scade
- [x] Profilo: punti, ELO, lottatori posseduti, statistiche
- [x] Ruolo amministratore (`--promuovi-admin`)
- [x] Schermate di iscrizione e accesso nel gioco (client)

## 2. Lottatori

- [x] Catalogo dei 9 lottatori in `dati/negozio.json`
- [x] 6 disponibili dall'iscrizione, 3 da sbloccare (Bakari 2.500, Sekou 3.500, Ayo 4.000)
- [x] Card bloccata con lucchetto e prezzo nella schermata di selezione
- [x] Selezione che non permette di usare un lottatore non posseduto

## 3. Negozio e punti

- [x] Catalogo letto da `dati/negozio.json`
- [x] Acquisto che scala i punti e sblocca il lottatore
- [x] Messaggio chiaro se i punti non bastano (402) o se è già tuo (409)
- [x] Schermata del negozio nel gioco (client)
- [x] Punti per partita online decisi dal server (`/api/partita/avvia` + `/api/partita/concludi`)
- [x] Un solo accredito per partita: identificativo emesso dal server, scade dopo 60 minuti
- [x] Tetto di 15 partite contate al giorno, oltre le quali si gioca senza punti
- [ ] Punti per partita ranked, amichevole e torneo
- [ ] Nessun punto per partite non validate dal server

## 4. Amici

- [x] Ricerca per nickname, richiesta, accettazione, rimozione
- [x] Richiesta incrociata che vale come accettazione
- [x] Schermata amici nel gioco (client): ricerca, ricevute, elenco, in attesa
- [ ] Stato in linea e invito diretto in una stanza
- [ ] Segnalazioni e blocco di un giocatore

## 5. Ranked e classifica

- [x] Coda ranked con abbinamento per ELO (`/api/coda/entra|stato|esci`, finestra ±300 → ±600 → ±1000)
- [x] Passaggio automatico del codice stanza dal padrone all'ospite (`/api/coda/codice`)
- [x] Esito della partita deciso dal server (ELO e punti calcolati lì, uno solo accredito per partita)
- [x] Classifica per ELO e per punti (schermata CLASSIFICA nel gioco, pubblica)
- [ ] Fascia visibile (Bronzo, Argento, Oro, Platino, Diamante, Maestro)
- [ ] ELO separato per lottatore
- [x] Prime 10 partite di piazzamento e stato "in valutazione" (campo `provvisorio`)
- [ ] Protezione dalla retrocessione una volta per fascia
- [x] Bonus della serie di vittorie (campi `serie` e `miglioreSerie` aggiornati)
- [ ] Coda delle partite non ranked
- [ ] Partita abbandonata: sconfitta e coda sospesa
- [ ] Storico delle ultime partite
- [ ] Spettatori di una partita in corso
- [ ] Avversario automatico a coda vuota, con priorità sempre alle persone
- [ ] Partite contro l'avversario automatico a punteggio ridotto e con limite giornaliero

## 6. Tornei

- [ ] Creazione del torneo riservata all'amministratore
- [ ] Richiesta di partecipazione degli utenti e approvazione dell'amministratore
- [ ] Tabellone a eliminazione diretta
- [ ] Risultati degli scontri e premio in punti al vincitore

## 7. Comunicazione

- [ ] Chat di stanza e messaggi rapidi in partita (testo, con filtro parole)
- [ ] Notifiche in gioco per richieste e tornei
- [ ] Profilo pubblico visitabile e titoli ottenuti
- [ ] Stagioni ranked con reset morbido e premio di fine stagione
- [ ] Tre missioni giornaliere validate dal server

## 8. Regole

- [ ] `docs/REGOLE_ONLINE.md` con regole, punteggi e penalità

## 9. Mobile e iOS

- [x] Comandi a schermo: leva virtuale e tre tasti (`js/Touch.js`)
- [x] Layout per schermi stretti (`css/style.css`, blocchi `@media`)
- [x] App Android in `android/` con WebView e cache svuotata a ogni build
- [ ] Installabile da browser (manifest + service worker + icone)
- [ ] Cancellazione dell'account dentro il gioco (obbligatoria per l'App Store)
- [ ] Informativa sulla privacy raggiungibile dal gioco

## 10. Messa online

- [ ] Caddy/nginx con HTTPS e WebSocket (in parte già presente)
- [ ] `dati/runtime/` negata al web (fatta lato server: 404 sulle cartelle nascoste)
- [ ] Backup giornaliero dello stato
- [ ] Istruzioni di installazione aggiornate

## Controlli

```bash
node --check server/server.js server/dati.js server/account.js server/api.js
node tools/prova_account.js      # 21 verifiche su account, sessioni, negozio
```

Ultimo esito: `21/21 verifiche passate`.
