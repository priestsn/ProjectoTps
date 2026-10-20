// tools/swarm/insegui_pulsanti.js — il pulsante di ritorno dell'account è
// davvero incliccabile col mouse? Elenca i pulsanti di ogni schermata con
// rettangolo, pointer-events e cosa c'è sotto il dito al centro.
const { apriNavigatore } = require('./navigatore.js');
const { avviaServerDiProva, fermaServerDiProva } = require('./serverProva.js');

function attendi(ms) { return new Promise((r) => setTimeout(r, ms)); }

const ELENCO = `(function(){
    var area = document.querySelector('#areaGioco') || document.body;
    var elenco = Array.prototype.slice.call(area.querySelectorAll('button, a, .voce'));
    return JSON.stringify(elenco.map(function (el) {
        var r = el.getBoundingClientRect();
        var stile = getComputedStyle(el);
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        var sopra = null;
        try { sopra = document.elementFromPoint(cx, cy); } catch (e) {}
        return {
            sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).split(' ').join('.') : ''),
            testo: (el.innerText || el.textContent || '').trim().slice(0, 24),
            x: Math.round(cx), y: Math.round(cy),
            w: Math.round(r.width), h: Math.round(r.height),
            mostra: stile.display + '/' + stile.visibility,
            eventi: stile.pointerEvents,
            sotto: sopra ? (sopra.tagName.toLowerCase() + (sopra.id ? '#' + sopra.id : '') +
                (sopra.className ? '.' + String(sopra.className).split(' ')[0] : '')) : null,
            eLui: !!(sopra && (sopra === el || el.contains(sopra)))
        };
    }));
})()`;

async function main() {
    const server = await avviaServerDiProva(8362);
    const nav = await apriNavigatore({ porta: 9862, url: server.url, attesaCaricamentoMs: 4000 });

    try {
        for (const schermata of ['account', 'negozio', 'classifica']) {
            const clic = await nav.cliccaTesto('#menuCorpo .voce', schermata.toUpperCase());
            await attendi(2000);
            const stato = await nav.valuta('statoCorrente');
            console.log('=== clic su ' + schermata + ' -> stato ' + stato + ' (clic: ' + clic.esito + ') ===');

            const elenco = JSON.parse(await nav.valuta(ELENCO) || '[]');
            for (const voce of elenco) {
                console.log('  ' + (voce.eLui ? 'OK  ' : 'NO  ') + voce.testo.padEnd(22) +
                    ' @' + String(voce.x).padStart(4) + ',' + String(voce.y).padStart(4) +
                    ' ' + String(voce.w).padStart(4) + 'x' + String(voce.h).padStart(3) +
                    ' ' + voce.mostra.padEnd(18) + ' pe:' + voce.eventi.padEnd(6) +
                    ' sotto:' + voce.sotto);
            }

            // prova a cliccare INDIETRO col mouse e guarda che succede
            const ritorno = await nav.cliccaTesto('#areaGioco button', 'INDIETRO');
            await attendi(800);
            console.log('  -> clic INDIETRO: ' + ritorno.esito + ' · stato dopo: ' + (await nav.valuta('statoCorrente')));

            await nav.premiTasto('Escape', 60);
            await attendi(500);
            await nav.valuta('apriMenu("principale")');
            await attendi(400);
        }
    } finally {
        nav.chiudi();
        fermaServerDiProva(server);
    }
}

main().catch((e) => { console.error('FALLITO:', e.message); process.exit(1); });
