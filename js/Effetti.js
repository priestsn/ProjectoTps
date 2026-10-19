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

function creaSistemaEffetti() {
    return {
        particelle: [],
        onde: [],
        scossa: 0,
        tinta: null,   // { colore, forza, timer, durata }
        impatto: null  // { x, y, angolo, timer } per lo sprite del colpo
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
 * Segna il punto d'impatto dove disegnare lo sprite del colpo (se c'è).
 */
function segnaImpatto(sistema, x, y, timer) {
    sistema.impatto = { x: x, y: y, timer: timer || 12, durata: timer || 12 };
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
}

/**
 * Disegna tutto sopra la scena. `ctx` è il contesto del canvas.
 * Se la pagina ha caricato gli sprite degli effetti (assets/Effetti/) li usa
 * al posto delle forme geometriche; se non ci sono, tutto funziona lo stesso.
 */
function disegnaEffetti(sistema, ctx) {
    ctx.save();

    // Sprite del colpo (opzionale, vedi assets/Effetti/)
    if (sistema.impatto && typeof spriteImpattoPronto === 'function' && spriteImpattoPronto()) {
        const immagine = immagineImpatto();
        const lato = 180;
        ctx.globalAlpha = Math.max(0, sistema.impatto.timer / sistema.impatto.durata);
        ctx.drawImage(immagine,
            sistema.impatto.x - lato / 2, sistema.impatto.y - lato / 2, lato, lato);
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
        creaSistemaEffetti: creaSistemaEffetti,
        aggiungiParticelle: aggiungiParticelle,
        aggiungiOnda: aggiungiOnda,
        scuoti: scuoti,
        tigni: tigni,
        segnaImpatto: segnaImpatto,
        aggiornaEffetti: aggiornaEffetti,
        disegnaEffetti: disegnaEffetti,
        disegnaStelleStun: disegnaStelleStun
    };
}
