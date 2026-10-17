# App Android di UVSF7

Contenitore **nativo** del gioco: una `Activity` con una `WebView` a schermo
intero. Nessuna libreria esterna, nessun Gradle, nessuna AndroidX: si compila
con i soli strumenti dell'SDK (`aapt2`, `javac`, `d8`, `zipalign`, `apksigner`),
quindi non c'è niente da scaricare al momento della build.

## Come si aggiorna

Ci sono due aggiornamenti distinti, ed è la parte che conta:

| Cosa | Da dove arriva | Come |
|---|---|---|
| **Il gioco** | repository → GitHub Pages (`https://priestsn.github.io/ProjectoTps/`) | l'app carica la pagina remota: **ogni push è già sul telefono** alla riapertura. Nessun APK da rifare |
| **L'app (APK)** | Release GitHub (`app-vX.Y.Z` + asset `.apk`) | l'app legge `releases/latest`, confronta la versione, scarica e apre l'installer |

In pratica: cambi una riga del gioco → push → apri l'app → vedi la modifica.
Cambi qualcosa del contenitore nativo → nuova Release → l'app propone
l'aggiornamento.

## Comandi

- **Tre dita sullo schermo** → impostazioni (indirizzo del server, aggiornamenti)
- **Indietro due volte** → esce (evita uscite accidentali durante il combattimento)
- Tornando nell'app dopo 5 minuti in background, la pagina si ricarica da sola

## Compilare

```bash
./build.sh                          # versione 1.0.0, versionCode 1
VERSIONE=1.0.1 CODE=2 ./build.sh    # nuova versione
```

Variabili utili: `ANDROID_SDK`, `JAVA_HOME`, `KEYSTORE`, `KS_PASS`, `ALIAS`.

La chiave di firma sta **fuori dal repository** (`~/.uvsf7-release.jks`, creata
al primo build). Va conservata: Android rifiuta un aggiornamento firmato con una
chiave diversa. Il file `.jks` non va mai committato.

Risultato: `build/uvsf7-v<versione>.apk`, già allineato e firmato.

## Struttura

```
android/
├── AndroidManifest.xml          permessi, orientamento, provider
├── build.sh                     build senza Gradle
├── res/                         icone launcher e stringhe
└── src/it/uvsf7/app/
    ├── MainActivity.java        WebView, schermo intero, impostazioni, pagina di errore
    ├── Aggiornamento.java       controllo Release, download, installazione APK
    └── ApkProvider.java         espone l'APK come content:// (serve dall'API 24)
```

## Scelte tecniche

- **`minSdk 24`, `targetSdk 35`** — copre Android 7 in su; le API nuove
  (`layoutInDisplayCutoutMode`, `canRequestPackageInstalls`) sono protette da
  controlli di versione.
- **`sensorLandscape`** — il gioco ha un mondo 16:9: in verticale l'arena
  sarebbe una striscia (la versione web mostra l'avviso "ruota il telefono").
- **`usesCleartextTraffic="true"`** — permette anche un server raggiunto in
  `http://` o `ws://` in rete locale, senza certificato.
- **Nessuna `file://`** — `ApkProvider` serve l'APK installabile come
  `content://`: passare un `file://` a un'altra app fa scattare
  `FileUriExposedException` dall'API 24.
- **`ApkProvider` scritto a mano** invece di `androidx.core.content.FileProvider`:
  aggiungere AndroidX significherebbe dipendenze da risolvere, cioè Gradle e
  centinaia di MB di librerie per una sola classe.
- **Pagina di errore locale** — se il server non risponde si vede una schermata
  scura con RIPROVA e IMPOSTAZIONI, non il messaggio di Chrome "Impossibile
  raggiungere il sito".
- **Ricarica dopo 5 minuti in background** — è il meccanismo che rende
  percepibile l'aggiornamento automatico del gioco: senza, una WebView può
  mostrare per giorni la versione in cache.

## Pubblicare una nuova versione

```bash
VERSIONE=1.0.1 CODE=2 ./build.sh
gh release create app-v1.0.1 build/uvsf7-v1.0.1.apk --title "App 1.0.1" --notes "..."
```

Il tag deve contenere la versione (`app-v1.0.1`): l'app la confronta con la
propria e propone l'aggiornamento. L'asset deve finire in `.apk`.
