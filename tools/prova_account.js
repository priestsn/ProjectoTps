// ========================================
// Verifica di account, sessioni e negozio (lato server)
// ==========================================
// Avvia il server del gioco su una porta di prova e gli parla via HTTP, come
// farebbe il browser. Ogni controllo è una regola vera: nickname univoci,
// password mai in chiaro, punti scalati solo quando si compra davvero.
//
// Uso:  node tools/prova_account.js
// Esce con codice 0 se tutti i controlli passano, 1 altrimenti.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const RADICE = path.resolve(__dirname, '..');
const CARTELLA_STATO = path.join(RADICE, 'dati', 'runtime');
const PORTA = 8102;
const BASE = 'http://127.0.0.1:' + PORTA;
const risultati = [];
const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

function verifica(nome, condizione, dettaglio) {
    risultati.push(!!condizione);
    console.log((condizione ? 'OK       ' : 'FALLITO  ') + nome.padEnd(50) + (dettaglio || ''));
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

/** Aspetta che il server risponda, invece di sperare in un tempo fisso. */
async function attendiServer(limiteMs) {
    const scadenza = Date.now() + (limiteMs || 8000);
    while (Date.now() < scadenza) {
        try {
            const risposta = await fetch(BASE + '/stato');
            if (risposta.ok) return true;
        } catch (errore) {
            // server non ancora in ascolto
        }
        await attendi(150);
    }
    return false;
}

async function main() {
    fs.rmSync(path.join(CARTELLA_STATO, 'giocatori.json'), { force: true });

    const server = spawn(process.execPath, ['server/server.js'], {
        cwd: RADICE,
        stdio: 'ignore',
        env: Object.assign({}, process.env, { PORTA: String(PORTA), HOST: '127.0.0.1' })
    });

    const pronto = await attendiServer();
    if (!pronto) {
        console.log('FALLITO  il server non ha risposto sulla porta ' + PORTA);
        server.kill();
        process.exit(1);
    }

    try {
        const iscrizione = await post('/api/iscrizione', { nick: 'VerdelloKid', password: 'passwordsicura1' });
        verifica('iscrizione accettata', iscrizione.stato === 201 && !!iscrizione.dati.token, 'http ' + iscrizione.stato);
        verifica('punti iniziali dalle regole', iscrizione.dati.giocatore.punti === 500, 'punti ' + iscrizione.dati.giocatore.punti);
        verifica('sei lottatori disponibili da subito', iscrizione.dati.giocatore.personaggi.length === 6,
            iscrizione.dati.giocatore.personaggi.length + ' lottatori');
        verifica('la risposta non espone password né hash',
            !JSON.stringify(iscrizione.dati).includes('passwordsicura1') &&
            !JSON.stringify(iscrizione.dati).includes('hash'), 'controllo campi sensibili');

        const doppio = await post('/api/iscrizione', { nick: 'verdellokid', password: 'altrapassword9' });
        verifica('nickname già usato rifiutato (maiuscole comprese)', doppio.stato === 409, 'http ' + doppio.stato);

        const corta = await post('/api/iscrizione', { nick: 'Bo', password: '123' });
        verifica('nickname e password troppo corti rifiutati', corta.stato === 400, 'http ' + corta.stato);

        const sbagliata = await post('/api/accesso', { nick: 'VerdelloKid', password: 'nonesatta' });
        verifica('password sbagliata respinta', sbagliata.stato === 401 && !sbagliata.dati.token, 'http ' + sbagliata.stato);

        const accesso = await post('/api/accesso', { nick: 'VerdelloKid', password: 'passwordsicura1' });
        verifica('accesso corretto restituisce un token',
            accesso.stato === 200 && accesso.dati.token.length >= 32, 'token lungo ' + (accesso.dati.token || '').length);

        const profilo = await get('/api/profilo', accesso.dati.token);
        verifica('il profilo risponde con il nickname',
            profilo.stato === 200 && profilo.dati.nick === 'VerdelloKid', 'http ' + profilo.stato);

        const senzaToken = await get('/api/profilo');
        verifica('senza token il profilo è vietato', senzaToken.stato === 401, 'http ' + senzaToken.stato);

        const negozio = await get('/api/negozio', accesso.dati.token);
        verifica('il negozio elenca 9 lottatori', negozio.dati.voci.length === 9, 'voci ' + negozio.dati.voci.length);
        verifica('tre lottatori risultano da acquistare',
            negozio.dati.voci.filter((v) => !v.ottenuto).length === 3,
            negozio.dati.voci.filter((v) => !v.ottenuto).map((v) => v.personaggio).join(','));

        const troppoCaro = await post('/api/negozio/acquisto', { personaggio: 'AyoAdebayo' }, accesso.dati.token);
        verifica('acquisto senza punti sufficienti rifiutato', troppoCaro.stato === 402, 'http ' + troppoCaro.stato);

        // I punti che una partita vinta accrediterà più avanti: qui si scrivono
        // nel file di stato che il server rilegge a ogni richiesta.
        const percorsoGiocatori = path.join(CARTELLA_STATO, 'giocatori.json');
        const statoSuDisco = JSON.parse(fs.readFileSync(percorsoGiocatori, 'utf8'));
        statoSuDisco.giocatori[iscrizione.dati.giocatore.id].punti = 3000;
        fs.writeFileSync(percorsoGiocatori, JSON.stringify(statoSuDisco, null, 2));

        const compra = await post('/api/negozio/acquisto', { personaggio: 'BakariTraore' }, accesso.dati.token);
        verifica('acquisto con punti sufficienti riesce',
            compra.stato === 200 && compra.dati.personaggi.includes('BakariTraore'), 'http ' + compra.stato);
        verifica('i punti vengono scalati del prezzo esatto', compra.dati.punti === 500, 'punti ' + compra.dati.punti);

        const ricompra = await post('/api/negozio/acquisto', { personaggio: 'BakariTraore' }, accesso.dati.token);
        verifica('ricomprare lo stesso lottatore rifiutato', ricompra.stato === 409, 'http ' + ricompra.stato);

        const inesistente = await post('/api/negozio/acquisto', { personaggio: 'Nessuno' }, accesso.dati.token);
        verifica('lottatore inesistente respinto con 404', inesistente.stato === 404, 'http ' + inesistente.stato);

        const rottaSconosciuta = await get('/api/qualcosa', accesso.dati.token);
        verifica('rotta /api sconosciuta risponde 404 JSON', rottaSconosciuta.stato === 404, 'http ' + rottaSconosciuta.stato);

        const fileStato = await get('/dati/runtime/giocatori.json');
        verifica('lo stato dei giocatori non è scaricabile dal sito', fileStato.stato === 404, 'http ' + fileStato.stato);

        const uscita = await post('/api/uscita', {}, accesso.dati.token);
        verifica('uscita accettata', uscita.stato === 200, 'http ' + uscita.stato);
        const dopoUscita = await get('/api/profilo', accesso.dati.token);
        verifica('il token non vale più dopo l\'uscita', dopoUscita.stato === 401, 'http ' + dopoUscita.stato);
    } finally {
        server.kill();
        await attendi(200);
        fs.rmSync(path.join(CARTELLA_STATO, 'giocatori.json'), { force: true });
        const totale = risultati.filter(Boolean).length;
        console.log('\n' + totale + '/' + risultati.length + ' verifiche passate');
        process.exit(totale === risultati.length ? 0 : 1);
    }
}

main().catch((errore) => {
    console.log('FALLITO  errore imprevisto: ' + errore.message);
    process.exit(1);
});
