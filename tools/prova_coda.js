// ========================================
// Verifica della coda ranked
// ==========================================
// La finestra di ELO, la scelta dell'avversario più vicino, l'abbinamento vero
// fra due account, il codice della stanza consegnato all'ospite e l'esito che
// muove l'ELO di tutti e due.
//
// Uso:  node tools/prova_coda.js

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const coda = require('../server/coda.js');

const RADICE = path.resolve(__dirname, '..');
const CARTELLA_STATO = path.join(RADICE, 'dati', 'runtime');
const FILE_STATO = ['giocatori.json', 'partite.json', 'partite.jsonl', 'coda.json', 'amici.json'];
const PORTA = 8114;
const BASE = 'http://127.0.0.1:' + PORTA;
const risultati = [];
const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

function verifica(nome, condizione, dettaglio) {
    risultati.push(!!condizione);
    console.log((condizione ? 'OK       ' : 'FALLITO  ') + nome.padEnd(52) + (dettaglio || ''));
}

async function chiama(metodo, percorso, corpo, token) {
    const intestazioni = { 'Content-Type': 'application/json' };
    if (token) intestazioni.Authorization = 'Bearer ' + token;
    const risposta = await fetch(BASE + percorso, {
        method: metodo,
        headers: intestazioni,
        body: corpo === undefined ? undefined : JSON.stringify(corpo)
    });
    let dati = null;
    try { dati = await risposta.json(); } catch (errore) { dati = null; }
    return { stato: risposta.status, dati: dati };
}

const post = (percorso, corpo, token) => chiama('POST', percorso, corpo, token);
const get = (percorso, token) => chiama('GET', percorso, undefined, token);

async function attendiServer(limiteMs) {
    const scadenza = Date.now() + (limiteMs || 8000);
    while (Date.now() < scadenza) {
        try {
            const risposta = await fetch(BASE + '/stato');
            if (risposta.ok) return true;
        } catch (errore) { /* non ancora in ascolto */ }
        await attendi(150);
    }
    return false;
}

async function iscrivi(nick) {
    const esito = await post('/api/iscrizione', { nick: nick, password: 'passwordsicura1' });
    return esito.dati.token;
}

/** Controlli sulla logica pura, senza server. */
function controlliFinestra() {
    verifica('la finestra parte da 300 punti',
        coda.finestra(0) === 300 && coda.finestra(10) === 300, 'a 0s: ' + coda.finestra(0));
    verifica('dopo dieci secondi si allarga a 600', coda.finestra(15) === 600, 'a 15s: ' + coda.finestra(15));
    verifica('dopo venti secondi arriva a 1000', coda.finestra(60) === 1000, 'a 60s: ' + coda.finestra(60));

    const adesso = Date.now();
    const io = { giocatore: 'a', nick: 'A', elo: 1000, entrato: adesso };
    const vicino = { giocatore: 'b', nick: 'B', elo: 1100, entrato: adesso };
    const lontano = { giocatore: 'c', nick: 'C', elo: 1800, entrato: adesso };

    verifica('chi è a 100 punti è compatibile subito', coda.compatibile(io, vicino, adesso) === true, 'sì');
    verifica('chi è a 800 punti non lo è (finestra 300)', coda.compatibile(io, lontano, adesso) === false,
        'finestra ' + coda.finestra(0));

    const scelto = coda.scegliAvversario([lontano, vicino], io, adesso);
    verifica('si sceglie l\'avversario con l\'ELO più vicino', scelto && scelto.giocatore === 'b',
        'scelto ' + (scelto && scelto.nick));

    const vecchio = { giocatore: 'd', nick: 'D', elo: 1700, entrato: adesso - 30000 };
    const abbinato = coda.scegliAvversario([vecchio], io, adesso);
    verifica('chi aspetta da 30 secondi allarga la finestra a 1000',
        abbinato && abbinato.giocatore === 'd', 'scelto ' + (abbinato && abbinato.nick));
}

async function main() {
    for (const file of FILE_STATO) {
        fs.rmSync(path.join(CARTELLA_STATO, file), { force: true });
    }

    controlliFinestra();

    const server = spawn(process.execPath, ['server/server.js'], {
        cwd: RADICE,
        stdio: 'ignore',
        env: Object.assign({}, process.env, { PORTA: String(PORTA), HOST: '127.0.0.1' })
    });

    if (!await attendiServer()) {
        console.log('FALLITO  il server non ha risposto sulla porta ' + PORTA);
        server.kill();
        process.exit(1);
    }

    try {
        const tokenA = await iscrivi('CodaUno');
        const tokenB = await iscrivi('CodaDue');

        const senzaToken = await post('/api/coda/entra', {});
        verifica('entrare in coda senza token vietato', senzaToken.stato === 401, 'http ' + senzaToken.stato);

        const primoIngresso = await post('/api/coda/entra', {}, tokenA);
        verifica('il primo resta in attesa',
            primoIngresso.stato === 200 && primoIngresso.dati.stato === 'inAttesa' &&
            primoIngresso.dati.posizione === 1, 'posizione ' + (primoIngresso.dati && primoIngresso.dati.posizione));

        const rientro = await post('/api/coda/entra', {}, tokenA);
        verifica('rientrare non crea una seconda voce in coda',
            rientro.dati.inCoda === 1, 'in coda ' + (rientro.dati && rientro.dati.inCoda));

        const secondoIngresso = await post('/api/coda/entra', {}, tokenB);
        verifica('il secondo viene abbinato subito',
            secondoIngresso.stato === 200 && secondoIngresso.dati.stato === 'abbinato',
            'stato ' + (secondoIngresso.dati && secondoIngresso.dati.stato));
        verifica('chi arriva dopo fa da ospite e vede il nick del padrone',
            secondoIngresso.dati.ruolo === 'ospite' && secondoIngresso.dati.avversario === 'CodaUno',
            secondoIngresso.dati.ruolo + ' / ' + secondoIngresso.dati.avversario);

        const statoPrimo = await get('/api/coda/stato', tokenA);
        verifica('il primo trova l\'abbinamento al controllo successivo',
            statoPrimo.dati.stato === 'abbinato' && statoPrimo.dati.ruolo === 'padrone' &&
            statoPrimo.dati.avversario === 'CodaDue',
            statoPrimo.dati.stato + ' / ' + statoPrimo.dati.ruolo);
        verifica('l\'abbinamento porta un identificativo di partita',
            typeof statoPrimo.dati.partitaId === 'string' && statoPrimo.dati.partitaId.length === 36,
            'id ' + String(statoPrimo.dati.partitaId).slice(0, 8) + '…');

        const statoRipetuto = await get('/api/coda/stato', tokenA);
        verifica('l\'abbinamento si consegna una volta sola',
            statoRipetuto.dati.stato === 'fuori', 'stato ' + statoRipetuto.dati.stato);

        // Il padrone crea la stanza e comunica il codice.
        const codiceSubito = await get('/api/coda/codice', tokenB);
        verifica('l\'ospite non ha ancora il codice della stanza',
            codiceSubito.dati.stato === 'attesa', 'stato ' + codiceSubito.dati.stato);

        const codiceCorto = await post('/api/coda/codice', { codice: 'AB' }, tokenA);
        verifica('un codice di due caratteri è respinto', codiceCorto.stato === 400, 'http ' + codiceCorto.stato);

        const codice = await post('/api/coda/codice', { codice: 'k7pm' }, tokenA);
        verifica('il padrone consegna il codice della stanza',
            codice.stato === 200 && codice.dati.codice === 'K7PM', 'codice ' + (codice.dati && codice.dati.codice));

        const codiceOspite = await get('/api/coda/codice', tokenB);
        verifica('l\'ospite riceve il codice del padrone',
            codiceOspite.dati.stato === 'pronto' && codiceOspite.dati.codice === 'K7PM',
            'codice ' + codiceOspite.dati.codice);

        // L'esito si comunica dal padrone e muove l'ELO di tutti e due.
        const esito = await post('/api/partita/concludi',
            { partitaId: statoPrimo.dati.partitaId, esito: 'vittoria' }, tokenA);
        verifica('l\'esito della partita in coda muove l\'ELO del vincitore',
            esito.stato === 200 && esito.dati.elo === 1016, 'elo ' + (esito.dati && esito.dati.elo));

        const profiloB = await get('/api/profilo', tokenB);
        verifica('anche l\'ospite ha ELO e sconfitta aggiornati',
            profiloB.dati.elo === 984 && profiloB.dati.sconfitte === 1,
            'elo ' + profiloB.dati.elo + ' sconfitte ' + profiloB.dati.sconfitte);

        const uscita = await post('/api/coda/esci', {}, tokenB);
        verifica('uscire dalla coda risponde "fuori"', uscita.dati.stato === 'fuori', uscita.dati.stato);

        const dopoUscita = await get('/api/coda/stato', tokenB);
        verifica('dopo l\'uscita non si è più in coda', dopoUscita.dati.stato === 'fuori',
            dopoUscita.dati.stato);

        const codiceSenzaAbbinamento = await post('/api/coda/codice', { codice: 'ZZZZ' }, tokenB);
        verifica('senza abbinamento non si possono consegnare codici',
            codiceSenzaAbbinamento.stato === 409, 'http ' + codiceSenzaAbbinamento.stato);
    } finally {
        server.kill();
        await attendi(250);
        for (const file of FILE_STATO) {
            fs.rmSync(path.join(CARTELLA_STATO, file), { force: true });
        }
        const totale = risultati.filter(Boolean).length;
        console.log('\n' + totale + '/' + risultati.length + ' verifiche passate');
        process.exit(totale === risultati.length ? 0 : 1);
    }
}

main().catch((errore) => {
    console.log('FALLITO  errore imprevisto: ' + errore.message);
    process.exit(1);
});
