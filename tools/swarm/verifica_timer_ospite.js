// tools/swarm/verifica_timer_ospite.js — il timer che l'OSPITE VEDE scende?
// La variabile `timer` dell'ospite resta a 60 (non simula), ma l'HUD la
// disegna dallo stato ricevuto (aggiornaOspite: hud.timer.innerHTML =
// stato.timer). Qui si guarda quello che vede il giocatore, non la variabile.
const fs = require('fs');
const path = require('path');

const { apriNavigatore } = require('./navigatore.js');
const { avviaServerDiProva, fermaServerDiProva } = require('./serverProva.js');

const SORGENTE_SONDA = fs.readFileSync(path.join(__dirname, 'sonda.js'), 'utf8');
function attendi(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function creaAccount(url, numero) {
    const casuale = Math.random().toString(36).slice(2, 7);
    const risposta = await fetch(url + 'api/iscrizione', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nick: 'Tmr' + numero + casuale, password: 'password' + casuale })
    });
    const dati = await risposta.json();
    return dati.token;
}

async function main() {
    const server = await avviaServerDiProva(8341);
    const nav1 = await apriNavigatore({ porta: 9442, url: server.url, attesaCaricamentoMs: 4000 });
    const nav2 = await apriNavigatore({ porta: 9443, url: server.url, attesaCaricamentoMs: 4000 });

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

        const confermati = { 1: false, 2: false };
        for (let giro = 0; giro < 40; giro++) {
            for (const [numero, nav] of [[1, nav1], [2, nav2]]) {
                const stato = await nav.valuta('statoCorrente');
                if (stato === 'selezione' && !confermati[numero]) {
                    const ospite = await nav.valuta('(typeof onlineStato !== "undefined" && onlineStato) ? !!onlineStato.ospite : false');
                    await nav.valuta('confermaScelta(' + (ospite ? 2 : 1) + '); "ok"');
                    confermati[numero] = true;
                }
            }
            const stato1 = await nav1.valuta('statoCorrente');
            const stato2 = await nav2.valuta('statoCorrente');
            if (stato1 === 'partita' && stato2 === 'partita') break;
            await attendi(700);
        }

        console.log('partita avviata. Confronto fra variabile e HUD per ENTRAMBI:\n');
        for (let giro = 0; giro < 8; giro++) {
            const lettura = async (nav) => await nav.valuta(
                'JSON.stringify({variabile: (typeof timer !== "undefined") ? timer : null,' +
                'hud: (function(){var e=document.querySelector("#timer");return e?e.textContent.trim():null;})(),' +
                'ospite: (typeof onlineStato !== "undefined" && onlineStato) ? !!onlineStato.ospite : null})'
            );
            const a = JSON.parse(await lettura(nav1));
            const b = JSON.parse(await lettura(nav2));
            console.log(String(giro * 2).padStart(2) + 's  bot1 ' + JSON.stringify(a) + '   bot2 ' + JSON.stringify(b));
            await attendi(2000);
        }
    } finally {
        nav1.chiudi();
        nav2.chiudi();
        fermaServerDiProva(server);
    }
}

main().catch((e) => { console.error('FALLITO:', e.message); process.exit(1); });
