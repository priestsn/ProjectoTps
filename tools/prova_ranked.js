// ========================================
// Verifica di ranked, ELO e classifica
// ==========================================
// Due parti: i conti dell'ELO provati direttamente sulla formula, e il giro
// completo dalle API (avvio ranked, esito, ELO di entrambi, classifica).
//
// Uso:  node tools/prova_ranked.js

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const elo = require('../server/elo.js');

const RADICE = path.resolve(__dirname, '..');
const CARTELLA_STATO = path.join(RADICE, 'dati', 'runtime');
const PORTA = 8111;
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

/** Controlli sulla formula, senza server. */
function controlliFormula() {
    verifica('a parità di ELO il pronostico è mezzo e mezzo',
        Math.abs(elo.atteso(1000, 1000) - 0.5) < 0.0001, 'atteso ' + elo.atteso(1000, 1000).toFixed(3));

    const partita = elo.nuoviElo(1000, 1000, 'vittoria');
    verifica('vittoria fra pari: +16 / -16',
        partita.eloUno === 1016 && partita.eloAltro === 984,
        partita.eloUno + ' / ' + partita.eloAltro);

    const pareggio = elo.nuoviElo(1000, 1000, 'pareggio');
    verifica('pareggio fra pari: nessuna variazione',
        pareggio.eloUno === 1000 && pareggio.eloAltro === 1000, 'variazione ' + pareggio.variazione);

    const squilibrata = elo.nuoviElo(1600, 1000, 'vittoria');
    verifica('chi è molto avanti guadagna poco vincendo',
        squilibrata.variazione < 5, '+' + squilibrata.variazione);

    const somma = elo.nuoviElo(1234, 1567, 'vittoria');
    verifica('la somma degli ELO non cambia mai',
        somma.eloUno + somma.eloAltro === 1234 + 1567,
        somma.eloUno + ' + ' + somma.eloAltro + ' = ' + (somma.eloUno + somma.eloAltro));

    const alMinimo = elo.nuoviElo(100, 1500, 'sconfitta', { minimo: 100 });
    verifica('l\'ELO non scende sotto il minimo e la somma resta uguale',
        alMinimo.eloUno >= 100 && alMinimo.eloUno + alMinimo.eloAltro === 1600,
        alMinimo.eloUno + ' / ' + alMinimo.eloAltro);
}

async function main() {
    for (const file of ['giocatori.json', 'partite.json', 'partite.jsonl', 'amici.json', 'amici.jsonl']) {
        fs.rmSync(path.join(CARTELLA_STATO, file), { force: true });
    }

    controlliFormula();

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
        const tokenA = await iscrivi('RankedUno');
        const tokenB = await iscrivi('RankedDue');

        const senzaAvversario = await post('/api/partita/avvia', { modo: 'ranked' }, tokenA);
        verifica('ranked senza avversario respinto', senzaAvversario.stato === 400,
            'http ' + senzaAvversario.stato);

        const avversarioFinto = await post('/api/partita/avvia',
            { modo: 'ranked', avversario: 'NessunoQui' }, tokenA);
        verifica('ranked con avversario inesistente respinto', avversarioFinto.stato === 404,
            'http ' + avversarioFinto.stato);

        const controSeStessi = await post('/api/partita/avvia',
            { modo: 'ranked', avversario: 'rankeduno' }, tokenA);
        verifica('ranked contro se stessi respinto', controSeStessi.stato === 400,
            'http ' + controSeStessi.stato);

        const avvio = await post('/api/partita/avvia',
            { modo: 'ranked', avversario: 'rankeddue' }, tokenA);
        verifica('avvio ranked con avversario registrato',
            avvio.stato === 200 && avvio.dati.modo === 'ranked' && avvio.dati.avversario === 'RankedDue',
            'avversario ' + (avvio.dati && avvio.dati.avversario));

        const esito = await post('/api/partita/concludi',
            { partitaId: avvio.dati.partitaId, esito: 'vittoria' }, tokenA);
        verifica('l\'ELO del vincitore sale di 16', esito.dati.elo === 1016, 'elo ' + esito.dati.elo);
        verifica('punti ranked accreditati al vincitore', esito.dati.puntiGuadagnati === 100,
            '+' + esito.dati.puntiGuadagnati);
        verifica('la risposta riporta l\'ELO dell\'avversario',
            esito.dati.avversario && esito.dati.avversario.nick === 'RankedDue' &&
            esito.dati.avversario.elo === 984, 'avversario ' + (esito.dati.avversario && esito.dati.avversario.elo));

        const profiloB = await get('/api/profilo', tokenB);
        verifica('lo sconfitto ha l\'ELO sceso e la sconfitta',
            profiloB.dati.elo === 984 && profiloB.dati.sconfitte === 1,
            'elo ' + profiloB.dati.elo + ' sconfitte ' + profiloB.dati.sconfitte);
        verifica('lo sconfitto prende comunque i punti di consolazione',
            profiloB.dati.punti === 525, 'punti ' + profiloB.dati.punti);

        const doppio = await post('/api/partita/concludi',
            { partitaId: avvio.dati.partitaId, esito: 'vittoria' }, tokenA);
        const profiloADopo = await get('/api/profilo', tokenA);
        verifica('un secondo invio non muove più l\'ELO',
            doppio.stato === 409 && profiloADopo.dati.elo === 1016, 'elo ' + profiloADopo.dati.elo);

        const classifica = await get('/api/classifica');
        verifica('la classifica è pubblica e ordinata per ELO',
            classifica.stato === 200 && classifica.dati.classifica.length === 2 &&
            classifica.dati.classifica[0].nick === 'RankedUno' &&
            classifica.dati.classifica[0].posizione === 1,
            classifica.dati.classifica.map((voce) => voce.nick + ' ' + voce.elo).join(' | '));

        verifica('chi ha giocato poco risulta provvisorio',
            classifica.dati.classifica[0].provvisorio === true, 'provvisorio');

        // Dieci partite ranked: si esce dallo stato provvisorio.
        for (let giro = 0; giro < 10; giro++) {
            const nuova = await post('/api/partita/avvia',
                { modo: 'ranked', avversario: 'RankedDue' }, tokenA);
            await post('/api/partita/concludi', { partitaId: nuova.dati.partitaId, esito: 'vittoria' }, tokenA);
        }

        const profiloFinale = await get('/api/profilo', tokenA);
        const classificaFinale = await get('/api/classifica');
        verifica('dopo dieci ranked non si è più provvisori',
            profiloFinale.dati.partiteRanked >= 10 && classificaFinale.dati.classifica
                .find((voce) => voce.nick === 'RankedUno').provvisorio === false,
            'ranked giocate ' + profiloFinale.dati.partiteRanked);

        verifica('la classifica resta a somma ELO costante',
            classificaFinale.dati.classifica.reduce((totale, voce) => totale + voce.elo, 0) === 2000,
            'somma ' + classificaFinale.dati.classifica.reduce((totale, voce) => totale + voce.elo, 0));

        const registro = fs.readFileSync(path.join(CARTELLA_STATO, 'partite.jsonl'), 'utf8')
            .split('\n').filter((riga) => riga.trim() !== '');
        verifica('il registro contiene una riga per giocatore e per partita',
            registro.length === 22, registro.length + ' righe');
    } finally {
        server.kill();
        await attendi(250);
        for (const file of ['giocatori.json', 'partite.json', 'partite.jsonl', 'amici.json', 'amici.jsonl']) {
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
