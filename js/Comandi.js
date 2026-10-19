// ========================================
// Regole dei comandi
// ==========================================
// Funzioni pure (niente DOM, niente stato globale) che rispondono a tre
// domande del ciclo di gioco:
//   - una parata o una carica sono rimaste accese senza il tasto premuto?
//   - un comando in coda vale ancora?
//   - un attacco in corso si può già interrompere?
// Si provano con Node: `node tools/prova_comandi.js`.

// Quanti passi (1/60 di secondo) dura il recupero prima di poter interrompere
// un attacco. 16 passi = 0,27 s: il frame d'impatto è già passato, ma il
// lottatore non può "macinare" attacchi a raffica.
const FINESTRA_RECUPERO = 16;

/**
 * La parata va chiusa se è attiva ma il tasto non è più premuto: senza questo
 * una parata partita dalla coda dei comandi resta accesa per sempre e blocca
 * l'attacco (era il bug "dopo la parata non si può più attaccare").
 */
function parataDaChiudere(lottatore, tastoPremutoOra) {
    if (!lottatore) {
        return false;
    }
    return !!lottatore.isParata && !tastoPremutoOra;
}

/** Stessa cosa per la carica dell'attacco: tasto lasciato, si rilascia. */
function caricaDaRilasciare(lottatore, tastoPremutoOra) {
    if (!lottatore) {
        return false;
    }
    return !!lottatore.isCaricando && !tastoPremutoOra;
}

/**
 * Un comando in coda vale finché il tasto è ancora premuto (intenzione viva);
 * se il tasto è stato lasciato vale solo dentro la sua finestra di frame.
 */
function comandoAncoraValido(voce, frame, tastoPremutoOra) {
    if (!voce) {
        return false;
    }
    if (tastoPremutoOra) {
        return true;
    }
    return frame <= voce.scade;
}

/**
 * Un attacco si può interrompere (cancellare) quando ha superato il recupero:
 * è la finestra che rende il combattimento fluido, come nei picchiaduro veri.
 */
function puoCancellareAttacco(lottatore, finestra) {
    if (!lottatore || !lottatore.isAttacking) {
        return false;
    }
    const limite = (finestra === undefined) ? FINESTRA_RECUPERO : finestra;
    return (lottatore.framesAttacco || 0) >= limite;
}

// Doppia modalità: nel browser è uno script classico, nei test si carica con require.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FINESTRA_RECUPERO: FINESTRA_RECUPERO,
        parataDaChiudere: parataDaChiudere,
        caricaDaRilasciare: caricaDaRilasciare,
        comandoAncoraValido: comandoAncoraValido,
        puoCancellareAttacco: puoCancellareAttacco
    };
}
