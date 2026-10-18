// ========================================
// Menu
// ==========================================
// Le voci di ogni menu sono dati: `wip: true` significa "non ancora
// disponibile", quindi la voce viene mostrata ma NON è selezionabile.

const VOCI_MENU = {
    principale: [
        { testo: 'PLAY', azione: () => apriMenu('play') },
        { testo: 'RANKED', azione: () => apriCodaRanked() },
        { testo: 'ACCOUNT', azione: () => apriAccount() },
        { testo: 'NEGOZIO', azione: () => apriNegozio() },
        { testo: 'AMICI', azione: () => apriAmici() },
        { testo: 'CLASSIFICA', azione: () => apriClassifica() },
        { testo: 'SETTINGS', azione: () => apriMenu('settings') }
    ],
    play: [
        { testo: 'VS LOCALE', azione: () => apriSelezione(MODALITA.LOCALE) },
        { testo: 'VS CPU', azione: () => apriMenu('cpu') },
        { testo: 'VS ONLINE', azione: () => apriMenu('online') },
        { testo: 'INDIETRO', azione: () => apriMenu('principale') }
    ],
    // VS ONLINE: la sfida in rete passa da una stanza con codice
    online: [
        { testo: 'CREA STANZA', azione: () => creaStanzaOnline() },
        { testo: 'ENTRA CON CODICE', azione: () => apriIngressoOnline() },
        { testo: 'INDIETRO', azione: () => apriMenu('play') }
    ],
    cpu: [
        { testo: 'FACILE', azione: () => avviaSelezioneCPU('facile') },
        { testo: 'DIFFICILE', azione: () => avviaSelezioneCPU('difficile') },
        { testo: 'GUISSÈ', azione: () => avviaSelezioneCPU('guisse') },
        { testo: 'INDIETRO', azione: () => apriMenu('play') }
    ],
    settings: [
        { testo: 'FULLSCREEN', azione: () => attivaFullscreen() },
        { testo: 'KEYBINDS', azione: () => apriKeybinds('settings') },
        { testo: 'INDIETRO', azione: () => apriMenu('principale') }
    ],
    pausa: [
        { testo: 'RIPRENDI', azione: () => chiudiPausa() },
        { testo: 'IMPOSTAZIONI', azione: () => apriMenu('impostazioniPausa', STATI.PAUSA) },
        { testo: 'ESCI AL MENU', azione: () => esciAlMenu() }
    ],
    // Compare da sola a fine partita: rivincita o cambio personaggi
    finePartita: [
        { testo: 'RIVINCITA', azione: () => rivincita() },
        { testo: 'CAMBIA PERSONAGGI', azione: () => cambiaPersonaggi() },
        { testo: 'ESCI AL MENU', azione: () => esciAlMenu() }
    ],
    impostazioniPausa: [
        { testo: 'FULLSCREEN', azione: () => attivaFullscreen() },
        { testo: 'KEYBINDS', azione: () => apriKeybinds('impostazioniPausa') },
        { testo: 'INDIETRO', azione: () => apriMenu('pausa', STATI.PAUSA) }
    ]
};

const TITOLI_MENU = {
    principale: 'Ultra Verdello Street Fight 7',
    play: 'PLAY',
    cpu: 'VS CPU',
    online: 'VS ONLINE',
    settings: 'SETTINGS',
    pausa: 'PAUSA',
    finePartita: 'FINE PARTITA',
    impostazioniPausa: 'IMPOSTAZIONI'
};

// Menu a cui torna Esc da ciascun sottomenu
const MENU_PADRE = {
    play: 'principale',
    cpu: 'play',
    online: 'play',
    settings: 'principale'
};

// Testo di aiuto mostrato sotto le voci: ricorda che Esc fa sempre da "back"
const SUGGERIMENTI_MENU = {
    principale: 'Invio per scegliere',
    play: 'Esc per tornare indietro',
    cpu: 'Esc per tornare indietro',
    online: 'Esc per tornare indietro',
    settings: 'Esc per tornare indietro',
    pausa: 'Esc per riprendere la partita',
    finePartita: 'Esc per uscire al menu principale',
    impostazioniPausa: 'Esc per tornare alla pausa'
};

let menuCorrente = 'principale';
let indiceVoce = 0;

/**
 * Apre un menu, evidenzia la prima voce selezionabile e lo rende visibile.
 * Con `stato = STATI.PAUSA` il menu viene mostrato sopra la partita in pausa.
 */
function apriMenu(nome, stato = STATI.MENU) {
    menuCorrente = nome;
    indiceVoce = primaVoceSelezionabile();
    disegnaMenu();

    // In pausa lo sfondo del menu è trasparente e compare il pulsante report
    document.querySelector('#menu').classList.toggle('pausa', stato === STATI.PAUSA);

    cambiaStato(stato);
}

/**
 * Ridisegna titolo e voci del menu corrente
 */
function disegnaMenu() {
    document.querySelector('#menuTitolo').innerHTML = TITOLI_MENU[menuCorrente];

    const suggerimento = document.querySelector('#menuSuggerimento');
    if (suggerimento) {
        suggerimento.innerHTML = SUGGERIMENTI_MENU[menuCorrente] || '';
    }

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
 * Apre la selezione in modalità CPU con la difficoltà scelta
 */
function avviaSelezioneCPU(difficolta) {
    difficoltaCPU = difficolta;
    apriSelezione(MODALITA.CPU);
}

/**
 * Torna al menu padre del menu corrente
 */
function tornaIndietro() {
    // Esc dal menu di pausa riprende la partita
    if (menuCorrente === 'pausa') {
        chiudiPausa();
        return;
    }

    // A fine partita Esc equivale a "esci al menu"
    if (menuCorrente === 'finePartita') {
        esciAlMenu();
        return;
    }

    // Esc dalle impostazioni in pausa torna al menu di pausa
    if (menuCorrente === 'impostazioniPausa') {
        apriMenu('pausa', STATI.PAUSA);
        return;
    }

    const padre = MENU_PADRE[menuCorrente];
    if (padre) {
        apriMenu(padre);
    }
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
    if (statoCorrente !== STATI.MENU && statoCorrente !== STATI.PAUSA) {
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
