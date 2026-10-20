// ========================================
// Verifica delle leghe
// ==========================================
// Le soglie, la protezione dalla retrocessione (una sola volta per fascia), il
// fatto che salire di lega ricarichi la protezione, e la lega visibile nel
// profilo e in classifica.
//
// Uso:  node tools/prova_leghe.js

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const leghe = require('../server/leghe.js');

const RADICE = path.resolve(__dirname, '..');
const CARTELLA_STATO = path.join(RADICE, 'dati', 'runtime');
const FILE_STATO = ['giocatori.json', 'partite.json', 'partite.jsonl', 'coda.json'];
const PORTA = 8116;
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

/** Controlli sulla scala delle leghe, senza server. */
function controlliScala() {
    verifica('un ELO di 1000 è Bronzo', leghe.legaDi(1000).nome === 'Bronzo', leghe.legaDi(1000).nome);
    verifica('la soglia esatta appartiene alla lega nuova',
        leghe.legaDi(1100).nome === 'Argento' && leghe.legaDi(1249).nome === 'Argento',
        '1100 → ' + leghe.legaDi(1100).nome);
    verifica('Oro, Platino, Diamante e Maestro hanno le soglie giuste',
        leghe.legaDi(1250).nome === 'Oro' && leghe.legaDi(1400).nome === 'Platino' &&
        leghe.legaDi(1550).nome === 'Diamante' && leghe.legaDi(1700).nome === 'Maestro' &&
        leghe.legaDi(9999).nome === 'Maestro', 'scala completa');
    verifica('il conto alla lega successiva è corretto',
        leghe.legaDi(1000).mancano === 100 && leghe.legaDi(1000).prossima === 'Argento',
        'mancano ' + leghe.legaDi(1000).mancano);
    verifica('la lega più alta non ha una successiva', leghe.legaDi(1800).prossima === null, 'null');

    // Protezione: prima volta si resta, seconda si scende.
    const giocatore = { elo: 1120, protezioneUsata: false };
    const primo = leghe.applicaProtezione(giocatore, 1120, 1080);
    verifica('la prima retrocessione viene fermata alla soglia',
        primo.protetto === true && primo.elo === 1100 && giocatore.protezioneUsata === true,
        'elo ' + primo.elo + ' protetto ' + primo.protetto);

    const secondo = leghe.applicaProtezione(giocatore, 1110, 1050);
    verifica('la seconda volta si scende davvero',
        secondo.protetto === false && secondo.elo === 1050 && secondo.lega.nome === 'Bronzo',
        'elo ' + secondo.elo + ' lega ' + secondo.lega.nome);

    const promosso = { elo: 1390, protezioneUsata: true };
    leghe.applicaProtezione(promosso, 1390, 1420);
    verifica('salire di lega ricarica la protezione',
        promosso.protezioneUsata === false && leghe.legaDi(1420).nome === 'Platino',
        'protezione usata ' + promosso.protezioneUsata);

    const fermo = leghe.applicaProtezione({ elo: 1250, protezioneUsata: false }, 1250, 1260);
    verifica('restando nella stessa lega la protezione non si consuma',
        fermo.protetto === false && fermo.lega.nome === 'Oro', fermo.lega.nome);
}

async function iscrivi(nick) {
    const esito = await post('/api/iscrizione', { nick: nick, password: 'passwordsicura1' });
    return esito.dati.token;
}

async function main() {
    for (const file of FILE_STATO) {
        fs.rmSync(path.join(CARTELLA_STATO, file), { force: true });
    }

    controlliScala();

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
        const tokenA = await iscrivi('LegaUno');
        const tokenB = await iscrivi('LegaDue');

        const profilo = await get('/api/profilo', tokenA);
        verifica('il profilo mostra la lega di partenza',
            profilo.stato === 200 && profilo.dati.lega === 'Bronzo' && profilo.dati.legaProssima === 'Argento',
            profilo.dati.lega + ' → ' + profilo.dati.legaProssima);
        verifica('il profilo dice quanti punti mancano alla lega dopo',
            profilo.dati.legaMancano === 100, 'mancano ' + profilo.dati.legaMancano);

        const partita = await post('/api/partita/avvia',
            { modo: 'ranked', avversario: 'LegaDue' }, tokenA);
        const esito = await post('/api/partita/concludi',
            { partitaId: partita.dati.partitaId, esito: 'vittoria' }, tokenA);
        verifica('l\'esito riporta la lega di chi ha vinto', esito.dati.lega === 'Bronzo', esito.dati.lega);
        verifica('l\'esito riporta la lega dell\'avversario', esito.dati.avversario.lega === 'Bronzo',
            esito.dati.avversario.lega);
        verifica('vincere non fa ancora cambiare lega', esito.dati.elo === 1016, 'elo ' + esito.dati.elo);

        // Portiamo LegaUno al limite dell'Argento. Il guadagno cala a ogni
        // vittoria perché l'avversario continua a scendere: si insiste finché
        // non supera la soglia (max 20 partite, per non restare in loop).
        for (let giro = 0; giro < 20; giro++) {
            const attuale = await get('/api/profilo', tokenA);
            if (attuale.dati.elo >= 1100) break;

            const nuova = await post('/api/partita/avvia',
                { modo: 'ranked', avversario: 'LegaDue' }, tokenA);
            await post('/api/partita/concludi', { partitaId: nuova.dati.partitaId, esito: 'vittoria' }, tokenA);
        }

        const profiloAvanti = await get('/api/profilo', tokenA);
        verifica('vincendo si arriva alla lega successiva',
            profiloAvanti.dati.elo >= 1100 && profiloAvanti.dati.lega === 'Argento',
            'elo ' + profiloAvanti.dati.elo + ' lega ' + profiloAvanti.dati.lega);

        const classifica = await get('/api/classifica');
        // Il bot Guissè (Maestro, 2198) è in classifica per scelta: qui si
        // guardano i due giocatori veri di questa prova.
        const umani = classifica.dati.classifica.filter((voce) => voce.bot !== true);
        verifica('la classifica riporta la lega di ogni giocatore',
            umani[0].lega === 'Argento' && umani[1].lega === 'Bronzo',
            umani.map((voce) => voce.nick + ' ' + voce.lega).join(' | '));

        // Protezione vera, dal server: ora LegaDue vince e LegaUno scende
        // dall'Argento. La prima discesa deve essere fermata dalla protezione.
        let protettoVisto = false;
        for (let giro = 0; giro < 6; giro++) {
            const attuale = await get('/api/profilo', tokenA);
            // Ci si ferma appena la protezione è stata consumata: una seconda
            // sconfitta farebbe scendere davvero di lega, ed è giusto così.
            if (attuale.dati.protezioneUsata) break;
            if (attuale.dati.elo < 1100) break;

            const nuova = await post('/api/partita/avvia',
                { modo: 'ranked', avversario: 'LegaUno' }, tokenB);
            await post('/api/partita/concludi', { partitaId: nuova.dati.partitaId, esito: 'vittoria' }, tokenB);
        }

        const statoDopo = await get('/api/profilo', tokenA);
        protettoVisto = statoDopo.dati.protezioneUsata === true;
        verifica('perdendo molto si consuma la protezione dalla retrocessione',
            protettoVisto === true, 'protezione usata ' + statoDopo.dati.protezioneUsata);
        verifica('finché c\'è protezione la lega non scende',
            statoDopo.dati.lega === 'Argento' && statoDopo.dati.elo >= 1100,
            'lega ' + statoDopo.dati.lega + ' elo ' + statoDopo.dati.elo);
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
