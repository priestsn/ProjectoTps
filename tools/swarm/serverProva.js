// tools/swarm/serverProva.js
// Avvia un server di gioco su una porta di prova, con lo stato azzerato: lo
// swarm non deve sporcare i dati veri e non deve leggere i giocatori registrati.
// Ricalca quello che fanno già i file di prova (vedi tools/prova_partite.js).

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const CARTELLA_STATO = path.join(RADICE, 'dati', 'runtime');

function attendi(ms) {
    return new Promise((risolvi) => setTimeout(risolvi, ms));
}

/** True se il server risponde sull'endpoint di stato. */
function risponde(porta) {
    return new Promise((risolvi) => {
        const richiesta = http.get({ host: '127.0.0.1', port: porta, path: '/stato', timeout: 2000 }, (risposta) => {
            risposta.resume();
            risolvi(risposta.statusCode === 200);
        });
        richiesta.on('error', () => risolvi(false));
        richiesta.on('timeout', () => richiesta.destroy(new Error('timeout')));
    });
}

/**
 * Cancella lo stato del gioco (come i file di prova) e avvia il server.
 * Ritorna {processo, url, porta}.
 */
async function avviaServerDiProva(porta) {
    const numeroPorta = Number(porta || 8300);

    for (const file of ['giocatori.json', 'partite.json', 'partite.jsonl', 'coda.json']) {
        fs.rmSync(path.join(CARTELLA_STATO, file), { force: true });
    }

    const processo = spawn(process.execPath, ['server/server.js'], {
        cwd: RADICE,
        stdio: ['ignore', 'ignore', 'pipe'],
        env: Object.assign({}, process.env, {
            PORTA: String(numeroPorta),
            HOST: '127.0.0.1',
            REPORT_DIR: path.join(CARTELLA_STATO, 'reports-prova')
        })
    });

    let errore = '';
    processo.stderr.on('data', (pezzo) => { errore += pezzo.toString(); });

    for (let giro = 0; giro < 40; giro++) {
        if (await risponde(numeroPorta)) {
            return { processo: processo, url: 'http://127.0.0.1:' + numeroPorta + '/', porta: numeroPorta };
        }
        if (errore.indexOf('EADDRINUSE') !== -1) {
            throw new Error('porta ' + numeroPorta + ' già occupata');
        }
        await attendi(250);
    }

    processo.kill();
    throw new Error('il server di prova non risponde sulla porta ' + numeroPorta + (errore ? ' — ' + errore.trim() : ''));
}

/** Ferma il server di prova. */
function fermaServerDiProva(server) {
    if (!server || !server.processo) return;
    try { server.processo.kill(); } catch (errore) { /* già morto */ }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { avviaServerDiProva, fermaServerDiProva, risponde };
}

// Uso diretto: node tools/swarm/serverProva.js 8300
if (require.main === module) {
    avviaServerDiProva(process.argv[2] || 8300)
        .then((server) => {
            console.log('server di prova su ' + server.url + ' — Ctrl+C per fermarlo');
            process.on('SIGINT', () => { fermaServerDiProva(server); process.exit(0); });
        })
        .catch((errore) => {
            console.error('FALLITO:', errore.message);
            process.exit(1);
        });
}
