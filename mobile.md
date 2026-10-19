# Versione mobile: com'è fatta e cosa è stato misurato

Documento di lavoro per la parte telefono/tablet (web e APK).
Aggiornato: 19 ottobre 2026.

---

## 1. Come è diviso il codice adesso

| File | Cosa contiene | Cosa NON contiene |
|---|---|---|
| `css/style.css` | tutto il desktop e le regole che dipendono **solo dalla dimensione** (per esempio `@media (max-height: 720px)`, che vale anche per una finestra desktop ridotta) | niente regole legate al dito |
| `css/mobile.css` | solo regole da dito: `pointer: coarse`, `hover: none`, portrait, safe area del notch, dimensione minima dei tasti | niente regole che cambierebbero il desktop |
| `js/Touch.js` | il **disegno** dei comandi a schermo (leva, tasti, zone) | rilevamento del dispositivo, rotazione, scala |
| `js/Mobile.js` | il **dispositivo**: `dispositivoTouch()`, `schermoVerticale()`, `aggiornaMobile()`, `segnaTastieraFisica()`, `comandiTouchUtili()` | niente disegno dei comandi |

Regola da rispettare quando si tocca il telefono:

> Se una regola CSS dipende da **come** si tocca lo schermo (dito o mouse) va in `css/mobile.css`.
> Se dipende solo da **quanto è grande**, resta in `css/style.css`, perché vale anche per una
> finestra desktop ridotta. Spostarla in `mobile.css` cambierebbe il desktop: il contrario di quello
> che vogliamo.

`css/mobile.css` si carica **dopo** `style.css` (`index.html`), e `js/Mobile.js` si carica **prima**
di `js/Touch.js`. Il test `tools/prova_mobile.js` verifica entrambe le cose (26 controlli).

---

## 2. Misure raccolte (prima del refactoring)

Emulazione Chrome (`Emulation.setDeviceMetricsOverride`), gioco giocato in partita, non solo menu:

| Profilo | Area di gioco | HUD | Leva | Tasto | Note |
|---|---|---|---|---|---|
| telefono orizzontale 844×390 (dpr 3) | 693×390 | 693×49 | 108 px | **58 px** | menu che scorre: atteso |
| telefono verticale 390×844 (dpr 3) | 390×219 | 390×27 | — | — | compare l'avviso «ruota il telefono» |
| tablet orizzontale 1180×820 (dpr 2) | 1180×664 | 1180×83 | 136 px | 76 px | tutto comodo |
| desktop 1400×900 | 1400×788 | 1400×98 | — | — | nessun comando touch (giusto) |

Difetti trovati e corretti:

1. **Tasti da 58 px** sul telefono piccolo: sotto la soglia comoda per un pollice. Portati a un
   minimo di **64 px** con `min-width/min-height` in `css/mobile.css` (non con una larghezza fissa:
   così un telefono grande non li rimpicciolisce).
2. **I pollici coprono i lottatori**: leva e tasti stanno in basso, dove sta il combattimento. Ora i
   comandi spenti sono semi-trasparenti (`opacity: 0.72`) e diventano pieni appena li tocchi
   (`.leva-touch.attiva`, `.tasto-touch.premuto`). L'opacità sta sui singoli comandi e **non** sul
   contenitore, perché `:has()` non esiste nelle WebView vecchie di Android 7-8.
3. **Nessuno spazio per il notch**: c'era una sola regola `env(safe-area-inset)` in tutto il CSS.
   Ora `.comandi-touch` tiene conto di sinistra/destra/basso e `#hud` di sinistra/destra, così le
   barre della vita non finiscono sotto la tacca su un telefono in orizzontale.
4. **Doppio tocco che faceva zoom** sopra i comandi: `touch-action: none` e
   `-webkit-tap-highlight-color: transparent` su leva e tasti.
5. **Comandi a schermo su un PC con touch screen**: appena si preme un tasto vero,
   `segnaTastieraFisica()` li toglie di mezzo (`comandiTouchUtili()` diventa `false`). Prima
   restavano lì anche giocando con WASD.

---

## 3. Cosa è stato verificato davvero

In emulazione (Chrome headless su questa macchina, porta CDP 9111):

- telefono orizzontale: leva 108 px, tasto **64 px**, opacità 0.72 a riposo;
- **input touch funzionante**: trascinando la leva a destra il lottatore si sposta di +64 px e la
  leva si accende; premendo ATT parte la carica (`isCaricando`), il tasto si illumina (opacità 1) e
  al rilascio parte l'attacco (`isAttacking`);
- telefono verticale: compare l'avviso «Ruota il telefono in orizzontale», e «gioca lo stesso» lo
  chiude (sparisce davvero: `display: none`);
- tastiera fisica su dispositivo touch: i comandi spariscono (`display: none`);
- desktop 1400×900: menu, tre colonne e scheda profilo identici a prima del refactoring.

## 4. Cosa NON si può verificare da qui

Vanno provati su un telefono vero, e vanno chiesti all'utente invece di darli per fatti:

- **safe area reale**: l'emulazione di questa versione di Chrome non ha
  `Emulation.setSafeAreaInsets`, quindi le regole `env(safe-area-inset-*)` sono scritte e sensate ma
  non misurate su un notch vero;
- **dito vero**: la pressione, il multitouch reale (leva + due tasti insieme) e la latenza;
- **WebView dell'APK**: comportamento della cache, ritorno in primo piano, orientamento bloccato.

---

## 5. APK

- `android/AndroidManifest.xml`: `versionCode="3"`, `versionName="1.0.2"`.
- `android/src/it/uvsf7/app/MainActivity.java`: `BUILD_APP = 3` **deve restare uguale al
  `versionCode`**: è il valore che fa svuotare la cache della WebView al primo avvio dopo un
  aggiornamento. Se i due numeri si disallineano, il telefono mostra HTML vecchio con CSS nuovo e
  sembra «layout rotto».
- Compilazione: `VERSIONE=1.0.2 CODE=3 ./android/build.sh` (aapt2 + javac + d8 + apksigner, senza
  Gradle). Firma in `~/.uvsf7-release.jks`, fuori dal repository.
- L'app punta a `https://priestsn.github.io/uvstf7/` e si aggiorna da sola leggendo l'ultima Release
  GitHub (`app-vX.Y.Z`).
