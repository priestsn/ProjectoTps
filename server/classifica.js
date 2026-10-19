// ========================================
// Classifica: chi sta davanti
// ==========================================
// Ordina per ELO, poi per vittorie, poi per ordine alfabetico (così due
// giocatori con lo stesso punteggio non ballano da una richiesta all'altra).
//
// Chi ha giocato meno di PARTITE_PER_USCIRE_DA_PROVVISORIO partite ranked resta
// segnato come provvisorio: il suo ELO c'è, ma non è ancora una misura stabile.

const { PARTITE_PER_USCIRE_DA_PROVVISORIO } = require('./elo.js');
const leghe = require('./leghe.js');

const QUANTI_PREDEFINITO = 50;

/** Legge i giocatori, senza mai restituire hash o sale. */
function giocatori(magazzino) {
    const stato = magazzino.leggi('giocatori.json', { versione: 1, giocatori: {}, sessioni: {} });
    return Object.values(stato.giocatori || {});
}

/** True se il giocatore è segnato come provvisorio. */
function eProvvisorio(giocatore) {
    if (giocatore.provvisorio === false) return false;
    return (giocatore.partiteRanked || 0) < PARTITE_PER_USCIRE_DA_PROVVISORIO;
}

/**
 * Classifica ordinata. Restituisce { classifica: [...], totale: N }.
 */
function classifica(magazzino, quante) {
    const tutti = giocatori(magazzino);

    const ordinati = tutti
        .slice()
        .sort((uno, altro) => {
            const differenzaElo = (altro.elo || 0) - (uno.elo || 0);
            if (differenzaElo !== 0) return differenzaElo;

            const differenzaVittorie = (altro.vittorie || 0) - (uno.vittorie || 0);
            if (differenzaVittorie !== 0) return differenzaVittorie;

            return String(uno.nick).localeCompare(String(altro.nick));
        })
        .slice(0, quante || QUANTI_PREDEFINITO)
        .map((giocatore, indice) => ({
            posizione: indice + 1,
            nick: giocatore.nick,
            elo: giocatore.elo || 0,
            lega: leghe.legaDi(giocatore.elo || 0).nome,
            legaColore: leghe.legaDi(giocatore.elo || 0).colore,
            punti: giocatore.punti || 0,
            partite: giocatore.partiteGiocate || 0,
            partiteRanked: giocatore.partiteRanked || 0,
            vittorie: giocatore.vittorie || 0,
            sconfitte: giocatore.sconfitte || 0,
            serie: giocatore.serie || 0,
            miglioreSerie: giocatore.miglioreSerie || 0,
            provvisorio: eProvvisorio(giocatore)
        }));

    return { classifica: ordinati, totale: tutti.length };
}

module.exports = { classifica, eProvvisorio, giocatori };
