// ========================================
// Punti guadagnati giocando online
// ==========================================
// Il server non si fida del client per il punteggio: qui si chiede prima
// l'identificativo della partita, poi si comunica l'esito. Il server calcola i
// punti, applica il tetto giornaliero e rifiuta il secondo invio.
//
// Vale solo per il VS ONLINE: VS LOCALE e VS CPU non danno punti, altrimenti
// basterebbe giocare contro un amico che si lascia colpire.

// Identificativo della partita aperta sul server, se ce n'è una.
let partitaPunti = null;

// True quando la partita ranked l'ha aperta il server perché l'avversario è il
// bot Guissè: in quel caso l'esito va comunicato anche se la partita si gioca
// in locale contro la CPU (la modalità è MODALITA.CPU, non ONLINE).
let partitaPuntiDaBot = false;

/** Registra la partita ranked contro Guissè, già aperta dal server. */
function impostaPartitaBot(partitaId) {
    partitaPunti = partitaId || null;
    partitaPuntiInviata = false;
    partitaPuntiDaBot = !!partitaId;
}

// Evita il doppio invio (fine per morte e fine per tempo arrivano vicine).
let partitaPuntiInviata = false;

/** Apre la partita sul server: va chiamata quando l'incontro parte davvero. */
async function apriPartitaPunti() {
    // Se la partita è già aperta (per esempio dalla coda ranked) non se ne apre
    // un'altra: l'identificativo che conta è quello.
    if (partitaPunti) return;

    partitaPunti = null;
    partitaPuntiInviata = false;

    if (!statoAccount.dentro) return;
    if (typeof modalitaPartita === 'undefined' || modalitaPartita !== MODALITA.ONLINE) return;

    try {
        const risposta = await api.chiama('/api/partita/avvia', { corpo: { modo: 'online' } });
        partitaPunti = risposta.partitaId;
    } catch (errore) {
        // Senza identificativo la partita si gioca lo stesso, solo senza punti
        partitaPunti = null;
    }
}

/**
 * Comunica l'esito e mostra i punti guadagnati.
 * `esito` è dal punto di vista di chi sta giocando a questo dispositivo.
 */
async function chiudiPartitaPunti(esito) {
    if (!partitaPunti || partitaPuntiInviata) return;

    // Vale per il VS ONLINE e per la ranked contro Guissè, che si gioca in
    // locale ma è una partita ranked vera aperta dal server.
    const ammessa = partitaPuntiDaBot ||
        (typeof modalitaPartita !== 'undefined' && modalitaPartita === MODALITA.ONLINE);
    if (!ammessa) return;

    partitaPuntiInviata = true;
    const daBot = partitaPuntiDaBot;
    partitaPuntiDaBot = false;

    const identificativo = partitaPunti;
    partitaPunti = null;

    try {
        const risultato = await api.chiama('/api/partita/concludi', {
            corpo: { partitaId: identificativo, esito: esito }
        });

        if (risultato.puntiGuadagnati > 0) {
            mostraAvviso('+' + risultato.puntiGuadagnati + ' PUNTI', '#7dff7d');
        } else if (!risultato.contata) {
            mostraAvviso('PUNTI DI OGGI ESAURITI: MASSIMO ' + risultato.limiteGiornaliero + ' PARTITE AL GIORNO', '#e0a020');
        }
        if (daBot && risultato.elo !== undefined) {
            statoAccount.elo = risultato.elo;
            if (typeof aggiornaSchedaMenu === 'function') aggiornaSchedaMenu();
        }

        if (statoAccount.dentro) {
            statoAccount.punti = risultato.punti;
        }
    } catch (errore) {
        // Il risultato non è stato registrato: nessun punto, ma la partita è
        // comunque finita. Non si blocca niente per questo.
    }
}

/** Chi ha vinto, guardando la partita dal lato di chi ospita (P1). */
function esitoPerP1() {
    if (Player.health === Enemy.health) return 'pareggio';
    return Player.health > Enemy.health ? 'vittoria' : 'sconfitta';
}

/** Lo stesso esito letto dal lato dell'ospite, che è P2. */
function esitoInvertito(esito) {
    if (esito === 'vittoria') return 'sconfitta';
    if (esito === 'sconfitta') return 'vittoria';
    return 'pareggio';
}
