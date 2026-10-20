// tools/prova_swarm_sonda_viva.js — le sonde scattano davvero?
// Uno sciame che non trova mai niente è indistinguibile da uno rotto: qui si
// inietta un difetto noto nel gioco vivo e si controlla che la sonda lo veda.
//
// Uso: node tools/prova_swarm_sonda_viva.js

const fs = require('fs');
const path = require('path');

const { apriNavigatore } = require('./swarm/navigatore.js');
const { avviaServerDiProva, fermaServerDiProva } = require('./swarm/serverProva.js');

const SORGENTE_SONDA = fs.readFileSync(path.join(__dirname, 'swarm', 'sonda.js'), 'utf8');

function attendi(ms) { return new Promise((r) => setTimeout(r, ms)); }

const risultati = [];
function verifica(nome, condizione, dettaglio) {
    risultati.push(!!condizione);
    console.log((condizione ? 'OK   ' : 'NO   ') + nome + (dettaglio ? '  [' + dettaglio + ']' : ''));
}

function firme(anomalie) {
    return (anomalie || []).map((voce) => voce.firma);
}

async function main() {
    const server = await avviaServerDiProva(8330);
    const nav = await apriNavigatore({ porta: 9430, url: server.url, attesaCaricamentoMs: 4000 });

    try {
        await nav.valuta(SORGENTE_SONDA);
        await nav.valuta("avviaSelezioneCPU('normale'); confermaScelta(1); confermaScelta(2); 'avviata'");
        await attendi(1500);

        verifica('la sonda è installata nella pagina',
            await nav.valuta("typeof _swarm !== 'undefined' && typeof _swarm.prelevaAnomalie === 'function'"));

        // --- 1. valore fuori scala: inietto una vita impossibile ---
        await nav.valuta('_swarm.prelevaAnomalie()');
        await nav.valuta('Enemy.health = 9999');
        await attendi(900);
        const dopoVita = await nav.valuta('_swarm.prelevaAnomalie()');
        verifica('vita impossibile → valore-fuori-scala',
            firme(dopoVita).indexOf('valore-fuori-scala') !== -1,
            firme(dopoVita).join(',') || 'niente');

        // rimetto a posto
        await nav.valuta('Enemy.health = Enemy.statistiche.vita');

        // --- 2. ciclo bloccato: occupo il thread principale per 1,2 s ---
        await nav.valuta('_swarm.prelevaAnomalie()');
        await nav.valuta('(function(){ var t = Date.now(); while (Date.now() - t < 1200) {} return "bloccato"; })()');
        await attendi(900);
        const dopoBlocco = await nav.valuta('_swarm.prelevaAnomalie()');
        verifica('thread occupato → ciclo-blocco o ritmo-basso',
            firme(dopoBlocco).some((f) => f === 'ciclo-blocco' || f === 'ritmo-basso'),
            firme(dopoBlocco).join(',') || 'niente');

        // --- 3. dopo il blocco il gioco riparte (nessun difetto inventato) ---
        await nav.valuta('_swarm.prelevaAnomalie()');
        await attendi(1200);
        const dopoRipresa = await nav.valuta('_swarm.prelevaAnomalie()');
        verifica('a regime, nessun difetto inventato',
            firme(dopoRipresa).indexOf('ciclo-blocco') === -1,
            firme(dopoRipresa).join(',') || 'niente');

        // --- 4. il campionamento produce un campione completo ---
        const campione = await nav.valuta('_swarm.campiona()');
        verifica('il campione ha giocatori, timer e canvas',
            !!campione && !!campione.p1 && !!campione.p2 && typeof campione.timer === 'number' &&
            !!campione.canvas && campione.canvas.larghezza > 100,
            campione ? 'timer ' + campione.timer : 'nessun campione');

        verifica('il campione porta il massimo di vita del verdellinese',
            !!campione && typeof campione.p1.vitaMax === 'number' && campione.p1.vitaMax >= 80,
            campione ? String(campione.p1.vitaMax) : '?');
    } finally {
        nav.chiudi();
        fermaServerDiProva(server);
    }

    const passate = risultati.filter(Boolean).length;
    console.log('\n' + passate + '/' + risultati.length + ' verifiche passate');
    process.exit(passate === risultati.length ? 0 : 1);
}

main().catch((errore) => {
    console.error('FALLITO:', errore.message);
    process.exit(1);
});
