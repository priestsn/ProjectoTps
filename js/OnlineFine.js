// ========================================
// Fine partita in VS ONLINE: le due scelte
// ==========================================
// In VS ONLINE la rivincita e il cambio di verdellinese non li decide più
// l'host da solo: servono le scelte di ENTRAMBI i giocatori.
//
// Questo file è una macchina a stati pura: niente DOM, niente rete, niente
// timer. Così si prova con node (tools/prova_online_fine.js) e il gioco la
// usa così com'è.
//
// Ogni lato tiene due caselle:
//   mia   -> quello che ho scelto io
//   altra -> quello che ha scelto l'avversario
// Le scelte possibili sono tre: 'rivincita', 'cambia', 'esci'.
// L'ultima scelta di ognuno vince: si può cambiare idea finché l'accordo
// non è raggiunto.
//
// ECCEZIONE VOLUTA: 'esci' non richiede l'accordo. Chi vuole andarsene se ne
// va, e l'altro riceve "avversario uscito" dal server. Le due scelte che
// cambiano la partita (rivincita, cambio verdellinese) invece servono uguali.

const SCELTE_FINE = ['rivincita', 'cambia', 'esci'];

// Le scelte che richiedono l'accordo dei due. 'esci' resta fuori apposta.
const SCELTE_CONDIVISE = ['rivincita', 'cambia'];

const ETICHETTE_SCELTA = {
    rivincita: 'RIVINCITA',
    cambia: 'CAMBIA VERDELLINESI',
    esci: 'ESCI AL MENU'
};

/** Consenso vuoto: nessuno ha ancora scelto niente. */
function consensoIniziale() {
    return { mia: null, altra: null };
}

/**
 * Registra una scelta. `chi` vale 'mia' o 'altra'.
 * Restituisce un oggetto NUOVO: quello passato non viene mai modificato.
 */
function segnaSceltaFine(consenso, chi, scelta) {
    const base = consenso || consensoIniziale();

    if (chi !== 'mia' && chi !== 'altra') return base;
    if (SCELTE_FINE.indexOf(scelta) === -1) return base;

    const nuovo = { mia: base.mia, altra: base.altra };
    nuovo[chi] = scelta;
    return nuovo;
}

/**
 * Cosa succede adesso:
 *   'attesa'     -> manca la scelta di uno dei due
 *   'disaccordo' -> hanno scelto cose diverse
 *   'rivincita' | 'cambia' -> tutti e due d'accordo, si esegue
 *   'esci'       -> basta la scelta di uno solo
 */
function esitoFine(consenso) {
    const mia = consenso ? consenso.mia : null;
    const altra = consenso ? consenso.altra : null;

    // Uscire è sempre concesso: non aspetta nessuno
    if (mia === 'esci' || altra === 'esci') return 'esci';

    if (!mia || !altra) return 'attesa';
    if (mia !== altra) return 'disaccordo';
    return mia;
}

/** Testo da mostrare sotto il menu di fine partita. */
function testoStatoFine(consenso, nomeAvversario) {
    const nome = nomeAvversario || 'L\'avversario';
    const esito = esitoFine(consenso);

    const mia = consenso ? consenso.mia : null;
    const altra = consenso ? consenso.altra : null;

    if (esito === 'rivincita') return 'Rivincita accettata: si riparte.';
    if (esito === 'cambia') return 'Tutti e due volete cambiare verdellinese.';
    if (esito === 'esci') return 'Si torna al menu.';

    if (esito === 'disaccordo') {
        return 'Tu: ' + ETICHETTE_SCELTA[mia] + ' - ' + nome + ': ' +
            ETICHETTE_SCELTA[altra] + ' - per andare avanti dovete volere la stessa cosa.';
    }

    if (!mia && !altra) {
        return 'Scegli cosa fare: rivincita e cambio di verdellinese servono l\'accordo di entrambi.';
    }

    if (!mia) {
        return nome + ' ha scelto ' + ETICHETTE_SCELTA[altra] + ': tocca a te.';
    }

    if (!altra) {
        return 'Hai scelto ' + ETICHETTE_SCELTA[mia] + ': aspetto ' + nome + '.';
    }

    return '';
}

/** Etichetta della voce di menu: dice se l'altro ha già accettato. */
function etichettaFinePartita(scelta, consenso) {
    const etichetta = ETICHETTE_SCELTA[scelta] || scelta;
    const mia = consenso ? consenso.mia : null;
    const altra = consenso ? consenso.altra : null;

    if (altra === scelta) return etichetta + ' (accettata)';
    if (mia === scelta) return etichetta + ' (in attesa)';
    return etichetta;
}

/** Questa scelta ha bisogno del sì dell'altro per essere eseguita? */
function serveAccordo(scelta) {
    return SCELTE_CONDIVISE.indexOf(scelta) !== -1;
}

// Doppia modalità: nel browser è uno script classico, nei test si carica con require.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SCELTE_FINE: SCELTE_FINE,
        SCELTE_CONDIVISE: SCELTE_CONDIVISE,
        ETICHETTE_SCELTA: ETICHETTE_SCELTA,
        consensoIniziale: consensoIniziale,
        segnaSceltaFine: segnaSceltaFine,
        esitoFine: esitoFine,
        testoStatoFine: testoStatoFine,
        etichettaFinePartita: etichettaFinePartita,
        serveAccordo: serveAccordo
    };
}
