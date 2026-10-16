// ========================================
// Stato del Gioco
// ==========================================
// Un unico posto dove sapere "a che punto siamo": il game loop e gli input
// si comportano in modo diverso a seconda dello stato corrente.

const STATI = {
    CARICAMENTO: 'caricamento',
    MENU: 'menu',
    SELEZIONE: 'selezione',
    PARTITA: 'partita'
};

let statoCorrente = STATI.CARICAMENTO;

/**
 * Cambia lo stato del gioco e aggiorna le schermate visibili
 */
function cambiaStato(nuovoStato) {
    statoCorrente = nuovoStato;
    aggiornaVisibilita();
}

/**
 * Mostra solo la schermata legata allo stato corrente:
 * - caricamento -> schermata di caricamento
 * - menu        -> menu
 * - selezione   -> scelta del personaggio
 * - partita     -> nessuna schermata (si vedono canvas e HUD)
 */
function aggiornaVisibilita() {
    impostaVisibilita('#loadingScreen', statoCorrente === STATI.CARICAMENTO);
    impostaVisibilita('#menu', statoCorrente === STATI.MENU);
    impostaVisibilita('#selezione', statoCorrente === STATI.SELEZIONE);
}

/**
 * Mostra o nasconde un elemento tramite la proprietà display
 */
function impostaVisibilita(selettore, visibile) {
    const elemento = document.querySelector(selettore);
    if (elemento) {
        elemento.style.display = visibile ? 'flex' : 'none';
    }
}
