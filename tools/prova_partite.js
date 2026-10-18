// ========================================
// Verifica dei punti guadagnati giocando
// ==========================================
// Il server emette un identificativo di partita e accetta un solo risultato per
// identificativo: qui si controlla che i punti arrivino davvero, una volta sola,
// e che il tetto giornaliero li fermi.
//
// Uso:  node tools/prova_partite.js

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const RADICE = path.resolve(__dirname, '..');
const CARTELLA_STATO = path.join(RADICE, 'dati', 'runtime');
const PORTA = 8106;
const BASE = 'http://127.0.0.1:' + PORTA;
const risultati = [];
const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

function verifica(nome, condizione, dettaglio) {
    risultati.push(!!condizione);
    console.log((condizione ? 'OK       ' : 'FALLITO  ') + nome.padEnd(52) + (dettaglio || ''));
}

async function post(percorso, corpo, token) {
    const intestazioni = { 'Content-Type': 'application/json' };
    if (token) intestazioni.Authorization = 'Bearer ' + token;
    const risposta = await fetch(BASE + percorso, {
        method: 'POST',
        headers: intestazioni,
        body: JSON.stringify(corpo || {})
    });
    let dati = null;
    try { dati = await risposta.json(); } catch (e) { dati = null; }
    return { stato: risposta.status, dati: dati };
}

async function get(percorso, token) {
    const intestazioni = token ? { Authorization: 'Bearer ' + token } : {};
    const risposta = await fetch(BASE + percorso, { headers: intestazioni });
    let dati = null;
    try { dati = await risposta.json(); } catch (e) { dati = null; }
    return { stato: risposta.status, dati: dati };
}

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

async function main() {
    for (const file of ['giocatori.json', 'partite.json', 'partite.jsonl']) {
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
        const iscrizione = await post('/api/iscrizione', { nick: 'PartitaProva', password: 'passwordsicura1' });
        const token = iscrizione.dati.token;

        const senzaToken = await post('/api/partita/avvia', { modo: 'online' });
        verifica('avvio partita senza token vietato', senzaToken.stato === 401, 'http ' + senzaToken.stato);

        const avvio = await post('/api/partita/avvia', { modo: 'online', avversario: 'Avversario' }, token);
        verifica('avvio partita restituisce un identificativo',
            avvio.stato === 200 && typeof avvio.dati.partitaId === 'string' && avvio.dati.partitaId.length === 36,
            'id ' + String(avvio.dati.partitaId).slice(0, 8) + '…');

        const esitoNonValido = await post('/api/partita/concludi',
            { partitaId: avvio.dati.partitaId, esito: 'boh' }, token);
        verifica('esito non valido respinto', esitoNonValido.stato === 400, 'http ' + esitoNonValido.stato);

        const partitaFinta = await post('/api/partita/concludi',
            { partitaId: '00000000-0000-0000-0000-000000000000', esito: 'vittoria' }, token);
        verifica('identificativo inventato respinto', partitaFinta.stato === 404, 'http ' + partitaFinta.stato);

        const vinta = await post('/api/partita/concludi',
            { partitaId: avvio.dati.partitaId, esito: 'vittoria' }, token);
        verifica('vittoria accreditata', vinta.stato === 200 && vinta.dati.puntiGuadagnati === 100,
            'punti +' + (vinta.dati && vinta.dati.puntiGuadagnati));
        verifica('punti totali aggiornati', vinta.dati.punti === 600, 'punti ' + vinta.dati.punti);
        verifica('la partita risulta contata', vinta.dati.contata === true,
            'partite oggi ' + vinta.dati.partiteOggi + '/' + vinta.dati.limiteGiornaliero);

        const doppio = await post('/api/partita/concludi',
            { partitaId: avvio.dati.partitaId, esito: 'vittoria' }, token);
        verifica('lo stesso risultato non si accredita due volte', doppio.stato === 409, 'http ' + doppio.stato);

        const persa = await post('/api/partita/avvia', { modo: 'online' }, token);
        const sconfitta = await post('/api/partita/concludi',
            { partitaId: persa.dati.partitaId, esito: 'sconfitta' }, token);
        verifica('sconfitta accredita meno della vittoria',
            sconfitta.stato === 200 && sconfitta.dati.puntiGuadagnati === 25, 'punti +' +
            (sconfitta.dati && sconfitta.dati.puntiGuadagnati));

        const profilo = await get('/api/profilo', token);
        verifica('i punti si vedono nel profilo', profilo.dati.punti === 625, 'punti ' + profilo.dati.punti);
        verifica('vittorie e sconfitte aggiornate',
            profilo.dati.vittorie === 1 && profilo.dati.sconfitte === 1,
            'V ' + profilo.dati.vittorie + ' S ' + profilo.dati.sconfitte);

        // Tetto giornaliero: si consumano le partite rimaste e si controlla la
        // prima che supera il limite.
        let ultima = null;
        for (let giro = 0; giro < 20; giro++) {
            const nuova = await post('/api/partita/avvia', { modo: 'online' }, token);
            ultima = await post('/api/partita/concludi', { partitaId: nuova.dati.partitaId, esito: 'vittoria' }, token);
            if (ultima.dati.contata === false) break;
        }
        verifica('oltre il tetto giornaliero la partita non accredita',
            ultima.dati.contata === false && ultima.dati.puntiGuadagnati === 0,
            'punti +' + ultima.dati.puntiGuadagnati + ' (partite oggi ' + ultima.dati.partiteOggi + ')');

        const registro = fs.readFileSync(path.join(CARTELLA_STATO, 'partite.jsonl'), 'utf8')
            .split('\n').filter((riga) => riga.trim() !== '');
        verifica('il registro delle partite conserva ogni esito', registro.length >= 16,
            registro.length + ' righe');

        // Un secondo giocatore non può chiudere la partita del primo.
        const altro = await post('/api/iscrizione', { nick: 'Intruso', password: 'passwordsicura2' });
        const partita = await post('/api/partita/avvia', { modo: 'online' }, token);
        const intrusione = await post('/api/partita/concludi',
            { partitaId: partita.dati.partitaId, esito: 'vittoria' }, altro.dati.token);
        verifica('la partita di un altro non si può chiudere', intrusione.stato === 403, 'http ' + intrusione.stato);
    } finally {
        server.kill();
        await attendi(250);
        for (const file of ['giocatori.json', 'partite.json', 'partite.jsonl']) {
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
