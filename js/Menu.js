// ========================================
// Menu
// ==========================================
// Le voci di ogni menu sono dati: `wip: true` significa "non ancora
// disponibile", quindi la voce viene mostrata ma NON è selezionabile.

// Il menu principale NON è qui: le sue tre colonne sono dati in
// js/MenuModello.js (GRUPPI_PRINCIPALE) e le azioni in AZIONI_MENU_PRINCIPALE,
// più sotto. Qui restano i sottomenu, che sono elenchi piatti.
const VOCI_MENU = {
    // VS ONLINE: la sfida in rete passa da una stanza con codice
    online: [
        { testo: 'CREA STANZA', azione: () => creaStanzaOnline() },
        { testo: 'ENTRA CON CODICE', azione: () => apriIngressoOnline() },
        { testo: 'INDIETRO', azione: () => apriMenu('principale') }
    ],
    cpu: [
        { testo: 'FACILE', azione: () => avviaSelezioneCPU('facile') },
        { testo: 'DIFFICILE', azione: () => avviaSelezioneCPU('difficile') },
        { testo: 'GUISSÈ', azione: () => avviaSelezioneCPU('guisse') },
        { testo: 'INDIETRO', azione: () => apriMenu('principale') }
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
        { testo: 'CAMBIA VERDELLINESI', azione: () => cambiaPersonaggi() },
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
    cpu: 'VS CPU',
    online: 'VS ONLINE',
    settings: 'SETTINGS',
    pausa: 'PAUSA',
    finePartita: 'FINE PARTITA',
    impostazioniPausa: 'IMPOSTAZIONI'
};

// Menu a cui torna Esc da ciascun sottomenu
const MENU_PADRE = {
    cpu: 'principale',
    online: 'principale',
    settings: 'principale'
};

// Testo di aiuto mostrato sotto le voci: ricorda che Esc fa sempre da "back"
const SUGGERIMENTI_MENU = {
    principale: 'Invio per scegliere · ← → per cambiare colonna · Esc per uscire',
    cpu: 'Esc per tornare indietro',
    online: 'Esc per tornare indietro',
    settings: 'Esc per tornare indietro',
    pausa: 'Esc per riprendere la partita',
    finePartita: 'Esc per uscire al menu principale',
    impostazioniPausa: 'Esc per tornare alla pausa'
};

let menuCorrente = 'principale';

// Menu principale: due dimensioni (colonna, indice), modello in js/MenuModello.js
let selezionePrincipale = { colonna: 0, indice: 0 };

// Sottomenu (cpu, online, settings, pausa…): elenco piatto, una sola dimensione
let indiceVoce = 0;

/**
 * Apre un menu, evidenzia la prima voce selezionabile e lo rende visibile.
 * Con `stato = STATI.PAUSA` il menu viene mostrato sopra la partita in pausa.
 */
function apriMenu(nome, stato = STATI.MENU) {
    menuCorrente = nome;

    if (nome === 'principale') {
        selezionePrincipale = { colonna: 0, indice: primoIndice(0) };
    } else {
        indiceVoce = primaVoceSelezionabile();
    }

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

    if (menuCorrente === 'principale') {
        disegnaColonne(contenitore);
    } else {
        disegnaElenco(contenitore);
    }

    disegnaPannelloGiocatore();

    aggiornaMenuFinePartita();
}

/**
 * In VS ONLINE le voci di fine partita dicono anche cosa ha scelto l'altro, e
 * sotto il menu compare una riga di stato. Fuori dall'online non fa niente.
 */
function aggiornaMenuFinePartita() {
    if (menuCorrente !== 'finePartita') return;

    const online = modalitaPartita === MODALITA.ONLINE && onlineStato.attivo;
    const consenso = online ? onlineStato.consensoFine : null;

    const voci = VOCI_MENU.finePartita;
    if (voci && voci.length >= 2) {
        voci[0].testo = online ? etichettaFinePartita('rivincita', consenso) : 'RIVINCITA';
        voci[1].testo = online ? etichettaFinePartita('cambia', consenso) : 'CAMBIA VERDELLINESI';
    }

    const riga = document.querySelector('#menuStatoFine');
    if (!riga) return;

    if (!online) {
        riga.textContent = '';
        riga.style.display = 'none';
        return;
    }

    riga.textContent = testoStatoFine(consenso, onlineStato.nomeAvversario);
    riga.style.display = 'block';
}

/** Menu principale: un blocco per colonna, con titolo e voci. */
function disegnaColonne(contenitore) {
    GRUPPI_PRINCIPALE.forEach((gruppo, colonna) => {
        const blocco = document.createElement('div');
        blocco.className = 'gruppo';

        const titolo = document.createElement('div');
        titolo.className = 'gruppo-titolo';
        titolo.textContent = gruppo.titolo;
        blocco.appendChild(titolo);

        gruppo.voci.forEach((voce, indice) => {
            const elemento = creaVoce(voce);

            if (colonna === selezionePrincipale.colonna && indice === selezionePrincipale.indice) {
                elemento.className += ' selezionata';
            }

            elemento.addEventListener('click', () => {
                selezionePrincipale = { colonna: colonna, indice: indice };
                disegnaMenu();
                attivaVoce();
            });

            blocco.appendChild(elemento);
        });

        contenitore.appendChild(blocco);
    });
}

/** Sottomenu: elenco piatto, come prima. */
function disegnaElenco(contenitore) {
    (VOCI_MENU[menuCorrente] || []).forEach((voce, indice) => {
        const elemento = creaVoce(voce);

        if (indice === indiceVoce) {
            elemento.className += ' selezionata';
        }

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

/** Crea il div di una voce: nome, riga di nota e (se serve) etichetta WIP. */
function creaVoce(voce) {
    const elemento = document.createElement('div');
    elemento.className = voce.wip ? 'voce wip' : 'voce';

    const testo = document.createElement('span');
    testo.textContent = voce.testo;
    elemento.appendChild(testo);

    if (voce.wip) {
        const etichetta = document.createElement('span');
        etichetta.className = 'etichetta-wip';
        etichetta.textContent = 'WIP';
        elemento.appendChild(etichetta);
    }

    if (voce.nota) {
        const nota = document.createElement('span');
        nota.className = 'nota';
        nota.textContent = voce.nota;
        elemento.appendChild(nota);
    }

    return elemento;
}

/**
 * Scheda del giocatore a destra del menu principale: nick, lega con il suo
 * colore, ELO, quanti punti mancano alla lega dopo, punti e partite.
 * Da sloggati mostra l'invito ad accedere, che è la prima cosa da fare per
 * ranked, negozio e classifica.
 */
function disegnaPannelloGiocatore() {
    const pannello = document.querySelector('#menuPannello');
    if (!pannello) {
        return;
    }
    pannello.innerHTML = '';

    // La scheda serve solo al menu principale: nei sottomenu resta nascosta
    if (menuCorrente !== 'principale') {
        pannello.style.display = 'none';
        return;
    }
    pannello.style.display = '';

    const dati = typeof datiPannelloGiocatore === 'function'
        ? datiPannelloGiocatore()
        : { dentro: false };

    const titolo = document.createElement('div');
    titolo.className = 'pannello-titolo';
    titolo.textContent = 'IL TUO PROFILO';
    pannello.appendChild(titolo);

    if (!dati.dentro) {
        // C'è sempre un'identità: quella dell'ospite, con il suo nome e il
        // numero di partite giocate in questo browser (js/Identita.js).
        if (dati.nome) {
            const nome = document.createElement('div');
            nome.className = 'pannello-nick';
            nome.textContent = dati.nome;
            pannello.appendChild(nome);

            const nota = document.createElement('div');
            nota.className = 'pannello-riga';
            nota.textContent = dati.partite
                ? dati.partite + (dati.partite === 1 ? ' partita giocata' : ' partite giocate')
                : 'Prima partita';
            pannello.appendChild(nota);
        }

        const testo = document.createElement('div');
        testo.className = 'pannello-vuoto';
        testo.textContent = 'Stai giocando come ospite. Con un account punti, ELO e verdellinesi sbloccati restano salvati.';
        pannello.appendChild(testo);
        return;
    }

    const nick = document.createElement('div');
    nick.className = 'pannello-nick';
    nick.textContent = dati.nick;
    pannello.appendChild(nick);

    const rigaLega = document.createElement('div');
    rigaLega.className = 'pannello-riga';
    const distintivo = document.createElement('span');
    distintivo.className = 'pannello-lega';
    distintivo.style.backgroundColor = dati.legaColore;
    distintivo.textContent = String(dati.lega).toUpperCase();
    rigaLega.appendChild(distintivo);
    rigaLega.appendChild(document.createTextNode('  ' + dati.elo + ' ELO'));
    pannello.appendChild(rigaLega);

    const mancano = document.createElement('div');
    mancano.className = 'pannello-riga';
    mancano.textContent = (dati.legaProssima && dati.legaMancano > 0)
        ? 'Mancano ' + dati.legaMancano + ' punti per ' + dati.legaProssima
        : 'Lega massima raggiunta';
    pannello.appendChild(mancano);

    const punti = document.createElement('div');
    punti.className = 'pannello-riga pannello-punti';
    punti.textContent = dati.punti + ' punti · ' + dati.partite + ' partite';
    pannello.appendChild(punti);
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
    if (menuCorrente === 'principale') {
        spostaVert(selezionePrincipale, passo);
    } else {
        const finto = { colonna: 0, indice: indiceVoce };
        spostaInElenco(VOCI_MENU[menuCorrente], finto, passo);
        indiceVoce = finto.indice;
    }
    disegnaMenu();
}

/**
 * Sposta la selezione fra le colonne: vale solo per il menu principale.
 */
function spostaColonna(passo) {
    if (menuCorrente !== 'principale') {
        return;
    }
    spostaOrizz(selezionePrincipale, passo);
    disegnaMenu();
}

/**
 * Esegue l'azione della voce evidenziata.
 * Nel menu principale l'azione è una stringa del modello: qui diventa la
 * funzione vera, in un solo posto (AZIONI_MENU_PRINCIPALE).
 */
function attivaVoce() {
    if (menuCorrente !== 'principale') {
        const voce = VOCI_MENU[menuCorrente][indiceVoce];
        if (!voce || voce.wip) {
            return;
        }
        voce.azione();
        return;
    }

    const scelta = voceSelezionata(selezionePrincipale);
    if (!scelta || scelta.voce.wip) {
        return;
    }

    const azione = AZIONI_MENU_PRINCIPALE[scelta.voce.azione];
    if (typeof azione === 'function') {
        azione();
    }
}

// Dalla stringa del modello alla funzione del gioco: un solo posto.
const AZIONI_MENU_PRINCIPALE = {
    vsLocale: () => apriSelezione(MODALITA.LOCALE),
    vsCpu: () => apriMenu('cpu'),
    vsOnline: () => apriMenu('online'),
    ranked: () => apriCodaRanked(),
    amici: () => apriAmici(),
    classifica: () => apriClassifica(),
    account: () => apriAccount(),
    negozio: () => apriNegozio(),
    settings: () => apriMenu('settings')
};

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
        // Esc chiude le schermate informative e torna al menu principale:
        // prima la tastiera era muta e da dentro l'account non si usciva.
        if (evento.key === 'Escape') {
            if (statoCorrente === STATI.ACCOUNT || statoCorrente === STATI.NEGOZIO ||
                statoCorrente === STATI.CLASSIFICA || statoCorrente === STATI.AMICI ||
                statoCorrente === STATI.CODA) {

                if (statoCorrente === STATI.CODA && typeof annullaCoda === 'function') {
                    annullaCoda();
                }

                if (statoCorrente === STATI.NEGOZIO && typeof chiudiNegoziante === 'function') {
                    chiudiNegoziante();
                }

                apriMenu('principale');
            }
        }
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

        case 'ArrowLeft':
        case 'a':
        case 'A':
            spostaColonna(-1);
            break;

        case 'ArrowRight':
        case 'd':
        case 'D':
            spostaColonna(1);
            break;

        case 'Enter':
            attivaVoce();
            break;

        case 'Escape':
            tornaIndietro();
            break;
    }
}

// Diagnosi dal browser: dice dove sta la selezione. La usano le verifiche.
window.uvsf7MenuDebug = function () {
    const scelta = voceSelezionata(selezionePrincipale);
    return {
        menu: menuCorrente,
        colonna: selezionePrincipale.colonna,
        indice: selezionePrincipale.indice,
        voce: scelta ? scelta.voce.id : null,
        azione: scelta ? scelta.voce.azione : null,
        colonneVisibili: document.querySelectorAll('#menuVoci .gruppo').length,
        vociVisibili: document.querySelectorAll('#menuVoci .voce').length
    };
};
