"""Trasforma un'immagine di riferimento in una ricetta di skin.

Il flusso delle skin complesse, in tre passi:

1. un'immagine qualsiasi (un frame, un concept disegnato a mano, un ritratto
   trovato in giro) qui diventa una **ricetta**: la sua palette raggruppata in
   OKLab, ordinata per luminanza, con le rampe scuro->chiaro ricavate da ogni
   gruppo;
2. la ricetta viene salvata in `dati/skin/ricette.json`;
3. `python tools/crea_skin.py --solo <nome>` la applica agli otto fogli di
   tutti i verdellinesi, quindi il colore e il trattamento estratti da UNA
   immagine valgono per l'intero set di animazioni.

Questo è il pezzo dell'AI che serve davvero: il modello genera una sola
immagine, poi la ricetta (codice deterministico) la porta su tutti i fotogrammi
senza far ballare il disegno da un frame all'altro.

Uso:
    python tools/concetto_skin.py concetto.png --nome tramonto
    python tools/concetto_skin.py concetto.png --nome tramonto --rim 0.6
    python tools/crea_skin.py --solo tramonto
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

from crea_skin import (            # noqa: E402  (serve dopo sys.path)
    RADICE,
    RICETTE,
    rgb_a_oklab,
    oklab_a_rgb,
    GRUPPI
)


def pixel_visibili(percorso):
    with Image.open(percorso) as immagine:
        immagine = immagine.convert("RGBA")
        dati = np.asarray(immagine, dtype=np.uint8)

    visibili = dati[dati[:, :, 3] > 8]
    if len(visibili) == 0:
        visibili = dati.reshape(-1, 4)

    rgb = visibili[:, :3].astype(np.float64)

    # I modelli generano spesso su fondo nero pieno (o trasparente). Se il
    # fondo resta nella palette, la ricetta diventa quasi tutta nera: lo si
    # scarta quando non è il colore del personaggio.
    scuri = rgb.max(axis=1) <= 12
    if scuri.sum() < len(rgb) * 0.9:
        rgb = rgb[~scuri]

    return rgb if len(rgb) else visibili[:, :3].astype(np.float64)


def raggruppa(lab, gruppi):
    """K-means in OKLab, come nel motore delle skin."""
    luminanze = lab[:, 0]
    quantili = np.linspace(0.03, 0.97, gruppi)
    centri = np.stack([
        np.array([np.quantile(luminanze, q),
                  np.quantile(lab[:, 1], q),
                  np.quantile(lab[:, 2], q)]) for q in quantili
    ])

    for _ in range(50):
        distanze = ((lab[:, None, :] - centri[None, :, :]) ** 2).sum(axis=2)
        assegnazione = distanze.argmin(axis=1)
        nuovi = np.array([
            lab[assegnazione == i].mean(axis=0) if np.any(assegnazione == i) else centri[i]
            for i in range(gruppi)
        ])
        if np.allclose(nuovi, centri, atol=1e-5):
            centri = nuovi
            break
        centri = nuovi

    return centri[np.argsort(centri[:, 0])]


def costruisci_ricetta(centri, nome, prezzo, descrizione, rim_intensita, dither):
    """Da gruppi ordinati per luce a rampe scuro/chiaro, tenendo la tinta."""
    rampe = []
    for centro in centri:
        # stessa tinta, luminanza più bassa e più alta: la rampa nasce dal
        # colore trovato nell'immagine, non da una tabella scritta a mano
        scuro = centro.copy()
        scuro[0] = max(0.05, centro[0] * 0.45)

        chiaro = centro.copy()
        chiaro[0] = min(0.98, centro[0] * 1.55)
        # chi è già chiaro si schiarisce meno, altrimenti sbianca tutto
        chiaro[1] *= 0.85
        chiaro[2] *= 0.85

        rampe.append({
            "scuro": [int(v) for v in oklab_a_rgb(np.array([scuro]))[0]],
            "chiaro": [int(v) for v in oklab_a_rgb(np.array([chiaro]))[0]]
        })

    # il bordo luminoso usa il gruppo più chiaro dell'immagine
    rim = None
    if rim_intensita > 0:
        colore = [int(v) for v in oklab_a_rgb(np.array([centri[-1]]))[0]]
        rim = {"colore": colore, "intensita": round(rim_intensita, 2), "spessore": 2,
               "alone": [2, 100]}

    return {
        "nome": nome.capitalize(),
        "prezzo": prezzo,
        "descrizione": descrizione,
        "contrasto": 1.0,
        "dither": bool(dither),
        "rim": rim,
        "rampe": rampe
    }


def main():
    argomenti = argparse.ArgumentParser()
    argomenti.add_argument("concetto", help="immagine di riferimento (PNG, JPG)")
    argomenti.add_argument("--nome", required=True, help="nome della skin (minuscolo, senza spazi)")
    argomenti.add_argument("--prezzo", type=int, default=1500)
    argomenti.add_argument("--descrizione", default=None)
    argomenti.add_argument("--gruppi", type=int, default=GRUPPI)
    argomenti.add_argument("--rim", type=float, default=0.55, help="intensità bordo, 0 = nessuno")
    argomenti.add_argument("--dither", action="store_true")
    opzioni = argomenti.parse_args()

    percorso = Path(opzioni.concetto)
    if not percorso.is_file():
        print("Immagine non trovata:", percorso)
        return 1

    pixel = pixel_visibili(percorso)
    if len(pixel) > 40000:
        scelta = np.random.default_rng(7).choice(len(pixel), 40000, replace=False)
        pixel = pixel[scelta]

    lab = rgb_a_oklab(pixel)

    # Il raggruppamento va fatto sui COLORI, non sulle ombre: in un'immagine
    # generata metà dei pixel è quasi nera, e senza questo filtro quattro
    # gruppi su cinque finiscono sul nero. Si tengono i pixel abbastanza
    # luminosi; le rampe scure si ricavano poi da ogni gruppo.
    luminosi = lab[:, 0] >= 0.15
    if luminosi.sum() < len(lab) * 0.15:
        luminosi = lab[:, 0] >= 0.08
    if luminosi.sum() >= opzioni.gruppi * 20:
        lab = lab[luminosi]

    centri = raggruppa(lab, opzioni.gruppi)

    descrizione = opzioni.descrizione or ("Ricetta estratta da " + percorso.name)
    ricetta = costruisci_ricetta(centri, opzioni.nome, opzioni.prezzo, descrizione,
                                 opzioni.rim, opzioni.dither)

    RICETTE.parent.mkdir(parents=True, exist_ok=True)
    salvate = {}
    if RICETTE.is_file():
        try:
            salvate = json.loads(RICETTE.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            salvate = {}

    salvate[opzioni.nome] = ricetta
    RICETTE.write_text(json.dumps(salvate, ensure_ascii=False, indent=1), encoding="utf-8")

    print("Ricetta '%s' scritta in %s" % (opzioni.nome, RICETTE.relative_to(RADICE)))
    print("Palette estratta (scuro -> chiaro):")
    for indice, rampa in enumerate(ricetta["rampe"]):
        print("  zona %d: #%02x%02x%02x -> #%02x%02x%02x" % (
            indice, rampa["scuro"][0], rampa["scuro"][1], rampa["scuro"][2],
            rampa["chiaro"][0], rampa["chiaro"][1], rampa["chiaro"][2]))
    print("\nOra:  python tools/crea_skin.py --solo %s" % opzioni.nome)

    return 0


if __name__ == "__main__":
    sys.exit(main())
