# Bug — ProjectoTps

> In questo file vengono raccolti tutti i bug incontrati durante la programmazione.

Analisi statica di `index.html`, `index.js`, `js/Classi.js`, `js/Utili.js`.
Verifiche eseguite: lettura completa del codice, confronto percorsi asset ↔ file reali in `img/`, simulazione della fisica con Node per il test del salto.

## Riepilogo

| ID | Severità | Dove | Bug |
|---|---|---|---|
| BUG-01 | Risolto | `index.js` (`case 'w'` / `case 'ArrowUp'`), `js/Classi.js:129-133` | Salto legato a un numero fisso invece che al suolo: rotto dopo il resize del canvas |
| BUG-02 | Risolto | `js/Utili.js:4` + chiamate in `index.js` e `js/Utili.js` | `determineWinner` lanciava `TypeError`: il vincitore non veniva mai mostrato |
| BUG-03 | Risolto | `index.js:21` | Lo sfondo era diviso in 5 frame e animato (`framesMax: 5`) |
| BUG-04 | Risolto | `index.js`, `js/Classi.js` | `isAttacking` aveva due fonti di verità: ora conta solo l'animazione |
| BUG-05 | Risolto | `index.js`, `js/Utili.js` | Vita/stamina fuori range: `width` CSS non valido, barre non aggiornate |
| BUG-06 | Risolto | `index.js` (`case 'j'` / `case 'à'`) | Si può parare da morti (manca il controllo `isDead`) |
| BUG-07 | Risolto | `index.js` (blocco parata dedicato) | Drenaggio stamina della parata solo da fermi e non in movimento |
| BUG-08 | Risolto | `index.js` (blocco "Condizione di fine gioco") | `determineWinner` richiamato a ogni frame dopo la morte |
| BUG-09 | Risolto | `js/Utili.js` (`decreaseTimer`) | Timer off-by-one: partiva da 59 e la prima iterazione era istantanea |
| BUG-10 | Risolto | `js/Classi.js` | `this.facing` usato in `Sprite` ma definito solo in `Lottatore`: ora sta nel costruttore di `Sprite` |
| BUG-11 | Risolto | `js/Personaggi.js`, `index.js` | Magic number (50, 200) nelle hitbox: ora ogni personaggio ha le sue misure |
| BUG-12 | Risolto | `js/Utili.js`, `js/Classi.js` | `gravity` spostata in `js/Utili.js`: nessuna dipendenza da un file caricato dopo |
| BUG-13 | Risolto | `index.js`, `js/Classi.js` | La parata è "invisibile": verificato che ora lo sprite `ParataIdle` vince su attacco e su Jump/Fall |
| BUG-14 | Risolto | `js/Classi.js` (`aggiornaAttackBox`) | `facing` unico per i due lottatori e AttackBox calcolata da `facing`, non da `lastKey` |
| BUG-15 | Risolto | `js/Keybinds.js`, `index.js` | Stato `keys.*.pressed`: ora c'e' un unico strato di input e i flag di movimento sono l'unica fonte letta dal loop |
| BUG-16 | Risolto | `index.js` | Proprietà `color` fantasma rimosse: restano solo le proprietà lette da disegno e collisioni |
| BUG-17 | Risolto | `js/Classi.js` | Hitbox di debug invisibile: ora si attivano con il tasto U |
| BUG-18 | Risolto | `index.js` | Nessun `event.repeat` / `preventDefault()`: aggiunti entrambi |
| BUG-19 | Risolto | `index.js` (`hud`) | ~10 `document.querySelector` per frame dentro il game loop |
| BUG-20 | Risolto | `index.js`, `js/Classi.js` | Lo stato di colpo subito si chiude contando i frame (`framesDanno`, 24 frame), niente `setTimeout` |
| BUG-21 | Risolto (UX) | `js/Utili.js`, `js/Classi.js`, `index.html`, `index.js` | Asset caricati uno alla volta: aggiunta la schermata di caricamento |
| BUG-22 | Risolto | `js/Classi.js` (`cambiaSprite`/`update`), `index.js` | L'animazione di morte non partiva e il lottatore morto si muoveva ancora |
| BUG-23 | Risolto | `js/Classi.js` (`cambiaSprite`/`update`), `index.js` | Dopo il primo attacco `isAttacking` restava `true`: lottatore bloccato in attacco senza animazione |
| BUG-24 | Risolto | `js/Personaggi.js` (dati `attacco`) | Hitbox verticale dell'attacco identica per tutti (`dy: 42`, `altezza: 126`): non seguiva l'arma o l'effetto del personaggio |
| BUG-25 | Risolto | `index.js` (`case 'w'`, `case 'j'`, `case 'ArrowUp'`, `case 'à'`) | Parata in salto: all'atterraggio il lottatore restava bloccato nell'animazione di salto, pur risultando in parata e consumando stamina |
| BUG-26 | Risolto | `js/Utili.js` (`decreaseTimer`) | Allo scadere del timer `gameOver` restava `false`: gli input continuavano a funzionare |
| BUG-27 | Risolto | `index.js` (game loop, blocco `gameOver`) | A fine partita il vincitore restava in loop sull'animazione di attacco o parata |
| BUG-28 | Risolto | `index.js` (`risolviImpatto`), `js/Classi.js` (`update`) | Perfect block: l'attaccante non mostrava l'animazione di danno e non restava fermo per lo stun |
| BUG-29 | Risolto | `index.js`, `js/Classi.js`, `js/CPU.js` | Attacco caricato immediato e senza drawback: ora richiede 1 secondo di carica e parte al rilascio |
| BUG-30 | Risolto | `index.js` (comandi condivisi) | La CPU restava bloccata in `TakeHit`: poteva iniziare parata/carica/ultimate durante `isTakingDmg`, ma lo sprite non poteva cambiare |
| BUG-31 | Risolto | `index.js` (`risolviImpatto`), `js/Classi.js` | Le ultimate mischia applicavano danno più volte durante lo stesso frame d'impatto |

---

## BUG-01 — [Critico] Il salto non funziona mai

**Dove:** `index.js` → `case 'w'` (`if (Player.position.y === 690 …)`) e `case 'ArrowUp'` (identico per `Enemy`).

**Causa (verificata):** la condizione confronta `position.y` con un **numero fisso** che dovrebbe valere esattamente `ground - height`. Il valore è stato aggiornato a mano da `710` a `690` dopo il ridimensionamento del canvas, ma non corrisponde all'atterraggio reale.

Misurazioni con i valori attuali (`gravity = 0.25`, `canvas.height = 850`, `height = 150`):

| | |
|---|---|
| `ground` = `canvas.height - 40` | **810** |
| posizione di riposo reale (`ground - height`) | **660** |
| valore controllato dal codice | 690 |
| `660 === 690` | **false** → il salto non parte |

Il punto chiave: il valore corretto **non è una costante indipendente**, è derivato da `canvas.height`. Con il canvas a 900 il numero coincideva per caso con `ground - height` (710) e il salto funzionava; portando il canvas a 850 il valore fisso è diventato sbagliato. Qualunque futura modifica di `canvas.height` avrebbe rotto di nuovo il salto, in silenzio e senza errori in console.

**Impatto:** `W` e `ArrowUp` non fanno saltare i lottatori. Gli stati `Jump` e `Fall` restano di fatto irraggiungibili.

**RISOLTO** — vedi la sezione "Fix applicati" in fondo al file.

---

## BUG-02 — [Critico] `determineWinner` lancia sempre `TypeError`

**Dove:** `js/Utili.js:4` `function determineWinner({ player, enemy, timerId })`, chiamata a `index.js:202` con `{ Player, Enemy, timerId }` e a `js/Utili.js:40` con `{ Player, Enemy, timerId }`.

**Causa:** i parametri si chiamano `player` / `enemy` (minuscolo) ma vengono passate le proprietà `Player` / `Enemy` (maiuscolo). Il destructuring di oggetto lavora **per nome**: dentro la funzione `player` è `undefined`, quindi `player.health` lancia:

```
TypeError: Cannot read properties of undefined (reading 'health')
```

**Impatto:** il messaggio del vincitore (`Giocatore 1 Vince!`, `Pareggio!`…) **non viene mai mostrato**. In `decreaseTimer` l'errore era nascosto dal `try/catch` e finiva solo in console; nella chiamata da `index.js` l'eccezione non era gestita e veniva rilanciata a ogni frame.

**RISOLTO** — adottata la soluzione più robusta: **parametri posizionali** al posto del destructuring, così l'accoppiamento per nome (e il rischio di confondere `Player` con `player`) sparisce del tutto.

```js
// js/Utili.js
function determineWinner(player, enemy, timerId) { ... }

// chiamate
determineWinner(Player, Enemy, timerId);
```

Contestualmente è stato rimosso il `try/catch` che mascherava l'errore e aggiunto il guard `gameOver` (BUG-08). Vedi "Fix applicati #2".

---

## BUG-03 — [Critico] Lo sfondo è tagliato in 5 frame e animato

**Dove:** `index.js:21`

```js
const background = new Sprite({ x: 0, y: 0 }, './img/Background.png', 1, 5, { x: 0, y: 0 }, );
```

**Causa:** il quarto parametro di `Sprite` è `framesMax`. Passando `5`, `Sprite.draw()` calcola `this.image.width / 5` e `animateFrames()` scorre ciclicamente i 5 frame. Un'immagine di sfondo singola viene così tagliata in 5 colonne e fatta scorrere.

**Impatto:** lo sfondo appare sfarfallato/parziale (o mostra 1/5 dell'immagine alla volta).

**Fix suggerito:** `framesMax: 1` per un'immagine statica. Nota cosmetica: c'è anche una virgola finale dopo l'ultimo argomento (`{ x: 0, y: 0 }, )`), formalmente valida in ES2017+ ma da rimuovere.

**RISOLTO** — corretto il fraintendimento: `Background.png` è un foglio di **5 frame** da 384×221, quindi va animato con la stessa logica degli sprite (`framesMax: 5`, `framesCurrent`), non tagliato a mano né fatto scorrere. La scala è calcolata sul **singolo frame** con criterio "cover" (copre larghezza e altezza del canvas), così non restano bordi vuoti. Vedi "Fix applicati #5".

> **Aggiornamento 17/10/2026:** i 5 segmenti sono **frame di animazione**, non un panorama da scorrere. L'animazione è stata ripristinata con `framesMax: 5`; lo scorrimento aggiunto per errore è stato rimosso.

---

## BUG-04 — [Alto] `isAttacking` ha due fonti di verità

**Dove:** `index.js:243` / `index.js:289`

```js
Player.isAttacking = true;
await new Promise(resolve => setTimeout(resolve, 550));
Player.isAttacking = false;
```

contro il reset a frame in `index.js:141-146`:

```js
if (Player.image === Player.sprites.Attack1.image && Player.framesCurrent === 4) { Player.isAttacking = false; }
if (Enemy.image === Enemy.sprites.Attack1.image && Enemy.framesCurrent === 3) { Enemy.isAttacking = false; }
```

**Causa:** il flag viene azzerato da due meccanismi indipendenti (tempo reale vs. avanzamento animazione). I valori 550 ms (Player) e 400 ms (Enemy) corrispondono a 5 frame × `framesHold = 10` solo se il gioco gira a **esattamente 60 fps**.

**Impatto:** su schermi a 120/144 Hz l'animazione finisce prima del timeout → l'hitbox resta attiva oltre l'animazione; con lag/cali di frame succede il contrario e l'attacco si interrompe a metà. Hitbox non deterministiche.

**Fix suggerito:** una sola fonte di verità, il frame:
```js
if (Player.image === Player.sprites.Attack1.image && Player.framesCurrent >= Player.sprites.Attack1.framesMax - 1) {
    Player.isAttacking = false;
}
```
ed eliminare `await`/`setTimeout` dall'handler `keydown`.

---

## BUG-05 — [Alto] Vita e stamina senza limiti: barre HUD non aggiornate

**Dove:** `index.js:108`, `130` (`stamina -= 0.2`), `169`, `187` (`health -= 10`), `240`, `286` (`stamina -= 20`), `js/Utili.js:29`, `33` (`stamina += 10`).

**Causa:** nessun valore viene clampato. Esempi concreti:
- parando a stamina quasi zero, `stamina` va sotto **0** (`index.js:108`) → `style.width = "-3%"`, che è CSS **non valido** e viene ignorato: la barra resta alla larghezza precedente invece di svuotarsi;
- la vita scende sotto 0 con un colpo finale → `width: -10%` → la **barra vita dell'uomo morto resta visibile/piena**;
- la rigenerazione può superare 100 (`95 + 10 = 105`) → barra al 105%.

**Impatto:** HUD che non rispecchia lo stato reale del combattimento, proprio nel momento clou (morte/parata al limite).

**Fix suggerito:** un helper di clamp, es. `Player.stamina = Math.max(0, Math.min(100, Player.stamina - 0.2));`

**RISOLTO (Fase 3)** — clamp applicato in tutti i punti di modifica: danno (`applicaDanno`), drenaggio parata, costo degli attacchi, costo extra della carica, rigenerazione in `js/Utili.js` (già limitata al massimo del personaggio).

---

## BUG-06 — [Alto] Si può parare da morti

**Dove:** `index.js:249` (`case 'j'`) e `index.js:295` (`case 'à'`).

**Causa:** tutti gli altri rami controllano `!Player.isDead` (`index.js:216`, `222`, `230`, `238`), mentre i due rami della parata no.

**Impatto:** un personaggio già morto può alzare la parata e persino bloccare i colpi (`!Enemy.isParata` è una condizione dell'hitbox, `index.js:163`).

**Fix suggerito:** aggiungere `&& !Player.isDead` / `&& !Enemy.isDead` alle due condizioni.

**RISOLTO (Fase 3)** — i due rami di parata richiedono `!isDead` e `!isStunned`; ora richiedono anche di essere **a terra**. Verificato: con `isDead = true` la parata resta `false`.

---

## BUG-07 — [Alto] Drenaggio stamina dipendente dal frame rate

**Dove:** `index.js:96-108` (Player) e `118-130` (Enemy)

```js
} else if (!Player.isParata) {
    Player.cambiaSprite('idle');
} else {
    Player.stamina -= 0.2;
}
```

**Causa 1:** il consumo è applicato **per frame**, non per tempo: a 60 fps sono 12 punti/secondo, a 144 fps **28.8 punti/secondo**.
**Causa 2:** il ramo è raggiungibile solo se non si preme nessun tasto di movimento, quindi **parare camminando non consuma stamina** (mentre lo sprite diventa `Run`, `index.js:99-104`).

**Impatto:** la meccanica di parata è sbilanciata e non riproducibile su hardware diverso.

**Fix suggerito:** introdurre un `deltaTime` (calcolato da `requestAnimationFrame`) e usare `stamina -= 12 * deltaTime`, applicando il consumo in un blocco dedicato a `isParata` invece che nel ramo "nessun movimento".

**RISOLTO PARZIALMENTE (Fase 3)** — il consumo ora sta in un blocco dedicato che gira **anche in movimento** e la stamina è clampata a 0. La dipendenza dal frame rate resta per scelta di progetto (D6: logica per frame, nessun `deltaTime`): a 60 fps sono circa 12 punti/secondo, coerente con attacchi e stun, anch'essi espressi in frame.

---

## BUG-08 — [Alto] `determineWinner` richiamato a ogni frame

**Dove:** `index.js:193-204`

**Causa:** la condizione `if (Player.health <= 0 || Enemy.health <= 0)` resta vera per tutti i frame successivi alla morte, e dentro il blocco vengono riscritti `display` e chiamato `determineWinner` ogni volta.

**Impatto:** unito a BUG-02, produceva un `TypeError` **non gestito** in console a 60 volte al secondo; il testo finale veniva ricalcolato inutilmente e il timer "fermato" di continuo.

**RISOLTO** — aggiunto il flag `gameOver`, che fa eseguire il blocco di fine partita **una sola volta** (vedi "Fix applicati #2").

---

## BUG-09 — [Medio] Timer off-by-one

**Dove:** `js/Utili.js:21-25`, avviato da `index.js:80` con `decreaseTimer();`

**Causa:** `decreaseTimer()` esegue il decremento **immediatamente** alla prima chiamata, quindi il timer parte da 59 e non da 60 come mostrato in `index.html`.

**Impatto:** la partita dura 59 secondi e il primo secondo scorre istantaneamente all'avvio.

**Fix suggerito:** usare `timerId = setInterval(...)` oppure spostare il primo decremento dentro un `setTimeout`.

**RISOLTO** — il decremento è stato spostato dentro il `setTimeout`: il primo secondo scorre dopo 1 secondo e il timer parte da 60. Vedi "Fix applicati #5".

---

## BUG-10 — [Medio] `this.facing` usato in `Sprite` ma definito solo in `Lottatore`

**Dove:** `js/Classi.js:27` `c.scale(this.facing, 1);` — `this.facing` è inizializzato solo in `js/Classi.js:69` (dentro `Lottatore`).

**Causa/Impatto:** per le istanze di `Sprite` (lo sfondo) `this.facing` è `undefined`. `c.scale(undefined, 1)` non lancia errori perché la specifica Canvas ignora la chiamata se un argomento non è un numero finito: il codice "funziona per caso". Resta un bug latente (rompe il flip orizzontale di qualunque nuovo `Sprite`).

**Fix suggerito:** spostare `this.facing = 1;` nel costruttore di `Sprite`.

---

## BUG-11 — [Medio] Magic number duplicati nelle hitbox

**Dove:** `index.js:159-162` e `index.js:177-180` (`Enemy.position.x + 50`, `+ 200`).

**Causa:** le dimensioni dei lottatori (`width = 50`, `AttackBox.width = 200`) esistono come proprietà nelle classi ma vengono **ripetute a mano** nei controlli di collisione.

**Impatto:** cambiando `scale`, `width` o le dimensioni del canvas le hitbox di collisione diventano scorrette **senza errori visibili**.

**Fix suggerito:** usare i valori reali — `Enemy.position.x + Enemy.width`, `Player.AttackBox.position.x + Player.AttackBox.width`.

> **Nota:** la parte sulle quote del suolo (magic number `710` / `40`) è stata risolta con la costante `ground` — vedi "Fix applicati".

---

## BUG-12 — [Medio] `gravity` definita in `index.js`, usata in `Classi.js`

**Dove:** dichiarata a `index.js:16`, utilizzata a `js/Classi.js:135` (`this.velocity.y += gravity;`).

**Causa/Impatto:** `Classi.js` viene caricato **prima** di `index.js` (ordine negli script di `index.html`) e dipende da una costante definita dopo. Funziona solo grazie allo scope globale delle variabili `const` di script classici e perché `update()` viene chiamata a runtime. È una dipendenza nascosta: spostando `const gravity` dentro una funzione o usando i moduli ES, il gioco si rompe con `ReferenceError`.

**RISOLTO (Fix #12)** — `const gravity = 0.25` sta in `js/Utili.js`, caricato per primo: `js/Classi.js` la trova sempre. Verificato: `typeof gravity` è `number` e il gioco anima senza errori.

---

## BUG-13 — [Medio] La parata è "invisibile" in due casi

**Dove:** `index.js:111-117` / `124-130` (Jump/Fall), `index.js:237-262` (attacco → parata).

**Causa:** `isParata` viene impostato al `keydown`, ma lo sprite `ParataIdle` è applicato **solo lì**. Poi:
1. se il giocatore è a mezz'aria, il loop sovrascrive lo sprite con `Jump`/`Fall` (`index.js:111-117`);
2. se si preme parata durante un attacco, `cambiaSprite('ParataIdle')` esce subito in `js/Classi.js:88-90` (l'animazione `Attack1` non è finita) → lo sprite resta `Attack1`.

**Impatto:** lo stato logico (`isParata = true`, i danni sono bloccati) e la grafica non coincidono: si blocca senza mostrare il blocco, quindi l'avversario non capisce perché il colpo non va a segno.

**RISOLTO (Fix #12)** — verificato che `iniziaParata()` annulla l'attacco prima di cambiare sprite (`isAttacking = false`) e che la parata si può avviare solo da terra (BUG-25): premendo parata durante `Attack1` lo sprite passa subito a `ParataIdle` con `isAttacking` a `false`.

---

## BUG-14 — [Medio] Facing di Enemy invertito e AttackBox non aggiornata

**Dove:** `index.js:104` (`Player.facing = 1` → destra) vs `index.js:127` (`Enemy.facing = -1` → destra); `js/Classi.js:105` usa `lastKey`.

**Causa/Impatto:**
- La convenzione è opposta tra i due lottatori (`+1` = destra per Player, `-1` = destra per Enemy): non è un bug se gli sprite di Enemy sono disegnati speculari, ma è una **trappola** che porterà a errori appena si aggiunge un personaggio. Va documentata con un commento.
- `Enemy.lastKey` è aggiornato **solo** dai tasti di movimento (`index.js:271`, `278`), mai da `ù`/`à`. Se il nemico non si è mai mosso, `lastKey` resta `'ArrowRight'` (impostato a `index.js:66`) e la direzione dell'`AttackBox` è decisa da uno stato vecchio/stantio, non dalla direzione attuale.

**RISOLTO (Fix #12)** — `aggiornaAttackBox()` usa `this.facing` per entrambi i lottatori e la convenzione è documentata nel costruttore di `Lottatore`. Verificato: con `facing = 1` l'area parte a destra del centro del corpo, con `facing = -1` a sinistra.

---

## BUG-15 — [Basso] Stato `keys` in gran parte codice morto

**Dove:** `keys.h.pressed`, `keys.j.pressed`, `keys.ù.pressed`, `keys.à.pressed` — scritti a `index.js:241-242`, `251`, `285-286`, `297-298` ma **mai letti** nel game loop (che usa solo `Player.isAttacking` / `isParata`).

**Impatto:** stato duplicato che induce in errore (sembra che il loop controlli i tasti di attacco, ma non lo fa) e che diventerà incoerente alla prima modifica.

**RISOLTO (Fix #11)** — con i keybinds l'input passa da un unico strato (`azioneDaTasto` / `premiAzione`): i soli flag letti dal game loop sono quelli di movimento (`keys.a`, `keys.d`, `keys.ArrowLeft`, `keys.ArrowRight`), scritti in un punto solo. Attacco, parata e ultimate non usano più flag duplicati ma i comandi condivisi (`iniziaCarica`, `rilasciaCarica`, `iniziaParata`, `finisciParata`, `attivaUltimate`).

**Fix suggerito:** rimuoverli da `keys` o usarli come unica fonte di verità per attacco/parata.

---

## BUG-16 — [Basso] Proprietà `color` fantasma

**Dove:** `index.js:259`, `305`, `326`, `340` — `Player.color = 'blue'` / `Enemy.color = 'green'`.

**Impatto:** nessuna classe definisce `color` e nessuno la legge: codice morto che suggerisce un feedback visivo mai implementato.

**RISOLTO (Fix #12)** — le assegnazioni sono sparite nelle riscritture del game loop; un `grep` su `Player.color` / `Enemy.color` non trova più nulla.

---

## BUG-17 — [Basso] Hitbox di debug invisibile

**Dove:** `js/Classi.js:99-110`

```js
c.fillStyle = 'transparent';
...
c.fillRect(this.AttackBox.position.x, this.AttackBox.position.y - 100, this.AttackBox.width, this.AttackBox.height);
```

**Impatto:** il rettangolo viene disegnato **trasparente**, quindi è invisibile: il debug delle hitbox non funziona. In compenso il calcolo della posizione dell'`AttackBox` è corretto e viene riusato dalle collisioni.

**Fix suggerito:** per il debug usare un colore con alpha, es. `c.fillStyle = 'rgba(255,0,0,0.3)'`.

**RISOLTO** — con il tasto **U** si attivano i riquadri di collisione: corpo in blu, area di attacco in rosso, più un pannello con personaggio, frame corrente e stati. Il riquadro dell'attacco ora viene disegnato nella posizione esatta usata dalle collisioni (prima era spostato di -100 px, dettaglio che non si notava perché invisibile).

Il calcolo della posizione dell'`AttackBox` è stato separato dal disegno (`aggiornaAttackBox`): le collisioni continuano a funzionare anche con il debug spento.

---

## BUG-18 — [Basso] Handler tastiera senza `repeat` / `preventDefault`

**Dove:** `index.js:210` (`keydown`) e `index.js:313` (`keyup`).

**Causa/Impatto:**
- le `ArrowUp/Left/Right` non chiamano `event.preventDefault()`, quindi **la pagina scrolla** mentre si gioca;
- non si controlla `event.repeat`: tenendo premuto un tasto, il browser genera `keydown` ripetuti. Per `a`/`d` è innocuo, ma per `h`/`ù` tali eventi vengono serializzati dall'`await` (BUG-04) e per `w`/`ArrowUp` si tenta il salto più volte.

**RISOLTO (Fix #11)** — `event.repeat` viene ignorato in testa all'handler e le frecce (più la barra spaziatrice) ricevono `preventDefault()` durante la partita: la pagina non scorre più.

---

## BUG-19 — [Basso] `querySelector` a ogni frame

**Dove:** `index.js:154-155`, `170`, `188`, `201`, più le query in `js/Utili.js`.

**Impatto:** ~6-10 ricerche nel DOM per ogni frame (≈ 360-600/secondo): lavoro inutile nel loop di gioco. Non è un bug funziona

**RISOLTO (Fase 3)** — aggiunto l'oggetto `hud` in `index.js` con tutti i riferimenti alle barre e a `#displayText`; il game loop non esegue più `querySelector`. `js/Utili.js` continua a interrogare il DOM solo una volta al secondo per il timer.le ma abbassa le prestazioni e la leggibilità.

**Fix suggerito:** memorizzare i riferimenti una volta sola all'avvio (es. `const timerEl = document.querySelector('#timer')`).

---

## BUG-20 — [Basso] `setTimeout` su `isTakingDmg` non tracciati

**Dove:** `index.js:171` e `index.js:189`

```js
setTimeout(() => { Enemy.isTakingDmg = false; }, 400);
```

**Causa:** ogni colpo crea un timer indipendente. Due timer su un intervallo vicino producono scritture concorrenti sullo stesso flag.

**Impatto:** `isTakingDmg` può essere azzerato dal timer del colpo precedente mentre è ancora in corso l'animazione di `TakeHit`; inoltre il flag non viene mai pulito in modo deterministico.

**RISOLTO (Fix #12)** — nuovo contatore `framesDanno` sul lottatore: `applicaDanno()` lo azzera a ogni colpo e `aggiornaMeccaniche()` lo incrementa, chiudendo `isTakingDmg` a `DANNO_FRAMI` (24 frame, cioè i 400 ms di prima). Due colpi ravvicinati non si cancellano più lo stato a vicenda. Verificato: 10 frame → ancora in danno, 30 frame → tornato normale.

---

## BUG-21 — [Alto] Asset caricati uno alla volta, manca la schermata di caricamento

**RISOLTO** — schermata di caricamento implementata seguendo i 3 passi qui sotto, con una differenza importante: il flag `loaded` ora vive **sull'immagine** (`this.image.loaded`) invece che sullo `Sprite`. Così segue automaticamente lo sprite attivo e risolve anche il bug latente dell'invisibilità descritto sotto. Vedi "Fix applicati #3".

**Dove:** `js/Classi.js:9-15` (`Sprite`), `js/Classi.js:88-92` (`Lottatore`), avvio del gioco a `index.js:85` (`decreaseTimer()`) e `index.js:211` (`animate()`).

**Sintomo osservato:** all'avvio i personaggi e lo sfondo compaiono **uno alla volta**, in ordine variabile, invece di apparire tutti insieme.

**Causa:** ogni immagine viene creata con `new Image()` + assegnazione di `src`, operazione **asincrona**. Il gioco però parte subito:

```js
// js/Classi.js — Sprite
this.image = new Image();
this.loaded = false;
this.image.onload = () => { this.loaded = true; };
this.image.src = imageSrc;

// js/Classi.js — Lottatore: gli sprite degli stati NON hanno onload
for (const sprite in this.sprites) {
    this.sprites[sprite].image = new Image();
    this.sprites[sprite].image.src = this.sprites[sprite].imageSrc;
}
```

Nessuno aspetta: `animate()` viene chiamata immediatamente e `Sprite.draw()` disegna **solo se** `this.loaded` è vero. Ogni elemento appare quindi nell'istante in cui il suo file finisce di scaricarsi, da cui l'effetto "uno alla volta".

**Aggravante (bug latente collegato):** `this.loaded` è aggiornato **solo dall'immagine di base**, non dagli sprite degli stati. Quando `cambiaSprite()` sostituisce `this.image` con, ad esempio, `Run.png`, `loaded` resta `true` ma l'immagine nuova potrebbe non essere ancora pronta: `drawImage` con un'immagine incompleta **non disegna nulla** (nessun errore in console). Il lottatore può quindi risultare **invisibile per qualche frame** quando si muove o salta.

**Impatto:** i primi secondi di gioco sono incompleti/instabili e un asset lento rende il personaggio invisibile a intermittenza.

**Fix proposto (3 passi):**

1. **Tracciare ogni immagine creata** con un unico helper, invece di contare a mano.
   ```js
   // js/Utili.js — caricato per primo, quindi disponibile a tutti
   const immaginiDaCaricare = [];   // tutte le Image del gioco

   function creaImmagine(imageSrc) {
       const img = new Image();
       img.loaded = false;
       img.onload = () => { img.loaded = true; };
       img.src = imageSrc;
       immaginiDaCaricare.push(img);
       return img;
   }
   ```
   e usarlo sia in `Sprite` (`this.image = creaImmagine(imageSrc)`) sia nel ciclo degli sprite in `Lottatore`.

2. **Aspettare tutte le immagini** prima di avviare il gioco. `img.complete` evita di perdere i file già in cache, e i gestori `error` sono indispensabili: senza di essi **un singolo asset mancante blocca il gioco per sempre**.
   ```js
   function attendiCaricamento() {
       const attese = immaginiDaCaricare.map(img => {
           if (img.complete) return Promise.resolve();
           return new Promise(resolve => {
               img.addEventListener('load', resolve, { once: true });
               img.addEventListener('error', resolve, { once: true });
           });
       });
       return Promise.all(attese);
   }
   ```

3. **Schermata di caricamento in `index.html`** (overlay semplice) e avvio del gioco solo alla fine.
   ```html
   <div id="loadingScreen" style="position:absolute; inset:0; background:black; color:white;
        display:flex; align-items:center; justify-content:center; font-size:40px; z-index:30;">
       Caricamento…
   </div>
   ```
   ```js
   // js/Utili.js — il gioco parte solo quando TUTTO è pronto
   attendiCaricamento().then(() => {
       document.querySelector('#loadingScreen').style.display = 'none';
       decreaseTimer();   // il timer NON deve scorrere durante il caricamento
       animate();
   });
   ```

**Punti importanti:**
- L'invocazione `animate()` a `index.js:211` va **rimossa** dal punto attuale e spostata dentro il `.then()`.
- Anche `decreaseTimer()` (`index.js:85`) va spostata: oggi partirebbe durante il caricamento, bruciando i primi secondi di partita.
- Tenere il `Promise.all` dentro una funzione (o su `window.onload`) evita di dipendere dall'ordine di caricamento degli script.
- Con un contatore si può mostrare l'avanzamento, es. `Caricamento… 7/19`.

**Cosa testare:**
1. Ricaricare con la cache svuotata (DevTools → Disable cache): la schermata di caricamento deve restare finché non compare **tutto insieme**, sfondo compreso.
2. Il timer deve partire da 60 **dopo** la chiusura della schermata, non durante il caricamento.
3. Rinominare temporaneamente un asset per simulare un 404: il gioco deve comunque avviarsi (non restare bloccato sulla schermata di caricamento).
4. Muoversi e saltare subito dopo l'avvio: il personaggio non deve mai sparire durante il cambio di sprite.

---

## BUG-22 — [Alto] L'animazione di morte non partiva e il lottatore morto si muoveva ancora

**Sintomo osservato:** uccidendo il nemico, l'animazione di morte non partiva (il lottatore restava in piedi) e si poteva continuare a muoverlo.

**Dove:** `js/Classi.js` (`cambiaSprite`, `update`), `index.js` (blocchi di movimento, handler `keydown`).

**Causa (riprodotta):** i due sintomi hanno la stessa radice. Il colpo mortale applica **prima** `TakeHit` e **nello stesso frame** il blocco di fine partita chiede `Death`:

```js
// index.js — rilevamento collisione (eseguito per primo)
Enemy.cambiaSprite('TakeHit');   // -> image = TakeHit, framesCurrent = 0
Enemy.health -= 10;

// index.js — blocco di fine partita (stesso frame, subito dopo)
Enemy.cambiaSprite('Death');     // -> SCARTATO dal guard su TakeHit
```

Dentro `cambiaSprite` i guard di `Attack1` e `TakeHit` eseguono `return` finché la loro animazione non è finita:

```js
if (this.image === this.sprites.TakeHit.image && this.framesCurrent < this.sprites.TakeHit.framesMax - 1) {
    return;   // framesCurrent = 0 < 2 -> la morte viene ignorata
}
```

Conseguenza a catena:
1. lo sprite `Death` non viene mai applicato;
2. `isDead` viene impostato **solo** nel ramo `Death` di `cambiaSprite` (`js/Classi.js`), quindi resta `false` per sempre;
3. i tasti di movimento non sono più bloccati (il `keydown` controlla `!Enemy.isDead`) e il blocco di movimento in `animate()` non sapeva nulla della fine partita → **il lottatore morto continua a muoversi**;
4. dopo qualche frame l'animazione `TakeHit` finisce e il lottatore torna in `idle`: sembra vivo con vita 0.

**Misurazione del bug (prima del fix):**

| Controllo | Prima |
|---|---|
| Animazione di morte avviata | **false** |
| Sprite dopo 30 frame | `idle`/`TakeHit` (mai `Death`) |
| `isDead` | **false** |
| Spostamento con tasto premuto | **60 px** (12 frame × 5) |

**RISOLTO** con tre modifiche coordinate:

1. **`cambiaSprite` — la morte ha priorità.** Il controllo sullo sprite `Death` è stato spostato in cima (una volta avviata la morte lo sprite non cambia più) e i guard di `Attack1`/`TakeHit` vengono saltati quando la richiesta è proprio `Death`:
   ```js
   if (sprite !== 'Death') {
       // ...guard di Attack1 e TakeHit...
   }
   ```
   È l'eccezione minima necessaria: attacco e colpo subito restano non interrompibili, **tranne** dalla morte.

2. **`update` — la morte si completa da sola.** `isDead` non dipende più da chi chiama `cambiaSprite`, ma dall'avanzamento reale dell'animazione:
   ```js
   if (this.image === this.sprites.Death.image && this.framesCurrent === this.sprites.Death.framesMax - 1) {
       this.isDead = true;
   }
   ```
   Così l'animazione arriva fino in fondo e si **ferma** sull'ultimo disegno (senza ripartire da capo).

3. **Movimento e input bloccati a partita finita.** I due blocchi di movimento in `animate()` sono racchiusi in `if (!gameOver)` e l'handler `keydown` esce subito con `if (gameOver) return;`. Il secondo è necessario perché durante l'animazione di morte (≈1,2 s) `isDead` è ancora `false`: senza il guard, un tasto poteva far **saltare o attaccare** il lottatore già morto. Le tastiere vengono comunque rilasciate correttamente dal `keyup`.

**Verifiche eseguite (test di riproduzione con DOM simulato in Node):**

| Controllo | Dopo il fix |
|---|---|
| Animazione di morte avviata | **true** |
| Sprite finale | `Death` |
| Spostamento nei 30 frame dopo la morte | **0 px** |
| Salto tentato durante l'animazione (`velocity.y`) | **0** (input ignorato) |
| `isDead` a fine animazione | **true** |
| Animazione ferma sull'ultimo frame | 6/6, nessun loop |

**Nota su un residuo impercettibile:** al momento esatto della morte resta **1 solo frame** di movimento (5 px), perché in `animate()` il movimento viene processato prima del rilevamento di fine partita che imposta `gameOver`. Si può azzerare aggiungendo `Player.health > 0` alle condizioni di movimento, ma è impercettibile (0,3% della larghezza del canvas).

**Da confermare con un test manuale:** se a partita finita si preferisce lasciare **mobile il vincitore** (oggi è congelato anche lui), basta cambiare il guard dei blocchi di movimento da `!gameOver` a una condizione sul solo lottatore morto.

---

## BUG-23 — [Alto] Dopo il primo attacco il lottatore resta bloccato in attacco

**Dove:** `index.js` (blocco del movimento verticale e `aggiornaFineAttacco`), `js/Classi.js` (`cambiaSprite`).

**Causa:** in `animate()` l'ordine era:

1. movimento orizzontale e verticale → `cambiaSprite('Jump')` / `cambiaSprite('Fall')`;
2. `aggiornaFineAttacco()` → chiudeva l'attacco solo se `lottatore.image === Attack1.image`.

Il guard di `cambiaSprite` era basato sul frame corrente (`framesCurrent < framesMax - 1`): quando l'animazione raggiungeva **l'ultimo frame** il guard lasciava passare `Fall`, che sostituiva `Attack1` **prima** che `aggiornaFineAttacco` potesse vedere l'ultimo frame. `isAttacking` restava quindi `true` per sempre: visivamente il lottatore tornava in `idle`, ma ogni attacco successivo veniva rifiutato dal controllo `!Player.isAttacking` nell'handler di `h` / `ù`. Lo stesso accadeva se il lottatore veniva colpito durante l'attacco, perché `TakeHit` sostituiva `Attack1`.

**Riproduzione (browser, partita appena avviata):** attacco durante la caduta iniziale. Stato letto frame per frame:

| Campione | `framesMax` | `framesCurrent` | `isAttacking` |
|---|---|---|---|
| durante l'attacco | 7 (`Attack1`) | 0 → 4 | `true` |
| subito dopo | 3 (`Fall`) | 0 | **`true`** |
| dopo l'atterraggio | 11 (`idle`) | 0 → 1 | **`true`** |

**Impatto:** dopo il primo colpo il personaggio non può più attaccare (e `Attack1` non viene mai più mostrato).

**RISOLTO** con quattro modifiche coordinate:

1. **Fine attacco dentro il lottatore.** `Lottatore.update()` chiude l'attacco quando ha appena disegnato l'ultimo frame di `Attack1`; `index.js` non ha più il compito di indovinare lo stato.
2. **Guard sul flag, non sul frame.** In `cambiaSprite` un attacco in corso non può essere sostituito da `Jump`/`Fall`/`idle`; solo `TakeHit` (colpo subito) e `Death` lo interrompono e azzerano `isAttacking`.
3. **Riavvio pulito.** Se si richiede `Attack1` mentre l'immagine è già quella dell'attacco, `framesCurrent` e `framesElapsed` ripartono da 0: il secondo attacco non resta sull'ultimo frame.
4. **Rimozione di `aggiornaFineAttacco`** da `index.js` e delle sue due chiamate: la fine dell'attacco ha una sola fonte di verità.

**Verifica (browser):** dopo il fix due attacchi consecutivi completano l'animazione e `isAttacking` torna `false`; attacco durante la caduta, parata e colpo subito non lasciano più il flag attivo.

---

## BUG-24 — [Medio] Hitbox verticale dell'attacco identica per tutti i personaggi

**Dove:** `js/Personaggi.js`, campo `sprite.attacco` di ogni personaggio.

**Causa:** la parte orizzontale (`dx`, `larghezza`) era già stata misurata per personaggio, ma quella verticale era rimasta un valore unico copiato: `dy: 42`, `altezza: 126` per tutti. Non corrispondeva all'arma o all'effetto disegnato nel frame d'impatto.

**Misura:** per ogni foglio `attack.png` è stato letto il canale alpha dei pixel (soglia 32) nel frame d'impatto, scartando le colonne vicine al corpo (primo 50% della portata). Le coordinate sono poi state riportate in pixel di gioco con la stessa formula usata dal rendering (`px * scale - offset`).

| Personaggio | Portata misurata | `dy` prima | `altezza` prima | `dy` ora | `altezza` ora |
|---|---|---|---|---|---|
| Ousmane Diouf | 133,5 | 42 | 126 | -29 | 202 |
| Kwame Mensah | 257,8 | 42 | 126 | -54 | 242 |
| Chidi Okonkwo | 377,5 | 42 | 126 | -61 | 242 |
| Amara Diallo | 316,5 | 42 | 126 | -15 | 218 |
| Tarisai Moyo | 301,1 | 42 | 126 | -177 | 371 |
| Zuri Nkosi | 240,0 | 42 | 126 | -100 | 285 |
| Bakari Traore | 252,0 | 42 | 126 | 34 | 141 |
| Sekou Camara | 217,4 | 42 | 126 | -44 | 219 |
| Ayo Adebayo | 247,6 | 42 | 126 | 32 | 32 |

Le portate orizzontali misurate confermano i valori `dx + larghezza` già presenti (la differenza è sempre sotto i 21 px, meno di un frame di portata). **RISOLTO** aggiornando i valori verticali con quelli misurati.

---

## BUG-25 — [Alto] Parata in salto: atterraggio bloccato nell'animazione di salto

**Dove:** `index.js` — handler `keydown` (`w` / `ArrowUp`, `j` / `à`) e blocco del movimento verticale in `animate()`.

**Causa:** la parata poteva essere attivata in aria. In `animate()` il movimento verticale sovrascriveva `ParataIdle` con `Jump`/`Fall`; dopo l'atterraggio `velocity.y` vale 0, quindi né `Jump` né `Fall` venivano richiesti, e il ramo `else if (!Player.isParata) cambiaSprite('idle')` non scattava perché `isParata` era `true`. Risultato: sprite fermo sull'ultimo frame di caduta, lottatore considerato in parata e stamina in consumo.

**RISOLTO (Fase 3):**

1. La parata si può avviare **solo da terra** (`position.y + height >= ground`).
2. **Saltare annulla la parata** e rilascia il tasto di parata, così non si resta mai in parata mentre si è in aria.
3. All'atterraggio, non essendo più `isParata`, il game loop torna a `idle`.

**Verifica (frame manuali in browser):** parata premuta in aria → `isParata: false`, nessuna animazione di parata; atterraggio → sprite `idle`, stamina invariata. Parata da terra poi salto → parata annullata e salto regolare.

---

## BUG-26 — [Basso] Allo scadere del timer la partita non si fermava

**Dove:** `js/Utili.js` — ramo `else` di `decreaseTimer()`.

**Causa:** allo scadere del tempo veniva mostrato il risultato con `determineWinner`, ma `gameOver` restava `false`: i lottatori continuavano a muoversi e ad attaccare.

**RISOLTO (Fase 3)** — `gameOver = true` prima di mostrare il vincitore.

---

## BUG-27 — [Alto] A fine partita il vincitore resta in loop di attacco

**Dove:** `index.js`, blocco di fine gioco e animazioni in `animate()`.

**Causa:** quando `gameOver` diventa `true`, i blocchi di movimento vengono saltati. Se il vincitore era a metà di un attacco o di una parata, `Lottatore.update()` continuava ad animare i frame e, una volta finita l'azione, nessuno riportava lo sprite a `idle`: l'animazione di `Attack1` o `ParataIdle` continuava a ciclare.

**RISOLTO** — nel game loop, quando `gameOver` è `true`, per ogni lottatore vivo si azzerano stun, carica e parata e, appena l'azione corrente è finita, si torna a `idle`. Il morente mantiene la sua animazione `Death`.

**Verifica:** partita chiusa mentre il vincitore attacca → dopo 150 frame il vincitore è in `idle`, `isAttacking` è `false`; il perdente è `isDead` con sprite `Death`.

---

## BUG-28 — [Medio] Perfect block: l'attaccante non mostrava l'animazione di danno

**Dove:** `index.js` (`risolviImpatto`), `js/Classi.js` (`Lottatore.update`).

**Causa:** il perfect block chiamava `stunna(attaccante)` ma non cambiava lo sprite dell'attaccante: dopo l'attacco tornava subito in `idle`, senza alcuna resa visiva dello stun. Inoltre l'animazione `TakeHit` ciclava e non restava visibile per tutta la durata dello stun.

**RISOLTO:**

1. Dopo lo stun l'attaccante passa a `TakeHit`.
2. `Lottatore.update()` ferma l'animazione `TakeHit` sull'ultimo frame finché `isStunned` è attivo: l'animazione di danno resta visibile per **1 secondo**.
3. Alla fine dello stun si torna regolarmente in `idle`.

**Verifica:** la CPU para al frame perfetto un attacco del giocatore → il giocatore resta a vita piena, viene stunnato, mostra `TakeHit` e dopo 60 frame torna `idle`; il difensore non subisce danno.

---

## BUG-29 — [Medio] Attacco caricato immediato e senza drawback

**Dove:** `index.js` (comandi condivisi e game loop), `js/Classi.js`, `js/CPU.js`.

**Causa:** l'attacco partiva subito alla pressione del tasto e diventava caricato dopo soli 10 frame se il tasto restava premuto: non c'era una vera attesa e nessun rischio.

**RISOLTO — nuova carica a rilascio:**

- `H` / `Ù` iniziano la **carica**, non l'attacco.
- La carica dura **60 frame (1 secondo)**; la barra sopra il lottatore mostra l'avanzamento e l'etichetta `CARICATO`.
- Al **rilascio** parte il colpo: normale se la carica è incompleta, caricato se completa (rompe la parata e stunna 1 s).
- Durante la carica non si può **muovere, saltare, parare o usare l'ultimate**: è il drawback.
- Costo stamina: base per l'attacco normale, **1,5x** per il caricato.
- La CPU carica a sua volta per 1 secondo e rilascia; la probabilità di usare il caricato è stata ridotta (0,05 / 0,25 / 0,45).

**Verifica:** 30 e 60 frame di carica non fanno partire l'attacco; il rilascio dopo 60 frame imposta `attaccoCaricato` e scala 1,5x la stamina; il tap breve fa un attacco normale; il movimento resta bloccato durante la carica.

---

## BUG-30 — [Alto] La CPU resta bloccata in `TakeHit`

**Dove:** `index.js`, comandi condivisi (`salta`, `iniziaCarica`, `iniziaParata`, `eseguiAttacco`, `attivaUltimate`).

**Causa:** durante `isTakingDmg` il cambio sprite è vietato dal guard di `cambiaSprite` (serve a non interrompere `TakeHit`). La CPU però poteva avviare una **parata**, una **carica** o l'**ultimate** in quella finestra: lo stato cambiava (`isParata` / `isCaricando` / `isAttacking`) ma lo sprite restava `TakeHit`. Con `isParata` attivo il ramo `idle` del movimento non scattava più, quindi la CPU restava visivamente nell'animazione di danno.

**RISOLTO** — tutte le azioni ora richiedono `!isTakingDmg`:

- `salta`
- `iniziaCarica`
- `iniziaParata`
- `eseguiAttacco`
- `attivaUltimate`

Il lottatore completa l'animazione di colpo subito e poi torna in `idle`.

**Verifica (browser, frame manuali):** durante `TakeHit` tutte le azioni restituiscono `false`; dopo l'animazione lo sprite è `idle`. CPU colpita due volte in rapida successione: nessuna parata durante il colpo subito e recupero completo.

---

## BUG-31 — [Medio] Le ultimate mischia colpivano più volte

**Dove:** `index.js` (`risolviImpatto`), `js/Classi.js` (`Lottatore`).

**Causa:** il danno delle ultimate è forzato (`forza = true`) per colpire anche un bersaglio già in `TakeHit`. Il frame d'impatto resta attivo per `framesHold` frame e, bypassando il guard `isTakingDmg`, il danno veniva applicato a ogni frame. Esempi: Ousmane faceva 80 danni invece di 20, Chidi uccideva con una sola ultimate.

**RISOLTO** — nuovo flag `ultimateHaColpito`, resettato in `avviaAttacco()` e impostato al primo impatto; `risolviImpatto` esce se l'ultimate ha già fatto centro. Ogni ultimate mischia colpisce una sola volta per attivazione.

**Verifica:** Ousmane 20 danni, Chidi 24, Tarisai 20 + veleno; Zuri: attacco normale da 10 → 13 con marchio (+30%).

---

## Verifiche senza esito (controllate e OK)

- **Asset:** tutti i percorsi sono corretti e sensibili alla maiuscola, verificati su filesystem Linux:
  `img/Player/idle.png` (minuscolo), `img/Enemy/Idle.png` (maiuscolo), `'Take hit.png'` (con spazio), `Background.png`. Nessun file mancante o con nome sbagliato.
- **Ordine degli script** in `index.html`: `Utili.js` → `Classi.js` → `index.js`, coerente con le dipendenze (a parte il caso `gravity`, BUG-12).
- **Rilevamento collisioni:** la logica sui frame di impatto (`framesCurrent === 3` per il Player, `=== 2` per l'Enemy) è coerente con i rispettivi `framesMax` (5 e 4).

## Non ancora verificato (richiede test manuale nel browser)

- Comportamento dell'`AttackBox` per l'Enemy già girato (`facing = -1`): da confermare con un test visivo.
- Sfasamento tra `framesMax` degli sprite e le immagini reali (es. `idle` Player dichiarato 8 frame).
- La parata resta poco testabile finché BUG-02 non è risolto.

---

# Fix applicati

## Fix #1 — Costante `ground` e salto robusto (BUG-01) — 16/10/2026

**Obiettivo:** eliminare i valori fissi legati al suolo e rendere il salto indipendente dalle dimensioni del canvas.

**Modifiche:**

1. `index.js` — nuova costante accanto a `gravity`:
   ```js
   // y della superficie del suolo: i piedi dei lottatori poggiano qui.
   // 40 = margine di terreno lasciato sotto i piedi.
   // I piedi corrispondono a (position.y + height), cioè la base della hitbox.
   const ground = canvas.height - 40;
   ```

2. `js/Classi.js` (già usata in `Lottatore.update()`) — sostituito `canvas.height - 40` con `ground` e il clamp verticale `canvas.height - this.height` con `ground - this.height`:
   ```js
   // Clamp posizione verticale: i piedi non scendono sotto il suolo.
   this.position.y = Math.max(0, Math.min(ground - this.height, this.position.y));

   // Applica gravità: si azzera quando i piedi raggiungono il suolo
   if (this.position.y + this.height + this.velocity.y >= ground) {
       this.velocity.y = 0;
   } else {
       this.velocity.y += gravity;
   }
   ```
   Il clamp verticale ora usa la stessa quota del suolo: l'atterraggio avviene sempre esattamente a `ground - height`, quindi la posizione di riposo è **deterministica**.

3. `index.js` — condizione di salto basata sul contatto dei piedi invece che su un numero fisso:
   ```js
   case 'w':
       // Salta solo se i piedi sono appoggiati al suolo (niente doppio salto)
       if (Player.position.y + Player.height >= ground && !Player.isDead) {
           Player.velocity.y = -10;
       }
       break;
   ```
   (identico per `Enemy` in `case 'ArrowUp'`)

**Verifiche eseguite:**

- `node --check` su `index.js`, `js/Classi.js`, `js/Utili.js` → nessun errore di sintassi.
- Simulazione della fisica con i valori attuali (`gravity = 0.25`, `canvas.height = 850`, `height = 150`):

  | Condizione | Risultato |
  |---|---|
  | `ground` | 810 |
  | posizione di riposo `ground - height` | **660** |
  | dopo 1 salto -> riposo | 660 (può risaltare) |
  | dopo 2 salti -> riposo | 660 (può risaltare) |
  | a mezz'aria (y = 500, piedi a 650 < 810) | non può saltare |

**Cosa testare a mano nel browser:**
1. `A`/`D` per muoversi, `W` per saltare — il salto deve partire a ogni pressione quando si è a terra.
2. Tenere premuto `W` durante il salto: **non** deve esserci un doppio salto.
3. Ripetere con il secondo giocatore (`←`/`→` per muoversi, `↑` per saltare).
4. Controllare che gli sprite `Jump` (in salita) e `Fall` (in discesa) vengano mostrati correttamente.

---

## Fix #2 — Decisione del vincitore (BUG-02 + BUG-08) — 16/10/2026

**Obiettivo:** far apparire il messaggio finale e non ricalcolarlo a ogni frame.

**Modifiche:**

1. `js/Utili.js` — `determineWinner` passa dal destructuring ai **parametri posizionali**:
   ```js
   // prima: function determineWinner({ player, enemy, timerId })
   //        chiamata con { Player, Enemy, timerId }  -> player undefined -> TypeError
   function determineWinner(player, enemy, timerId) { ... }
   ```

2. `js/Utili.js` e `index.js` — le due chiamate diventano `determineWinner(Player, Enemy, timerId);`

3. `js/Utili.js` — rimosso il `try/catch` attorno alla chiamata in `decreaseTimer`: era ciò che **nascondeva** il `TypeError`, facendolo sembrare un "vincitore che non appare" invece di un errore.

4. `index.js` — nuovo flag di stato e guard nel blocco di fine partita:
   ```js
   // Flag di fine partita: impedisce che il risultato venga ricalcolato a ogni frame
   let gameOver = false;
   ...
   // Condizione di fine gioco (eseguita una sola volta)
   if (!gameOver && (Player.health <= 0 || Enemy.health <= 0)) {
       gameOver = true;
       ...
       determineWinner(Player, Enemy, timerId);
   }
   ```

**Verifiche eseguite:** smoke test con DOM simulato in Node (i tre script eseguiti in un contesto `vm`):

| Controllo | Risultato |
|---|---|
| `Player.health = 0` / testo mostrato | `"Giocatore 2 Vince!"` |
| Frame successivo (con `Enemy.health = 0`) | testo **invariato** (guard `gameOver` attivo) |
| Errori a runtime | nessuno |

**Cosa testare a mano nel browser:**
1. Lasciar scadere il timer a 0: deve comparire `Pareggio!` / `Giocatore X Vince!`.
2. Azzerare la vita di un giocatore: deve comparire il nome del vincitore.
3. Console del browser (F12): **nessun** `TypeError`.

---

## Fix #3 — Schermata di caricamento (BUG-21) — 16/10/2026

**Obiettivo:** non far partire il gioco finché tutti gli asset non sono pronti, ed eliminare l'effetto "uno alla volta".

**Modifiche:**

1. `js/Utili.js` — nuove funzioni (caricato per primo, quindi disponibili a tutti):
   - `creaImmagine(imageSrc)`: crea l'`Image`, la registra in `immaginiDaCaricare` e traccia il caricamento su `img.loaded`. Su `error` **prosegue** invece di bloccare (`console.error`).
   - `aggiornaSchermataCaricamento()`: aggiorna il contatore `Caricamento… x/y`.
   - `avviaGiocoQuandoPronto(callback)`: `Promise.all` su tutte le immagini (con `img.complete` per quelle in cache e gestori sia `load` sia `error`) e avvia il gioco solo alla fine.

2. `js/Classi.js`:
   - `Sprite`: `this.image = creaImmagine(imageSrc)` al posto di `new Image()` + onload manuale; rimosso `this.loaded`.
   - `draw()`: il controllo diventa `if (this.image.loaded)` → segue **lo sprite attivo**, quindi risolve anche il bug latente dell'invisibilità al cambio sprite.
   - `Lottatore`: il ciclo degli sprite usa `creaImmagine(...)`, così anche gli 8 stati sono tracciati.

3. `index.html` — overlay `#loadingScreen` (z-index 40) con titolo e `#loadingTesto`.

4. `index.js` — rimossi `decreaseTimer();` e `animate();` dal flusso principale; l'avvio è ora:
   ```js
   avviaGiocoQuandoPronto(() => {
       decreaseTimer();
       animate();
   });
   ```
   In questo modo **anche il timer** parte solo a caricamento concluso.

**Verifiche eseguite (smoke test Node con DOM simulato):**

| Controllo | Risultato |
|---|---|
| Asset registrati | **19** (1 sfondo + 1 base + 8 sprite per Player, 1 base + 8 sprite per Enemy) |
| Asset caricati | **19** su 19 |
| `#loadingScreen` dopo il caricamento | `display: "none"` |
| Game loop avviato | 6 frame eseguiti |
| Errori a runtime | nessuno |

**Cosa testare a mano nel browser:**
1. Ricaricare con DevTools → Network → *Disable cache*: la schermata deve restare finché non compare **tutto insieme**.
2. Il timer deve partire da 60 **dopo** la schermata di caricamento, non durante.
3. Rinominare temporaneamente un asset per simulare un 404: il gioco deve avviarsi comunque (grazie ai gestori `error`).
4. Muoversi e saltare subito dopo l'avvio: il lottatore non deve mai sparire nei cambi di sprite.

---

## Fix #4 — Animazione di morte e blocco a fine partita (BUG-22) — 16/10/2026

**Obiettivo:** far partire l'animazione di morte al momento del colpo mortale e impedire ogni interazione dopo la fine della partita.

**Modifiche:**

1. `js/Classi.js` — `cambiaSprite()`: controllo su `Death` spostato in cima e guard di `Attack1`/`TakeHit` saltati quando la richiesta è la morte:
   ```js
   // La morte ha priorità su tutto: una volta avviata, lo sprite non cambia più.
   if (this.image === this.sprites.Death.image) {
       return;
   }

   // Attacco e colpo subito non si interrompono mai... tranne che per la morte.
   if (sprite !== 'Death') {
       // ...guard di Attack1 e TakeHit...
   }
   ```

2. `js/Classi.js` — `update()`: completamento della morte indipendente dalle chiamate esterne:
   ```js
   if (this.image === this.sprites.Death.image && this.framesCurrent === this.sprites.Death.framesMax - 1) {
       this.isDead = true;
   }
   ```
   (la logica duplicata è stata rimossa da `cambiaSprite`)

3. `index.js` — i due blocchi di movimento sono racchiusi in `if (!gameOver) { ... }`.

4. `index.js` — guard in testa all'handler `keydown`:
   ```js
   if (gameOver) return;
   ```

**Verifiche eseguite:** test di riproduzione dedicato (DOM simulato in Node), che simula colpo mortale + animazione + tasto premuto.

| Controllo | Prima | Dopo |
|---|---|---|
| Animazione di morte avviata | false | **true** |
| Sprite finale | `idle` | **`Death`** |
| Spostamento nei 30 frame dopo la morte | 60 px | **0 px** |
| Salto tentato durante l'animazione | (nessuno) | **ignorato** |
| `isDead` a fine animazione | false | **true** |
| Animazione in loop | sì | **no** (ferma su 6/6) |

Lo smoke test del caricamento e della fine partita è stato rieseguito senza regressioni.

**Cosa testare a mano nel browser:**
1. Uccidere il nemico: deve partire l'animazione di morte e **restare** sull'ultimo fotogramma.
2. Continuare a tenere premuti `←`/`→` (o `A`/`D`) mentre il nemico muore: non deve più muoversi.
3. Premere `↑` (o `W`) subito dopo il colpo mortale: nessun salto.
4. Ripetere con i ruoli invertiti (Player ucciso da Enemy).

---

## Fix #5 — Fase 1: CSS esterno, stati di gioco e menu (BUG-03, BUG-09) — 16/10/2026

**Obiettivo:** chiudere i prerequisiti della Fase 1 (CSS esterno + fix rapidi) e introdurre menu e stati di gioco.

**Nuovi file:**

| File | Contenuto |
|---|---|
| `css/style.css` | Tutti gli stili, prima inline in `index.html`: HUD, barre, timer, schermate, menu |
| `js/Stato.js` | Macchina a stati: `STATI` (caricamento, menu, partita), `statoCorrente`, `cambiaStato()`, `aggiornaVisibilita()` |
| `js/Menu.js` | Menu come dati (`VOCI_MENU`), navigazione da tastiera, voci `wip`, fullscreen |

**Modifiche:**

1. `index.html` — rimosso ogni attributo `style="..."`: ora usa classi e `<link rel="stylesheet" href="css/style.css">`. Aggiunto il markup del menu (`#menu`, `#menuTitolo`, `#menuVoci`). Ordine script aggiornato: `Utili.js`, `Stato.js`, `Menu.js`, `Classi.js`, `index.js`.

2. `js/Stato.js` — un unico posto dove sapere "a che punto siamo". La visibilità di caricamento e menu è gestita dallo stato, non più a mano.

3. `js/Menu.js` — le voci sono dati; `wip: true` significa visibile ma **non selezionabile** (etichetta WIP, esclusa dalla navigazione e dal click):
   - PLAY: VS LOCALE (attivo), VS CPU (WIP), VS ONLINE (WIP)
   - SETTINGS: FULLSCREEN (attivo), KEYBINDS (WIP), INDIETRO
   Navigazione con frecce o `W`/`S`, Invio per confermare, Esc per tornare indietro. Le pressioni prolungate non fanno scorrere le voci a raffica (`event.repeat`).

4. `index.js`:
   - `animate()` esce subito se lo stato non è `partita`: il gioco **non parte più da solo**.
   - `keydown`: fuori dalla partita gli input vanno a `gestisciInputMenu(event)`.
   - nuova `avviaPartita()`: imposta lo stato `partita` e avvia il timer.
   - avvio: `aggiornaVisibilita()` mostra il caricamento; a caricamento finito si apre il menu.

5. `js/Utili.js` — `decreaseTimer()` riscritta (BUG-09) e rimossa la riga che nascondeva la schermata di caricamento: ora lo fa il cambio di stato.

**Verifiche eseguite:** test automatico con DOM e tastiera simulati (`node`), 30 controlli:

| Controllo | Esito |
|---|---|
| Stato iniziale `caricamento`, schermata visibile, menu nascosto | OK |
| A caricamento finito: stato `menu`, loading nascosto, menu visibile | OK |
| Voci del menu principale: `PLAY`, `SETTINGS` | OK |
| Navigazione circolare con frecce su e giù | OK |
| Sottomenu SETTINGS e PLAY con la voce `wip` etichettata | OK |
| La navigazione **salta** le voci WIP | OK |
| VS LOCALE avvia la partita e nasconde il menu | OK |
| Il timer resta 60 e passa a 59 dopo 1 secondo (BUG-09) | OK |
| `framesMax` dello sfondo uguale a 1 (BUG-03) | OK |
| `animate()` aggiorna solo in partita, fine partita e morte ancora funzionanti | OK |

**Cosa testare a mano nel browser** (http://localhost:3000/index.html):

1. All'apertura deve comparire la schermata di caricamento e poi il menu con `PLAY` evidenziato.
2. Frecce su/giù (o `W`/`S`) per spostare la selezione, Invio per confermare.
3. `PLAY` -> `VS CPU` e `VS ONLINE` devono avere l'etichetta WIP e non essere raggiungibili con le frecce.
4. `PLAY` -> `VS LOCALE` deve avviare la partita con il timer a 60 (non 59).
5. `SETTINGS` -> `FULLSCREEN` deve attivare lo schermo intero; `Esc` torna al menu principale.
6. Lo sfondo non deve più sfarfallare.

---

## Fix #6 — Attacco bloccato e hitbox verticali per personaggio (BUG-23, BUG-24) — 17/10/2026

**Obiettivo:** chiudere il bug che bloccava l'attacco dopo il primo colpo e rendere l'area d'attacco verticale propria di ogni personaggio.

**Modifiche:**

1. `js/Classi.js` — `Lottatore.update()` chiude l'attacco quando ha disegnato l'ultimo frame di `Attack1`:
   ```js
   if (this.isAttacking &&
       this.image === this.sprites.Attack1.image &&
       this.framesCurrent === this.sprites.Attack1.framesMax - 1) {
       this.isAttacking = false;
   }
   ```

2. `js/Classi.js` — `cambiaSprite()`:
   - un attacco in corso non viene sostituito da `Jump`/`Fall`/`idle` (guard su `isAttacking`, non sul frame);
   - `TakeHit` e `Death` azzerano `isAttacking` (il colpo subito interrompe l'attacco);
   - lo stesso `Attack1` richiesto di nuovo riparte da `framesCurrent = 0`.

3. `index.js` — rimosse `aggiornaFineAttacco()` e le sue chiamate: la fine dell'attacco ha una sola fonte di verità nel lottatore.

4. `js/Personaggi.js` — `attacco.dy` e `attacco.altezza` misurati per ogni personaggio sul frame d'impatto (prima erano `42` / `126` per tutti). Dettaglio nella sezione BUG-24.

**Verifiche eseguite (browser, gioco reale):**

| Controllo | Esito |
|---|---|
| Primo attacco completato, `isAttacking` torna `false`, sprite `idle` | OK |
| Secondo attacco immediato riparte dal frame 0 | OK |
| Attacco iniziato durante la caduta iniziale | OK, nessun blocco |
| Colpo subito durante l'attacco | `isAttacking` azzerato, `TakeHit` mostrato |
| Colpo a segno per tutti e 9 i personaggi | OK (danno pari alla statistica, a distanza ravvicinata) |
| Hitbox verticale | `dy`/`altezza` diversi per personaggio, da misura pixel |

**Cosa testare a mano nel browser** (http://localhost:8000):

1. Attaccare più volte di seguito: ogni attacco deve mostrare l'animazione completa e non bloccare il personaggio.
2. Attaccare mentre si salta o si cade: l'attacco deve partire e completarsi.
3. Farsi colpire a metà attacco: l'animazione deve interrompersi e il personaggio tornare operativo.
4. Premere `U` e attaccare con personaggi diversi: il riquadro rosso deve seguire arma o effetto (in particolare Tarisai, Zuri, Ayo e Bakari).

---

## Fix #7 — Fase 3: perfect block, ultimate, attacco caricato (BUG-05, BUG-06, BUG-07, BUG-19, BUG-25, BUG-26) — 17/10/2026

**Obiettivo:** introdurre le meccaniche di combattimento avanzate e chiudere il debito tecnico propedeutico.

**Nuove meccaniche:**

| Meccanica | Comportamento |
|---|---|
| Perfect block | Parata iniziata da al massimo 3 frame: nessun danno, attaccante stunnato 1 s (60 frame), +15 di carica ultimate, avviso "PERFECT BLOCK" |
| Attacco caricato | Tasto attacco tenuto per 10 frame durante il windup: rompe la parata, danno + stun 1 s, costo extra 50% |
| Ultimate | Barra dedicata, piena in circa 20 s, +15 per parata perfetta, -25 quando si viene stunnati; danno e nome per personaggio; tasto `G` (P1) / `L` (P2) |
| Stun | Blocca movimento, salto, attacco, parata e ultimate; gli input vengono ignorati |

**Modifiche principali:**

1. `js/Classi.js` — nuovi campi `isStunned`, `stunTimer`, `framesParata`, `ultimate`, `datiUltimate`, `attaccoCaricato`, `attaccoUltimate`, `framesAttacco`; nuovo metodo `avviaAttacco({ caricato, ultimate })`; reset dei flag a fine attacco e su `TakeHit`/`Death`.
2. `js/Personaggi.js` — `ultimate: { nome, danno }` per i 9 personaggi, passato al lottatore in `creaLottatore`.
3. `index.js` — costanti `STUN_FRAMI`, `FINESTRA_PERFETTO`, `CARICA_ATTACCO_FRAMI`, `ULTIMATE_CARICA_FRAME`, guadagno/perdita; funzioni `aggiornaMeccaniche`, `stunna`, `applicaDanno`, `risolviImpatto`, `attivaUltimate`, `mostraAvviso`, `disegnaAvviso`; HUD in cache; parata solo da terra; clamp vita/stamina; input bloccati durante lo stun.
4. `index.html` + `css/style.css` — due barre ultimate sotto la stamina.
5. `js/Utili.js` — rigenerazione stamina limitata al massimo del personaggio; `gameOver = true` allo scadere del timer.
6. `js/Selezione.js` — la scheda mostra anche stamina massima e costo dell'attacco.

**Verifiche eseguite (browser, frame manuali):**

| Controllo | Esito |
|---|---|
| Perfect block: nessun danno, +15 ultimate, attaccante stunato 60 frame | OK |
| Blocco normale (parata iniziata prima): nessun danno, nessuno stun | OK |
| Attacco caricato contro parata: danno, parata rotta, difensore stunato | OK |
| Attacco normale (tasto rilasciato): danno e costo base, nessuno stun | OK |
| Ultimate a barra piena: carica azzerata, danno proprio, barra HUD aggiornata | OK |
| Ultimate contro parata: parata rotta e danno | OK |
| Carica ultimate: +5% al secondo | OK |
| Stun: input ignorati, posizione ferma, fine dopo 60 frame | OK |
| Parata da morti | Bloccata |
| Parata in salto e atterraggio | Nessun blocco, sprite `idle`, stamina invariata |
| Clamp vita/stamina | Valori e barre mai fuori range |

**Cosa testare a mano nel browser** (http://localhost:8000):

1. Parare nell'istante dell'impatto (3 frame): avviso "PERFECT BLOCK" e avversario stunato.
2. Tenere premuto attacco per almeno 10 frame con l'avversario in parata: la parata si rompe e l'avversario resta stunato.
3. Aspettare la barra ultimate piena e premere `G` (P1) o `L` (P2): parte il colpo ultimate.
4. Attaccare e parare in salto: nessun blocco all'atterraggio.
5. Premere `U` per vedere nel pannello `ult`, `stun` e i frame di parata.

---

## Fix #8 — Bug report del 17/10/2026 (BUG-27, BUG-28, BUG-29)

**Obiettivo:** chiudere i tre bug segnalati dal pannello di report in partita.

| Bug | Correzione |
|---|---|
| BUG-27 vincitore in loop di attacco | A `gameOver`, stun/carica/parata azzerati e ritorno a `idle` appena l'azione finisce |
| BUG-28 perfect block senza resa visiva | L'attaccante passa a `TakeHit` e l'animazione resta ferma sull'ultimo frame per tutto lo stun (1 s) |
| BUG-29 attacco caricato senza drawback | Carica di 1 secondo, colpo al rilascio, movimento/salto/parata/ultimate bloccati durante la carica, costo 1,5x |

**File modificati:** `index.js`, `js/Classi.js`, `js/CPU.js`.

**Verifiche eseguite (browser, frame manuali):**

| Controllo | Esito |
|---|---|
| Carica a 30/60 frame: nessun attacco | OK |
| Rilascio dopo 60 frame: attacco caricato, stamina 1,5x | OK |
| Tap breve: attacco normale, costo base | OK |
| Movimento bloccato durante la carica | OK |
| Perfect block: attaccante `TakeHit` + stun 60 frame, difensore senza danno | OK |
| Dopo lo stun: attaccante `idle` | OK |
| Fine partita: vincitore `idle`, perdente `Death`, nessun loop | OK |
| CPU: carica 1 s, attacca al rilascio | OK |

**Cosa testare a mano:**

1. Tenere premuto `H`/`Ù` per un secondo e rilasciare: deve partire il colpo caricato, con barra e scritta `CARICATO`.
2. Rilasciare prima: attacco normale.
3. Durante la carica provare a muoversi o parare: non deve essere possibile.
4. Fare un perfect block: l'attaccante deve restare in animazione di danno per circa un secondo.
5. Uccidere l'avversario mentre si sta attaccando: il vincitore deve fermarsi in `idle`, senza loop.

---

## Fix #9 — CPU bloccata in `TakeHit` (BUG-30) — 17/10/2026

**Modifica:** aggiunto il controllo `!isTakingDmg` a `salta`, `iniziaCarica`, `iniziaParata`, `eseguiAttacco` e `attivaUltimate` in `index.js`.

**Verifiche:**

| Controllo | Esito |
|---|---|
| Parata durante `TakeHit` | Rifiutata |
| Carica durante `TakeHit` | Rifiutata |
| Attacco durante `TakeHit` | Rifiutato |
| Salto durante `TakeHit` | Rifiutato |
| Ultimate durante `TakeHit` | Rifiutata |
| Recupero dopo l'animazione | Sprite `idle` |
| CPU colpita due volte ravvicinate | Nessun blocco, recupero in `idle` |

---

## Fix #10 — Ultimate uniche e colpo singolo (BUG-31) — 17/10/2026

**Obiettivo:** rendere ogni ultimate diversa e correggere il danno multiplo delle ultimate mischia.

**Ultimate:**

| Personaggio | Tipo | Effetto |
|---|---|---|
| Ousmane | Mischia | Rallentamento (velocità -50%, animazioni +80%) per 4 s |
| Kwame | Mischia | Inversione comandi per 3 s |
| Chidi | Mischia | Congelamento per 1,5 s |
| Amara | Buff | Velocità +50%, animazioni -40% per 5 s |
| Tarisai | Mischia | Veleno: 12 danni in 4 s |
| Zuri | Mischia | Marchio: +30% danni subiti per 5 s |
| Bakari | Proiettile | Bruciatura: 14 danni + blocco rigenerazione stamina |
| Sekou | Proiettile | Silenzio: niente ultimate, stamina in calo |
| Ayo | Proiettile | Eclissi: inversione + rallentamento per 3 s |

**Modifiche:**

1. `js/Personaggi.js` — dati completi per ogni ultimate (`tipo`, `effetto`, `durata`, `colore`, `descrizione`).
2. `js/Classi.js` — campi per stati e moltiplicatori; `animateFrames` usa il moltiplicatore di velocità animazione; flag `ultimateHaColpito`.
3. `index.js` — sistema stati, proiettili disegnati sul canvas, etichette sopra i lottatori, inversion e rallentamento nel movimento, applicazione effetti, danno forzato ma una sola volta per ultimate.
4. `js/Utili.js` — la bruciatura blocca la rigenerazione stamina.
5. `js/Selezione.js` + `css/style.css` — nome e descrizione dell'ultimate nella scheda.
6. `js/CPU.js` — la CPU non agisce da congelata.

**Verifiche:**

| Controllo | Esito |
|---|---|
| Ousmane: 20 danni una sola volta + rallentamento | OK |
| Chidi: 24 danni una sola volta + congelamento | OK |
| Kwame: comandi invertiti (freccia sinistra → destra) | OK |
| Amara: buff 1,5x velocità / 0,6x animazioni | OK |
| Tarisai: veleno nel tempo | OK |
| Zuri: attacco 10 → 13 con marchio | OK |
| Bakari/Sekou/Ayo: proiettile, danno e stato | OK |
| Silenzio: ultimate nemica bloccata, stamina in calo | OK |
| Congelamento: salto/parata/carica rifiutati, nessun movimento | OK |

**Cosa testare a mano:**

1. Nella selezione leggere la descrizione dell'ultimate di ogni personaggio.
2. Provare Bakari, Sekou e Ayo a distanza: il proiettile deve viaggiare e applicare lo stato.
3. Provare Ousmane, Kwame, Chidi, Tarisai e Zuri da vicino: stato applicato al colpo.
4. Amara: attivare l'ultimate e notare movimento e attacchi più rapidi.
5. Controllare le etichette di stato sopra i lottatori.


---

## Fix #11 — Keybinds e unico strato di input (BUG-15, BUG-18) — 17/10/2026

**Obiettivo:** rendere rimappabili i tasti di entrambi i giocatori e togliere dall'handler della tastiera la catena di `switch` con i tasti scritti a mano.

**Nuovo file:** `js/Keybinds.js` (caricato subito dopo `js/Stato.js`).

**Come funziona:**

| Passo | Chi | Cosa |
|---|---|---|
| 1 | `keydown` in `index.js` | calcola il tasto normalizzato e chiama `azioneDaTasto(key)` |
| 2 | `azioneDaTasto()` | cerca il tasto nella configurazione: restituisce `{ giocatore, azione }` oppure `null` |
| 3 | `premiAzione()` | esegue l'azione: scrittura dei flag di movimento o chiamata ai comandi condivisi del gioco |
| 4 | VS ONLINE, ospite | `premiAzione()` non simula: manda `{ t: 'azione', g: 'p2', a, giu }`; l'host la esegue sul giocatore 2 |

**Dati e persistenza:**

- sei azioni per giocatore (`sinistra`, `destra`, `salto`, `attacco`, `parata`, `ultimate`);
- valori predefiniti identici ai tasti storici (`A`/`D`/`W`/`H`/`J`/`G`, frecce e `Ù`/`À`/`L`);
- salvataggio in `localStorage` sotto `uvsf7-keybinds`, ripristino dei predefiniti dalla schermata;
- un tasto già usato da un'altra azione viene **tolto** all'altra, così non esistono doppioni;
- `Esc`, `Invio`, `Tab`, `U` sono riservati (menu, pausa, debug) e vengono rifiutati con un messaggio.

**Schermata:** `SETTINGS -> KEYBINDS`, raggiungibile anche da `Esc -> IMPOSTAZIONI` in partita. Frecce su/giù (o `W`/`S`) per spostarsi, `Invio` per assegnare ("PREMI UN TASTO"), `Esc` per annullare l'assegnazione o tornare al menu di partenza. Nuovo stato `STATI.KEYBINDS` in `js/Stato.js` con la sua schermata `#keybinds`.
Gli altri input restano fissi: la conferma nella selezione (`H` / `Ù`) e la navigazione dei menu (frecce o `W`/`S`) non dipendono dai keybinds.

**Effetti collaterali positivi:**

- **BUG-18** — `event.repeat` ignorato in testa e `preventDefault()` su frecce e barra spaziatrice durante la partita: la pagina non scorre più.
- **BUG-15** — i flag `keys.*` di attacco/parata non vengono più scritti: le sole fonti sono i flag di movimento (letti dal loop) e i comandi condivisi.
- **Touch** — `js/Touch.js` non manda più eventi di tastiera: chiama `premiAzione(ruolo, azione)`, quindi i tasti virtuali funzionano anche con keybinds personalizzati.
- **VS ONLINE** — viaggia l'azione, non il tasto: ogni giocatore tiene i propri keybinds.

**Verifiche eseguite (browser, gioco reale):**

| Controllo | Esito |
|---|---|
| Schermata con 12 azioni + ripristino, gruppi Giocatore 1 / Giocatore 2 | OK |
| Assegnazione di `K` all'attacco P1: riga aggiornata, `localStorage` scritto | OK |
| `K` in partita: carica fino a 60 frame e rilascia l'attacco caricato | OK |
| Vecchio tasto `H` dopo la rimappatura: non fa nulla | OK |
| Persistenza dopo il ricaricamento della pagina | OK |
| Doppione: `K` assegnato alla parata P2 -> tolto all'attacco P1 | OK |
| Ripristino predefiniti dalla riga `INVIO` | OK |
| Tasto riservato (`Esc`) durante l'assegnazione: rifiutato con messaggio | OK |
| Keybinds aperti dalla pausa: `Esc` torna a `IMPOSTAZIONI` in pausa | OK |
| Touch ATT con attacco rimappato su `K`: carica e colpo caricato | OK |
| VS ONLINE: l'ospite con attacco su `K` fa partire la carica sull'host (`Enemy.isCaricando`) | OK |
| VS ONLINE: parata dell'ospite su `O` arriva all'host | OK |
| Nessun errore JavaScript | OK |

---

## Fix #12 — Debito tecnico rimasto e richieste del 17/10/2026

**Obiettivo:** chiudere gli ultimi bug aperti (BUG-10, BUG-12, BUG-13, BUG-14, BUG-16, BUG-20) e sistemare le richieste arrivate dai giocatori: tasto indietro nei menu, rivincita, selezione diversa per modalità, versione mobile, report bug salvati sul server.

### Bug chiusi

| Bug | Correzione |
|---|---|
| BUG-10 | `this.facing = 1` spostato nel costruttore di `Sprite` (serve a `draw()` di ogni sprite) |
| BUG-12 | `const gravity = 0.25` spostata in `js/Utili.js`, caricato per primo |
| BUG-13 | verificata la resa della parata: lo sprite `ParataIdle` vince su attacco e su Jump/Fall |
| BUG-14 | `aggiornaAttackBox()` usa `facing`; convenzione documentata nel costruttore |
| BUG-16 | rimosse le proprietà `color` fantasma |
| BUG-20 | `framesDanno` (24 frame) al posto del `setTimeout` non tracciato |

### Menu e partita

- **Tasto indietro**: aggiunto `INDIETRO` al menu `PLAY` (era l'unico senza) e una riga di aiuto sotto le voci (`#menuSuggerimento`) che ricorda cosa fa `Esc` in quel menu.
- **Fine partita**: al termine compare il menu `FINE PARTITA` con `RIVINCITA` (stessi personaggi), `CAMBIA PERSONAGGI` (torna alla selezione) e `ESCI AL MENU`. In VS ONLINE la rivincita riparte per entrambi: l'host rimanda `avvia`, l'ospite manda una richiesta `rivincita`; il cambio personaggi si propaga con il messaggio `selezione`.
- **Selezione per modalità**: la schermata non è più identica ovunque. VS LOCALE mostra due schede attive; VS CPU mostra il personaggio del computer già scelto con la difficoltà; VS ONLINE mostra la propria scheda (`TU`) e quella dell'avversario come `AVVERSARIO` con lo stato "in attesa" finché non arriva la scelta. Anche le istruzioni in fondo cambiano con i tasti giusti.
- **Mobile**: layout responsive (menu, selezione, keybinds, pannelli), ritratti più piccoli, griglia scorrevole, pulsanti `P1/P2` con `<` `>` `CONFERMA` nella selezione (senza tastiera non si poteva scegliere) e cella toccabile. I lottatori si riducono in proporzione al campo (`fattoreScalaCampo()` in `js/Personaggi.js`: scala, offset, corpo, area d'attacco, velocità e salto moltiplicati per lo stesso fattore), così su telefono non occupano metà schermo. I comandi touch compaiono come prima solo in partita.
- **Report bug sul server**: il pannello ora invia il report con `POST /report`; il server lo accoda in `/var/lib/uvsf7/reports/report-AAAA-MM-GG.md` con data, IP e user agent. Niente più file da scaricare. Se il server non risponde il report resta in `localStorage` e viene reinviato alla riapertura del pannello; `ESPORTA MD` e `COPIA` restano come riserva.

### Verifiche eseguite (browser, gioco reale)

| Controllo | Esito |
|---|---|
| Menu `PLAY` con `INDIETRO` e riga di aiuto per ogni menu | OK |
| Fine partita -> menu `FINE PARTITA` con le tre voci | OK |
| `RIVINCITA`: stessi personaggi, timer a 60, vita piena | OK |
| `CAMBIA PERSONAGGI`: torna alla selezione | OK |
| Selezione: testi e schede diversi in LOCALE / CPU / ONLINE | OK |
| Mobile 390x844: menu, selezione e partita dentro lo schermo, celle toccabili, `CONFERMA` funzionante | OK |
| Mobile: lottatori ridotti (corpo 52x88, velocità 2.52, salto -4.83) e piedi a terra | OK |
| Mobile: tasto `ATT` touch carica e rilascia l'attacco caricato | OK |
| Report dal pannello: `POST /report` -> file Markdown sul server con contesto | OK |
| Report senza server: resta in coda e viene reinviato | OK (fallback) |
| BUG-20: 10 frame in danno, 30 frame -> stato chiuso | OK |
| BUG-14: AttackBox a destra con `facing = 1`, a sinistra con `facing = -1` | OK |
| Nessun errore JavaScript | OK |
