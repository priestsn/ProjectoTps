// ========================================
// Tempo di gioco: timestep fisso a 60 Hz
// ==========================================
// Il gioco è pensato a 60 frame al secondo: un frame di gioco vale 1/60 di
// secondo. Prima ogni fotogramma dello schermo valeva un frame di gioco, così
// su un monitor a 144 Hz tutto (animazioni, parate, stamina) andava 2,4 volte
// più veloce, e su un PC lento più piano.
// Qui si accumula il tempo reale e si dice quanti passi di simulazione fare:
// 60 passi al secondo sempre, qualunque sia la frequenza dello schermo.

const PASSO_MS = 1000 / 60;

// Se il gioco si è fermato a lungo (scheda in secondo piano, pausa del sistema)
// non si recuperano tutti i passi arretrati: si fanno al massimo questi, così
// il gioco riprende senza salti e senza "spirale della morte".
const MAX_PASSI = 5;

// Nessun fotogramma può valere più di questo: un blocco più lungo è un buco,
// non tempo da simulare.
const MAX_ATTESA_MS = 250;

/**
 * Aggiunge il tempo reale trascorso all'accumulatore e restituisce quanti
 * passi di simulazione eseguire adesso e quanto tempo resta in attesa.
 *
 * @param {number} accumulatoreMs tempo già accumulato dal fotogramma prima
 * @param {number} dtMs tempo reale trascorso dall'ultimo fotogramma
 * @returns {{passi: number, resto: number}}
 */
function avanzaAccumulatore(accumulatoreMs, dtMs) {
    const attesa = Math.max(0, Math.min(MAX_ATTESA_MS, Number(dtMs) || 0));
    const totale = Math.max(0, Number(accumulatoreMs) || 0) + attesa;

    // +1e-6: 16,6666... diviso 16,6666... deve dare 1, non 0 per errore di virgola
    const teorici = Math.floor(totale / PASSO_MS + 1e-6);
    const passi = Math.min(teorici, MAX_PASSI);

    return { passi: passi, resto: totale - passi * PASSO_MS };
}

// Doppia modalità: nel browser questo file è uno script classico (le funzioni
// sono globali), nei test Node viene caricato con require.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PASSO_MS: PASSO_MS,
        MAX_PASSI: MAX_PASSI,
        MAX_ATTESA_MS: MAX_ATTESA_MS,
        avanzaAccumulatore: avanzaAccumulatore
    };
}
