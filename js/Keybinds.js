// ========================================
// Keybinds
// ==========================================
// I tasti di ogni giocatore sono dati modificabili, non più scritti dentro gli
// `switch` dell'handler della tastiera. Ogni giocatore ha sei azioni e ogni
// azione ha il suo tasto; la configurazione si salva nel browser
// (localStorage) e vale per tutte le modalità, touch compreso.
//
// Flusso di un tasto:
//   keydown -> azioneDaTasto() -> premiAzione()
//   premiAzione() scrive sui flag che il game loop già legge (keys.a, lastKey)
//   oppure, se siamo l'ospite di una partita online, manda l'azione all'host.

const AZIONI_TASTIERA = [
    { id: 'sinistra', nome: 'Sinistra' },
    { id: 'destra', nome: 'Destra' },
    { id: 'salto', nome: 'Salto' },
    { id: 'attacco', nome: 'Attacco' },
    { id: 'parata', nome: 'Parata' },
    { id: 'ultimate', nome: 'Ultimate' }
];

// Tasti di partenza: quelli usati prima dell'introduzione dei keybinds
const TASTI_PREDEFINITI = {
    p1: { sinistra: 'a', destra: 'd', salto: 'w', attacco: 'h', parata: 'j', ultimate: 'g' },
    p2: { sinistra: 'ArrowLeft', destra: 'ArrowRight', salto: 'ArrowUp', attacco: 'ù', parata: 'à', ultimate: 'l' }
};

const NOMI_GIOCATORI = { p1: 'Giocatore 1', p2: 'Giocatore 2' };

// Tasti che non si possono assegnare: servono a menu, pausa e debug
const TASTI_RISERVATI = ['Escape', 'u', 'U', 'Tab', 'Enter', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock'];

const CHIAVE_SALVATAGGIO_TASTI = 'uvsf7-keybinds';

// Configurazione attiva (modificabile a runtime)
let tastiComandi = {
    p1: Object.assign({}, TASTI_PREDEFINITI.p1),
    p2: Object.assign({}, TASTI_PREDEFINITI.p2)
};

// ========================================
// Lettura e salvataggio
// ========================================

/**
 * Riporta una configurazione salvata alla forma attesa: se manca qualcosa o
 * non è una stringa, si usa il valore predefinito.
 */
function normalizzaTasti(dati) {
    const risultato = { p1: {}, p2: {} };

    for (const giocatore of ['p1', 'p2']) {
        const salvato = (dati && dati[giocatore]) || {};
        for (const azione of AZIONI_TASTIERA) {
            const valore = salvato[azione.id];
            risultato[giocatore][azione.id] = (typeof valore === 'string' && valore.length > 0)
                ? valore
                : TASTI_PREDEFINITI[giocatore][azione.id];
        }
    }
    return risultato;
}

/**
 * Carica i tasti salvati nel browser, se ci sono
 */
function caricaKeybinds() {
    let salvato = null;
    try {
        salvato = JSON.parse(localStorage.getItem(CHIAVE_SALVATAGGIO_TASTI));
    } catch (errore) {
        salvato = null;
    }
    tastiComandi = normalizzaTasti(salvato);
}

/**
 * Salva la configurazione corrente
 */
function salvaKeybinds() {
    try {
        localStorage.setItem(CHIAVE_SALVATAGGIO_TASTI, JSON.stringify(tastiComandi));
    } catch (errore) {
        // localStorage pieno o disattivato: i tasti valgono solo per questa sessione
    }
}

/**
 * Riporta tutti i tasti a quelli predefiniti
 */
function ripristinaKeybinds() {
    tastiComandi = normalizzaTasti(null);
    salvaKeybinds();
}

// ========================================
// Tasti e azioni
// ========================================

/**
 * Tasto assegnato a un'azione
 */
function tastoDi(giocatore, azione) {
    return tastiComandi[giocatore][azione];
}

/**
 * Testo leggibile di un tasto, per la schermata dei keybinds
 */
function nomeTasto(tasto) {
    const simboli = {
        'ArrowLeft': 'Frecce sinistra',
        'ArrowRight': 'Frecce destra',
        'ArrowUp': 'Frecce su',
        'ArrowDown': 'Frecce giu',
        ' ': 'Spazio',
        'Ù': 'U accentata'
    };

    if (tasto === 'ù') return 'U accentata';
    if (tasto === 'à') return 'A accentata';
    if (simboli[tasto]) return simboli[tasto];
    return tasto.toUpperCase();
}

/**
 * Azione legata a un tasto: { giocatore, azione } oppure null.
 * Se lo stesso tasto fosse assegnato due volte, vince il primo trovato
 * (l'assegnazione impedisce comunque i doppioni).
 */
function azioneDaTasto(tasto) {
    for (const giocatore of ['p1', 'p2']) {
        for (const azione of AZIONI_TASTIERA) {
            if (tastoDi(giocatore, azione.id) === tasto) {
                return { giocatore: giocatore, azione: azione.id };
            }
        }
    }
    return null;
}

/**
 * Esegue (o rilascia) un'azione: è il punto in cui i tasti diventano comandi
 * di gioco. Gli host usano la simulazione locale, l'ospite online manda
 * l'azione al server perché la esegua l'host.
 */
function premiAzione(giocatore, azione, premuto) {
    // VS ONLINE, lato ospite: nessuna simulazione locale, si manda l'azione
    if (onlineStato.attivo && onlineStato.ospite && statoCorrente === STATI.PARTITA) {
        Rete.invia({ t: 'azione', g: 'p2', a: azione, giu: premuto ? 1 : 0 });
        return;
    }

    const lottatore = giocatore === 'p1' ? Player : Enemy;
    if (!lottatore) {
        return;
    }

    // Tasti di movimento: gli stessi flag letti dal game loop
    if (azione === 'sinistra' || azione === 'destra') {
        const nome = giocatore === 'p1'
            ? (azione === 'sinistra' ? 'a' : 'd')
            : (azione === 'sinistra' ? 'ArrowLeft' : 'ArrowRight');

        if (!premuto) {
            keys[nome].pressed = false;
            return;
        }

        if (lottatore.isDead || lottatore.isStunned) {
            return;
        }

        keys[nome].pressed = true;
        lottatore.lastKey = nome;
        if (giocatore === 'p1') {
            lastKey = nome;
        }
        return;
    }

    switch (azione) {
        case 'salto':
            if (premuto) {
                salta(lottatore);
            }
            break;

        case 'attacco':
            if (premuto) {
                iniziaCarica(lottatore);
            } else if (statoCorrente === STATI.PARTITA) {
                rilasciaCarica(lottatore);
            }
            break;

        case 'parata':
            if (premuto) {
                iniziaParata(lottatore);
            } else {
                finisciParata(lottatore);
            }
            break;

        case 'ultimate':
            if (premuto) {
                attivaUltimate(lottatore);
            }
            break;
    }
}

// ========================================
// Schermata dei keybinds
// ==========================================
// Raggiungibile da SETTINGS -> KEYBINDS, sia dal menu sia dalla pausa.
// Frecce (o W/S) per spostarsi, Invio per assegnare, Esc per tornare indietro:
// mentre si aspetta il tasto, il tasto premuto viene assegnato.

let keybindsRitorno = 'settings';
let keybindsIndice = 0;
let keybindsInAscolto = false;

/**
 * Righe della schermata: le sei azioni dei due giocatori più il ripristino
 */
function righeKeybinds() {
    const righe = [];

    for (const giocatore of ['p1', 'p2']) {
        for (const azione of AZIONI_TASTIERA) {
            righe.push({ giocatore: giocatore, azione: azione.id, nome: azione.nome });
        }
    }

    righe.push({ giocatore: null, azione: null, nome: 'RIPRISTINA PREDEFINITI' });
    return righe;
}

/**
 * Apre la schermata dei keybinds. `ritorno` è il menu in cui si torna con Esc.
 */
function apriKeybinds(ritorno = 'settings') {
    keybindsRitorno = ritorno;
    keybindsIndice = 0;
    keybindsInAscolto = false;

    disegnaKeybinds();
    cambiaStato(STATI.KEYBINDS);
}

/**
 * Ridisegna elenco e stato della schermata
 */
function disegnaKeybinds() {
    const contenitore = document.querySelector('#keybindsElenco');
    if (!contenitore) {
        return;
    }

    const righe = righeKeybinds();
    contenitore.innerHTML = '';

    let ultimoGiocatore = null;

    righe.forEach((riga, indice) => {
        if (riga.giocatore && riga.giocatore !== ultimoGiocatore) {
            const intestazione = document.createElement('div');
            intestazione.className = 'keybinds-gruppo';
            intestazione.textContent = NOMI_GIOCATORI[riga.giocatore];
            contenitore.appendChild(intestazione);
            ultimoGiocatore = riga.giocatore;
        }

        const elemento = document.createElement('div');
        elemento.className = 'keybinds-riga';

        if (indice === keybindsIndice) {
            elemento.className += ' selezionata';
        }

        const etichetta = document.createElement('span');
        etichetta.className = 'keybinds-azione';
        etichetta.textContent = riga.nome;

        const valore = document.createElement('span');
        valore.className = 'keybinds-tasto';

        if (riga.giocatore) {
            const inAscolto = keybindsInAscolto && indice === keybindsIndice;
            valore.textContent = inAscolto ? 'PREMI UN TASTO' : nomeTasto(tastoDi(riga.giocatore, riga.azione));
            if (inAscolto) {
                elemento.className += ' in-ascolto';
            }
        } else {
            valore.textContent = 'INVIO';
        }

        elemento.appendChild(etichetta);
        elemento.appendChild(valore);
        contenitore.appendChild(elemento);
    });

    const stato = document.querySelector('#keybindsStato');
    if (stato) {
        if (keybindsInAscolto) {
            stato.innerHTML = 'Premi il tasto da assegnare. Esc per annullare.';
        } else if (dispositivoTouch()) {
            stato.innerHTML = 'Su telefono i keybinds si cambiano collegando una tastiera. Esc per tornare indietro.';
        } else {
            stato.innerHTML = 'Frecce su/giu per spostarti, Invio per cambiare, Esc per tornare indietro.';
        }
    }
}

/**
 * Chiude la schermata e torna al menu di provenienza
 */
function chiudiKeybinds() {
    keybindsInAscolto = false;
    if (keybindsRitorno === 'impostazioniPausa') {
        apriMenu('impostazioniPausa', STATI.PAUSA);
    } else {
        apriMenu('settings');
    }
}

/**
 * Assegna un tasto a un'azione, togliendolo a chi lo usava già
 */
function assegnaTasto(giocatore, azione, tasto) {
    for (const altroGiocatore of ['p1', 'p2']) {
        for (const altraAzione of AZIONI_TASTIERA) {
            if (tastoDi(altroGiocatore, altraAzione.id) === tasto) {
                tastiComandi[altroGiocatore][altraAzione.id] = '';
            }
        }
    }

    tastiComandi[giocatore][azione] = tasto;
    salvaKeybinds();
}

/**
 * Tastiera della schermata dei keybinds
 */
function gestisciInputKeybinds(evento) {
    if (statoCorrente !== STATI.KEYBINDS) {
        return;
    }

    // Fase di assegnazione: il prossimo tasto diventa il comando
    if (keybindsInAscolto) {
        evento.preventDefault();

        if (evento.key === 'Escape') {
            keybindsInAscolto = false;
            disegnaKeybinds();
            return;
        }

        if (TASTI_RISERVATI.includes(evento.key) || evento.key === 'Dead') {
            const stato = document.querySelector('#keybindsStato');
            if (stato) {
                stato.innerHTML = 'Tasto riservato a menu e pausa: scegline un altro. Esc per annullare.';
            }
            return;
        }

        const riga = righeKeybinds()[keybindsIndice];
        if (riga && riga.giocatore) {
            const tasto = (evento.key.length === 1) ? evento.key.toLowerCase() : evento.key;
            assegnaTasto(riga.giocatore, riga.azione, tasto);
        }

        keybindsInAscolto = false;
        disegnaKeybinds();
        return;
    }

    if (evento.repeat) {
        return;
    }

    const righe = righeKeybinds();

    switch (evento.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            keybindsIndice = (keybindsIndice - 1 + righe.length) % righe.length;
            disegnaKeybinds();
            break;

        case 'ArrowDown':
        case 's':
        case 'S':
            keybindsIndice = (keybindsIndice + 1) % righe.length;
            disegnaKeybinds();
            break;

        case 'Enter': {
            const riga = righe[keybindsIndice];
            if (!riga) {
                return;
            }

            if (!riga.giocatore) {
                ripristinaKeybinds();
                disegnaKeybinds();
                return;
            }

            keybindsInAscolto = true;
            disegnaKeybinds();
            break;
        }

        case 'Escape':
            chiudiKeybinds();
            break;
    }
}

// I tasti salvati servono subito: l'handler della tastiera li legge al primo tasto
caricaKeybinds();
