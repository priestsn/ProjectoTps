// tools/swarm/spike_runtime.js
// Prova che decide se lo swarm si può costruire o no. Tre domande:
//   1. due Chrome headless aperti insieme fanno girare il ciclo a ~60 passi/s?
//   2. i tasti inviati via CDP arrivano al gioco?
//   3. il canvas si legge come PNG senza toccare il codice del gioco?
// Uso: node tools/swarm/spike_runtime.js
//
// Va lanciato DOPO aver avviato il server di prova (lo avvia da solo).

const { apriNavigatore } = require('./navigatore.js');
const { avviaServerDiProva, fermaServerDiProva } = require('./serverProva.js');

const PORTA_SERVER = Number(process.env.PORTA || 8300);

function attendi(ms) {
    return new Promise((risolvi) => setTimeout(risolvi, ms));
}

/**
 * Avvia una partita VS CPU senza toccare il menu a mano: sono le stesse
 * funzioni che usano i pulsanti del gioco (js/Menu.js:391, js/Selezione.js:382).
 */
async function avviaPartitaCpu(nav, difficolta) {
    await nav.valuta(
        "avviaSelezioneCPU('" + (difficolta || 'normale') + "'); confermaScelta(1); confermaScelta(2); 'avviata'"
    );
    await attendi(1500);
    return nav.valuta('statoCorrente');
}

async function main() {
    const server = await avviaServerDiProva(PORTA_SERVER);
    console.log('server di prova su ' + server.url);

    const primo = await apriNavigatore({ porta: 9400, url: server.url });
    const secondo = await apriNavigatore({ porta: 9401, url: server.url });

    try {
        // il gioco è caricato?
        const pronto = await primo.valuta("typeof uvsf7Debug === 'function'");
        console.log('gioco caricato:', pronto);

        // In MENU il ciclo non avanza (frameGioco cresce solo in partita):
        // prima si avvia una partita VS CPU, altrimenti si misura lo zero.
        await avviaPartitaCpu(primo, 'normale');
        await avviaPartitaCpu(secondo, 'normale');

        const statoPrimo = await primo.valuta('statoCorrente');
        console.log('stato dopo l\'avvio:', statoPrimo);

        const prima = await primo.valuta('uvsf7Debug().frame');
        const primaSecondo = await secondo.valuta('uvsf7Debug().frame');

        await attendi(3000);

        const dopo = await primo.valuta('uvsf7Debug().frame');
        const dopoSecondo = await secondo.valuta('uvsf7Debug().frame');

        const passiPrimo = dopo - prima;
        const passiSecondo = dopoSecondo - primaSecondo;

        console.log('bot 1: frame ' + prima + ' -> ' + dopo + ' | passi in 3 s: ' + passiPrimo);
        console.log('bot 2: frame ' + primaSecondo + ' -> ' + dopoSecondo + ' | passi in 3 s: ' + passiSecondo);

        // il canvas si legge come PNG?
        const png = await primo.screenshotPng();
        console.log('png base64, caratteri: ' + (png ? png.length : 0));

        // un tasto arriva al gioco?
        // Lo spostamento si misura sulla posizione, l'attacco campionando il
        // flag: l'animazione dura ~250 ms e un controllo secco la manca.
        const xPrima = await primo.valuta('Math.round(Player.position.x)');
        await primo.premiTasto('d', 400);
        await attendi(100);
        const xDopo = await primo.valuta('Math.round(Player.position.x)');

        await primo.premiTasto('h', 60);
        const campioni = [];
        for (let giro = 0; giro < 10; giro++) {
            campioni.push(await primo.valuta('Player.isAttacking ? 1 : 0'));
            await attendi(50);
        }
        const inAttacco = campioni.indexOf(1) !== -1;

        console.log('spostamento con D: x ' + xPrima + ' -> ' + xDopo + ' (mosso: ' + (xDopo !== xPrima) + ')');
        console.log('isAttacking campionato: ' + campioni.join(''));

        const esiti = {
            entrambiVeloce: passiPrimo >= 150 && passiSecondo >= 150,
            pngPresente: !!png && png.length > 5000,
            tastoArrivato: inAttacco === true && xDopo !== xPrima
        };

        console.log('\nESITO: ' + JSON.stringify(esiti));
        const tuttoBene = esiti.entrambiVeloce && esiti.pngPresente && esiti.tastoArrivato;
        console.log(tuttoBene ? 'SPIKE SUPERATO' : 'SPIKE NON SUPERATO — vedi i tre esiti sopra');
        return tuttoBene ? 0 : 1;
    } finally {
        primo.chiudi();
        secondo.chiudi();
        fermaServerDiProva(server);
    }
}

main()
    .then((codice) => process.exit(codice))
    .catch((errore) => {
        console.error('SPIKE FALLITO:', errore.message);
        process.exit(1);
    });
