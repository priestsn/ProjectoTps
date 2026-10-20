// tools/swarm/diagnosi_schermate.js — chi apre cosa, e dove resta lo stato
const fs = require('fs');
const path = require('path');
const { apriNavigatore } = require('./navigatore.js');
const { avviaServerDiProva, fermaServerDiProva } = require('./serverProva.js');

const SORGENTE_SONDA = fs.readFileSync(path.join(__dirname, 'sonda.js'), 'utf8');

function attendi(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
    const server = await avviaServerDiProva(8332);
    const nav = await apriNavigatore({ porta: 9432, url: server.url, attesaCaricamentoMs: 4000 });

    const elenco = ['apriNegozio', 'apriAccount', 'apriClassifica', 'apriAmici', 'apriCodaRanked'];

    try {
        await nav.valuta(SORGENTE_SONDA);
        await attendi(600);
        console.log('stato iniziale:', await nav.valuta('statoCorrente'));

        for (const funzione of elenco) {
            const prima = await nav.valuta('statoCorrente');
            await nav.valuta(funzione + '()');
            await attendi(2500);
            const dopo = await nav.valuta('statoCorrente');

            // Escape torna al menu?
            await nav.premiTasto('Escape', 60);
            await attendi(700);
            const dopoEscape = await nav.valuta('statoCorrente');

            // il menu è davvero tornato? se no, lo rimetto io
            if (dopoEscape !== 'menu') {
                await nav.valuta('apriMenu("principale")');
                await attendi(500);
            }

            console.log(funzione.padEnd(18), 'stato prima:', String(prima).padEnd(12),
                '-> dopo:', String(dopo).padEnd(12), '-> Escape:', dopoEscape);
        }

        // cosa dice la pagina sui bottoni presenti nella schermata negozio?
        await nav.valuta('apriNegozio()');
        await attendi(2500);
        const bottoni = await nav.valuta(
            "JSON.stringify(Array.from(document.querySelectorAll('#areaGioco button, #areaGioco a'))" +
            ".map(function(e){return (e.innerText||'').trim().slice(0,18);}).filter(Boolean))"
        );
        console.log('bottoni visibili nel negozio:', bottoni);
        console.log('stato in negozio:', await nav.valuta('statoCorrente'));
    } finally {
        nav.chiudi();
        fermaServerDiProva(server);
    }
}

main().catch((e) => { console.error('FALLITO:', e.message); process.exit(1); });
