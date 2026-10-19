// ========================================
// Effetti visivi
// ==========================================
// Effetti animati (fogli di sprite) + particelle + onde + tinte + scosse.
//
// Gli sprite vengono da due pacchetti gratuiti di itch.io, licenza CC BY 4.0
// (credito obbligatorio, vedi assets/Effetti/CREDITI.md):
//   - "Combat FX Free" di heyheythere: colpo, parata, critico, caricato
//   - "Explosion FX Free" di heyheythere: ultimate, proiettile, fumo
// Ogni foglio è una griglia di fotogrammi (colonne x righe) con celle quadrate;
// metadata ricavati da effects.json dei pacchetti.
//
// REGOLA: gli effetti NON toccano la simulazione. Avanzano una volta per passo
// (1/60 di secondo) e si disegnano sopra la scena. Se sparissero tutti, il gioco
// sarebbe identico: solo più povero da guardare.
//
// Se le immagini non caricano (rete lenta, cartella spostata), restano le forme
// geometriche disegnate col canvas: nessun errore, nessun blocco.

const MASSIMO_PARTICELLE = 220;
const MASSIMO_ANIMAZIONI = 14;
const GRAVITA_PARTICELLA = 0.12;
const ATTRITO_PARTICELLA = 0.98;

// Un passo di simulazione vale 1/60 di secondo: un effetto a 30 fps avanza ogni
// due passi (60 / fps).
const PASSI_PER_SECONDO = 60;

// Fogli di sprite disponibili. `scala` è quanto viene ingrandita la cella da
// 128 px: un colpo si vede a 192 px, un'ultimate a oltre 400.
const ANIMAZIONI_EFFETTI = {
    colpo: { file: 'assets/Effetti/colpo.png', fotogrammi: 12, fps: 30, colonne: 8, righe: 2, cella: 128, scala: 1.5 },
    parata: { file: 'assets/Effetti/parata.png', fotogrammi: 16, fps: 30, colonne: 8, righe: 2, cella: 128, scala: 1.3 },
    critico: { file: 'assets/Effetti/critico.png', fotogrammi: 20, fps: 30, colonne: 8, righe: 3, cella: 128, scala: 2.0 },
    caricato: { file: 'assets/Effetti/caricato.png', fotogrammi: 16, fps: 30, colonne: 8, righe: 2, cella: 128, scala: 1.8 },
    ultimate: { file: 'assets/Effetti/ultimate.png', fotogrammi: 32, fps: 30, colonne: 8, righe: 4, cella: 128, scala: 3.2 },
    proiettile: { file: 'assets/Effetti/proiettile.png', fotogrammi: 16, fps: 30, colonne: 8, righe: 2, cella: 128, scala: 2.2 },
    fumo: { file: 'assets/Effetti/fumo.png', fotogrammi: 16, fps: 30, colonne: 8, righe: 2, cella: 128, scala: 1.6 }
};

const immaginiEffetti = {};

/**
 * Avvia il caricamento dei fogli di sprite: si chiama una volta all'avvio e non
 * aspetta. Finché un'immagine non è pronta si usano le forme geometriche.
 */
function preparaAnimazioniEffetti() {
    if (typeof Image !== 'function') {
        return;
    }
    for (const nome in ANIMAZIONI_EFFETTI) {
        const immagine = new Image();
        immagine.loaded = false;
        immagine.addEventListener('load', () => { immagine.loaded = true; });
        immagine.src = ANIMAZIONI_EFFETTI[nome].file;
        immaginiEffetti[nome] = immagine;
    }
}

function animazionePronta(nome) {
    const immagine = immaginiEffetti[nome];
    return !!(immagine && immagine.loaded && immagine.width > 0);
}

function creaSistemaEffetti() {
    return {
        particelle: [],
        onde: [],
        animazioni: [],
        scossa: 0,
        tinta: null,   // { colore, forza, timer, durata }
        aura: null     // { lottatore, colore, timer, durata }
    };
}

/**
 * Fa partire un effetto animato in un punto. `scala` moltiplica la dimensione
 * della cella (128 px): 1 = 128 px, 3 = 384 px.
 */
function avviaAnimazione(sistema, nome, x, y, scala) {
    const dati = ANIMAZIONI_EFFETTI[nome];
    if (!dati) {
        return null;
    }
    if (sistema.animazioni.length >= MASSIMO_ANIMAZIONI) {
        sistema.animazioni.shift();
    }

    const istanza = {
        nome: nome,
        x: x,
        y: y,
        scala: scala || dati.scala,
        fotogramma: 0,
        attesa: 0,
        passiPerFotogramma: Math.max(1, Math.round(PASSI_PER_SECONDO / dati.fps)),
        dati: dati
    };

    sistema.animazioni.push(istanza);
    return istanza;
}

/**
 * Sparge particelle da un punto: sono i detriti del colpo.
 */
function aggiungiParticelle(sistema, x, y, colore, quante, forza) {
    const numero = Math.max(0, Math.floor(quante));
    for (let i = 0; i < numero; i++) {
        if (sistema.particelle.length >= MASSIMO_PARTICELLE) {
            break;
        }
        const angolo = Math.random() * Math.PI * 2;
        const spinta = forza * (0.4 + Math.random() * 0.8);
        const vita = 22 + Math.floor(Math.random() * 16);

        sistema.particelle.push({
            x: x,
            y: y,
            vx: Math.cos(angolo) * spinta,
            vy: Math.sin(angolo) * spinta - forza * 0.3,
            raggio: 2 + Math.random() * 3,
            colore: colore,
            vita: vita,
            vitaIniziale: vita
        });
    }
    return sistema.particelle.length;
}

/**
 * Onda circolare: la "bolla" della parata, il colpo dell'ultimate.
 */
function aggiungiOnda(sistema, x, y, colore, raggioMassimo, spessore) {
    sistema.onde.push({
        x: x,
        y: y,
        colore: colore,
        raggio: 6,
        raggioMassimo: raggioMassimo || 90,
        spessore: spessore || 6,
        vita: 18,
        vitaIniziale: 18
    });
}

/**
 * Scossa dello schermo: tiene sempre la forza più alta in corso.
 */
function scuoti(sistema, forza) {
    sistema.scossa = Math.max(sistema.scossa, forza);
}

/**
 * Tinta a tutto schermo (flash del perfect block, colore dell'ultimate).
 */
function tigni(sistema, colore, forza, durata) {
    sistema.tinta = { colore: colore, forza: forza, timer: durata, durata: durata };
}

/**
 * Alone luminoso addosso a un lottatore: dice "l'ultimate è in corso" (o che un
 * buff è attivo). Tiene il riferimento al lottatore, quindi lo segue da solo.
 */
function accendiAura(sistema, lottatore, colore, durata) {
    sistema.aura = { lottatore: lottatore, colore: colore, timer: durata, durata: durata };
}

function aggiornaEffetti(sistema) {
    // Effetti animati: avanzano di un fotogramma ogni 60/fps passi
    for (let i = sistema.animazioni.length - 1; i >= 0; i--) {
        const a = sistema.animazioni[i];
        a.attesa++;
        if (a.attesa < a.passiPerFotogramma) {
            continue;
        }
        a.attesa = 0;
        a.fotogramma++;
        if (a.fotogramma >= a.dati.fotogrammi) {
            sistema.animazioni.splice(i, 1);
        }
    }

    for (let i = sistema.particelle.length - 1; i >= 0; i--) {
        const p = sistema.particelle[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += GRAVITA_PARTICELLA;
        p.vx *= ATTRITO_PARTICELLA;
        p.vita--;
        if (p.vita <= 0) {
            sistema.particelle.splice(i, 1);
        }
    }

    for (let i = sistema.onde.length - 1; i >= 0; i--) {
        const o = sistema.onde[i];
        o.raggio += (o.raggioMassimo - o.raggio) * 0.25;
        o.vita--;
        if (o.vita <= 0) {
            sistema.onde.splice(i, 1);
        }
    }

    sistema.scossa *= 0.82;
    if (sistema.scossa < 0.3) {
        sistema.scossa = 0;
    }

    if (sistema.tinta) {
        sistema.tinta.timer--;
        if (sistema.tinta.timer <= 0) {
            sistema.tinta = null;
        }
    }

    if (sistema.aura) {
        sistema.aura.timer--;
        if (sistema.aura.timer <= 0) {
            sistema.aura = null;
        }
    }
}

/**
 * Disegna un fotogramma di un effetto animato, centrato in (x, y).
 * Restituisce false se l'immagine non è ancora pronta.
 */
function disegnaAnimazione(ctx, istanza) {
    if (!animazionePronta(istanza.nome)) {
        return false;
    }

    const dati = istanza.dati;
    const colonna = istanza.fotogramma % dati.colonne;
    const riga = Math.floor(istanza.fotogramma / dati.colonne);
    const cella = dati.cella;
    const lato = cella * istanza.scala;

    ctx.drawImage(
        immaginiEffetti[istanza.nome],
        colonna * cella, riga * cella, cella, cella,
        istanza.x - lato / 2, istanza.y - lato / 2, lato, lato
    );
    return true;
}

/**
 * Disegna tutto sopra la scena. `ctx` è il contesto del canvas.
 */
function disegnaEffetti(sistema, ctx) {
    ctx.save();

    // Alone addosso al lottatore: in "lighter" si somma al personaggio
    if (sistema.aura && sistema.aura.lottatore && sistema.aura.lottatore.position) {
        const lottatore = sistema.aura.lottatore;
        const frazione = sistema.aura.timer / sistema.aura.durata;
        const x = lottatore.position.x + lottatore.centroCorpo;
        const y = lottatore.position.y + lottatore.height * 0.5;
        const raggio = lottatore.height * (0.55 + (1 - frazione) * 0.35);

        const gradiente = ctx.createRadialGradient(x, y, raggio * 0.15, x, y, raggio);
        gradiente.addColorStop(0, sistema.aura.colore);
        gradiente.addColorStop(0.55, sistema.aura.colore);
        gradiente.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5 * Math.min(1, frazione * 2.5);
        ctx.fillStyle = gradiente;
        ctx.beginPath();
        ctx.arc(x, y, raggio, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Effetti animati (colpi, parate, ultimate)
    for (const a of sistema.animazioni) {
        disegnaAnimazione(ctx, a);
    }

    for (const p of sistema.particelle) {
        ctx.globalAlpha = Math.max(0, p.vita / p.vitaIniziale);
        ctx.fillStyle = p.colore;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.raggio, 0, Math.PI * 2);
        ctx.fill();
    }

    for (const o of sistema.onde) {
        ctx.globalAlpha = Math.max(0, o.vita / o.vitaIniziale) * 0.9;
        ctx.strokeStyle = o.colore;
        ctx.lineWidth = o.spessore;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.raggio, 0, Math.PI * 2);
        ctx.stroke();
    }

    if (sistema.tinta) {
        ctx.globalAlpha = (sistema.tinta.timer / sistema.tinta.durata) * sistema.tinta.forza;
        ctx.fillStyle = sistema.tinta.colore;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    ctx.restore();
}

/**
 * Stelle che girano sopra la testa dello stunnato: senza questo lo stun non si
 * vedeva affatto (l'animazione TakeHit è la stessa di un colpo normale).
 */
function disegnaStelleStun(ctx, lottatore, frame) {
    if (!lottatore || !lottatore.isStunned) {
        return;
    }

    const centro = lottatore.position.x + lottatore.centroCorpo;
    const base = lottatore.position.y - 18;

    ctx.save();
    ctx.fillStyle = '#ffd34d';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.lineWidth = 2;

    for (let i = 0; i < 3; i++) {
        const angolo = (frame * 0.12) + (i * (Math.PI * 2 / 3));
        const x = centro + Math.cos(angolo) * 26;
        const y = base + Math.sin(angolo) * 8;

        ctx.beginPath();
        for (let punta = 0; punta < 10; punta++) {
            const raggio = punta % 2 === 0 ? 6 : 2.6;
            const a = (punta * Math.PI) / 5;
            const px = x + Math.cos(a) * raggio;
            const py = y + Math.sin(a) * raggio;
            if (punta === 0) { ctx.moveTo(px, py); } else { ctx.lineTo(px, py); }
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    ctx.restore();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MASSIMO_PARTICELLE: MASSIMO_PARTICELLE,
        MASSIMO_ANIMAZIONI: MASSIMO_ANIMAZIONI,
        ANIMAZIONI_EFFETTI: ANIMAZIONI_EFFETTI,
        creaSistemaEffetti: creaSistemaEffetti,
        avviaAnimazione: avviaAnimazione,
        aggiungiParticelle: aggiungiParticelle,
        aggiungiOnda: aggiungiOnda,
        scuoti: scuoti,
        tigni: tigni,
        accendiAura: accendiAura,
        aggiornaEffetti: aggiornaEffetti,
        disegnaEffetti: disegnaEffetti,
        disegnaStelleStun: disegnaStelleStun,
        animazionePronta: animazionePronta
    };
}
