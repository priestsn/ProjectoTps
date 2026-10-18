// ========================================
// Stato del Gioco
// ==========================================
// Un unico posto dove sapere "a che punto siamo": il game loop e gli input
// si comportano in modo diverso a seconda dello stato corrente.

const STATI = {
    CARICAMENTO: 'caricamento',
    MENU: 'menu',
    SELEZIONE: 'selezione',
    PARTITA: 'partita',
    PAUSA: 'pausa',
    KEYBINDS: 'keybinds',
    ACCOUNT: 'account',
    NEGOZIO: 'negozio',
    AMICI: 'amici'
};

// Modalità di gioco e difficoltà della CPU.
// `modalitaPartita` viene impostata dalla selezione e letta da avviaPartita().
const MODALITA = {
    LOCALE: 'locale',
    CPU: 'cpu',
    ONLINE: 'online'
};

let modalitaPartita = MODALITA.LOCALE;
let difficoltaCPU = 'difficile';

// True mentre il pannello di report bug è aperto: mette in pausa il gioco
let reportAperto = false;

// Nomi mostrati nella selezione e nell'HUD
const NOMI_DIFFICOLTA = {
    facile: 'Facile',
    difficile: 'Difficile',
    guisse: 'Guissè'
};

let statoCorrente = STATI.CARICAMENTO;

/**
 * Cambia lo stato del gioco e aggiorna le schermate visibili
 */
function cambiaStato(nuovoStato) {
    statoCorrente = nuovoStato;
    aggiornaVisibilita();

    // I comandi touch compaiono solo in partita (js/Touch.js)
    if (typeof aggiornaComandiTouch === 'function') {
        aggiornaComandiTouch();
    }
}

/**
 * Mostra solo la schermata legata allo stato corrente:
 * - caricamento -> schermata di caricamento
 * - menu        -> menu
 * - pausa       -> menu, sopra la partita in pausa
 * - selezione   -> scelta del personaggio
 * - partita     -> nessuna schermata (si vedono canvas e HUD)
 */
function aggiornaVisibilita() {
    impostaVisibilita('#loadingScreen', statoCorrente === STATI.CARICAMENTO);
    impostaVisibilita('#menu', statoCorrente === STATI.MENU || statoCorrente === STATI.PAUSA);
    impostaVisibilita('#selezione', statoCorrente === STATI.SELEZIONE);
    impostaVisibilita('#keybinds', statoCorrente === STATI.KEYBINDS);
    impostaVisibilita('#account', statoCorrente === STATI.ACCOUNT);
    impostaVisibilita('#negozio', statoCorrente === STATI.NEGOZIO);
    impostaVisibilita('#amici', statoCorrente === STATI.AMICI);
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
