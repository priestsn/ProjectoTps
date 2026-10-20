// ========================================
// Frasi del negoziante
// ==========================================
// Il negoziante parla di Guissè, la difficoltà CPU più forte del gioco
// (js/CPU.js, DIFFICOLTA_CPU.guisse). Sono fatti di colore: non toccano il
// bilanciamento, non rivelano numeri interni e non nominano problemi tecnici.
//
// Una frase per visita: si sceglie all'apertura del negozio (vedi js/Negozio.js).
//
// File puro: si prova con node in tools/prova_negoziante.js.

const FRASI_NEGOZIANTE = [
    'Guissè non para gli attacchi. Li concede.',
    'Ho visto uno battere Guissè. Poi mi sono svegliato.',
    'Guissè ha imparato a leggere il buffer guardando me.',
    'Dicono che Guissè non abbia mai premuto due tasti insieme per sbaglio.',
    'Il mio fornitore mi ha detto che Guissè paga sempre in punti.',
    'Guissè non corre: arriva.',
    'Una volta ho chiesto un consiglio a Guissè. Mi ha risposto con una parata perfetta.',
    'Guissè conta i tuoi fotogrammi di recupero. Li conta meglio di me.',
    'Se Guissè ti offre una rivincita, chiedile prima cosa vuole in cambio.',
    'Guissè non ha una ultimate preferita: le usa tutte, per educazione.',
    'Nella mia bottega non vendo verdellinesi. Quelli li vende Guissè.',
    'Guissè si è fermata un secondo, una volta. Era per farti sentire bravo.',
    'Il prezzo giusto di un verdellinese lo sa Guissè. Io lo arrotondo.',
    'Guissè non sbaglia la parata: cambia idea prima di te.',
    'Ho provato a vendere un alimentatore a Guissè. Mi ha chiesto la scheda tecnica.',
    'Guissè non si arrabbia quando perde. Non le è mai capitato.',
    'La prima regola del mercato: non contrattare con Guissè.',
    'Guissè ha battuto la CPU difficile in due round. La CPU difficile era Guissè.',
    'Dicono che Guissè abbia imparato a giocare leggendo un report bug.',
    'Io vendo verdellinesi. Guissè vende illusioni.',
    'Guissè non ha una barra della stamina: ha una lista di cose da fare.',
    'Quando vedi Guissè caricare, hai già sbagliato una mossa fa.',
    'Una volta Guissè ha pareggiato. Dice che non vale e non se ne parla più.',
    'Il mio banco apre alle otto. Guissè è aperta da sempre.'
];

/**
 * Sceglie una frase. `casuale` è un numero fra 0 e 1 (si può iniettare nei test),
 * altrimenti si usa Math.random.
 */
function scegliFraseNegoziante(casuale) {
    const dado = (typeof casuale === 'number' && isFinite(casuale)) ? casuale : Math.random();
    const indice = Math.floor(dado * FRASI_NEGOZIANTE.length) % FRASI_NEGOZIANTE.length;
    return FRASI_NEGOZIANTE[indice];
}

/** Restituisce una frase diversa da quella data: così due visite di fila non si ripetono. */
function fraseDiversaDa(frasePrecedente, casuale) {
    if (FRASI_NEGOZIANTE.length < 2) return scegliFraseNegoziante(casuale);

    let frase = scegliFraseNegoziante(casuale);
    if (frase === frasePrecedente) {
        const indice = (FRASI_NEGOZIANTE.indexOf(frase) + 1) % FRASI_NEGOZIANTE.length;
        frase = FRASI_NEGOZIANTE[indice];
    }
    return frase;
}

// Doppia modalità: nel browser è uno script classico, nei test si carica con require.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FRASI_NEGOZIANTE: FRASI_NEGOZIANTE,
        scegliFraseNegoziante: scegliFraseNegoziante,
        fraseDiversaDa: fraseDiversaDa
    };
}
