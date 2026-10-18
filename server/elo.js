// ========================================
// ELO: punteggio delle partite ranked
// ==========================================
// Formula standard: il punteggio atteso dipende dalla differenza fra i due
// ELO, il guadagno è K volte la differenza fra risultato e atteso.
//
// La variazione si calcola una volta sola e si applica invertita all'altro
// giocatore: così il totale degli ELO non cambia mai (gioco a somma zero), che
// è la proprietà che rende la classifica confrontabile.

const K_PREDEFINITO = 32;
const MINIMO_PREDEFINITO = 100;
const PARTITE_PER_USCIRE_DA_PROVVISORIO = 10;

/** Probabilità di vittoria del primo giocatore, fra 0 e 1. */
function atteso(eloUno, eloAltro) {
    return 1 / (1 + Math.pow(10, (eloAltro - eloUno) / 400));
}

/** Punteggio del risultato dal punto di vista del primo giocatore. */
function punteggio(esito) {
    if (esito === 'vittoria') return 1;
    if (esito === 'sconfitta') return 0;
    return 0.5;
}

/**
 * Nuovi ELO dei due giocatori.
 * Restituisce { eloUno, eloAltro, variazione } dove `variazione` è quanto ha
 * guadagnato (o perso) il primo giocatore.
 */
function nuoviElo(eloUno, eloAltro, esito, opzioni) {
    const scelte = opzioni || {};
    const k = scelte.k || K_PREDEFINITO;
    const minimo = scelte.minimo || MINIMO_PREDEFINITO;

    const variazione = Math.round(k * (punteggio(esito) - atteso(eloUno, eloAltro)));

    // Il minimo si applica dopo: se uno dei due non può scendere, l'altro
    // guadagna lo stesso solo la parte effettivamente tolta, così la somma
    // resta identica a prima.
    let nuovoUno = eloUno + variazione;
    let nuovoAltro = eloAltro - variazione;

    if (nuovoUno < minimo) {
        nuovoAltro -= (minimo - nuovoUno);
        nuovoUno = minimo;
    }
    if (nuovoAltro < minimo) {
        nuovoUno -= (minimo - nuovoAltro);
        nuovoAltro = minimo;
    }

    return {
        eloUno: Math.round(nuovoUno),
        eloAltro: Math.round(nuovoAltro),
        variazione: Math.round(nuovoUno - eloUno)
    };
}

/**
 * Aggiorna i contatori di un giocatore dopo un esito.
 * `esito` è dal punto di vista del giocatore stesso.
 */
function aggiornaStatistiche(giocatore, esito) {
    giocatore.partiteGiocate = (giocatore.partiteGiocate || 0) + 1;

    if (esito === 'vittoria') {
        giocatore.vittorie = (giocatore.vittorie || 0) + 1;
        giocatore.serie = (giocatore.serie || 0) + 1;
        if (giocatore.serie > (giocatore.miglioreSerie || 0)) {
            giocatore.miglioreSerie = giocatore.serie;
        }
    } else if (esito === 'sconfitta') {
        giocatore.sconfitte = (giocatore.sconfitte || 0) + 1;
        giocatore.serie = 0;
    } else {
        giocatore.pareggi = (giocatore.pareggi || 0) + 1;
        giocatore.serie = 0;
    }

    // Si esce dallo stato provvisorio solo dopo un numero minimo di partite
    // ranked: prima l'ELO è troppo mosso per dire qualcosa.
    if (giocatore.partiteRanked >= PARTITE_PER_USCIRE_DA_PROVVISORIO) {
        giocatore.provvisorio = false;
    }

    return giocatore;
}

module.exports = { atteso, punteggio, nuoviElo, aggiornaStatistiche, PARTITE_PER_USCIRE_DA_PROVVISORIO };
