# Ultra Verdello Street Fight 7

Picchiaduro bidimensionale per **2 giocatori in locale**, scritto in **JavaScript vanilla** con rendering su **Canvas 2D**. Progetto scolastico (TPS). Nome del repository: **ProjectoTps**.

![screenshot](screenshot.png)

## Come si gioca

Apri `index.html` nel browser (oppure servilo in locale: `python3 -m http.server 8000` e vai su `http://localhost:8000`).

Dal menu scegli **PLAY** → **VS LOCALE**: frecce su/giù (o `W`/`S`) per spostarti, `Invio` per confermare, `Esc` per tornare indietro. Le voci non ancora disponibili sono marcate **WIP** e non si possono selezionare.

Servono **2 giocatori sulla stessa tastiera**.

| | Giocatore 1 | Giocatore 2 |
|---|---|---|
| Muovi | `A` / `D` | `←` / `→` |
| Salta | `W` | `↑` |
| Attacco | `H` | `ù` |
| Parata | `J` | `à` |

## Regole

- Ogni lottatore ha **vita** e **stamina**: attaccare e parare consumano stamina.
- La parata blocca i danni ma solo finché hai stamina.
- Vince chi azzera la vita dell'avversario entro i **60 secondi**; allo scadere vince chi ha più vita.

## Cosa c'è sotto il cofano

- Game loop con `requestAnimationFrame`, fisica custom (gravità, salto, hitbox di attacco).
- Sistema di sprite a stati: idle, corsa, salto, caduta, attacco, colpo subito, parata, morte.
- Collisioni attacco basate su frame dell'animazione (il colpo conta solo al frame giusto).
- HUD con barre vita/stamina e timer, schermata di fine partita.
- Schermata di caricamento che attende tutti gli asset e menu iniziale con stati di gioco.

## Struttura

```
index.html      → markup, HUD, menu e schermate
index.js        → game loop, input, collisioni, regole
css/style.css   → tutti gli stili
js/Utili.js     → caricamento asset, timer, determinazione vincitore
js/Stato.js     → stati del gioco (caricamento, menu, partita)
js/Menu.js      → menu, navigazione da tastiera, voci WIP, fullscreen
js/Classi.js    → classi Sprite e Lottatore
assets/         → sprite Player, Enemy, sfondo e logo
```

## Stack

JavaScript (nessun framework), HTML5 Canvas, CSS.
