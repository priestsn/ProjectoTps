# Sciame di bot per UVSF7

Bot che aprono **ognuno il proprio Chrome**, giocano a UVSF7 come un giocatore vero e riportano i
difetti. Serve al posto dei beta tester: nessuno deve stare lì a giocare per trovare cosa non funziona.

```
node tools/swarm/index.js --bot 4 --minuti 6 --jev        # combattimento
node tools/swarm/index.js --giro --bot 2 --account        # navigazione delle schermate
```

Due modalità: lo **sciame** fa giocare i bot (VS CPU, con o senza giudice) e misura il motore; il **giro**
apre ogni schermata informativa e verifica che si apra, che abbia un pulsante di ritorno e che Escape
riporti al menu.

Il rapporto finisce in `bug_reports/swarm-<data>/rapporto.md`, con gli screenshot dei difetti visti
accanto e il registro completo in `eventi.jsonl`.

## Come è fatto (e perché così)

| Pezzo | File | Ruolo |
|---|---|---|
| Navigatore | `tools/swarm/navigatore.js` | Un Chrome headless per bot via CDP (WebSocket di Node, **zero dipendenze**): naviga, preme tasti veri, cattura la pagina |
| Sonda | `tools/swarm/sonda.js` | Girata dentro la pagina: campiona `uvsf7Debug()`, `Player`, `Enemy`, timer e rileva le anomalie **oggettive** |
| Politica | `tools/swarm/politica.js` | Il cervello del bot: da uno stato di gioco all'azione. Puro e con seme, quindi una partita si rigioca identica |
| Giudice | `tools/swarm/giudice.js` | Jev: riceve uno screenshot + lo stato e risponde a domande tipizzate (c'è un difetto? che tipo? quanto è grave?) |
| Corridore | `tools/swarm/corridore.js` | Fa giocare N bot in parallelo e scrive gli eventi |
| Rapporto | `tools/swarm/rapporto.js` | Raggruppa per firma e categoria, scrive il Markdown |
| CLI | `tools/swarm/index.js` | Le opzioni |

**Jev non pilota il gioco.** La latenza misurata è ~0,7-2,3 s per chiamata, il gioco avanza di 60 passi al
secondo e una finestra d'impatto dura 8 passi: chi facesse decidere il modello arriverebbe sempre dopo.
Jev fa il **giudice delle immagini**, che è l'unica cosa che il codice non sa leggere. Il pilota è
`politica.js`, che costa zero e risponde in un microsecondo.

## Cosa guardano le sonde (codice puro, oggettive)

| Firma | Condizione |
|---|---|
| `eccezione` / `promessa-non-gestita` | qualsiasi errore in pagina |
| `ciclo-blocco` | meno di 20 passi in 500 ms mentre si gioca |
| `ritmo-basso` | sotto il 78% dei 60 passi/s attesi |
| `azione-persa` | comando che il gioco poteva accettare e nessuna reazione entro 450 ms |
| `colpo-senza-danno` | `attaccoHaColpito` vero e vita dell'avversario invariata |
| `valore-fuori-scala` | vita/stamina oltre il **massimo del verdellinese**, ultimate fuori 0-100 |
| `timer-negativo` / `timer-fermo` | timer che scende sotto zero o si blocca 6 s |
| `schermo-senza-uscita` | schermata informativa senza pulsante di ritorno |

## Trappole pagate (non riscoprirle)

1. **Un Chrome per bot, non N schede.** `requestAnimationFrame` non gira in una scheda in secondo piano
   e `Page.bringToFront` ne rende visibile una sola: con le schede, i bot fermi sembrano un bug del gioco.
   Con 2 Chrome headless indipendenti si misurano **60,3 passi/s ciascuno** (`--disable-background-timer-throttling`,
   `--disable-renderer-backgrounding`, `--disable-backgrounding-occluded-windows`, `--disable-features=CalculateNativeWinOcclusion`).
2. **Il solo canvas non ha l'HUD.** Barre della vita e timer sono elementi DOM: `canvas.toDataURL()` li
   perde (il primo screenshot sembrava un gioco senza interfaccia). Si cattura la **pagina intera** con
   `Page.captureScreenshot`.
3. **In menu il ciclo non avanza**: `frameGioco` cresce solo in partita, quindi prima di misurare si deve
   avviare una partita con `avviaSelezioneCPU('normale'); confermaScelta(1); confermaScelta(2);`.
4. **`frame` riparte da zero a ogni partita**: un confronto fra due campioni a cavallo del riavvio dà
   "ritmo −5548 passi/s". La sonda ignora i salti all'indietro e le partite appena cominciate.
5. **Il massimo della vita non è 100.** Ogni verdellinese ha il suo (`statistiche.vita`: Chidi 110, Ayo 85):
   controllare `<= 100` produceva un falso "valore fuori scala" su metà del roster.
6. **Il gioco rifiuta comandi di proposito**: attacco durante `FINESTRA_RECUPERO` (16 passi), parata in
   aria o senza stamina. La sonda chiede al gioco se il comando era accettabile **prima** di premerlo e
   in quel caso non segnala niente.
7. **Una parata dura ~100 ms**: il campionamento a 250 ms la salta. Mentre un'azione è in corso la sonda
   guarda ogni 30 ms.
8. **Jev va tarato o vede difetti ovunque.** Senza dirgli com'è fatto il gioco, ha descritto le due barre
   della vita come "bande nere e blu che glitchano l'interfaccia" e la scritta STAMINA come un errore.
   La costante `NORMALE` in `giudice.js` elenca cosa è normale (armi in mano, scie dei colpi, avvisi
   centrali, insegne al neon): con quella, lo stesso screenshot passa da `difetto 0,81` a `0,24`.

## Formato immagine di Jev (verificato il 20/10/2026)

Multipart con la prima parte `request` e una parte per immagine; **il segnaposto dell'asset va scritto
dentro lo `state`**, altrimenti l'API risponde `api_usage_error: Every part after the request must be
claimed by an asset`:

```js
const segnaposto = 'schermo_' + crypto.randomUUID();
const corpo = {
    model: 'jev-latest',
    state: descrizione + '\n\nImmagine da giudicare: ' + segnaposto,
    questions: DOMANDE,
    assets: { [segnaposto]: { type: 'image', part: 'immagine_1' } }
};
```

Costo misurato: **~1.300-3.400 token di ingresso per schermata** a $0,042/M → **$0,00005-0,00015 per
giudizio**. Una corsa da 4 bot per 4 minuti con un giudizio ogni 20 s costa **meno di un centesimo**.
Lo script `tools/swarm/prova_jev_immagine.js` è il test di sopravvivenza del formato: se Jev cambia
qualcosa, è quello che lo dice.

## Opzioni

| Argomento | Default | Significato |
|---|---|---|
| `--bot N` | 3 | bot in parallelo |
| `--minuti N` | 5 | durata della corsa |
| `--partite N` | 3 | partite massime per bot |
| `--jev` | spento | accende il giudice (altrimenti nessuna chiamata a pagamento) |
| `--jev-ogni N` | 12 | secondi fra due giudizi per bot |
| `--max-chiamate N` | 300 | tetto delle chiamate a Jev |
| `--porta N` | 8300 | porta del server di prova |
| `--uscita DIR` | `bug_reports` | dove scrivere rapporto e immagini |
| `--giro` | spento | modalità navigazione invece del combattimento |
| `--ripetizioni N` | 2 | quanti giri completi fa ogni bot |
| `--account` | spento | crea un account di prova e ci entra (senza, metà delle schermate rimanda al login) |

## Verifica (sempre, prima di fidarsi di un rapporto)

```bash
node tools/prova_swarm_politica.js     # 17 verifiche: le decisioni del bot, senza browser
node tools/prova_swarm_sonda.js        # 19 verifiche: le sonde presenti e non invasive
node tools/prova_swarm_giudice.js      # 13 verifiche: domande di Jev, soglie, scarti
node tools/prova_swarm_rapporto.js     # 18 verifiche: raggruppamento e Markdown
node tools/prova_swarm_sonda_viva.js   # 6 verifiche: inietta un difetto e controlla che scatti
node tools/swarm/spike_runtime.js      # 2 Chrome a 60 passi/s, tasti, cattura
```

**Uno sciame che non trova mai niente va insospettito prima di essere creduto.** `prova_swarm_sonda_viva.js`
inietta difetti veri (`Enemy.health = 9999`, thread principale occupato 1,2 s) e verifica che le sonde
scattino: senza quella prova, "nessun difetto" non significa nulla.

## Quanti bot su questo PC

Misurato: **4 bot** in parallelo con Jev, 4 minuti, 0 anomalie gravi e un solo `ritmo-basso`
(46 passi/s su un bot, contesa di CPU: 4 Chrome a 60 passi/s su 6 core si sentono). Con **2 bot** il
ritmo resta pieno. Oltre, guardare la sonda `ritmo-basso`: il numero
massimo è l'ultimo che tiene tutti i bot sopra ~55 passi/s. Non lanciare lo sciame mentre si gioca a mano
o si fa un deploy.

## Cosa non fa (per ora)

- Non gioca **online**: solo VS CPU. Il gioco a coppie nella stessa stanza (e il controllo di desync) è
  il passo successivo.
- Non apre issue GitHub: i difetti restano in `bug_reports/`.
- Non manda i report al server (`POST /report` è limitato a 20 per IP ogni 10 minuti).
