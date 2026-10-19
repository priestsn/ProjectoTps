# Crediti degli effetti

Gli effetti animati in questa cartella vengono da due pacchetti gratuiti di
**heyheythere**, entrambi con licenza **Creative Commons Attribuzione 4.0
(CC BY 4.0)**: uso libero anche commerciale, credito obbligatorio.

- **Combat FX Free** — https://heyheythere.itch.io/combat-fx-free — CC BY 4.0
  Fogli usati (versione 128 px): `colpo.png` (white_hit, 12 fotogrammi),
  `parata.png` (white_spark, 16), `critico.png` (gold_crit, 20),
  `caricato.png` (red_claw, 16).
- **Explosion FX Free** — https://heyheythere.itch.io/explosion-fx-free — CC BY 4.0
  Fogli usati (versione 128 px): `ultimate.png` (fire_explosion, 32),
  `proiettile.png` (fire_blast, 16), `fumo.png` (white_puff, 16).

Testi di licenza completi: `LICENZA-combat-fx-free.txt` e
`LICENZA-explosion-fx-free.txt` nella stessa cartella.

## Come sono fatti i fogli

Griglia di celle da 128 × 128 px, fotogrammi da sinistra a destra e poi in basso,
30 fps, una sola riproduzione (nessun ciclo). I metadata (fotogrammi, colonne,
righe, cella) stanno in `ANIMAZIONI_EFFETTI` dentro `js/Effetti.js` e vengono
verificati da `tools/prova_motore.js`, che ricava le misure reali dei PNG e le
confronta con quelli dichiarati.
