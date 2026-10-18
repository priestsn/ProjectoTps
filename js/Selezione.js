// ========================================
// Selezione del Personaggio
// ==========================================
// Schermata in cui il giocatore 1 e il giocatore 2 scelgono il personaggio.
// I due cursori si muovono in modo indipendente e la partita parte solo
// quando entrambi hanno confermato.
//
// Comandi:
//   giocatore 1: A / D per scorrere, H per confermare
//   giocatore 2: frecce sinistra / destra per scorrere, ù per confermare
//   Esc per tornare al menu

// Cursore dei due giocatori: indice dentro PERSONAGGI
let sceltaP1 = 0;
let sceltaP2 = 1;

// Chi ha già confermato la scelta
let confermatoP1 = false;
let confermatoP2 = false;

/**
 * Apre la schermata di selezione ripartendo da zero.
 * In modalità CPU il giocatore 2 è scelto dal computer ed è già confermato.
 */
function apriSelezione(modalita = MODALITA.LOCALE) {
    modalitaPartita = modalita;

    sceltaP1 = 0;
    sceltaP2 = PERSONAGGI.length > 1 ? 1 : 0;
    confermatoP1 = false;
    confermatoP2 = false;

    if (modalitaPartita === MODALITA.CPU) {
        sceltaP2 = Math.floor(Math.random() * PERSONAGGI.length);
        confermatoP2 = true;
    }

    // In VS ONLINE il personaggio dell'altro arriva dalla rete (messaggio
    // 'scelta'): qui si riparte da zero e si mostra il codice della stanza
    if (modalitaPartita === MODALITA.ONLINE) {
        aggiornaBadgeOnline();
    }

    disegnaSelezione();
    cambiaStato(STATI.SELEZIONE);
}

/**
 * Costruisce la griglia dei personaggi e le schede dei due giocatori
 */
function disegnaSelezione() {
    const griglia = document.querySelector('#selezioneGriglia');
    griglia.innerHTML = '';

    PERSONAGGI.forEach((personaggio, indice) => {
        const cella = document.createElement('div');
        cella.className = 'cella';

        // I lottatori non posseduti si vedono ma non si possono scegliere
        const posseduto = lottatorePosseduto(personaggio.id);
        if (!posseduto) {
            cella.className += ' bloccata';
        }

        // In VS ONLINE il cursore dell'avversario non va mostrato finché non ha
        // scelto: altrimenti sembra che stia scorrendo anche lui
        const mostraP1 = controllaCursoreP1() || confermatoP1;
        const mostraP2 = controllaCursoreP2() || confermatoP2;

        if (indice === sceltaP1 && mostraP1) {
            cella.className += ' p1';
        }
        if (indice === sceltaP2 && mostraP2) {
            cella.className += ' p2';
        }
        if (indice === sceltaP1 && confermatoP1) {
            cella.className += ' confermato';
        }
        if (indice === sceltaP2 && confermatoP2) {
            cella.className += ' confermato';
        }

        // Ritratto: primo fotogramma di idle, ritagliato sul riquadro reale
        const ritratto = document.createElement('div');
        ritratto.className = 'ritratto';
        Object.assign(ritratto.style, stileRitratto(personaggio));

        const nome = document.createElement('div');
        nome.className = 'cella-nome';
        nome.innerHTML = personaggio.nome;

        // Tocco: su telefono si sceglie direttamente la cella
        cella.addEventListener('click', () => {
            toccaCella(indice);
        });

        cella.appendChild(ritratto);
        cella.appendChild(nome);

        if (!posseduto) {
            const voce = voceNegozio(personaggio.id);
            const blocco = document.createElement('div');
            blocco.className = 'cella-blocco';
            blocco.textContent = voce ? 'BLOCCATO — ' + voce.prezzo + ' PUNTI' : 'BLOCCATO';
            cella.appendChild(blocco);
        }
        griglia.appendChild(cella);
    });

    aggiornaSchedeSelezione();
    aggiornaComandiSelezione();
}

/**
 * Un tocco su una cella sposta il cursore del giocatore che sta scegliendo:
 * P1 se non ha ancora confermato, altrimenti P2 (solo in VS LOCALE).
 */
function toccaCella(indice) {
    // Un lottatore non posseduto non sposta nemmeno il cursore: si vede il
    // blocco e il prezzo, e il tocco spiega dove sbloccarlo.
    if (!lottatorePosseduto(PERSONAGGI[indice].id)) {
        if (typeof mostraAvviso === 'function') {
            mostraAvviso('Lottatore bloccato: si sblocca nel negozio', '#e0a020');
        }
        return;
    }

    if (!confermatoP1 && controllaCursoreP1()) {
        sceltaP1 = indice;
        disegnaSelezione();
        return;
    }

    if (!confermatoP2 && controllaCursoreP2()) {
        sceltaP2 = indice;
        disegnaSelezione();
    }
}

/**
 * Su telefono la schermata di selezione non ha una tastiera: compaiono dei
 * pulsanti per scorrere e confermare, uno per giocatore.
 */
function aggiornaComandiSelezione() {
    const contenitore = document.querySelector('#selezioneComandi');
    if (!contenitore) {
        return;
    }

    if (!dispositivoTouch()) {
        contenitore.innerHTML = '';
        contenitore.style.display = 'none';
        return;
    }

    contenitore.innerHTML = '';
    contenitore.style.display = 'flex';

    const giocatori = [];
    if (controllaCursoreP1()) giocatori.push({ numero: 1, etichetta: 'P1' });
    if (controllaCursoreP2()) giocatori.push({ numero: 2, etichetta: 'P2' });

    giocatori.forEach((giocatore) => {
        const gruppo = document.createElement('div');
        gruppo.className = 'gruppo-selezione';

        const etichetta = document.createElement('span');
        etichetta.className = 'gruppo-nome';
        etichetta.textContent = giocatore.etichetta;
        gruppo.appendChild(etichetta);

        const sinistra = document.createElement('button');
        sinistra.type = 'button';
        sinistra.className = 'tasto-selezione';
        sinistra.textContent = '<';
        sinistra.addEventListener('click', () => spostaCursore(giocatore.numero, -1));

        const destra = document.createElement('button');
        destra.type = 'button';
        destra.className = 'tasto-selezione';
        destra.textContent = '>';
        destra.addEventListener('click', () => spostaCursore(giocatore.numero, 1));

        const conferma = document.createElement('button');
        conferma.type = 'button';
        conferma.className = 'tasto-selezione conferma';
        conferma.textContent = 'CONFERMA';
        conferma.addEventListener('click', () => confermaScelta(giocatore.numero));

        gruppo.appendChild(sinistra);
        gruppo.appendChild(destra);
        gruppo.appendChild(conferma);
        contenitore.appendChild(gruppo);
    });

    // Pulsante indietro: su telefono non c'è il tasto Esc e la schermata
    // restava senza via d'uscita.
    const indietro = document.createElement('button');
    indietro.type = 'button';
    indietro.className = 'tasto-selezione indietro';
    indietro.textContent = 'INDIETRO';
    indietro.addEventListener('click', () => indietroDallaSelezione());
    contenitore.appendChild(indietro);
}

/**
 * Stile per mostrare solo il personaggio dentro il suo riquadro.
 * Il foglio viene ingrandito in modo che il personaggio riempia il ritratto
 * in altezza, poi viene spostato per centrare il riquadro.
 */
function stileRitratto(personaggio) {
    const sprite = personaggio.sprite;
    // Il ritratto si misura sull'ARENA, non sulla finestra: con il mondo 16:9
    // l'area di gioco è più stretta dello schermo, e usando window.innerWidth
    // la griglia restava a misura grande (e quindi tagliata) su un telefono
    // in orizzontale, dove la finestra è larga 873 ma l'arena 699.
    const area = document.getElementById('areaGioco');
    const larghezzaArea = area ? area.clientWidth : window.innerWidth;
    const altezzaArea = area ? area.clientHeight : window.innerHeight;

    let lato = 110;                                   // schermo grande
    if (larghezzaArea <= 900 || altezzaArea <= 460) {
        lato = 64;                                    // telefono in orizzontale
    }
    if (larghezzaArea <= 560 || altezzaArea <= 330) {
        lato = 52;                                    // schermo molto piccolo
    }
    const ritaglio = sprite.ritaglio;
    const frame = sprite.frame;
    const fattore = lato / ritaglio.altezza;             // il personaggio riempie in altezza
    const scostamentoX = -ritaglio.x * fattore + (lato - ritaglio.larghezza * fattore) / 2;

    // Il foglio è una striscia: larghezza = frame x fotogrammi, altezza = frame.
    // Le due misure vanno scalate con lo stesso fattore, altrimenti il
    // personaggio risulta schiacciato in orizzontale.
    return {
        width: lato + 'px',
        height: lato + 'px',
        backgroundImage: 'url(' + sprite.cartella + 'idle.png)',
        backgroundSize: (frame * sprite.frames.idle * fattore) + 'px ' + (frame * fattore) + 'px',
        backgroundPosition: scostamentoX + 'px ' + (-ritaglio.y * fattore) + 'px'
    };
}

/**
 * Mostra nome, archetipo e statistiche del personaggio sotto il cursore
 */
function aggiornaSchedaGiocatore(selettore, indice, confermato, extra = '') {
    const personaggio = PERSONAGGI[indice];
    const stat = personaggio.statistiche;
    const scheda = document.querySelector(selettore);

    scheda.innerHTML =
        '<div class="info-nome">' + personaggio.nome +
        (confermato ? '<span class="info-ok">PRONTO</span>' : '') + '</div>' +
        '<div class="info-archetipo">' + personaggio.archetipo +
        (extra ? ' &middot; ' + extra : '') + '</div>' +
        '<div class="info-stat">Vita ' + stat.vita +
        ' &middot; Stamina ' + stat.stamina +
        ' &middot; Danno ' + stat.danno +
        ' &middot; Costo ' + stat.costoStamina +
        ' &middot; Velocità ' + stat.velocita +
        ' &middot; Salto ' + Math.abs(stat.salto) + '</div>' +
        '<div class="info-ultimate">ULT &mdash; ' + personaggio.ultimate.nome +
        ': ' + personaggio.ultimate.descrizione + '</div>';
}

/**
 * Schede dei due giocatori, diverse per modalità:
 * - VS LOCALE: due giocatori sullo stesso schermo, entrambe le schede attive;
 * - VS CPU: scheda del giocatore e scheda dell'avversario già scelto dalla CPU;
 * - VS ONLINE: la propria scheda e quella dell'avversario, che resta "in attesa"
 *   finché non arriva la sua scelta.
 */
function aggiornaSchedeSelezione() {
    const istruzioni = document.querySelector('#selezioneIstruzioni');

    if (modalitaPartita === MODALITA.CPU) {
        aggiornaSchedaGiocatore('#infoP1', sceltaP1, confermatoP1);
        aggiornaSchedaGiocatore('#infoP2', sceltaP2, true, 'CPU ' + NOMI_DIFFICOLTA[difficoltaCPU]);
        if (istruzioni) {
            istruzioni.innerHTML = 'Scegli il tuo personaggio: A / D per scorrere, H per confermare' +
                ' &nbsp;&middot;&nbsp; l\'avversario è scelto dalla CPU &nbsp;&middot;&nbsp; Esc per tornare indietro';
        }
        return;
    }

    if (modalitaPartita === MODALITA.ONLINE) {
        if (onlineStato.ospite) {
            aggiornaSchedaAvversario('#infoP1', sceltaP1, confermatoP1);
            aggiornaSchedaGiocatore('#infoP2', sceltaP2, confermatoP2, 'TU');
            if (istruzioni) {
                istruzioni.innerHTML = 'Frecce per scorrere, ù per confermare' +
                    ' &nbsp;&middot;&nbsp; Esc per uscire dalla stanza';
            }
        } else {
            aggiornaSchedaGiocatore('#infoP1', sceltaP1, confermatoP1, 'TU');
            aggiornaSchedaAvversario('#infoP2', sceltaP2, confermatoP2);
            if (istruzioni) {
                istruzioni.innerHTML = 'A / D per scorrere, H per confermare' +
                    ' &nbsp;&middot;&nbsp; Esc per uscire dalla stanza';
            }
        }
        return;
    }

    aggiornaSchedaGiocatore('#infoP1', sceltaP1, confermatoP1);
    aggiornaSchedaGiocatore('#infoP2', sceltaP2, confermatoP2);
    if (istruzioni) {
        istruzioni.innerHTML = 'Giocatore 1: A / D per scegliere, H per confermare' +
            ' &nbsp;&middot;&nbsp; Giocatore 2: frecce per scegliere, ù per confermare' +
            ' &nbsp;&middot;&nbsp; Esc per tornare indietro';
    }
}

/**
 * Scheda dell'avversario in VS ONLINE: nome solo dopo la sua conferma
 */
function aggiornaSchedaAvversario(selettore, indice, confermato) {
    const scheda = document.querySelector(selettore);
    if (!scheda) {
        return;
    }

    const personaggio = PERSONAGGI[indice];
    const stat = personaggio.statistiche;

    scheda.innerHTML =
        '<div class="info-nome avversario">AVVERSARIO' +
        (confermato ? '<span class="info-ok">PRONTO</span>' : '') + '</div>' +
        '<div class="info-archetipo">' + (confermato ? personaggio.nome : 'in attesa della scelta...') + '</div>' +
        '<div class="info-stat">' + (confermato
            ? 'Vita ' + stat.vita + ' &middot; Danno ' + stat.danno + ' &middot; Velocità ' + stat.velocita
            : 'L\'altro giocatore sta scegliendo il suo personaggio') + '</div>';
}

/**
 * Sposta il cursore di un giocatore di `passo` posizioni, girando intorno
 */
function spostaCursore(giocatore, passo) {
    const totale = PERSONAGGI.length;

    if (giocatore === 1) {
        if (confermatoP1) return;
        sceltaP1 = prossimoSelezionabile(sceltaP1, passo);
    } else {
        if (confermatoP2) return;
        sceltaP2 = prossimoSelezionabile(sceltaP2, passo);
    }

    disegnaSelezione();
}

/**
 * Prossimo lottatore selezionabile nella direzione del passo: salta quelli
 * bloccati, così il cursore non si ferma mai su chi non si possiede.
 */
function prossimoSelezionabile(indicePartenza, passo) {
    const totale = PERSONAGGI.length;
    let indice = indicePartenza;

    for (let giro = 0; giro < totale; giro++) {
        indice = (indice + passo + totale) % totale;
        if (lottatorePosseduto(PERSONAGGI[indice].id)) {
            return indice;
        }
    }
    return indicePartenza;
}

/**
 * Conferma la scelta di un giocatore
 */
function confermaScelta(giocatore) {
    const indiceScelto = giocatore === 1 ? sceltaP1 : sceltaP2;
    const personaggioScelto = PERSONAGGI[indiceScelto];

    // Un lottatore non posseduto non si può confermare: il blocco vale anche
    // per la CPU, che sceglierebbe un personaggio non acquistato.
    if (!lottatorePosseduto(personaggioScelto.id)) {
        if (typeof mostraAvviso === 'function') {
            mostraAvviso('Lottatore bloccato: si sblocca nel negozio', '#e0a020');
        }
        return;
    }

    if (giocatore === 1) {
        confermatoP1 = true;
    } else {
        confermatoP2 = true;
    }

    disegnaSelezione();

    // In VS ONLINE la scelta va comunicata all'altro giocatore
    if (modalitaPartita === MODALITA.ONLINE) {
        inviaSceltaOnline(giocatore === 1 ? PERSONAGGI[sceltaP1].id : PERSONAGGI[sceltaP2].id);
    }

    // Si parte solo quando entrambi hanno confermato
    if (confermatoP1 && confermatoP2) {
        if (modalitaPartita === MODALITA.ONLINE) {
            // L'host avvia e comunica tutto all'ospite, che aspetta 'avvia'
            if (!onlineStato.ospite) {
                inviaAvvioOnline();
            }
        } else {
            avviaPartita(PERSONAGGI[sceltaP1].id, PERSONAGGI[sceltaP2].id);
        }
    }
}

/**
 * Chi comanda il cursore del giocatore 1 in questa modalità.
 * In VS ONLINE ogni browser comanda solo il proprio.
 */
function controllaCursoreP1() {
    if (modalitaPartita === MODALITA.ONLINE) {
        return !onlineStato.ospite;
    }
    return true;
}

/**
 * Chi comanda il cursore del giocatore 2 in questa modalità
 */
function controllaCursoreP2() {
    if (modalitaPartita === MODALITA.LOCALE) {
        return true;
    }
    if (modalitaPartita === MODALITA.ONLINE) {
        return onlineStato.ospite;
    }
    return false;
}

/**
 * Gestisce la tastiera nella schermata di selezione
 */
function gestisciInputSelezione(evento) {
    if (statoCorrente !== STATI.SELEZIONE) {
        return;
    }

    // La pressione prolungata non deve far scorrere i cursori a raffica
    if (evento.repeat) {
        return;
    }

    const tasto = (evento.key && evento.key.length === 1) ? evento.key.toLowerCase() : evento.key;

    // In VS ONLINE ogni browser pilota solo il proprio cursore
    if (modalitaPartita === MODALITA.ONLINE) {
        if (onlineStato.ospite && (tasto === 'a' || tasto === 'd' || tasto === 'h')) {
            return;
        }
        if (!onlineStato.ospite && (tasto === 'ArrowLeft' || tasto === 'ArrowRight' || tasto === 'ù')) {
            return;
        }
    }

    switch (tasto) {
        // --- giocatore 1 ---
        case 'a':
            spostaCursore(1, -1);
            break;

        case 'd':
            spostaCursore(1, 1);
            break;

        case 'h':
            confermaScelta(1);
            break;

        // --- giocatore 2 (in VS locale e per l'ospite in VS online) ---
        case 'ArrowLeft':
            if (controllaCursoreP2()) spostaCursore(2, -1);
            break;

        case 'ArrowRight':
            if (controllaCursoreP2()) spostaCursore(2, 1);
            break;

        case 'ù':
            if (controllaCursoreP2()) confermaScelta(2);
            break;

        // --- indietro ---
        case 'Escape':
            indietroDallaSelezione();
            break;
    }
}

/**
 * Torna al menu dalla schermata di selezione.
 * È la stessa azione del tasto Esc e del pulsante INDIETRO su telefono:
 * in VS ONLINE chiude anche la stanza, per non lasciare l'altro in attesa.
 */
function indietroDallaSelezione() {
    if (modalitaPartita === MODALITA.ONLINE) {
        esciOnline();
        apriMenu('play');
        return;
    }
    apriMenu(modalitaPartita === MODALITA.CPU ? 'cpu' : 'play');
}
