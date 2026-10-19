// ========================================
// Effetti visivi
// ==========================================
// Particelle, onde e tinte disegnate col canvas: niente immagini obbligatorie,
// niente dipendenze. Il colore arriva dal personaggio
// (`personaggio.ultimate.colore`), così ogni lottatore "suona" con il suo.
//
// Gli effetti NON toccano la simulazione: si aggiornano una volta per passo e
// si disegnano sopra la scena. Se si cancellassero tutti, il gioco sarebbe
// identico.

const MASSIMO_PARTICELLE = 220;
const GRAVITA_PARTICELLA = 0.12;
const ATTRITO_PARTICELLA = 0.98;

// Immagini del pacchetto Kenney (CC0, vedi assets/Effetti/LICENZA-LICENSE.txt).
// Se mancano o non caricano restano le forme geometriche disegnate col canvas:
// il gioco funziona identico anche senza la cartella assets/Effetti/.
const SPRITE_EFFETTI = {
    impatto: 'assets/Effetti/impatto.png',
    parata: 'assets/Effetti/parata.png',
    stella: 'assets/Effetti/stella.png',
    ultimate: 'assets/Effetti/ultimate.png',
    scintilla: 'assets/Effetti/scintilla.png'
};

const immaginiEffetti = {};

/**
 * Avvia il caricamento degli sprite: si chiama una volta all'avvio e non
 * aspetta, perché finché un'immagine non è pronta si usano le forme geometriche.
 */
function preparaSpriteEffetti() {
    if (typeof Image !== 'function') {
        return;
    }
    for (const nome in SPRITE_EFFETTI) {
        const immagine = new Image();
        immagine.loaded = false;
        immagine.addEventListener('load', () => { immagine.loaded = true; });
        immagine.src = SPRITE_EFFETTI[nome];
        immaginiEffetti[nome] = immagine;
    }
}

function spriteEffettoPronto(nome) {
    const immagine = immaginiEffetti[nome];
    return !!(immagine && immagine.loaded && immagine.width > 0);
}

/**
 * Disegna lo sprite centrato in un punto. Restituisce false se l'immagine non è
 * pronta (allora chi chiama sa che deve disegnare la forma geometrica).
 */
function disegnaSpriteEffetto(ctx, nome, x, y, lato, alpha) {
    if (!spriteEffettoPronto(nome)) {
        return false;
    }
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(immaginiEffetti[nome], x - lato / 2, y - lato / 2, lato, lato);
    ctx.restore();
    return true;
}

function creaSistemaEffetti() {
    return {
        particelle: [],
        onde: [],
        scossa: 0,
        tinta: null,   // { colore, forza, timer, durata }
        impatto: null, // { x, y, timer, durata, sprite } per lo sprite del colpo
        aura: null     // { lottatore, colore, timer, durata }
    };
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

/**
 * Segna il punto d'impatto dove disegnare lo sprite del colpo (se c'è).
 */
function segnaImpatto(sistema, x, y, timer, sprite) {
    const durata = timer || 12;
    sistema.impatto = { x: x, y: y, timer: durata, durata: durata, sprite: sprite || 'impatto' };
}

function aggiornaEffetti(sistema) {
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

    if (sistema.impatto) {
        sistema.impatto.timer--;
        if (sistema.impatto.timer <= 0) {
            sistema.impatto = null;
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
 * Disegna tutto sopra la scena. `ctx` è il contesto del canvas.
 * Se la pagina ha caricato gli sprite degli effetti (assets/Effetti/) li usa
 * al posto delle forme geometriche; se non ci sono, tutto funziona lo stesso.
 */
function disegnaEffetti(sistema, ctx) {
    ctx.save();

    // Alone addosso al lottatore: disegnato in "lighter" così si somma al
    // personaggio invece di coprirlo
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

    // Flash del colpo: sprite del pacchetto, quando l'immagine è pronta
    if (sistema.impatto) {
        const alpha = Math.max(0, sistema.impatto.timer / sistema.impatto.durata);
        const lato = sistema.impatto.sprite === 'ultimate' ? 260 : 170;
        disegnaSpriteEffetto(ctx, sistema.impatto.sprite, sistema.impatto.x, sistema.impatto.y, lato, alpha);
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

    const conSprite = spriteEffettoPronto('stella');

    ctx.save();

    for (let i = 0; i < 3; i++) {
        const angolo = (frame * 0.12) + (i * (Math.PI * 2 / 3));
        const x = centro + Math.cos(angolo) * 26;
        const y = base + Math.sin(angolo) * 8;

        if (conSprite) {
            ctx.globalAlpha = 0.95;
            ctx.drawImage(immaginiEffetti.stella, x - 12, y - 12, 24, 24);
            continue;
        }

        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffd34d';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.lineWidth = 2;
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
        creaSistemaEffetti: creaSistemaEffetti,
        aggiungiParticelle: aggiungiParticelle,
        aggiungiOnda: aggiungiOnda,
        scuoti: scuoti,
        tigni: tigni,
        accendiAura: accendiAura,
        segnaImpatto: segnaImpatto,
        aggiornaEffetti: aggiornaEffetti,
        SPRITE_EFFETTI: SPRITE_EFFETTI,
        disegnaSpriteEffetto: disegnaSpriteEffetto,
        spriteEffettoPronto: spriteEffettoPronto,
        disegnaEffetti: disegnaEffetti,
        disegnaStelleStun: disegnaStelleStun
    };
}
