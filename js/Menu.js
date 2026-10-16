// ========================================
// Menu
// ==========================================
// Le voci di ogni menu sono dati: `wip: true` significa "non ancora
// disponibile", quindi la voce viene mostrata ma NON è selezionabile.

const VOCI_MENU = {
    principale: [
        { testo: 'PLAY', azione: () => apriMenu('play') },
        { testo: 'SETTINGS', azione: () => apriMenu('settings') }
    ],
    play: [
        { testo: 'VS LOCALE', azione: () => avviaPartita() },
        { testo: 'VS CPU', wip: true },
        { testo: 'VS ONLINE', wip: true }
    ],
    settings: [
        { testo: 'FULLSCREEN', azione: () => attivaFullscreen() },
        { testo: 'KEYBINDS', wip: true },
        { testo: 'INDIETRO', azione: () => apriMenu('principale') }
    ]
};

const TITOLI_MENU = {
    principale: 'Ultra Verdello Street Fight 7',
    play: 'PLAY',
    settings: 'SETTINGS'
};

let menuCorrente = 'principale';
let indiceVoce = 0;

/**
 * Apre un menu, evidenzia la prima voce selezionabile e lo rende visibile
 */
function apriMenu(nome) {
    menuCorrente = nome;
    indiceVoce = primaVoceSelezionabile();
    disegnaMenu();
    cambiaStato(STATI.MENU);
}

/**
 * Ridisegna titolo e voci del menu corrente
 */
function disegnaMenu() {
    document.querySelector('#menuTitolo').innerHTML = TITOLI_MENU[menuCorrente];

    const contenitore = document.querySelector('#menuVoci');
    contenitore.innerHTML = '';

    VOCI_MENU[menuCorrente].forEach((voce, indice) => {
        const elemento = document.createElement('div');
        elemento.className = 'voce';

        if (voce.wip) {
            elemento.className += ' wip';
        }
        if (indice === indiceVoce) {
            elemento.className += ' selezionata';
        }

        // Le voci WIP si vedono ma hanno l'etichetta accanto
        elemento.innerHTML = voce.wip
            ? voce.testo + '<span class="etichetta-wip">WIP</span>'
            : voce.testo;

        // Il click funziona solo sulle voci disponibili
        if (!voce.wip) {
            elemento.addEventListener('click', () => {
                indiceVoce = indice;
                attivaVoce();
            });
        }

        contenitore.appendChild(elemento);
    });
}

/**
 * Indice della prima voce selezionabile del menu corrente
 */
function primaVoceSelezionabile() {
    const indice = VOCI_MENU[menuCorrente].findIndex(voce => !voce.wip);
    return indice < 0 ? 0 : indice;
}

/**
 * Sposta la selezione saltando le voci WIP e ripartendo dal fondo
 */
function spostaSelezione(passo) {
    const voci = VOCI_MENU[menuCorrente];
    let indice = indiceVoce;

    for (let i = 0; i < voci.length; i++) {
        indice = (indice + passo + voci.length) % voci.length;
        if (!voci[indice].wip) {
            indiceVoce = indice;
            disegnaMenu();
            return;
        }
    }
}

/**
 * Esegue l'azione della voce evidenziata
 */
function attivaVoce() {
    const voce = VOCI_MENU[menuCorrente][indiceVoce];

    // Sicurezza: una voce WIP non deve fare nulla
    if (!voce || voce.wip) {
        return;
    }

    voce.azione();
}

/**
 * Torna al menu principale
 */
function tornaIndietro() {
    if (menuCorrente === 'principale') {
        return;
    }
    apriMenu('principale');
}

/**
 * Attiva o disattiva lo schermo intero sull'intera pagina
 */
function attivaFullscreen() {
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        document.documentElement.requestFullscreen();
    }
}

/**
 * Gestisce la tastiera quando NON si sta giocando.
 * Le frecce servono anche al giocatore 2, ma i due contesti non sono
 * mai attivi contemporaneamente.
 */
function gestisciInputMenu(evento) {
    if (statoCorrente !== STATI.MENU) {
        return;
    }

    // La pressione prolungata non deve far scorrere le voci a raffica
    if (evento.repeat) {
        return;
    }

    switch (evento.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            spostaSelezione(-1);
            break;

        case 'ArrowDown':
        case 's':
        case 'S':
            spostaSelezione(1);
            break;

        case 'Enter':
            attivaVoce();
            break;

        case 'Escape':
            tornaIndietro();
            break;
    }
}
