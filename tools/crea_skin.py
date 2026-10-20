"""Genera le skin ricolorate e i ritratti dei verdellinesi.

Per ogni verdellinese legge i fogli di sprite da assets/Personaggi/<Nome>/,
sposta la tonalita' di ogni pixel visibile e salva la variante in
assets/Skins/<Nome>-<skin>/. Delta e saturazione sono scelti per personaggio,
cosi' ogni skin "rara" ha una sua identita' invece di essere lo stesso filtro
applicato nove volte.

L'alfa non si tocca: i bordi morbidi degli sprite restano tali.

Uso:  python tools/crea_skin.py
      python tools/crea_skin.py --skin raro --forza
"""

import argparse
import colorsys
import json
import sys
from pathlib import Path

from PIL import Image

RADICE = Path(__file__).resolve().parent.parent
PERSONAGGI = RADICE / "assets" / "Personaggi"
SKINS = RADICE / "assets" / "Skins"

# Stato -> file. Sono gli stessi otto fogli per tutti i verdellinesi.
STATI = ["idle", "run", "attack", "parry", "takehit", "death", "jump", "fall"]

# Skin "rara" di ogni verdellinese: una palette scuro -> chiaro.
# Si chiama "trasporto di palette": la luminanza di ogni pixel decide dove
# cadere sulla rampa, quindi ombre, pieghe e dettagli restano tutti, ma il
# colore d'identita' diventa uno solo e ben riconoscibile. Lo spostamento di
# tonalita' da solo non bastava: su armature grigie (saturazione 0,17) quasi
# non si vedeva.
PALETTE = {
    "OusmaneDiouf": {"nome": "Oro", "scuro": (58, 42, 8), "chiaro": (255, 215, 94)},
    "KwameMensah": {"nome": "Ghiaccio", "scuro": (18, 42, 58), "chiaro": (159, 232, 255)},
    "ChidiOkonkwo": {"nome": "Cremisi", "scuro": (58, 13, 18), "chiaro": (255, 122, 107)},
    "AmaraDiallo": {"nome": "Smeraldo", "scuro": (11, 47, 28), "chiaro": (125, 255, 158)},
    "TarisaiMoyo": {"nome": "Ametista", "scuro": (38, 16, 58), "chiaro": (199, 155, 255)},
    "ZuriNkosi": {"nome": "Azzurro", "scuro": (11, 31, 58), "chiaro": (134, 183, 255)},
    "BakariTraore": {"nome": "Ambra", "scuro": (58, 30, 5), "chiaro": (255, 178, 87)},
    "SekouCamara": {"nome": "Fucsia", "scuro": (51, 10, 42), "chiaro": (255, 138, 216)},
    "AyoAdebayo": {"nome": "Turchese", "scuro": (5, 41, 43), "chiaro": (111, 230, 216)},
}

INESISTENTE = {"nome": "Rara", "scuro": (30, 30, 30), "chiaro": (200, 200, 200)}

# Quanto contrastare la rampa: 1.0 = lineare, >1 = ombre piu' profonde
CONTRASTO = 0.85


def ricolora(immagine, palette):
    """Porta i pixel visibili sulla rampa della palette, senza toccare l'alfa."""
    immagine = immagine.convert("RGBA")
    larghezza, altezza = immagine.size
    pixel = immagine.load()

    scuro = palette["scuro"]
    chiaro = palette["chiaro"]

    for y in range(altezza):
        for x in range(larghezza):
            r, g, b, a = pixel[x, y]
            if a == 0:
                continue

            # Luminanza percepita: e' quella che decide la posizione sulla rampa,
            # quindi il disegno (pieghe, luci, contorni) resta identico.
            luce = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
            luce = luce ** CONTRASTO

            pixel[x, y] = (
                int(round(scuro[0] + (chiaro[0] - scuro[0]) * luce)),
                int(round(scuro[1] + (chiaro[1] - scuro[1]) * luce)),
                int(round(scuro[2] + (chiaro[2] - scuro[2]) * luce)),
                a
            )

    return immagine


def primo_fotogramma(percorso, lato=None):
    """Ritaglia il primo fotogramma del foglio: serve come ritratto.

    La cella e' quadrata e alta quanto il foglio, ma l'altezza cambia da un
    verdellinese all'altro (126, 140, 180, 200, 250 px): non va fissata.
    """
    with Image.open(percorso) as foglio:
        foglio = foglio.convert("RGBA")
        larghezza, altezza = foglio.size
        lato = lato or altezza
        if larghezza < lato:
            return None
        return foglio.crop((0, 0, lato, lato))


def main():
    argomenti = argparse.ArgumentParser()
    argomenti.add_argument("--skin", default="raro")
    argomenti.add_argument("--forza", action="store_true", help="riscrive file che esistono")
    opzioni = argomenti.parse_args()

    if not PERSONAGGI.is_dir():
        print("Cartella dei personaggi non trovata:", PERSONAGGI)
        return 1

    rapporti = []
    for cartella in sorted(PERSONAGGI.iterdir()):
        if not cartella.is_dir():
            continue

        nome = cartella.name
        ricetta = PALETTE.get(nome, INESISTENTE)
        destinazione = SKINS / ("%s-%s" % (nome, opzioni.skin))
        destinazione.mkdir(parents=True, exist_ok=True)

        generati = 0
        for stato in STATI:
            sorgente = cartella / (stato + ".png")
            if not sorgente.is_file():
                print("  manca:", sorgente)
                continue

            uscita = destinazione / (stato + ".png")
            if uscita.exists() and not opzioni.forza:
                generati += 1
                continue

            with Image.open(sorgente) as originale:
                ricolora(originale, ricetta).save(uscita, "PNG", optimize=True)
            generati += 1

        # Ritratto: primo fotogramma dell'idle ricolorato
        sorgente_idle = cartella / "idle.png"
        if sorgente_idle.is_file():
            ritaglio = primo_fotogramma(sorgente_idle)
            if ritaglio is not None:
                ricolora(ritaglio, ricetta).save(destinazione / "ritratto.png", "PNG", optimize=True)

        dimensione = sum(f.stat().st_size for f in destinazione.glob("*.png")) / 1024
        rapporti.append((nome, generati, dimensione))
        print("%-16s %d fogli  %6.1f KB  %s" % (nome, generati, dimensione, ricetta["nome"]))

    totale = sum(r[2] for r in rapporti)
    print("\n%d personaggi, %.1f KB in totale in assets/Skins/" % (len(rapporti), totale))
    return 0


if __name__ == "__main__":
    sys.exit(main())
