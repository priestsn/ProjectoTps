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
    stato.partite[partitaId] = {
        partitaId: partitaId,
        giocatore: giocatore.id,
        modo: corpo && corpo.modo === 'ranked' ? 'ranked' : 'online',
        avversario: corpo && typeof corpo.avversario === 'string' ? corpo.avversario.slice(0, 24) : null,
        avviata: adesso,
        scade: adesso + DURATA_MASSIMA_MINUTI * 60000,
        conclusa: false
    };
    magazzino.scrivi('partite.json', stato);
    return { ok: true, partitaId: partitaId };
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
    giocatore.partiteGiocate = (giocatore.partiteGiocate || 0) + 1;
    if (esito === 'vittoria') giocatore.vittorie = (giocatore.vittorie || 0) + 1;
    if (esito === 'sconfitta') giocatore.sconfitte = (giocatore.sconfitte || 0) + 1;
    if (esito === 'pareggio') giocatore.pareggi = (giocatore.pareggi || 0) + 1;
    giocatore.punti = Math.max(0, (giocatore.punti || 0) + puntiDati);

    partita.conclusa = true;
    partita.esito = esito;
    partita.quando = new Date(adesso).toISOString();
    partita.punti = puntiDati;

    stato.partite[partita.partitaId] = partita;
    magazzino.scrivi('partite.json', stato);
    magazzino.scrivi('giocatori.json', leggiGiocatoriConGiocatore(magazzino, giocatore));

    // Registro permanente: serve allo storico e alle contestazioni.
    accoda(magazzino.percorso('partite.jsonl'), {
        partitaId: partita.partitaId,
        giocatore: giocatore.id,
        nick: giocatore.nick,
        modo: partita.modo,
        esito: esito,
        punti: puntiDati,
        quando: new Date(adesso).toISOString()
    });

    return {
        ok: true,
        punti: giocatore.punti,
        puntiGuadagnati: puntiDati,
        contata: contata,
        partiteOggi: giocatore.partiteOggi,
        limiteGiornaliero: PARTITE_CONTATE_AL_GIORNO
    };
}

/**
 * Il giocatore modificato va scritto nel file dei giocatori, che è separato da
 * quello delle partite: questa funzione prepara lo stato completo.
 */
function leggiGiocatoriConGiocatore(magazzino, giocatore) {
    const stato = magazzino.leggi('giocatori.json', { versione: 1, giocatori: {}, sessioni: {} });
    if (!stato.giocatori) stato.giocatori = {};
    stato.giocatori[giocatore.id] = giocatore;
    return stato;
}

module.exports = { avviaPartita, concludiPartita, PARTITE_CONTATE_AL_GIORNO, oggi };
