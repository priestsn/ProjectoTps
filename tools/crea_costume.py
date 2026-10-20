"""Costumi: accessori composti sopra i fotogrammi che esistono già.

Perché non si ridisegna il personaggio
--------------------------------------
Una skin "vestito" fatta con la diffusione perde la coerenza fra un fotogramma
e l'altro: 60 e passa frame colorati o rigenerati uno per uno ballano, e in un
picchiaduro le hitbox sono tarate sulle pose. Qui invece il corpo resta
esattamente quello originale e sopra ci va un **accessorio**, ancorato alla
testa e al collo rilevati dalla silhouette di ogni fotogramma. Il risultato è
deterministico: stesso pezzo, 68 fotogrammi, nessun flicker, e nessuna modifica
a pose, hitbox o bilanciamento.

Come si ancora
--------------
Per ogni fotogramma si prende la componente connessa più grande della sagoma
(il corpo, non la spada o gli effetti), se ne ricava il riquadro e da lì:
  - la testa sta nella fascia alta del corpo, centrata sul baricentro dei
    primi pixel opachi;
  - il collo sta subito sotto quella fascia.
Sono euristiche: su pose distese (morte, caduta) l'ancoraggio è approssimativo
e va rifinito a mano con una tabella per fotogramma.

Uso:
    python tools/crea_costume.py --personaggio OusmaneDiouf --costume smoking
    python tools/crea_costume.py --costume smoking        # tutti i verdellinesi
"""

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

RADICE = Path(__file__).resolve().parent.parent
PERSONAGGI = RADICE / "assets" / "Personaggi"
SKINS = RADICE / "assets" / "Skins"
CONTATTI = SKINS / "_contatti"

STATI = ["idle", "run", "attack", "parry", "takehit", "death", "jump", "fall"]

# Quanto è alta la fascia della testa, in frazione dell'altezza del corpo
FASCIA_TESTA = 0.16


def sagoma_corpo(dati, erosione=3):
    """Maschera del CORPO, senza armi né effetti.

    La componente connessa più grande non basta: mazza, bastone e spada sono
    attaccati alla mano, e la punta dell'arma finisce più in alto della testa
    (il cappello andava a finire sulla magia del bastone di Sekou).

    Qui si assottiglia la sagoma di qualche pixel: le strutture sottili (aste,
    lame, scintille) spariscono, il corpo resta. Si prende poi la componente
    più grande di quella versione e si riallarga restando dentro la sagoma
    originale: il risultato è il corpo con la sua testa, senza arma.
    """
    alfa = dati[:, :, 3]
    maschera = alfa > 40
    if not np.any(maschera):
        return None, None

    struttura = np.ones((3, 3), dtype=bool)
    assottigliata = ndimage.binary_erosion(maschera, structure=struttura, iterations=erosione)

    if not np.any(assottigliata):
        # sagoma troppo sottile per essere assottigliata: si usa quella intera
        assottigliata = maschera

    etichette, quante = ndimage.label(assottigliata)
    if quante == 0:
        return None, None

    aree = ndimage.sum(assottigliata, etichette, range(1, quante + 1))
    corpo = int(np.argmax(aree)) + 1

    nucleo = etichette == corpo
    riallargata = ndimage.binary_dilation(nucleo, structure=struttura, iterations=erosione)
    corpo_maschera = riallargata & maschera

    if not np.any(corpo_maschera):
        corpo_maschera = maschera

    righe, colonne = np.where(corpo_maschera)
    riquadro = (int(colonne.min()), int(righe.min()), int(colonne.max()), int(righe.max()))

    return corpo_maschera, riquadro


def righe_della_maschera(maschera):
    """Per ogni riga: quanti pixel opachi e quanto è larga la sagoma."""
    opachi = maschera.sum(axis=1)
    sinistra = np.argmax(maschera, axis=1)
    destra = maschera.shape[1] - 1 - np.argmax(maschera[:, ::-1], axis=1)
    larghezza = np.where(opachi > 0, destra - sinistra + 1, 0)
    return opachi, larghezza, sinistra, destra


RITAGLI = RADICE / "dati" / "costumi" / "ritagli.json"


def carica_ritagli():
    """Il riquadro esatto del personaggio nell'idle, da js/Verdellinesi.js.

    È l'unico dato affidabile sulla testa: la sagoma, da sola, non basta
    (chi ha una mazza o un effetto magico sopra la testa se lo vede arrivare
    addosso il cappello). Il riquadro lo ha già misurato chi ha fatto il gioco.
    """
    if not RITAGLI.is_file():
        return {}
    try:
        import json
        return json.loads(RITAGLI.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return {}


def centro_corpo(dati):
    """Centro del riquadro della componente più grande (il corpo)."""
    maschera, riquadro = sagoma_corpo(dati)
    if maschera is None:
        return None, None
    x0, y0, x1, y1 = riquadro
    return ((x0 + x1) / 2.0, (y0 + y1) / 2.0), riquadro


def riquadro_sagoma(dati):
    """Riquadro e centro dei pixel opachi del fotogramma."""
    maschera = dati[:, :, 3] > 40
    if not np.any(maschera):
        return None, None

    righe, colonne = np.where(maschera)
    x0, y0 = int(colonne.min()), int(righe.min())
    x1, y1 = int(colonne.max()), int(righe.max())

    return (x0, y0, x1, y1), ((x0 + x1) / 2.0, (y0 + y1) / 2.0)


def carica_teste():
    """La tabella delle teste (dati/costumi/teste.json)."""
    percorso = RADICE / "dati" / "costumi" / "teste.json"
    if not percorso.is_file():
        return {}
    try:
        import json
        return json.loads(percorso.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return {}


def ancore(dati, ritaglio=None, riferimento=None, testa=None):
    """Testa e collo del fotogramma.

    L'ancoraggio automatico dalla sagoma non regge su nove verdellinesi: chi
    ha una mazza o un bastone con un effetto sopra la testa se lo vede
    arrivare addosso il cappello, e i tentativi di indovinare dai profili di
    larghezza sbagliano almeno un personaggio su tre. Perciò la posizione
    della testa sta in una tabella misurata una volta (dati/costumi/teste.json,
    scostamento dall'alto del riquadro + larghezza). Qui si applica la tabella
    e si sposta l'ancora con il corpo del fotogramma.
    """
    riquadro_frame, centro_frame = riquadro_sagoma(dati)
    if not riquadro_frame:
        return None

    maschera = dati[:, :, 3] > 40

    if ritaglio and testa:
        cima = float(ritaglio["y"]) + float(testa["scarto"])
        larghezza = float(testa["larghezza"])
        altezza = larghezza * 1.15

        spostamento_x = 0.0
        spostamento_y = 0.0
        if riferimento and centro_frame:
            spostamento_x = centro_frame[0] - riferimento[0]
            spostamento_y = centro_frame[1] - riferimento[1]

        cima += spostamento_y
        centro_x = float(ritaglio["x"]) + float(ritaglio["larghezza"]) / 2.0 + spostamento_x

        # centro fine: media delle righe della testa, se ci sono pixel
        righe_banda = maschera[int(cima):int(cima + altezza), :]
        if np.any(righe_banda):
            righe, colonne = np.where(righe_banda)
            if len(colonne) > 3:
                centro_x = float(np.median(colonne))

        return {
            "testa_cx": centro_x,
            "testa_alto": cima,
            "testa_largo": larghezza,
            "testa_alta": altezza,
            "collo_y": cima + altezza,
            "corpo_alto": float(ritaglio["altezza"])
        }

    return testa_dentro_il_riquadro(maschera, riquadro_frame)


def testa_dentro_il_riquadro(maschera, riquadro):
    """Ripiego senza tabella: la testa come prima fascia piena della sagoma."""
    x0, y0, x1, y1 = riquadro
    altezza = max(1, y1 - y0)

    righe = []
    for y in range(y0, min(y1 + 1, y0 + int(altezza * 0.55))):
        colonne = np.where(maschera[y, x0:x1 + 1])[0]
        if len(colonne) == 0:
            continue
        righe.append((y, int(colonne.max() - colonne.min() + 1),
                      int(x0 + colonne.min()), int(x0 + colonne.max())))

    if not righe:
        return None

    larghezza_massima = max(r[1] for r in righe)
    piene = [r for r in righe if r[1] >= larghezza_massima * 0.50] or righe

    cima = piene[0][0]
    fondo = min(y1, cima + max(4, int(altezza * 0.22)))
    banda = [r for r in righe if cima <= r[0] <= fondo] or [piene[0]]

    sinistra = min(r[2] for r in banda)
    destra = max(r[3] for r in banda)

    return {
        "testa_cx": float((sinistra + destra) / 2.0),
        "testa_alto": float(cima),
        "testa_largo": max(6.0, float(destra - sinistra)),
        "testa_alta": max(3.0, float(fondo - cima)),
        "collo_y": float(fondo),
        "corpo_alto": float(altezza)
    }


# ========================================
# Accessori
# ========================================
# Ogni accessorio è una funzione che disegna su un livello trasparente delle
# stesse dimensioni del fotogramma, usando le ancore.

def disegna_cilindro(livello, ancore, colore, fascia_colore):
    """Cappello a cilindro: tesa, cupola e fascia colorata."""
    disegno = ImageDraw.Draw(livello)

    cx = ancore["testa_cx"]
    largo = ancore["testa_largo"]
    alta = ancore.get("testa_alta", largo)

    # La tesa appoggia sulla testa e ci affonda di un paio di pixel: appoggiata
    # appena sulla sommità sembra sospesa sopra la testa.
    base_y = ancore["testa_alto"] + max(1.5, alta * 0.18)

    # Proporzioni: un cappello più alto della testa la sovrasta e sembra
    # incollato; qui è circa i tre quarti.
    tesa_largo = largo * 1.15
    tesa_alto = max(1.0, alta * 0.10)
    cupola_largo = largo * 0.80
    cupola_alto = max(3.0, alta * 0.72)

    contorno = (18, 18, 22, 255)

    # tesa
    tesa = [cx - tesa_largo / 2, base_y - tesa_alto, cx + tesa_largo / 2, base_y]
    disegno.ellipse([tesa[0] - 1, tesa[1] - 1, tesa[2] + 1, tesa[3] + 1], fill=contorno)
    disegno.ellipse(tesa, fill=colore)

    # cupola
    cupola = [cx - cupola_largo / 2, base_y - tesa_alto - cupola_alto,
              cx + cupola_largo / 2, base_y - tesa_alto]
    disegno.rectangle([cupola[0] - 1, cupola[1] - 1, cupola[2] + 1, cupola[3]],
                      fill=contorno)
    disegno.rectangle(cupola, fill=colore)

    # fascia colorata in basso sulla cupola
    fascia_alto = max(1.5, cupola_alto * 0.22)
    disegno.rectangle([cupola[0], cupola[3] - fascia_alto, cupola[2], cupola[3]],
                      fill=fascia_colore)

    # riflesso verticale: stacca il nero del cappello dal fondo scuro
    riflesso = [cupola[0] + cupola_largo * 0.18, cupola[1] + cupola_alto * 0.12,
                cupola[0] + cupola_largo * 0.30, cupola[3] - fascia_alto]
    disegno.rectangle(riflesso, fill=(70, 72, 84, 255))

    # ombra sotto la tesa: senza, il cappello sembra appoggiato alzato di un
    # pixel; è il tocco che lo fa "sedere" sulla testa
    ombra_alto = max(1.0, alta * 0.12)
    disegno.rectangle([cx - cupola_largo * 0.42, base_y,
                       cx + cupola_largo * 0.42, base_y + ombra_alto],
                      fill=(0, 0, 0, 110))


def disegna_papillon(livello, ancore, colore):
    """Papillon al collo, con il nodo centrale."""
    disegno = ImageDraw.Draw(livello)

    cx = ancore["testa_cx"]
    alta = ancore.get("testa_alta", ancore["testa_largo"])
    cy = ancore["collo_y"] + max(1.0, alta * 0.20)
    largo = max(3.0, ancore["testa_largo"] * 0.45)
    alto = max(2.0, largo * 0.38)
    nodo = max(1.5, largo * 0.18)

    contorno = (16, 16, 20, 255)

    # ali
    disegno.polygon([(cx - largo / 2 - 1, cy), (cx - nodo, cy - alto / 2 - 1),
                     (cx - nodo, cy + alto / 2 + 1)], fill=contorno)
    disegno.polygon([(cx - largo / 2, cy), (cx - nodo, cy - alto / 2),
                     (cx - nodo, cy + alto / 2)], fill=colore)
    disegno.polygon([(cx + largo / 2 + 1, cy), (cx + nodo, cy - alto / 2 - 1),
                     (cx + nodo, cy + alto / 2 + 1)], fill=contorno)
    disegno.polygon([(cx + largo / 2, cy), (cx + nodo, cy - alto / 2),
                     (cx + nodo, cy + alto / 2)], fill=colore)

    # nodo
    disegno.rectangle([cx - nodo, cy - nodo, cx + nodo, cy + nodo], fill=colore)

    # ombra sotto il nodo: stacca il papillon dalla camicia
    disegno.rectangle([cx - nodo * 0.9, cy + nodo, cx + nodo * 0.9, cy + nodo + max(1.0, nodo)],
                      fill=(0, 0, 0, 90))


def disegna_camicia(livello, dati, ancore):
    """Davanti della camicia bianca: un cuneo sotto il papillon."""
    disegno = ImageDraw.Draw(livello)

    cx = ancore["testa_cx"]
    alta = ancore.get("testa_alta", ancore["testa_largo"])
    alto = ancore["collo_y"] + max(1.0, alta * 0.15)
    largo = max(2.5, ancore["testa_largo"] * 0.26)
    fondo = alto + max(3.0, alta * 0.75)

    disegno.polygon([(cx - largo / 2, alto), (cx + largo / 2, alto),
                     (cx, fondo)], fill=(238, 238, 232, 255))


COSTUMI = {
    "smoking": {
        "nome": "Smoking",
        "prezzo": 2000,
        "descrizione": "Cilindro, papillon e camicia bianca",
        "disegna": [
            lambda livello, dati, ancore: disegna_camicia(livello, dati, ancore),
            lambda livello, dati, ancore: disegna_cilindro(livello, ancore, (28, 28, 34, 255), (150, 30, 40, 255)),
            lambda livello, dati, ancore: disegna_papillon(livello, ancore, (150, 30, 40, 255))
        ]
    }
}


def applica_costume(immagine, costume, ritaglio=None, riferimento=None, testa=None):
    """Compone l'accessorio su un singolo fotogramma."""
    dati = np.asarray(immagine.convert("RGBA"), dtype=np.uint8)
    if dati.shape[2] != 4:
        return immagine

    ancore = ancore_di(dati, ritaglio, riferimento, testa)
    if not ancore:
        return immagine

    livello = Image.new("RGBA", immagine.size, (0, 0, 0, 0))
    for disegna in costume["disegna"]:
        disegna(livello, dati, ancore)

    base = immagine.convert("RGBA").copy()
    base.alpha_composite(livello)
    return base


def ancore_di(dati, ritaglio=None, riferimento=None, testa=None):
    return ancore(dati, ritaglio, riferimento, testa)


def frame_del_foglio(percorso):
    """Divide un foglio in fotogrammi quadrati (la cella è alta quanto il foglio)."""
    with Image.open(percorso) as foglio:
        foglio = foglio.convert("RGBA")
        lato = foglio.height
        quante = foglio.width // lato
        for indice in range(quante):
            yield indice, foglio.crop((indice * lato, 0, (indice + 1) * lato, lato))


def riferimento_idle(nome_personaggio):
    """Centro del corpo nel primo fotogramma dell'idle: è il metro degli scarti."""
    idle = PERSONAGGI / nome_personaggio / "idle.png"
    if not idle.is_file():
        return None

    with Image.open(idle) as foglio:
        foglio = foglio.convert("RGBA")
        lato = foglio.height
        frame = foglio.crop((0, 0, lato, lato))

    # stesso metro usato per gli altri fotogrammi (riquadro_sagoma): se qui si
    # usasse un'altra misura lo scarto dell'idle non sarebbe zero e l'ancora
    # partirebbe già spostata.
    _, centro = riquadro_sagoma(np.asarray(frame, dtype=np.uint8))
    return centro


def genera_costume(nome_personaggio, nome_costume, costume, forza=False):
    cartella = SKINS / ("%s-%s" % (nome_personaggio, nome_costume))
    cartella.mkdir(parents=True, exist_ok=True)

    ritaglio = carica_ritagli().get(nome_personaggio)
    testa = carica_teste().get(nome_personaggio)
    riferimento = riferimento_idle(nome_personaggio)

    for stato in STATI:
        sorgente = PERSONAGGI / nome_personaggio / (stato + ".png")
        if not sorgente.is_file():
            continue

        uscita = cartella / (stato + ".png")
        if uscita.exists() and not forza:
            continue

        with Image.open(sorgente) as foglio:
            foglio = foglio.convert("RGBA")
            lato = foglio.height
            quante = foglio.width // lato
            risultato = Image.new("RGBA", foglio.size, (0, 0, 0, 0))

            for indice in range(quante):
                frame = foglio.crop((indice * lato, 0, (indice + 1) * lato, lato))
                risultato.alpha_composite(
                    applica_costume(frame, costume, ritaglio, riferimento, testa),
                    (indice * lato, 0))

            risultato.save(uscita, "PNG", optimize=True)

    # ritratto: primo fotogramma dell'idle vestito
    idle = PERSONAGGI / nome_personaggio / "idle.png"
    if idle.is_file():
        with Image.open(idle) as foglio:
            foglio = foglio.convert("RGBA")
            lato = foglio.height
            frame = foglio.crop((0, 0, lato, lato))
            applica_costume(frame, costume, ritaglio, riferimento, testa).save(
                cartella / "ritratto.png", "PNG", optimize=True)

    dimensione = sum(f.stat().st_size for f in cartella.glob("*.png")) / 1024
    return dimensione


def foglio_confronto(nome_personaggio, nome_costume, stati=("idle", "attack"), scala=3):
    """Base sopra, costume sotto: due righe per lo stesso stato."""
    righe = []

    for stato in stati:
        base = PERSONAGGI / nome_personaggio / (stato + ".png")
        vestito = SKINS / ("%s-%s" % (nome_personaggio, nome_costume)) / (stato + ".png")
        if not base.is_file() or not vestito.is_file():
            continue

        with Image.open(base) as a, Image.open(vestito) as b:
            a = a.convert("RGBA")
            b = b.convert("RGBA")
            lato = a.height
            frame_a = a.crop((0, 0, lato, lato))
            frame_b = b.crop((0, 0, lato, lato))

        riga = Image.new("RGBA", (lato * 3 + 8, lato), (18, 18, 22, 255))
        riga.alpha_composite(frame_a, (0, 0))
        riga.alpha_composite(frame_b, (lato + 4, 0))
        righe.append(riga)

    if not righe:
        return None

    larghezza = max(r.width for r in righe)
    altezza = sum(r.height for r in righe) + 4 * (len(righe) - 1)
    tela = Image.new("RGBA", (larghezza, altezza), (18, 18, 22, 255))

    y = 0
    for riga in righe:
        tela.alpha_composite(riga, (0, y))
        y += riga.height + 4

    CONTATTI.mkdir(parents=True, exist_ok=True)
    uscita = CONTATTI / ("%s-%s.png" % (nome_personaggio, nome_costume))
    tela.resize((tela.width * scala, tela.height * scala), Image.NEAREST).save(uscita, "PNG")
    return uscita


def main():
    argomenti = argparse.ArgumentParser()
    argomenti.add_argument("--costume", default="smoking")
    argomenti.add_argument("--personaggio", default=None)
    argomenti.add_argument("--forza", action="store_true")
    opzioni = argomenti.parse_args()

    if opzioni.costume not in COSTUMI:
        print("Costume sconosciuto:", opzioni.costume, "| disponibili:", list(COSTUMI))
        return 1

    costume = COSTUMI[opzioni.costume]
    personaggi = sorted(p.name for p in PERSONAGGI.iterdir() if p.is_dir())
    if opzioni.personaggio:
        personaggi = [p for p in personaggi if p == opzioni.personaggio]
        if not personaggi:
            print("Personaggio non trovato:", opzioni.personaggio)
            return 1

    for nome in personaggi:
        kb = genera_costume(nome, opzioni.costume, costume, forza=opzioni.forza)
        confronto = foglio_confronto(nome, opzioni.costume)
        print("%-16s %6.1f KB  %s" % (nome, kb, confronto.relative_to(RADICE) if confronto else "-"))

    return 0


if __name__ == "__main__":
    sys.exit(main())
