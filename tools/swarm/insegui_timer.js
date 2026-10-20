// tools/swarm/insegui_timer.js — il timer mostrato si ferma davvero?
// Stampa ogni mezzo secondo la variabile, quello che c'è scritto nell'HUD e lo
// stato della partita, per vedere il momento esatto in cui si blocca.
const { apriNavigatore } = require('./navigatore.js');
const { avviaServerDiProva, fermaServerDiProva } = require('./serverProva.js');

function attendi(ms) { return new Promise((r) => setTimeout(r, ms)); }

const LETTURA = `(function(){
    var e = document.querySelector('#timer');
    return JSON.stringify({
        variabile: (typeof timer !== 'undefined') ? timer : null,
        mostrato: e ? e.textContent.trim() : null,
        gameOver: (typeof gameOver !== 'undefined') ? !!gameOver : null,
        stato: (typeof statoCorrente !== 'undefined') ? statoCorrente : null,
        cerimonia: (typeof cerimoniaFine !== 'undefined' && cerimoniaFine) ? cerimoniaFine.fase : null,
        pausa: (typeof reportAperto !== 'undefined') ? !!reportAperto : null,
        vitaP1: (typeof Player !== 'undefined' && Player) ? Math.round(Player.health) : null,
        vitaP2: (typeof Enemy !== 'undefined' && Enemy) ? Math.round(Enemy.health) : null
    });
})()`;

async function main() {
    const server = await avviaServerDiProva(8357);
    const nav = await apriNavigatore({ porta: 9857, url: server.url, attesaCaricamentoMs: 4000 });

    try {
        await nav.valuta("avviaSelezioneCPU('normale'); confermaScelta(1); confermaScelta(2); 'ok'");
        await attendi(1500);

        let ugualeDa = 0;
        let precedente = null;

        for (let giro = 0; giro < 120; giro++) {
            const letto = JSON.parse(await nav.valuta(LETTURA) || '{}');
            const segno = (precedente && letto.mostrato === precedente) ? ' ' : '*';
            if (precedente && letto.mostrato === precedente) ugualeDa += 1; else ugualeDa = 0;
            precedente = letto.mostrato;

            // si stampa solo quando cambia o ogni 10 letture, per non fare rumore
            if (segno === '*' || giro % 10 === 0 || ugualeDa === 12) {
                console.log(String((giro * 0.5).toFixed(1)).padStart(5) + 's' + segno + ' ' +
                    JSON.stringify(letto) + (ugualeDa === 12 ? '   <-- FERMO da 6 s' : ''));
            }

            // se si ferma e la partita è ancora in corso, si ferma la prova
            if (ugualeDa === 12) break;

            if (letto.stato !== 'partita') {
                console.log('fuori partita:', letto.stato);
                break;
            }
            await attendi(500);
        }
    } finally {
        nav.chiudi();
        fermaServerDiProva(server);
    }
}

main().catch((e) => { console.error('FALLITO:', e.message); process.exit(1); });
