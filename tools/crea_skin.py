"""Genera le skin dei verdellinesi con un motore di ricette.

Il principio
------------
Una skin non è un filtro applicato a tutto il foglio: è una **ricetta** che
dice, per ogni zona di colore del verdellinese, su quale rampa scuro->chiaro
portarla, più eventuali trattamenti (rim light, dithering).

Le zone non si disegnano a mano: si ricavano dai fogli stessi raggruppando i
colori in OKLab (lo spazio in cui le distanze di colore sono percettive, non
come l'RGB). I gruppi vengono messi in ordine di luminanza: il primo è
l'ombra/contorno, l'ultimo la luce. Così "camicia", "pelle" e "metallo"
finiscono in gruppi diversi e possono avere colori diversi, invece di essere
tutti lo stesso filtro.

Applicazione: ogni pixel va nel gruppo più vicino (calcolato sui colori
ORIGINALI, quindi la mappa è stabile) e dentro il gruppo conserva la sua
posizione relativa sulla rampa. Ombre e pieghe restano dove sono: cambia il
colore, non il disegno. L'alfa non viene mai toccata.

Uso:
    python tools/crea_skin.py                      # tutte le skin
    python tools/crea_skin.py --solo ombrosa       # una sola
    python tools/crea_skin.py --forza --contatti   # rigenera e rifà i confronti
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RADICE = Path(__file__).resolve().parent.parent
PERSONAGGI = RADICE / "assets" / "Personaggi"
SKINS = RADICE / "assets" / "Skins"
CONTATTI = SKINS / "_contatti"
RICETTE = RADICE / "dati" / "skin" / "ricette.json"
ZONE = RADICE / "dati" / "skin" / "zone"

STATI = ["idle", "run", "attack", "parry", "takehit", "death", "jump", "fall"]
GRUPPI = 5          # zone di colore ricavate da ogni verdellinese
CAMPIONE = 20000    # pixel usati per il raggruppamento (basta e avanza)


# ========================================
# Colore: sRGB <-> OKLab
# ========================================

def srgb_a_lineare(c):
    c = c.astype(np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lineare_a_srgb(c):
    c = np.clip(c, 0.0, 1.0)
    valore = np.where(c <= 0.0031308, c * 12.92, 1.055 * (c ** (1 / 2.4)) - 0.055)
    return np.clip(valore * 255.0, 0, 255)


def oklab_a_rgb(lab):
    """OKLab (N,3) -> rgb (N,3) 0..255. Serve a rigirare in colore le rampe."""
    l_ = lab[:, 0] + 0.3963377774 * lab[:, 1] + 0.2158037573 * lab[:, 2]
    m_ = lab[:, 0] - 0.1055613458 * lab[:, 1] - 0.0638541728 * lab[:, 2]
    s_ = lab[:, 0] - 0.0894841775 * lab[:, 1] - 1.2914855480 * lab[:, 2]

    l = l_ ** 3
    m = m_ ** 3
    s = s_ ** 3

    lineare = np.stack([
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    ], axis=1)

    return lineare_a_srgb(lineare)


def rgb_a_oklab(rgb):
    """rgb: array (N,3) 0..255 -> OKLab (N,3)."""
    lineare = srgb_a_lineare(rgb)

    l = 0.4122214708 * lineare[:, 0] + 0.5363325363 * lineare[:, 1] + 0.0514459929 * lineare[:, 2]
    m = 0.2119034982 * lineare[:, 0] + 0.6806995451 * lineare[:, 1] + 0.1073969566 * lineare[:, 2]
    s = 0.0883024619 * lineare[:, 0] + 0.2817188376 * lineare[:, 1] + 0.6299787005 * lineare[:, 2]

    l_ = np.cbrt(l)
    m_ = np.cbrt(m)
    s_ = np.cbrt(s)

    return np.stack([
        0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    ], axis=1)


# ========================================
# Zone di colore di un verdellinese
# ========================================

def leggi_pixel_visibili(percorso):
    """Colori RGB dei soli pixel opachi di un foglio."""
    with Image.open(percorso) as immagine:
        dati = np.asarray(immagine.convert("RGBA"), dtype=np.uint8)
    visibili = dati[dati[:, :, 3] > 8]
    return visibili[:, :3]


def calcola_zone(nome):
    """Raggruppa i colori del verdellinese in GRUPPI zone, ordinate per luce."""
    campioni = []
    for stato in ("idle", "attack", "run"):
        percorso = PERSONAGGI / nome / (stato + ".png")
        if percorso.is_file():
            campioni.append(leggi_pixel_visibili(percorso))

    if not campioni:
        return None

    pixel = np.concatenate(campioni, axis=0).astype(np.float64)
    if len(pixel) > CAMPIONE:
        scelta = np.random.default_rng(12345).choice(len(pixel), CAMPIONE, replace=False)
        pixel = pixel[scelta]

    lab = rgb_a_oklab(pixel)

    # K-means semplice: inizializzazione sui quantili, poi iterazioni.
    luminanze = lab[:, 0]
    quantili = np.linspace(0.02, 0.98, GRUPPI)
    centri = np.stack([
        np.array([np.quantile(luminanze, q),
                  np.quantile(lab[:, 1], q),
                  np.quantile(lab[:, 2], q)]) for q in quantili
    ])

    for _ in range(40):
        distanze = ((lab[:, None, :] - centri[None, :, :]) ** 2).sum(axis=2)
        assegnazione = distanze.argmin(axis=1)
        nuovi = np.array([
            lab[assegnazione == i].mean(axis=0) if np.any(assegnazione == i) else centri[i]
            for i in range(GRUPPI)
        ])
        if np.allclose(nuovi, centri, atol=1e-5):
            centri = nuovi
            break
        centri = nuovi

    # ordine per luminanza: gruppo 0 = piu' scuro, ultimo = piu' chiaro
    ordine = np.argsort(centri[:, 0])
    centri = centri[ordine]

    distanze = ((lab[:, None, :] - centri[None, :, :]) ** 2).sum(axis=2)
    assegnazione = distanze.argmin(axis=1)

    zone = []
    for i in range(GRUPPI):
        membri = lab[assegnazione == i]
        if len(membri) == 0:
            zone.append({"lab": centri[i].tolist(), "min": 0.0, "max": 1.0, "quota": 0.0})
            continue
        lum = membri[:, 0]
        zone.append({
            "lab": centri[i].tolist(),
            "min": float(np.quantile(lum, 0.02)),
            "max": float(np.quantile(lum, 0.98)),
            "quota": float(len(membri) / len(lab))
        })

    return {"gruppi": GRUPPI, "zone": zone}


def zone_di(nome, forza=False):
    """Zone del verdellinese: calcolate una volta e salvate in dati/skin/zone."""
    ZONE.mkdir(parents=True, exist_ok=True)
    percorso = ZONE / (nome + ".json")

    if percorso.is_file() and not forza:
        return json.loads(percorso.read_text(encoding="utf-8"))

    zone = calcola_zone(nome)
    if zone:
        percorso.write_text(json.dumps(zone, ensure_ascii=False, indent=1), encoding="utf-8")
    return zone


# ========================================
# Applicazione di una ricetta
# ========================================

MATRICE_BAYER = np.array([
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
], dtype=np.float64) / 16.0


def applica_ricetta(immagine, zone, ricetta):
    """Porta ogni pixel sulla rampa della sua zona, con i trattamenti della ricetta."""
    dati = np.asarray(immagine.convert("RGBA"), dtype=np.uint8)
    altezza, larghezza = dati.shape[:2]

    rgb = dati[:, :, :3].astype(np.float64)
    alfa = dati[:, :, 3]
    opachi = alfa > 0

    if not np.any(opachi):
        return immagine

    piatto = rgb.reshape(-1, 3)
    lab = rgb_a_oklab(piatto)

    centri = np.array([z["lab"] for z in zone["zone"]])
    distanze = ((lab[:, None, :] - centri[None, :, :]) ** 2).sum(axis=2)
    assegnazione = distanze.argmin(axis=1)

    uscita = np.zeros_like(piatto)
    rampe = ricetta["rampe"]

    for indice in range(len(zone["zone"])):
        # se la ricetta ha meno rampe delle zone, l'ultima vale per tutte
        rampa = rampe[indice] if indice < len(rampe) else rampe[-1]

        scuro = np.array(rampa["scuro"], dtype=np.float64)
        chiaro = np.array(rampa["chiaro"], dtype=np.float64)

        membri = np.where(assegnazione == indice)[0]
        if len(membri) == 0:
            continue

        luce = lab[membri, 0]
        minimo = zone["zone"][indice]["min"]
        massimo = zone["zone"][indice]["max"]
        ampiezza = max(massimo - minimo, 1e-6)
        t = np.clip((luce - minimo) / ampiezza, 0.0, 1.0)

        # contrasto: >1 schiaccia le ombre, <1 le apre
        t = t ** ricetta.get("contrasto", 1.0)

        if ricetta.get("dither"):
            righe, colonne = np.unravel_index(membri, (altezza, larghezza))
            rumore = MATRICE_BAYER[righe % 4, colonne % 4]
            t = np.clip(t + (rumore - 0.5) * 0.12, 0.0, 1.0)

        uscita[membri] = scuro + (chiaro - scuro) * t[:, None]

    # --- rim light: i pixel sul bordo del personaggio si accendono ---
    rim = ricetta.get("rim")
    alfa_piatta = alfa.reshape(-1).copy()
    if rim:
        colore = np.array(rim["colore"], dtype=np.float64)
        intensita = float(rim.get("intensita", 0.55))

        # Il bordo si allarga per passi: con un solo pixel a questa scala il
        # contorno luminoso non si vede. `spessore` = quanti pixel di bordo.
        spessore = int(rim.get("spessore", 2))
        interno = opachi.copy()
        for passo in range(1, spessore + 1):
            trasparente = (~interno).astype(np.uint8)
            vicino_trasparente = np.zeros_like(trasparente, dtype=bool)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    spostato = np.roll(np.roll(trasparente, dy, axis=0), dx, axis=1)
                    vicino_trasparente |= spostato.astype(bool)

            bordo = (vicino_trasparente & interno).reshape(-1)
            if not np.any(bordo):
                break

            # il bordo esterno si accende di più, quello interno di meno
            peso = intensita * (1.0 - (passo - 1) / (spessore + 1))
            uscita[bordo] = uscita[bordo] * (1 - peso) + colore * peso
            interno = interno & (~vicino_trasparente)

        # --- alone esterno: qualche pixel FUORI dalla sagoma, semitrasparente.
        # Un contorno ricolorato si nota appena; un bagliore attorno alla figura
        # si vede. `alone` = (pixel di spessore, alfa massima).
        alone = rim.get("alone")
        if alone:
            spessore_alone = int(alone[0])
            alfa_massima = int(alone[1])

            sagoma = opachi.copy()
            fuori = ~sagoma
            for passo in range(1, spessore_alone + 1):
                vicino_opaco = np.zeros_like(sagoma)
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if dx == 0 and dy == 0:
                            continue
                        vicino_opaco |= np.roll(np.roll(sagoma, dy, axis=0), dx, axis=1)

                anello = vicino_opaco & fuori
                if not np.any(anello):
                    break

                quota = 1.0 - (passo - 1) / spessore_alone
                alfa_anello = int(alfa_massima * quota)

                indici = anello.reshape(-1)
                uscita[indici] = colore
                alfa_piatta[indici] = np.maximum(alfa_piatta[indici], alfa_anello)

                fuori = fuori & (~vicino_opaco)

    risultato = np.zeros((altezza, larghezza, 4), dtype=np.uint8)
    risultato[:, :, :3] = np.clip(uscita.reshape(altezza, larghezza, 3), 0, 255).astype(np.uint8)
    risultato[:, :, 3] = alfa_piatta.reshape(altezza, larghezza)

    return Image.fromarray(risultato, "RGBA")


# ========================================
# Ricette
# ========================================

RICETTE_PREDEFINITE = {
    "raro": {
        "nome": "Raro",
        "prezzo": 1000,
        "descrizione": "Tinta piatta su tutto il verdellinese",
        "contrasto": 1.0,
        "dither": False,
        "rim": None,
        # una sola rampa: tutte le zone finiscono sullo stesso colore
        "rampe": [{"scuro": [12, 12, 12], "chiaro": [255, 255, 255]}],
        # ...ma il colore è diverso per verdellinese: una tinta sola uguale per
        # tutti e nove li renderebbe indistinguibili a colpo d'occhio.
        "per_personaggio": {
            "OusmaneDiouf": {"scuro": [58, 42, 8], "chiaro": [255, 215, 94]},
            "KwameMensah": {"scuro": [18, 42, 58], "chiaro": [159, 232, 255]},
            "ChidiOkonkwo": {"scuro": [58, 13, 18], "chiaro": [255, 122, 107]},
            "AmaraDiallo": {"scuro": [11, 47, 28], "chiaro": [125, 255, 158]},
            "TarisaiMoyo": {"scuro": [38, 16, 58], "chiaro": [199, 155, 255]},
            "ZuriNkosi": {"scuro": [11, 31, 58], "chiaro": [134, 183, 255]},
            "BakariTraore": {"scuro": [58, 30, 5], "chiaro": [255, 178, 87]},
            "SekouCamara": {"scuro": [51, 10, 42], "chiaro": [255, 138, 216]},
            "AyoAdebayo": {"scuro": [5, 41, 43], "chiaro": [111, 230, 216]}
        }
    },
    "ombrosa": {
        "nome": "Ombrosa",
        "prezzo": 1500,
        "descrizione": "Zone fredde, ombre profonde, bordo luminoso ciano",
        "contrasto": 1.25,
        "dither": True,
        "rim": {"colore": [140, 235, 255], "intensita": 0.6, "alone": [2, 110]},
        "rampe": [
            {"scuro": [6, 10, 20], "chiaro": [70, 90, 120]},
            {"scuro": [12, 22, 44], "chiaro": [96, 140, 190]},
            {"scuro": [24, 40, 70], "chiaro": [150, 200, 235]},
            {"scuro": [50, 70, 105], "chiaro": [205, 235, 255]},
            {"scuro": [110, 150, 190], "chiaro": [245, 252, 255]}
        ]
    },
    "fiamma": {
        "nome": "Fiamma",
        "prezzo": 1500,
        "descrizione": "Rampa calda, bordo incandescente",
        "contrasto": 1.15,
        "dither": False,
        "rim": {"colore": [255, 170, 60], "intensita": 0.65, "alone": [2, 105]},
        "rampe": [
            {"scuro": [30, 6, 4], "chiaro": [120, 45, 20]},
            {"scuro": [70, 12, 6], "chiaro": [200, 80, 25]},
            {"scuro": [120, 30, 8], "chiaro": [245, 140, 40]},
            {"scuro": [180, 80, 20], "chiaro": [255, 210, 110]},
            {"scuro": [230, 150, 60], "chiaro": [255, 245, 200]}
        ]
    },
    "ghiaccio": {
        "nome": "Ghiaccio",
        "prezzo": 1500,
        "descrizione": "Rampa fredda con dithering, bordo bianco-azzurro",
        "contrasto": 0.9,
        "dither": True,
        "rim": {"colore": [235, 250, 255], "intensita": 0.5, "alone": [2, 95]},
        "rampe": [
            {"scuro": [8, 16, 30], "chiaro": [70, 110, 150]},
            {"scuro": [16, 36, 60], "chiaro": [120, 180, 220]},
            {"scuro": [30, 60, 95], "chiaro": [170, 220, 245]},
            {"scuro": [70, 120, 160], "chiaro": [220, 245, 255]},
            {"scuro": [150, 200, 230], "chiaro": [255, 255, 255]}
        ]
    }
}


def carica_ricette():
    """Ricette predefinite + quelle salvate in dati/skin/ricette.json."""
    ricette = {k: dict(v) for k, v in RICETTE_PREDEFINITE.items()}

    if RICETTE.is_file():
        try:
            salvate = json.loads(RICETTE.read_text(encoding="utf-8"))
            for nome, dati in salvate.items():
                if isinstance(dati, dict) and dati.get("rampe"):
                    ricette[nome] = dati
        except (ValueError, OSError) as errore:
            print("  ricette.json illeggibile:", errore)

    return ricette


# ========================================
# Generazione
# ========================================

def primo_fotogramma(percorso):
    """Il primo fotogramma del foglio come ritratto (la cella è quadrata)."""
    with Image.open(percorso) as foglio:
        foglio = foglio.convert("RGBA")
        larghezza, altezza = foglio.size
        if larghezza < altezza:
            return None
        return foglio.crop((0, 0, altezza, altezza))


def ricetta_per(nome, ricetta):
    """La ricetta adattata al verdellinese (colore dedicato, se previsto)."""
    dedicata = (ricetta.get("per_personaggio") or {}).get(nome)
    if not dedicata:
        return ricetta

    adattata = dict(ricetta)
    adattata["rampe"] = [dedicata]
    return adattata


def genera_skin(nome, ricetta_id, ricetta, forza=False):
    cartella = SKINS / ("%s-%s" % (nome, ricetta_id))
    cartella.mkdir(parents=True, exist_ok=True)

    zone = zone_di(nome)
    if not zone:
        return None

    ricetta = ricetta_per(nome, ricetta)

    quanti = 0
    for stato in STATI:
        sorgente = PERSONAGGI / nome / (stato + ".png")
        if not sorgente.is_file():
            continue

        uscita = cartella / (stato + ".png")
        if uscita.exists() and not forza:
            quanti += 1
            continue

        with Image.open(sorgente) as originale:
            applica_ricetta(originale, zone, ricetta).save(uscita, "PNG", optimize=True)
        quanti += 1

    idle = PERSONAGGI / nome / "idle.png"
    if idle.is_file():
        ritaglio = primo_fotogramma(idle)
        if ritaglio is not None:
            applica_ricetta(ritaglio, zone, ricetta).save(cartella / "ritratto.png", "PNG", optimize=True)

    dimensione = sum(f.stat().st_size for f in cartella.glob("*.png")) / 1024
    return (nome, ricetta_id, quanti, dimensione)


def foglio_confronto(nome, elenco_skin, scala=2):
    """Un'immagine con lo stesso fotogramma in tutte le versioni, affiancate."""
    colonne = []

    with Image.open(PERSONAGGI / nome / "idle.png") as base:
        base = base.convert("RGBA")
        lato = base.height
        colonne.append(base.crop((0, 0, lato, lato)))

    for skin in elenco_skin:
        percorso = SKINS / ("%s-%s" % (nome, skin)) / "idle.png"
        if not percorso.is_file():
            continue
        with Image.open(percorso) as foglio:
            foglio = foglio.convert("RGBA")
            colonne.append(foglio.crop((0, 0, foglio.height, foglio.height)))

    if len(colonne) < 2:
        return None

    lato = colonne[0].height
    tela = Image.new("RGBA", (lato * len(colonne), lato), (18, 18, 22, 255))

    for indice, colonna in enumerate(colonne):
        tela.alpha_composite(colonna, (indice * lato, 0))

    CONTATTI.mkdir(parents=True, exist_ok=True)
    uscita = CONTATTI / (nome + ".png")
    tela.resize((tela.width * scala, tela.height * scala), Image.NEAREST).save(uscita, "PNG")
    return uscita


def main():
    argomenti = argparse.ArgumentParser()
    argomenti.add_argument("--solo", help="genera una sola skin")
    argomenti.add_argument("--personaggio", help="un solo verdellinese")
    argomenti.add_argument("--forza", action="store_true", help="riscrive file esistenti")
    argomenti.add_argument("--rzone", action="store_true", help="ricalcola le zone di colore")
    argomenti.add_argument("--contatti", action="store_true", help="solo i fogli di confronto")
    argomenti.add_argument("--login", default=None,
                           help="skin da mettere nel confronto, separate da virgola")
    opzioni = argomenti.parse_args()

    if not PERSONAGGI.is_dir():
        print("Cartella dei personaggi non trovata:", PERSONAGGI)
        return 1

    ricette = carica_ricette()
    elenco = [opzioni.solo] if opzioni.solo else list(RICETTE_PREDEFINITE)
    elenco = [s for s in elenco if s in ricette]

    personaggi = sorted(p.name for p in PERSONAGGI.iterdir() if p.is_dir())
    if opzioni.personaggio:
        personaggi = [p for p in personaggi if p == opzioni.personaggio]

    if not opzioni.contatti:
        totale = 0
        for nome in personaggi:
            zone_di(nome, forza=opzioni.rzone)
            for skin in elenco:
                esito = genera_skin(nome, skin, ricette[skin], forza=opzioni.forza)
                if esito:
                    _, _, quanti, kb = esito
                    totale += kb
                    print("%-16s %-9s %d fogli %6.1f KB" % (nome, skin, quanti, kb))
        print("\n%.1f KB in totale in assets/Skins/" % totale)

    confronto = opzioni.login.split(",") if opzioni.login else elenco
    print("\nFogli di confronto (base + %s):" % ", ".join(confronto))
    for nome in personaggi:
        uscita = foglio_confronto(nome, confronto)
        if uscita:
            print("  ", uscita.relative_to(RADICE))

    return 0


if __name__ == "__main__":
    sys.exit(main())
