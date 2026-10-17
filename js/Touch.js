// ========================================
// Comandi touch (telefono e tablet)
// ==========================================
// I pulsanti virtuali non hanno una logica di gioco propria: mandano gli stessi
// eventi della tastiera. Cosi' menu, selezione, partita e VS ONLINE funzionano
// senza duplicare una riga: l'unica cosa che cambia sono i tasti emessi.
//
// Disposizione:
// - un giocatore (VS CPU, VS ONLINE): leva a sinistra, tre tasti a destra;
// - due giocatori (VS LOCALE): leva e tasti per ogni lato, con i tasti del
//   proprio giocatore.
//
// In VS ONLINE i comandi sono quelli del giocatore che sta usando il telefono:
// l'host manda i tasti del giocatore 1, l'ospite quelli del giocatore 2.

const TASTI_TOUCH = {
    p1: { sinistra: 'a', destra: 'd', salto: 'w', attacco: 'h', parata: 'j', ultimate: 'g' },
    p2: { sinistra: 'ArrowLeft', destra: 'ArrowRight', salto: 'ArrowUp', attacco: 'ù', parata: 'à', ultimate: 'l' }
};

// Lunghezze in pixel dei comandi: la leva ha una corsa di 46, la zona morta e' 14
const CORSA_LEVA = 46;
const ZONA_MORTA = 14;

const comandiTouch = {
    disposizione: null,   // firma della disposizione costruita
    visibile: false
};

/**
 * True su telefono e tablet: dito come puntatore principale e nessun mouse.
 * Un PC con schermo touch (che ha `hover: hover`) resta a tastiera.
 */
function dispositivoTouch() {
    if (!navigator.maxTouchPoints) {
        return false;
    }
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) {
        return true;
    }
    return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
}

/**
 * Chi comanda questo schermo: 'p1' oppure 'p2' in base alla modalità.
 * In VS LOCALE servono entrambi i gruppi di comandi.
 */
function disposizioneTouch() {
    if (modalitaPartita === MODALITA.LOCALE) {
        return 'due';
    }
    if (modalitaPartita === MODALITA.ONLINE && onlineStato.ospite) {
        return 'p2';
    }
    return 'p1';
}

/**
 * Manda alla pagina un evento di tastiera, identico a quello di un tasto vero
 */
function premiTasto(tasto, premuto) {
    window.dispatchEvent(new KeyboardEvent(premuto ? 'keydown' : 'keyup', {
        key: tasto,
        bubbles: true,
        cancelable: true
    }));
}

/**
 * Rilascia tutti i tasti dei comandi touch: serve quando si esce dalla partita
 * (pausa, menu, partita finita) per non lasciare tasti premuti.
 */
function rilasciTuttoTouch() {
    for (const ruolo in TASTI_TOUCH) {
        for (const azione in TASTI_TOUCH[ruolo]) {
            premiTasto(TASTI_TOUCH[ruolo][azione], false);
        }
    }

    const contenitore = document.querySelector('#comandiTouch');
    if (contenitore) {
        contenitore.querySelectorAll('.tasto-touch.premuto').forEach(bottone => bottone.classList.remove('premuto'));
        contenitore.querySelectorAll('.leva-pomello').forEach(pomello => {
            pomello.style.transform = 'translate(0px, 0px)';
        });
        contenitore.querySelectorAll('.leva-touch.attiva').forEach(leva => leva.classList.remove('attiva'));
    }
}

/**
 * Crea la leva virtuale di un giocatore.
 * Il pomello si trascina: sinistra e destra muovono, in alto salta (un salto per
 * trascinamento). Non è un analogico vero perché il gioco legge tasti, non assi.
 */
function creaZonaLeva(ruolo) {
    const zona = document.createElement('div');
    zona.className = 'zona-leva';

    const leva = document.createElement('div');
    leva.className = 'leva-touch';

    const pomello = document.createElement('div');
    pomello.className = 'leva-pomello';
    leva.appendChild(pomello);
    zona.appendChild(leva);

    const tasti = TASTI_TOUCH[ruolo];
    const stato = { puntatore: null, sinistra: false, destra: false, salto: false };
    let centro = { x: 0, y: 0 };

    function muovi(evento) {
        const dx = evento.clientX - centro.x;
        const dy = evento.clientY - centro.y;

        const sinistra = dx < -ZONA_MORTA;
        const destra = dx > ZONA_MORTA;

        if (sinistra !== stato.sinistra) {
            stato.sinistra = sinistra;
            premiTasto(tasti.sinistra, sinistra);
        }
        if (destra !== stato.destra) {
            stato.destra = destra;
            premiTasto(tasti.destra, destra);
        }

        // Salto: parte una volta sola per trascinamento verso l'alto
        if (dy < -ZONA_MORTA * 2 && !stato.salto) {
            stato.salto = true;
            premiTasto(tasti.salto, true);
            premiTasto(tasti.salto, false);
        } else if (dy > -ZONA_MORTA && stato.salto) {
            stato.salto = false;
        }

        const distanza = Math.sqrt(dx * dx + dy * dy) || 1;
        const fattore = Math.min(1, CORSA_LEVA / distanza);
        pomello.style.transform = 'translate(' + (dx * fattore) + 'px,' + (dy * fattore) + 'px)';
    }

    leva.addEventListener('pointerdown', (evento) => {
        evento.preventDefault();
        const area = leva.getBoundingClientRect();
        centro = { x: area.left + area.width / 2, y: area.top + area.height / 2 };
        stato.puntatore = evento.pointerId;
        leva.classList.add('attiva');
        try {
            leva.setPointerCapture(evento.pointerId);
        } catch (errore) {
            // puntatore già rilasciato
        }
        muovi(evento);
    });

    leva.addEventListener('pointermove', (evento) => {
        if (stato.puntatore !== evento.pointerId) {
            return;
        }
        evento.preventDefault();
        muovi(evento);
    });

    function finisci(evento) {
        if (stato.puntatore === null) {
            return;
        }
        if (evento && evento.pointerId !== undefined && evento.pointerId !== stato.puntatore) {
            return;
        }

        stato.puntatore = null;
        stato.salto = false;
        stato.sinistra = false;
        stato.destra = false;

        premiTasto(tasti.sinistra, false);
        premiTasto(tasti.destra, false);

        pomello.style.transform = 'translate(0px, 0px)';
        leva.classList.remove('attiva');
    }

    leva.addEventListener('pointerup', finisci);
    leva.addEventListener('pointercancel', finisci);

    return zona;
}

/**
 * Crea i tre tasti di un giocatore: attacco (si tiene premuto per caricare),
 * parata (si tiene premuto) e ultimate (colpo singolo).
 * In VS LOCALE ogni gruppo ha l'etichetta del giocatore, perché i comandi
 * sullo stesso schermo sono due.
 */
function creaZonaTasti(ruolo) {
    const zona = document.createElement('div');
    zona.className = 'zona-tasti';
    zona.dataset.ruolo = ruolo;

    if (disposizioneTouch() === 'due') {
        const etichetta = document.createElement('div');
        etichetta.className = 'etichetta-giocatore';
        etichetta.textContent = ruolo === 'p1' ? 'P1' : 'P2';
        zona.appendChild(etichetta);
    }

    const riga = document.createElement('div');
    riga.className = 'riga-tasti';

    const tasti = TASTI_TOUCH[ruolo];
    const voci = [
        { tasto: tasti.attacco, testo: 'ATT', classe: 'attacco' },
        { tasto: tasti.parata, testo: 'PAR', classe: 'parata' },
        { tasto: tasti.ultimate, testo: 'ULT', classe: 'ultimate' }
    ];

    voci.forEach((voce) => {
        const bottone = document.createElement('button');
        bottone.type = 'button';
        bottone.className = 'tasto-touch ' + voce.classe;
        bottone.textContent = voce.testo;
        bottone.dataset.tasto = voce.tasto;

        let premuto = false;

        const giu = (evento) => {
            evento.preventDefault();
            if (premuto) {
                return;
            }
            premuto = true;
            bottone.classList.add('premuto');
            premiTasto(voce.tasto, true);
            try {
                bottone.setPointerCapture(evento.pointerId);
            } catch (errore) {
                // puntatore già rilasciato
            }
        };

        const su = () => {
            if (!premuto) {
                return;
            }
            premuto = false;
            bottone.classList.remove('premuto');
            premiTasto(voce.tasto, false);
        };

        bottone.addEventListener('pointerdown', giu);
        bottone.addEventListener('pointerup', su);
        bottone.addEventListener('pointercancel', su);
        bottone.addEventListener('pointerleave', su);

        // Il tasto non deve far scorrere o ingrandire la pagina
        bottone.addEventListener('touchstart', evento => evento.preventDefault(), { passive: false });

        riga.appendChild(bottone);
    });

    zona.appendChild(riga);

    return zona;
}

/**
 * Costruisce i comandi per la disposizione corrente (una volta sola, poi riusa)
 */
function costruisciComandiTouch() {
    const contenitore = document.querySelector('#comandiTouch');
    if (!contenitore) {
        return;
    }

    const disposizione = disposizioneTouch();
    if (comandiTouch.disposizione === disposizione && contenitore.childNodes.length > 0) {
        return;
    }

    contenitore.innerHTML = '';
    contenitore.classList.toggle('due-giocatori', disposizione === 'due');

    if (disposizione === 'due') {
        // Giocatore 1 a sinistra, giocatore 2 a destra
        contenitore.appendChild(creaZonaLeva('p1'));
        contenitore.appendChild(creaZonaTasti('p1'));
        contenitore.appendChild(creaZonaTasti('p2'));
        contenitore.appendChild(creaZonaLeva('p2'));
    } else {
        contenitore.appendChild(creaZonaLeva(disposizione));
        contenitore.appendChild(creaZonaTasti(disposizione));
    }

    comandiTouch.disposizione = disposizione;
}

/**
 * Mostra i comandi solo durante la partita e solo su dispositivi touch.
 * Richiamata da cambiaStato() e al ridimensionamento della finestra.
 */
function aggiornaComandiTouch() {
    const contenitore = document.querySelector('#comandiTouch');
    if (!contenitore) {
        return;
    }

    const inPartita = statoCorrente === STATI.PARTITA && !reportAperto;
    const visibile = inPartita && dispositivoTouch();

    if (visibile) {
        costruisciComandiTouch();
        contenitore.classList.toggle('verticale', window.innerHeight > window.innerWidth);
        contenitore.style.display = 'flex';
    } else {
        if (comandiTouch.visibile) {
            rilasciTuttoTouch();
        }
        contenitore.style.display = 'none';
    }

    comandiTouch.visibile = visibile;
}

// La rotazione del telefono cambia l'avviso "gira il telefono"
window.addEventListener('resize', aggiornaComandiTouch);

// Un tocco prolungato non deve aprire il menu contestuale del browser
document.addEventListener('contextmenu', (evento) => {
    if (comandiTouch.visibile) {
        evento.preventDefault();
    }
});
