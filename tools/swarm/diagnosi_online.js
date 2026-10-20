// tools/swarm/diagnosi_online.js — due bot in ranked, con la cronologia delle
// due viste secondo per secondo. Serve a capire se il timer fermo dell'ospite è
// un difetto vero o solo l'attesa dell'avvio.
const fs = require('fs');
const path = require('path');

const { apriNavigatore } = require('./navigatore.js');
const { avviaServerDiProva, fermaServerDiProva } = require('./serverProva.js');

const SORGENTE_SONDA = fs.readFileSync(path.join(__dirname, 'sonda.js'), 'utf8');

function attendi(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function creaAccount(url, numero) {
    const casuale = Math.random().toString(36).slice(2, 7);
    const nick = 'Diag' + numero + casuale;
    const risposta = await fetch(url + 'api/iscrizione', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nick: nick, password: 'password' + casuale })
    });
    const dati = await risposta.json();
    return (dati && dati.token) || null;
}

async function main() {
    const server = await avviaServerDiProva(8340);
    const nav1 = await apriNavigatore({ porta: 9440, url: server.url, attesaCaricamentoMs: 4000 });
    const nav2 = await apriNavigatore({ porta: 9441, url: server.url, attesaCaricamentoMs: 4000 });

    try {
        for (const [numero, nav] of [[1, nav1], [2, nav2]]) {
            const token = await creaAccount(server.url, numero);
            await nav.valuta("localStorage.setItem('uvsf7-token'," + JSON.stringify(token) + ")");
            await nav.valuta('location.reload()');
            await attendi(4000);
            await nav.valuta(SORGENTE_SONDA);
            await nav.valuta('apriCodaRanked(); "ok"');
            await attendi(400);
            await nav.valuta('cercaPartitaRanked(); "ok"');
        }
        console.log('due bot in coda ranked...');

        const confermati = { 1: false, 2: false };

        for (let secondo = 0; secondo < 45; secondo++) {
            const righe = [];
            for (const [numero, nav] of [[1, nav1], [2, nav2]]) {
                const stato = await nav.valuta('statoCorrente');

                if (stato === 'selezione' && !confermati[numero]) {
                    const ospite = await nav.valuta('(typeof onlineStato !== "undefined" && onlineStato) ? !!onlineStato.ospite : false');
                    await nav.valuta('confermaScelta(' + (ospite ? 2 : 1) + '); "ok"');
                    confermati[numero] = true;
                    righe.push('bot' + numero + ' seleziona come ' + (ospite ? 'ospite' : 'padrone'));
                    continue;
                }

                if (stato !== 'partita') { righe.push('bot' + numero + ' [' + stato + ']'); continue; }

                const vista = await nav.valuta(
                    '(function(){var a=(typeof Player!=="undefined"&&Player)?Player:null,b=(typeof Enemy!=="undefined"&&Enemy)?Enemy:null;' +
                    'return JSON.stringify({timer:timer,x:a?Math.round(a.position.x):null,vita:a?Math.round(a.health):null,' +
                    'px2:b?Math.round(b.position.x):null,vita2:b?Math.round(b.health):null,' +
                    'ospite:(typeof onlineStato!=="undefined"&&onlineStato)?!!onlineStato.ospite:null});})()'
                );
                righe.push('bot' + numero + ' ' + vista);
            }
            console.log(String(secondo).padStart(2) + 's  ' + righe.join('  |  '));
            await attendi(1000);
        }
    } finally {
        nav1.chiudi();
        nav2.chiudi();
        fermaServerDiProva(server);
    }
}

main().catch((e) => { console.error('FALLITO:', e.message); process.exit(1); });
