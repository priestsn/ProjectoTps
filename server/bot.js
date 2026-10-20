// ========================================
// Guissè, il bot della ranked
// ==========================================
// Guissè è un giocatore del server come gli altri: ha un record in
// giocatori.json, un ELO e compare in classifica. La differenza è che non ha
// un client: quando la coda ranked non trova nessun umano entro
// BOT_DOPO_SECONDI, il server abbina chi aspetta a lui e la partita si gioca
// contro la CPU "guisse" (js/CPU.js), che è la difficoltà più forte del gioco.
//
// Il record nasce senza `sale` e senza `hash`: non esiste una password che
// possa autenticarlo, quindi nessuno può entrare nell'account. Non è nemmeno
// un trucco per il client: lo stesso server lo tratta come avversario ranked,
// quindi l'ELO si aggiorna a entrambi come in una sfida vera.

const NICK = 'Guissè';
const ID = 'guisse-bot';
const ELO_INIZIALE = 2198;

// Dopo quanti secondi di coda senza umani si passa a Guissè. Otto secondi sono
// un compromesso: abbastanza per non rubare la partita a un umano che sta
// arrivando, pochi abbastanza per non lasciare la coda vuota a chiunque.
const BOT_DOPO_SECONDI = 8;

/** Normalizzazione identica a quella di server/account.js. */
function normalizza(nick) {
    return String(nick || '').trim().toLowerCase();
}

/** Il record del bot. `personaggi` li prende dal catalogo, se c'è. */
function creaRecord(account) {
    let personaggi = [];
    try {
        personaggi = account.negozio().voci
            .filter((voce) => !voce.skin)
            .map((voce) => voce.personaggio);
    } catch (errore) {
        personaggi = [];
    }

    return {
        id: ID,
        nick: NICK,
        nickNormalizzato: normalizza(NICK),
        bot: true,

        ruolo: 'giocatore',
        punti: 4200,
        elo: ELO_INIZIALE,
        eloPersonaggio: {},

        personaggi: personaggi,
        skins: [],

        vittorie: 33,
        sconfitte: 7,
        pareggi: 0,
        serie: 6,
        miglioreSerie: 11,
        partiteGiocate: 40,
        partiteRanked: 40,
        partiteOggi: 0,
        partiteBotOggi: 0,
        giornoBot: null,

        // Non è provvisorio: l'ELO di Guissè è una misura, non un numero di
        // partenza. Serve a comparire in classifica senza l'etichetta.
        provvisorio: false,
        protezioneUsata: false,

        titoli: [],
        amici: [],
        richiesteRicevute: [],
        richiesteInviate: [],
        bloccati: [],

        creatoIl: '2026-01-01T00:00:00.000Z',
        ultimoAccesso: null
    };
}

/**
 * Crea il bot se non c'è già. Va chiamata all'avvio: la classifica e la coda
 * leggono il file, e senza il record Guissè non esisterebbe.
 */
function assicura(magazzino, account) {
    const stato = magazzino.leggi('giocatori.json', { versione: 1, giocatori: {}, sessioni: {} });
    if (!stato.giocatori) stato.giocatori = {};

    const esistente = stato.giocatori[ID];
    if (esistente) {
        // Se il record c'è ma è stato azzerato a mano, si rimette l'ELO giusto
        if (typeof esistente.elo !== 'number') {
            esistente.elo = ELO_INIZIALE;
            magazzino.scrivi('giocatori.json', stato);
        }
        return esistente;
    }

    const nuovo = creaRecord(account || require('./account.js'));
    stato.giocatori[ID] = nuovo;
    magazzino.scrivi('giocatori.json', stato);

    return nuovo;
}

/** Il record del bot, senza creare niente. Null se non esiste. */
function leggi(magazzino) {
    const stato = magazzino.leggi('giocatori.json', { versione: 1, giocatori: {}, sessioni: {} });
    return (stato.giocatori && stato.giocatori[ID]) || null;
}

/** True se il giocatore indicato è il bot. */
function eIlBot(giocatore) {
    return !!giocatore && (giocatore.bot === true || giocatore.id === ID);
}

module.exports = {
    NICK, ID, ELO_INIZIALE, BOT_DOPO_SECONDI,
    assicura, leggi, eIlBot, normalizza, creaRecord
};
