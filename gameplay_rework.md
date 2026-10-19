# Gameplay rework — reattività, ritmo stabile ed effetti

> Documento di lavoro: cosa è stato cambiato, **perché**, **come**, e come è stato
> verificato. Se un giorno qualcosa in partita sembra strano, si legge qui e si
> trova il punto esatto che lo governa.

Data: 19 ottobre 2026
Punto di partenza: `5d202ea` (Leghe). Punto di arrivo: il commit che contiene
questo file.
Regola guida: **il gioco non cambia. Diventa solo più reattivo, più stabile e
più bello da guardare.**

---

## 1. Il problema, misurato nel codice

Le lamentele erano tre: «i tasti non sembrano essere premuti», «il gioco sembra
macchinoso», «mancano gli effetti per stun, perfect block e ultimate». Le prime
due non erano impressioni: erano quattro difetti precisi.

### 1.1 Il gioco girava alla frequenza dello schermo (la causa principale)

`animate()` veniva chiamata da `requestAnimationFrame` e **ogni chiamata faceva
avanzare lo stato di un frame di gioco**. Su un monitor a 144 Hz succedeva
questo:

| Cosa | A 60 Hz | A 144 Hz |
|---|---|---|
| Durata reale di un'attacco (30 frame) | 0,50 s | 0,21 s |
| Finestra del perfect block (3 frame) | 50 ms | 21 ms |
| Drenaggio stamina parando (0,2/frame) | 12 punti/s | 29 punti/s |
| Timer del round | 60 s | 60 s (è in tempo reale, `setTimeout`) |

Cioè: il round durava uguale, ma con tutto il resto 2,4 volte più veloce. È il
motivo per cui i tasti «non rispondevano»: il gioco era già passato oltre mentre
il giocatore premeva. Su un PC lento succedeva l'opposto.

### 1.2 La pressione di un tasto si giocava una volta sola

`premiAzione()` (`js/Keybinds.js`) chiamava subito `salta()` / `iniziaCarica()` /
`iniziaParata()` / `attivaUltimate()`. Se in quel preciso istante il lottatore era
in recupero attacco, in `TakeHit`, a mezz'aria o appena colpito, la funzione
restituiva `false` e **l'intenzione veniva buttata via**. Non esisteva coda.

### 1.3 Il colpo entrava solo sul frame esatto

La collisione confrontava `framesCurrent === attacco.frame`. Un fotogramma
saltato (calo di fps, scheda in secondo piano) e il colpo **passava attraverso
l'avversario senza fare danno**; a frequenze alte poteva registrare più volte lo
stesso attacco.

### 1.4 Tasti incollati

`keyup` veniva ignorato fuori dalla partita e non c'era nessun handler su `blur`:
aprire la pausa o fare alt-tab con un tasto premuto lasciava il lottatore a
correre da solo.

### 1.5 Effetti: c'erano solo scritte

Il perfect block mostrava il testo `PERFECT BLOCK`, lo stun **niente** (lo sprite
`TakeHit` è lo stesso di un colpo normale), l'ultimate solo il nome.

---

## 2. Le decisioni (e perché)

**I timer restano in frame.** Con il timestep fisso un frame vale esattamente
1/60 di secondo: le costanti esistenti (`STUN_FRAMI = 60`, `CARICA_ATTACCO_FRAMI
= 60`, …) diventano veritiere senza riscriverle. Convertirle in secondi sarebbe
stato un refactor enorme a guadagno zero.

**Niente hitstop** (congelare la simulazione sul colpo). È la tentazione da
picchiaduro, ma rompe la parità host/ospite in VS ONLINE e il determinismo dei
test. L'impatto lo dicono scossa + flash + particelle, che sono solo disegno.

**Effetti a immagini, come richiesto, ma con ricaduta procedurale.** Il pacchetto
Kenney «Particle Pack» è CC0 (uso libero anche commerciale): cinque sprite
scaricati, ridimensionati e messi in `assets/Effetti/` (66 KB in tutto). Se le
immagini non caricano, `js/Effetti.js` disegna le stesse cose con forme
geometriche: il gioco funziona identico anche senza la cartella.

**La parata in aria resta vietata.** Scelta esplicita. La reattività si ottiene
con la coda dei comandi, non allentando le regole.

---

## 3. Cosa è stato fatto

### 3.1 Ritmo stabile: `js/Tempo.js` + pianificatore in `index.js`

**Perché:** eliminare la dipendenza dagli Hz dello schermo senza toccare una sola
regola.

**Come:** il tempo reale si accumula; ogni volta che si raggiunge 1/60 di secondo
si esegue **un** passo di simulazione. `animate()` è diventata un pianificatore di
20 righe; il vecchio corpo del loop si chiama ora `passoSimulazione()` ed è
identico a prima, riga per riga.

```js
const esito = avanzaAccumulatore(accumulatore, dt);
accumulatore = esito.resto;
for (let i = 0; i < esito.passi; i++) { passoSimulazione(); }
```

Dettagli che evitano effetti collaterali:

- **tetto di 5 passi per fotogramma**: se la scheda è rimasta in secondo piano il
  gioco non «recupera» centinaia di passi arretrati (niente salti, niente
  spirale della morte);
- **`dt` limitato a 250 ms**: un blocco è un buco, non tempo da simulare;
- **accumulatore azzerato fuori dalla partita** e a ogni `avviaPartita()`.

**Verifica:** in un Chrome vero servito da Node, con la partita in corso:
`1144 passi in 19,1 s = 59,9 passi/s`. Prima, sullo stesso schermo, i passi
sarebbero stati uno per fotogramma dello schermo.

### 3.2 Coda dei comandi: `js/Buffer.js`

**Perché:** un tasto premuto 100 ms prima che il lottatore sia pronto non deve
andare perso.

**Come:** quando un'azione non può partire, entra in coda con una scadenza di
**9 frame (150 ms)**. A ogni passo di simulazione `riprovaBuffer()` la ritenta,
nell'ordine salto → parata → attacco → ultimate. Se l'attacco parte quando il
tasto è già stato rilasciato, il colpo parte subito invece di restare in carica.

- **Lo stun non è coperto**: `puoBufferizzare()` esclude stunnati e morti. Lo stun
  resta uno stato senza scampo, come deve essere.
- La CPU non passa dalla coda: `js/CPU.js` chiama `iniziaParata` / `iniziaCarica`
  / `attivaUltimate` direttamente, quindi l'IA non guadagna reattività per
  sbaglio.

**Verifica in browser (scenario cronometrato dentro la pagina):**

| Momento | Stato |
|---|---|
| parata premuta a mezz'aria | `isParata: false`, comandi in coda: **1** |
| 1,15 s dopo, appena atterrato | `isParata: true`, coda: **0** |

Cioè: il comando impossibile è stato ricordato ed è partito da solo
all'atterraggio. Prima si perdeva.

### 3.3 Colpo affidabile: `js/Regole.js` + `attaccoHaColpito`

**Perché:** un colpo non deve passare attraverso l'avversario per colpa di un
fotogramma perso.

**Come:** `colpoVaRegistrato(framesCurrent, frameImpatto, haGiaColpito)` registra
il colpo appena **si raggiunge** il frame d'impatto, e `attaccoHaColpito` (nuovo
campo in `js/Classi.js`, azzerato in `avviaAttacco()` e quando un colpo subito
interrompe l'attacco) garantisce **un solo colpo per attacco**. La collisione è
ora una funzione sola, `controllaColpo()`, usata per entrambi i lottatori (prima
erano due blocchi copiati).

**Verifica:** attacco a distanza utile → `Enemy.health` da 87 a 79, cioè **8
danni**, il valore della statistica di Ousmane. Nessun colpo doppio.

### 3.4 Effetti: `js/Effetti.js`

**Perché:** stun, perfect block e ultimate erano invisibili o quasi.

**Come:** un sistema di particelle, onde, tinte e scosse, più gli sprite del
pacchetto. **Non tocca la simulazione**: si aggiorna una volta per passo e si
disegna sopra la scena.

| Momento | Effetto |
|---|---|
| Colpo normale | scintille bianche dal punto d'impatto, onda breve, scossa 3 |
| Attacco caricato su chi para | scintille rosse, scossa 5, stun |
| Parata riuscita | bolla azzurra (`#8be9fd`) + sprite `parata.png` |
| Perfect block | anello dorato grande, flash dorato a schermo, 20 particelle, scossa 6 |
| Stun | onde bianche, tre stelle che girano sopra la testa, scossa 4 |
| Ultimate | flash del colore del personaggio, onda 200 px, 26 particelle, scossa 8 |
| Proiettile ultimate | scia colorata a ogni 2 passi, esplosione all'impatto |

Il colore viene da `personaggio.ultimate.colore`: **ogni lottatore ha i suoi
colori**, senza toccare il codice.

Tetto di sicurezza: massimo 220 particelle; con `prefers-reduced-motion` a
sistema le particelle dimezzano e la scossa si spegne.

**Verifica in browser (misure reali):**

- perfect block sintetico: ultimate **+15**, attaccante stunnato con
  `stunTimer: 60`, tinta `#ffd34d`, 3 onde, 34 particelle, scossa 6;
- ultimate di Ousmane: carica 100 → 0, `attaccoUltimate: true`, **26 particelle**,
  tinta `#8ab4ff` (il colore del personaggio), scossa 8, avviso «Radici del
  Baobab»;
- nessun errore JavaScript in pagina (`window._errori` vuoto) dopo tutti gli
  scenari.

### 3.5 Scossa dello schermo

**Perché:** dare peso ai colpi senza toccare la simulazione.

**Come:** `applicaScossa()` scrive due variabili CSS (`--scossa-x`, `--scossa-y`);
`css/style.css` sposta il canvas con `transform: translate(...)`. Non si può
spostare il disegno *dentro* il canvas perché il canvas viene ripulito a ogni
passo e i bordi resterebbero neri.

### 3.6 Feedback di pressione

**Perché:** «i tasti non sembrano premuti» è anche un problema di risposta visiva.

**Come:** quando un comando in coda viene finalmente eseguito compaiono quattro
particelle bianche sopra la testa del lottatore; se l'attacco non parte per
stamina insufficiente la barra stamina lampeggia (`lampeggiaStamina`). Così si
distingue «il gioco non mi ha sentito» da «non ho energia».

### 3.7 Pulizia e ottimizzazioni

- **Movimento e parata in una funzione sola** (`aggiornaParteComune`): prima lo
  stesso blocco era scritto due volte, uno per `Player` e uno per `Enemy`.
- **HUD scritto solo quando cambia** (`scriviBarra`): prima 4 barre × 60 passi =
  240 scritture di stile al secondo anche a valori identici.
- **Proiettili senza gradiente radiale**: due cerchi al posto di un gradiente
  creato per ogni proiettile a ogni frame.
- **Larghezze dei testi in cache** (`larghezzaTesto`): `measureText` non viene più
  chiamato per ogni etichetta a ogni frame.
- **`rilasciaTuttiITasti()`** su `blur`, pausa e uscita al menu: niente più tasti
  incollati.

---

## 4. Il pacchetto di effetti

`assets/Effetti/` contiene cinque immagini derivate dal **Kenney Particle Pack**
(CC0 — uso libero anche commerciale, credito gradito ma non obbligatorio):

| File | Da | Uso |
|---|---|---|
| `impatto.png` | `muzzle_01.png` | flash dei colpi |
| `parata.png` | `circle_01.png` | bolla della parata |
| `stella.png` | `star_01.png` | stelle dello stun |
| `ultimate.png` | `magic_05.png` | esplosione dell'ultimate |
| `scintilla.png` | `spark_01.png` | disponibile per scintille puntuali |

Ridimensionate con PIL (160/128/96/192/64 px): **66 KB in tutto**, contro i 15 MB
del pacchetto originale. Il testo di licenza è copiato accanto alle immagini in
`assets/Effetti/LICENZA-LICENSE.txt`.

Se la cartella viene cancellata, `spriteEffettoPronto()` restituisce `false` e
tutto torna a essere disegnato con forme geometriche: **nessun errore, nessuna
riga da cambiare**.

---

## 5. Verifiche (tutte eseguite, non stimate)

```
node tools/prova_motore.js       33/33 verifiche passate   (nuovo)
node tools/prova_invarianti.js   16/16 verifiche passate   (nuovo)
node tools/prova_account.js      21/21 verifiche passate
node tools/prova_partite.js      14/14 verifiche passate
node tools/prova_amici.js        21/21 verifiche passate
node tools/prova_ranked.js       21/21 verifiche passate
node tools/prova_coda.js         24/24 verifiche passate
node tools/prova_leghe.js        18/18 verifiche passate
```

- **`prova_motore.js`** verifica la logica pura: che 3 secondi a 144 Hz diano
  **180 passi e non 432**, che a 30 Hz ne diano comunque 180, che la coda scada
  dopo 9 frame, che un comando consumato non si ripeta, che le particelle
  rispettino il tetto e che le onde finiscano.
- **`prova_invarianti.js`** è il guardiano del bilanciamento: se qualcuno tocca
  `STUN_FRAMI`, `FINESTRA_PERFETTO`, la carica dell'attacco, il danno dei
  personaggi, la regola «parata solo da terra» o il drenaggio della stamina, il
  test diventa rosso. Serve a dimostrare che questo lavoro **non ha cambiato il
  gioco**.

Verifica nel browser vero (Chrome su CDP, pagina servita da `node server/server.js`):

| Prova | Risultato reale |
|---|---|
| passi di simulazione | 1144 in 19,1 s → **59,9/s** |
| parata premuta in aria | rifiutata e messa in coda (1) |
| parata dopo l'atterraggio | partita da sola, coda vuota |
| attacco su avversario | **8 danni** (statistica del personaggio) |
| perfect block | +15 ultimate, stun 60, flash dorato |
| ultimate | carica 0, 26 particelle, tinta del personaggio |
| errori in pagina | **nessuno** |

---

## 6. Cosa NON è stato fatto (e perché)

- **Effetti per l'ospite in VS ONLINE.** In online l'ospite non simula: disegna lo
  stato che riceve. Gli effetti dell'host non gli arrivano. Servirebbe aggiungere
  un campo al fotogramma di stato. Rimandato: costa un giro di protocollo e non
  era nella richiesta.
- **Hitstop** (micro-congelamento sul colpo): romperebbe parità e determinismo.
- **Refactor totale di `passoSimulazione()`** in sottosistemi: oggi è più corto e
  leggibile di prima (movimento e collisione sono usciti), ma resta una funzione
  lunga. Si può fare in un secondo momento, senza fretta e senza rischio.
- **Riscrittura dei timer in secondi**: inutile ora che un frame è esattamente
  1/60 s.

## 7. Manopole, se si vuole tarare a mano

| Cosa | Dove | Valore attuale |
|---|---|---|
| Durata della coda comandi | `js/Buffer.js` → `BUFFER_FRAMI` | 9 frame (150 ms) |
| Passi massimi per fotogramma | `js/Tempo.js` → `MAX_PASSI` | 5 |
| Particelle massime | `js/Effetti.js` → `MASSIMO_PARTICELLE` | 220 |
| Forza delle scosse | `index.js` → `scuoti(effetti, N)` nei vari punti | 3 / 4 / 5 / 6 / 8 |
| Durata/forza dei flash | `index.js` → `tigni(effetti, colore, forza, frame)` | 0,18–0,22 per 10–14 frame |

Se gli effetti sembrano troppo forti o troppo timidi, si cambiano solo questi
numeri: la simulazione non c'entra.
