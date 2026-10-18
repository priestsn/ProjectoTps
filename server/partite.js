// ========================================
// Partite conclusioni: punti guadagnati giocando
// ==========================================
// Perché servono due chiamate e non una: il client non deve poter dire
// "ho vinto, dammi 100 punti". Il server emette un identificativo di partita
// prima dell'incontro, e accetta un solo risultato per identificativo, entro il
// tempo massimo e dentro un tetto giornaliero. Così i punti arrivano da partite
// vere e non si possono moltiplicare inviando risultati a raffica.

const crypto = require('crypto');
const { accoda } = require('./dati.js');
const elo = require('./elo.js');

const DURATA_MASSIMA_MINUTI = 60;
const PARTITE_CONTATE_AL_GIORNO = 15;

/** Oggi, in formato AAAA-MM-GG: serve al tetto giornaliero. */
function oggi(adesso) {
    return new Date(adesso || Date.now()).toISOString().slice(0, 10);
}

/** La partita esiste ed è ancora valida? */
function partitaValida(stato, partitaId, giocatore, adesso) {
    const partita = stato.partite[partitaId];
    if (!partita) return { ok: false, stato: 404, messaggio: 'Partita non riconosciuta.' };
    if (partita.giocatore !== giocatore.id) return { ok: false, stato: 403, messaggio: 'Questa partita non è tua.' };
    if (partita.conclusa) return { ok: false, stato: 409, messaggio: 'Risultato già registrato.' };
    if (partita.scade < adesso) return { ok: false, stato: 409, messaggio: 'Partita scaduta: il risultato è troppo vecchio.' };
    return { ok: true, partita: partita };
}

/**
 * Apre una partita e restituisce il suo identificativo.
 * Va chiamata quando l'incontro parte davvero (non quando si apre il menu).
 */
function avviaPartita(magazzino, giocatore, corpo) {
    const stato = magazzino.leggi('partite.json', { versione: 1, partite: {} });
    if (!stato.partite) stato.partite = {};

    const adesso = Date.now();
    // Pulizia delle partite vecchie: il file non deve crescere per sempre.
    for (const [id, partita] of Object.entries(stato.partite)) {
        if (partita.scade < adesso - 3600000) delete stato.partite[id];
    }

    const partitaId = crypto.randomUUID();

    // Ranked: l'avversario va indicato per nickname e deve esistere, altrimenti
    // l'ELO non avrebbe un secondo giocatore da aggiornare.
    const modo = corpo && corpo.modo === 'ranked' ? 'ranked' : 'online';
    let avversarioId = null;
    let avversarioNick = null;

    if (modo === 'ranked') {
        const nickCercato = String((corpo && corpo.avversario) || '').trim().toLowerCase();
        if (!nickCercato) {
            return { ok: false, stato: 400, messaggio: 'Una partita ranked deve indicare l\'avversario.' };
        }

        const statoGiocatori = magazzino.leggi('giocatori.json', { versione: 1, giocatori: {}, sessioni: {} });
        const trovato = Object.values(statoGiocatori.giocatori || {})
            .find((altro) => altro.nickNormalizzato === nickCercato);

        if (!trovato) return { ok: false, stato: 404, messaggio: 'Nessun giocatore con questo nickname.' };
        if (trovato.id === giocatore.id) {
            return { ok: false, stato: 400, messaggio: 'Non puoi giocare ranked contro te stesso.' };
        }

        avversarioId = trovato.id;
        avversarioNick = trovato.nick;
    }

    stato.partite[partitaId] = {
        partitaId: partitaId,
        giocatore: giocatore.id,
        modo: modo,
        avversarioId: avversarioId,
        avversario: avversarioNick || (corpo && typeof corpo.avversario === 'string' ? corpo.avversario.slice(0, 24) : null),
        avviata: adesso,
        scade: adesso + DURATA_MASSIMA_MINUTI * 60000,
        conclusa: false
    };
    magazzino.scrivi('partite.json', stato);
    return { ok: true, partitaId: partitaId, modo: modo, avversario: avversarioNick };
}

/**
 * Chiude una partita e accredita i punti.
 * `esito` può essere: 'vittoria', 'sconfitta' oppure 'pareggio'.
 */
function concludiPartita(magazzino, giocatore, corpo, regole) {
    const adesso = Date.now();
    const esito = String((corpo && corpo.esito) || '');
    if (['vittoria', 'sconfitta', 'pareggio'].indexOf(esito) === -1) {
        return { ok: false, stato: 400, messaggio: 'Esito non valido: serve vittoria, sconfitta o pareggio.' };
    }

    const stato = magazzino.leggi('partite.json', { versione: 1, partite: {} });
    if (!stato.partite) stato.partite = {};

    const controllo = partitaValida(stato, String((corpo && corpo.partitaId) || ''), giocatore, adesso);
    if (!controllo.ok) return controllo;

    const partita = controllo.partita;
    const tabella = regole.punti;
    const premio = esito === 'vittoria' ? (partita.modo === 'ranked' ? tabella.rankedVinta : tabella.onlineVinta)
        : esito === 'sconfitta' ? (partita.modo === 'ranked' ? tabella.rankedPersa : tabella.onlinePersa)
            : tabella.rankedPari;

    // I giocatori si leggono dal file: nella ranked l'avversario non è nella
    // richiesta e il suo ELO va aggiornato insieme al nostro.
    const statoGiocatori = magazzino.leggi('giocatori.json', { versione: 1, giocatori: {}, sessioni: {} });
    if (!statoGiocatori.giocatori) statoGiocatori.giocatori = {};
    statoGiocatori.giocatori[giocatore.id] = giocatore;

    const avversario = partita.avversarioId ? statoGiocatori.giocatori[partita.avversarioId] : null;
    const ranked = partita.modo === 'ranked' && !!avversario;

    // Tetto giornaliero: oltre le partite contate la partita resta valida ma
    // non accredita più niente (evita di macinare punti in un pomeriggio).
    const giorno = oggi(adesso);
    if (giocatore.giornoPartite !== giorno) {
        giocatore.giornoPartite = giorno;
        giocatore.partiteOggi = 0;
    }
    const contata = (giocatore.partiteOggi || 0) < PARTITE_CONTATE_AL_GIORNO;
    const puntiDati = contata ? premio : 0;

    giocatore.partiteOggi = (giocatore.partiteOggi || 0) + 1;
    if (ranked) giocatore.partiteRanked = (giocatore.partiteRanked || 0) + 1;
    elo.aggiornaStatistiche(giocatore, esito);
    giocatore.punti = Math.max(0, (giocatore.punti || 0) + puntiDati);

    let variazioneElo = 0;
    let eloAvversario = null;
    let puntiAvversario = 0;

    if (ranked) {
        const esitoAvversario = esito === 'vittoria' ? 'sconfitta' : esito === 'sconfitta' ? 'vittoria' : 'pareggio';
        const premioAvversario = esitoAvversario === 'vittoria' ? tabella.rankedVinta
            : esitoAvversario === 'sconfitta' ? tabella.rankedPersa : tabella.rankedPari;

        const calcolo = elo.nuoviElo(
            giocatore.elo || regole.elo.iniziale,
            avversario.elo || regole.elo.iniziale,
            esito,
            { k: regole.elo.k, minimo: regole.elo.minimo }
        );
        giocatore.elo = calcolo.eloUno;
        avversario.elo = calcolo.eloAltro;
        variazioneElo = calcolo.variazione;

        // Anche all'avversario i punti seguono il tetto giornaliero: nessuno
        // deve poter gonfiare il punteggio di un amico facendosi battere.
        if (avversario.giornoPartite !== giorno) {
            avversario.giornoPartite = giorno;
            avversario.partiteOggi = 0;
        }
        const contataAvversario = (avversario.partiteOggi || 0) < PARTITE_CONTATE_AL_GIORNO;
        puntiAvversario = contataAvversario ? premioAvversario : 0;
        avversario.partiteOggi = (avversario.partiteOggi || 0) + 1;
        avversario.partiteRanked = (avversario.partiteRanked || 0) + 1;
        elo.aggiornaStatistiche(avversario, esitoAvversario);
        avversario.punti = Math.max(0, (avversario.punti || 0) + puntiAvversario);
        eloAvversario = avversario.elo;

        statoGiocatori.giocatori[avversario.id] = avversario;

        accoda(magazzino.percorso('partite.jsonl'), {
            partitaId: partita.partitaId,
            giocatore: avversario.id,
            nick: avversario.nick,
            modo: partita.modo,
            esito: esitoAvversario,
            punti: puntiAvversario,
            elo: eloAvversario,
            variazioneElo: -variazioneElo,
            quando: new Date(adesso).toISOString()
        });
    }

    partita.conclusa = true;
    partita.esito = esito;
    partita.quando = new Date(adesso).toISOString();
    partita.punti = puntiDati;
    partita.variazioneElo = variazioneElo;

    stato.partite[partita.partitaId] = partita;
    magazzino.scrivi('partite.json', stato);
    magazzino.scrivi('giocatori.json', statoGiocatori);

    // Registro permanente: serve allo storico e alle contestazioni.
    accoda(magazzino.percorso('partite.jsonl'), {
        partitaId: partita.partitaId,
        giocatore: giocatore.id,
        nick: giocatore.nick,
        modo: partita.modo,
        esito: esito,
        punti: puntiDati,
        elo: giocatore.elo,
        variazioneElo: variazioneElo,
        quando: new Date(adesso).toISOString()
    });

    const risposta = {
        ok: true,
        punti: giocatore.punti,
        puntiGuadagnati: puntiDati,
        contata: contata,
        partiteOggi: giocatore.partiteOggi,
        limiteGiornaliero: PARTITE_CONTATE_AL_GIORNO
    };

    if (ranked) {
        risposta.elo = giocatore.elo;
        risposta.eloGuadagnato = variazioneElo;
        risposta.avversario = {
            nick: avversario.nick,
            elo: eloAvversario,
            puntiGuadagnati: puntiAvversario
        };
    }

    return risposta;
}

module.exports = { avviaPartita, concludiPartita, PARTITE_CONTATE_AL_GIORNO, oggi };
