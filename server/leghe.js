// ========================================
// Leghe: le fasce dell'ELO
// ==========================================
// L'ELO è un numero, ma nessuno dice "sono a 1247". Le leghe danno un nome alle
// fasce, così si capisce a colpo d'occhio dove si è.
//
// Regola della protezione: la prima volta che un giocatore scenderebbe di lega,
// resta dov'è (l'ELO torna alla soglia) e consuma la sua protezione. Quando
// sale di lega la protezione si ricarica: una per fascia.

const FASCE = [
    { nome: 'Bronzo', soglia: 0, colore: '#b07a4a' },
    { nome: 'Argento', soglia: 1100, colore: '#c8c8c8' },
    { nome: 'Oro', soglia: 1250, colore: '#ffd34d' },
    { nome: 'Platino', soglia: 1400, colore: '#7fe3ff' },
    { nome: 'Diamante', soglia: 1550, colore: '#9b8cff' },
    { nome: 'Maestro', soglia: 1700, colore: '#ff6b6b' }
];

/** La lega che corrisponde a un ELO. */
function legaDi(elo) {
    const valore = Number(elo) || 0;
    let indice = 0;

    for (let i = 0; i < FASCE.length; i++) {
        if (valore >= FASCE[i].soglia) indice = i;
    }

    const fascia = FASCE[indice];
    const successiva = FASCE[indice + 1] || null;

    return {
        nome: fascia.nome,
        indice: indice,
        colore: fascia.colore,
        soglia: fascia.soglia,
        prossima: successiva ? successiva.nome : null,
        prossimaSoglia: successiva ? successiva.soglia : null,
        // Quanto manca alla lega successiva, in punti ELO
        mancano: successiva ? Math.max(0, successiva.soglia - valore) : 0
    };
}

/** Elenco delle fasce, per disegnare la scala nell'interfaccia. */
function elencoFasce() {
    return FASCE.map((fascia, indice) => ({
        nome: fascia.nome,
        soglia: fascia.soglia,
        colore: fascia.colore,
        indice: indice
    }));
}

/**
 * Applica la protezione dalla retrocessione.
 * Va chiamata dopo aver aggiornato l'ELO, con il valore di prima e quello di
 * dopo. Restituisce { protetto, lega, elo } con l'ELO eventualmente riportato
 * alla soglia.
 */
function applicaProtezione(giocatore, eloPrima, eloDopo) {
    const legaPrima = legaDi(eloPrima);
    const legaDopo = legaDi(eloDopo);

    // Salita di lega: la protezione si ricarica per la fascia nuova.
    if (legaDopo.indice > legaPrima.indice) {
        giocatore.protezioneUsata = false;
        return { protetto: false, lega: legaDopo, elo: eloDopo };
    }

    // Discesa di lega: la prima volta non si scende.
    if (legaDopo.indice < legaPrima.indice) {
        if (!giocatore.protezioneUsata) {
            giocatore.protezioneUsata = true;
            giocatore.elo = legaPrima.soglia;
            return { protetto: true, lega: legaPrima, elo: legaPrima.soglia };
        }

        return { protetto: false, lega: legaDopo, elo: eloDopo };
    }

    return { protetto: false, lega: legaDopo, elo: eloDopo };
}

module.exports = { legaDi, elencoFasce, applicaProtezione, FASCE };
