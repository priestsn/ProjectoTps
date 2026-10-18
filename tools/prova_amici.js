// ========================================
// Verifica delle amicizie
// ==========================================
// Richieste, accettazione, richiesta incrociata, rifiuto, rimozione e ricerca.
// Ogni controllo passa dalle API vere: se una rotta o una regola cambia, qui
// salta fuori subito.
//
// Uso:  node tools/prova_amici.js

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const RADICE = path.resolve(__dirname, '..');
const CARTELLA_STATO = path.join(RADICE, 'dati', 'runtime');
const PORTA = 8109;
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

async function main() {
    for (const file of ['giocatori.json', 'partite.json', 'amici.json', 'amici.jsonl']) {
        fs.rmSync(path.join(CARTELLA_STATO, file), { force: true });
    }

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
        const tokenA = await iscrivi('AnnaAmica');
        const tokenB = await iscrivi('BrunoAmico');
        const tokenC = await iscrivi('CarlaTerza');

        const senzaToken = await get('/api/amici');
        verifica('elenco amici senza token vietato', senzaToken.stato === 401, 'http ' + senzaToken.stato);

        const elencoIniziale = await get('/api/amici', tokenA);
        verifica('elenco iniziale vuoto',
            elencoIniziale.stato === 200 && elencoIniziale.dati.amici.length === 0 &&
            elencoIniziale.dati.ricevute.length === 0, 'amici 0');

        const ricercaCorta = await post('/api/amici/cerca', { nick: 'a' }, tokenA);
        verifica('ricerca di una sola lettera respinta', ricercaCorta.stato === 400, 'http ' + ricercaCorta.stato);

        const ricerca = await post('/api/amici/cerca', { nick: 'bruno' }, tokenA);
        verifica('ricerca per nome parziale trova il giocatore',
            ricerca.stato === 200 && ricerca.dati.risultati.length === 1 &&
            ricerca.dati.risultati[0].nick === 'BrunoAmico', 'trovato 1');

        const ricercaMia = await post('/api/amici/cerca', { nick: 'anna' }, tokenA);
        verifica('nella ricerca ci si vede come "me"',
            ricercaMia.dati.risultati[0].relazione === 'me', ricercaMia.dati.risultati[0].relazione);

        const aSeStesso = await post('/api/amici/chiedi', { nick: 'AnnaAmica' }, tokenA);
        verifica('richiesta a se stessi respinta', aSeStesso.stato === 400, 'http ' + aSeStesso.stato);

        const aInesistente = await post('/api/amici/chiedi', { nick: 'NessunoQui' }, tokenA);
        verifica('richiesta a un nickname inesistente respinta', aInesistente.stato === 404,
            'http ' + aInesistente.stato);

        const richiesta = await post('/api/amici/chiedi', { nick: 'BrunoAmico' }, tokenA);
        verifica('richiesta inviata', richiesta.stato === 200 && richiesta.dati.accettata === false,
            'accettata: ' + (richiesta.dati && richiesta.dati.accettata));

        const doppione = await post('/api/amici/chiedi', { nick: 'BrunoAmico' }, tokenA);
        verifica('seconda richiesta identica respinta', doppione.stato === 409, 'http ' + doppione.stato);

        const elencoB = await get('/api/amici', tokenB);
        verifica('l\'altro vede la richiesta ricevuta',
            elencoB.dati.ricevute.length === 1 && elencoB.dati.ricevute[0].nick === 'AnnaAmica',
            'ricevute 1');

        const ricercaRelazione = await post('/api/amici/cerca', { nick: 'bruno' }, tokenA);
        verifica('la ricerca mostra la richiesta inviata',
            ricercaRelazione.dati.risultati[0].relazione === 'richiestaInviata',
            ricercaRelazione.dati.risultati[0].relazione);

        const accettata = await post('/api/amici/accetta', { nick: 'AnnaAmica' }, tokenB);
        verifica('richiesta accettata', accettata.stato === 200, 'http ' + accettata.stato);

        const elencoADopo = await get('/api/amici', tokenA);
        const elencoBDopo = await get('/api/amici', tokenB);
        verifica('l\'amicizia si vede da entrambe le parti',
            elencoADopo.dati.amici.length === 1 && elencoBDopo.dati.amici.length === 1,
            'A ' + elencoADopo.dati.amici.length + ' / B ' + elencoBDopo.dati.amici.length);

        const accettaDoppio = await post('/api/amici/accetta', { nick: 'AnnaAmica' }, tokenB);
        verifica('accettare due volte è respinto', accettaDoppio.stato === 409, 'http ' + accettaDoppio.stato);

        // Richiesta incrociata: se l'altro ci aveva già chiesto l'amicizia, la
        // richiesta opposta vale come accettazione.
        await post('/api/amici/chiedi', { nick: 'CarlaTerza' }, tokenA);
        const incrociata = await post('/api/amici/chiedi', { nick: 'AnnaAmica' }, tokenC);
        verifica('richiesta incrociata crea subito l\'amicizia',
            incrociata.stato === 200 && incrociata.dati.accettata === true,
            'accettata: ' + (incrociata.dati && incrociata.dati.accettata));

        const rifiutoMancante = await post('/api/amici/rifiuta', { nick: 'CarlaTerza' }, tokenB);
        verifica('rifiutare senza richiesta è respinto', rifiutoMancante.stato === 404,
            'http ' + rifiutoMancante.stato);

        await post('/api/amici/chiedi', { nick: 'BrunoAmico' }, tokenC);
        const rifiuto = await post('/api/amici/rifiuta', { nick: 'CarlaTerza' }, tokenB);
        const elencoBDopoRifiuto = await get('/api/amici', tokenB);
        verifica('rifiuto accettato e richiesta sparita',
            rifiuto.stato === 200 && elencoBDopoRifiuto.dati.ricevute.length === 0,
            'ricevute ' + elencoBDopoRifiuto.dati.ricevute.length);

        const rimozione = await post('/api/amici/rimuovi', { nick: 'AnnaAmica' }, tokenB);
        const elencoARimossa = await get('/api/amici', tokenA);
        const nomiAmiciA = elencoARimossa.dati.amici.map((amico) => amico.nick);
        verifica('rimozione dell\'amico vale per entrambi',
            rimozione.stato === 200 && nomiAmiciA.indexOf('BrunoAmico') === -1 &&
            nomiAmiciA.indexOf('CarlaTerza') !== -1,
            'amici di A: ' + nomiAmiciA.join(', '));

        const rimozioneDoppia = await post('/api/amici/rimuovi', { nick: 'AnnaAmica' }, tokenB);
        verifica('rimuovere chi non è amico è respinto', rimozioneDoppia.stato === 404,
            'http ' + rimozioneDoppia.stato);

        const registro = fs.readFileSync(path.join(CARTELLA_STATO, 'amici.jsonl'), 'utf8')
            .split('\n').filter((riga) => riga.trim() !== '');
        verifica('il registro delle amicizie conserva gli eventi', registro.length >= 6,
            registro.length + ' righe');

        const fileAmici = JSON.parse(fs.readFileSync(path.join(CARTELLA_STATO, 'amici.json'), 'utf8'));
        verifica('nulla con l\'hash della password nel file delle amicizie',
            JSON.stringify(fileAmici).indexOf('hash') === -1 && JSON.stringify(fileAmici).indexOf('sale') === -1,
            'pulito');
    } finally {
        server.kill();
        await attendi(250);
        for (const file of ['giocatori.json', 'partite.json', 'amici.json', 'amici.jsonl']) {
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
