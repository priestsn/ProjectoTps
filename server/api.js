// ========================================
// API del gioco (JSON, sulla stessa porta del WebSocket)
// ==========================================
// Il browser parla con questo router per tutto ciò che non è la partita:
// account, negozio, amici, classifica, tornei. Le risposte sono sempre JSON e
// gli errori portano un campo "messaggio" già in italiano, pronto da mostrare.
//
// Non usa nessuna libreria: il corpo della richiesta è letto a mano e limitato
// a 16 KB, perché il gioco non ha bisogno di mandare di più.

const path = require('path');
const { Magazzino } = require('./dati.js');
const account = require('./account.js');
const partite = require('./partite.js');
const amici = require('./amici.js');
const classificaModulo = require('./classifica.js');

const RADICE = path.resolve(__dirname, '..');

/** Archivio dello stato: uno solo per processo, come il gioco. */
const magazzino = new Magazzino(path.join(RADICE, 'dati', 'runtime'));

const MASSIMO_CORPO = 16 * 1024;

/** Scrive una risposta JSON. */
function rispondi(risposta, stato, dati) {
    const testo = JSON.stringify(dati === undefined ? {} : dati);
    risposta.writeHead(stato, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(testo),
        'Cache-Control': 'no-store'
    });
    risposta.end(testo);
}

/**
 * Risposta per gli esiti del modulo amici, che tornano { ok, stato, messaggio }.
 * Quando va bene si restituiscono i dati utili, senza i campi di controllo.
 */
function rispondiAmici(risposta, esito) {
    if (!esito.ok) {
        rispondi(risposta, esito.stato || 400, { messaggio: esito.messaggio });
        return;
    }

    const dati = { messaggio: esito.messaggio };
    if (esito.risultati) dati.risultati = esito.risultati;
    if (esito.accettata !== undefined) dati.accettata = esito.accettata;
    rispondi(risposta, 200, dati);
}

/** Legge il corpo della richiesta, con un tetto alla dimensione. */
function leggiCorpo(richiesta) {
    return new Promise((risolvi, rifiuta) => {
        let totale = 0;
        const pezzi = [];
        richiesta.on('data', (pezzo) => {
            totale += pezzo.length;
            if (totale > MASSIMO_CORPO) {
                rifiuta(new Error('corpo troppo grande'));
                richiesta.destroy();
                return;
            }
            pezzi.push(pezzo);
        });
        richiesta.on('end', () => {
            const testo = Buffer.concat(pezzi).toString('utf8');
            if (!testo) { risolvi({}); return; }
            try {
                risolvi(JSON.parse(testo));
            } catch (errore) {
                rifiuta(new Error('JSON non valido'));
            }
        });
        richiesta.on('error', () => rifiuta(new Error('lettura fallita')));
    });
}

/** Il token arriva nell'intestazione Authorization: Bearer <token>. */
function tokenDaRichiesta(richiesta) {
    const intestazione = richiesta.headers.authorization || '';
    const pezzi = intestazione.split(' ');
    if (pezzi.length === 2 && pezzi[0].toLowerCase() === 'bearer') return pezzi[1];
    return null;
}

/** Giocatore autenticato collegato alla richiesta, oppure null. */
function giocatoreDaRichiesta(richiesta) {
    return account.daToken(magazzino, tokenDaRichiesta(richiesta));
}

const MESSAGGIO_SESSIONE = 'Sessione non valida: accedi di nuovo.';

/**
 * Gestisce una richiesta /api/. Restituisce true se l'ha presa in carico.
 * Le risposte sono asincrone: chi chiama non deve fare altro.
 */
async function gestisciApi(richiesta, risposta) {
    const metodo = richiesta.method.toUpperCase();
    const percorso = decodeURIComponent(richiesta.url.split('?')[0]).replace(/\/+$/, '');

    let corpo = {};
    if (metodo === 'POST') {
        try {
            corpo = await leggiCorpo(richiesta);
        } catch (errore) {
            const troppoGrande = errore.message === 'corpo troppo grande';
            rispondi(risposta, troppoGrande ? 413 : 400, {
                messaggio: troppoGrande ? 'Richiesta troppo grande.' : 'Dati non leggibili: la richiesta deve essere JSON valido.'
            });
            return true;
        }
    }

    switch (metodo + ' ' + percorso) {
        case 'POST /api/iscrizione': {
            const esito = account.iscrivi(magazzino, corpo);
            if (!esito.ok) { rispondi(risposta, esito.stato, { messaggio: esito.messaggio }); return true; }
            const accesso = account.accedi(magazzino, corpo);
            rispondi(risposta, 201, { token: accesso.token, giocatore: account.pubblico(accesso.giocatore) });
            return true;
        }

        case 'POST /api/accesso': {
            const esito = account.accedi(magazzino, corpo);
            if (!esito.ok) { rispondi(risposta, esito.stato, { messaggio: esito.messaggio }); return true; }
            rispondi(risposta, 200, { token: esito.token, giocatore: account.pubblico(esito.giocatore) });
            return true;
        }

        case 'POST /api/uscita': {
            const giocatore = giocatoreDaRichiesta(richiesta);
            if (!giocatore) { rispondi(risposta, 401, { messaggio: MESSAGGIO_SESSIONE }); return true; }
            account.esci(magazzino, tokenDaRichiesta(richiesta));
            rispondi(risposta, 200, { ok: true });
            return true;
        }

        case 'GET /api/profilo': {
            const giocatore = giocatoreDaRichiesta(richiesta);
            if (!giocatore) { rispondi(risposta, 401, { messaggio: MESSAGGIO_SESSIONE }); return true; }
            rispondi(risposta, 200, account.pubblico(giocatore));
            return true;
        }

        case 'GET /api/negozio': {
            const giocatore = giocatoreDaRichiesta(richiesta);
            if (!giocatore) { rispondi(risposta, 401, { messaggio: MESSAGGIO_SESSIONE }); return true; }
            const voci = account.negozio().voci.map((voce) => ({
                personaggio: voce.personaggio,
                prezzo: voce.prezzo,
                ottenuto: giocatore.personaggi.includes(voce.personaggio),
                icona: voce.icona
            }));
            rispondi(risposta, 200, { punti: giocatore.punti, voci: voci });
            return true;
        }

        case 'POST /api/negozio/acquisto': {
            const giocatore = giocatoreDaRichiesta(richiesta);
            if (!giocatore) { rispondi(risposta, 401, { messaggio: MESSAGGIO_SESSIONE }); return true; }
            const esito = account.acquista(magazzino, giocatore, String(corpo.personaggio || ''));
            if (!esito.ok) { rispondi(risposta, esito.stato, { messaggio: esito.messaggio }); return true; }
            rispondi(risposta, 200, { punti: esito.punti, personaggi: esito.personaggi });
            return true;
        }

        case 'POST /api/partita/avvia': {
            const giocatore = giocatoreDaRichiesta(richiesta);
            if (!giocatore) { rispondi(risposta, 401, { messaggio: MESSAGGIO_SESSIONE }); return true; }
            const esito = partite.avviaPartita(magazzino, giocatore, corpo);
            if (!esito.ok) { rispondi(risposta, esito.stato || 400, { messaggio: esito.messaggio }); return true; }
            rispondi(risposta, 200, {
                partitaId: esito.partitaId,
                modo: esito.modo,
                avversario: esito.avversario
            });
            return true;
        }

        case 'POST /api/partita/concludi': {
            const giocatore = giocatoreDaRichiesta(richiesta);
            if (!giocatore) { rispondi(risposta, 401, { messaggio: MESSAGGIO_SESSIONE }); return true; }
            const esito = partite.concludiPartita(magazzino, giocatore, corpo, account.regole());
            if (!esito.ok) { rispondi(risposta, esito.stato, { messaggio: esito.messaggio }); return true; }
            rispondi(risposta, 200, {
                punti: esito.punti,
                puntiGuadagnati: esito.puntiGuadagnati,
                contata: esito.contata,
                partiteOggi: esito.partiteOggi,
                limiteGiornaliero: esito.limiteGiornaliero,
                elo: esito.elo,
                eloGuadagnato: esito.eloGuadagnato,
                avversario: esito.avversario
            });
            return true;
        }

        case 'GET /api/classifica': {
            // Visibile anche senza account: la classifica è pubblica, come in
            // ogni gioco competitivo. Non contiene dati personali, solo nick e
            // numeri di gioco.
            rispondi(risposta, 200, classificaModulo.classifica(magazzino));
            return true;
        }

        case 'GET /api/amici': {
            const giocatore = giocatoreDaRichiesta(richiesta);
            if (!giocatore) { rispondi(risposta, 401, { messaggio: MESSAGGIO_SESSIONE }); return true; }
            rispondi(risposta, 200, amici.elenco(magazzino, giocatore, account.elencoGiocatori(magazzino)));
            return true;
        }

        case 'POST /api/amici/cerca': {
            const giocatore = giocatoreDaRichiesta(richiesta);
            if (!giocatore) { rispondi(risposta, 401, { messaggio: MESSAGGIO_SESSIONE }); return true; }
            rispondiAmici(risposta, amici.cerca(magazzino, giocatore, account.elencoGiocatori(magazzino), corpo.nick));
            return true;
        }

        case 'POST /api/amici/chiedi': {
            const giocatore = giocatoreDaRichiesta(richiesta);
            if (!giocatore) { rispondi(risposta, 401, { messaggio: MESSAGGIO_SESSIONE }); return true; }
            rispondiAmici(risposta, amici.chiedi(magazzino, giocatore, account.elencoGiocatori(magazzino), corpo.nick));
            return true;
        }

        case 'POST /api/amici/accetta': {
            const giocatore = giocatoreDaRichiesta(richiesta);
            if (!giocatore) { rispondi(risposta, 401, { messaggio: MESSAGGIO_SESSIONE }); return true; }
            rispondiAmici(risposta, amici.accetta(magazzino, giocatore, account.elencoGiocatori(magazzino), corpo.nick));
            return true;
        }

        case 'POST /api/amici/rifiuta': {
            const giocatore = giocatoreDaRichiesta(richiesta);
            if (!giocatore) { rispondi(risposta, 401, { messaggio: MESSAGGIO_SESSIONE }); return true; }
            rispondiAmici(risposta, amici.rifiuta(magazzino, giocatore, account.elencoGiocatori(magazzino), corpo.nick));
            return true;
        }

        case 'POST /api/amici/rimuovi': {
            const giocatore = giocatoreDaRichiesta(richiesta);
            if (!giocatore) { rispondi(risposta, 401, { messaggio: MESSAGGIO_SESSIONE }); return true; }
            rispondiAmici(risposta, amici.rimuovi(magazzino, giocatore, account.elencoGiocatori(magazzino), corpo.nick));
            return true;
        }

        default:
            rispondi(risposta, 404, { messaggio: 'Indirizzo non riconosciuto: ' + metodo + ' ' + percorso + '.' });
            return true;
    }
}

module.exports = { gestisciApi, rispondi, magazzino, giocatoreDaRichiesta, tokenDaRichiesta, MESSAGGIO_SESSIONE };
