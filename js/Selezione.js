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
 * Apre la schermata di selezione ripartendo da zero
 */
function apriSelezione() {
    sceltaP1 = 0;
    sceltaP2 = PERSONAGGI.length > 1 ? 1 : 0;
    confermatoP1 = false;
    confermatoP2 = false;

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

        if (indice === sceltaP1) {
            cella.className += ' p1';
        }
        if (indice === sceltaP2) {
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

        cella.appendChild(ritratto);
        cella.appendChild(nome);
        griglia.appendChild(cella);
    });

    aggiornaSchedaGiocatore('#infoP1', sceltaP1, confermatoP1);
    aggiornaSchedaGiocatore('#infoP2', sceltaP2, confermatoP2);
}

/**
 * Stile per mostrare solo il personaggio dentro il suo riquadro.
 * Il foglio viene ingrandito in modo che il personaggio riempia il ritratto
 * in altezza, poi viene spostato per centrare il riquadro.
 */
function stileRitratto(personaggio) {
    const sprite = personaggio.sprite;
    const lato = 110;                                    // lato del ritratto in pixel
    const ritaglio = sprite.ritaglio;
    const frame = sprite.frame;
    const fattore = lato / ritaglio.altezza;             // il personaggio riempie in altezza
    const scostamentoX = -ritaglio.x * fattore + (lato - ritaglio.larghezza * fattore) / 2;

    return {
        backgroundImage: 'url(' + sprite.cartella + 'idle.png)',
        backgroundSize: (frame * fattore) + 'px ' + (frame * fattore) + 'px',
        backgroundPosition: scostamentoX + 'px ' + (-ritaglio.y * fattore) + 'px'
    };
}

/**
 * Mostra nome, archetipo e statistiche del personaggio sotto il cursore
 */
function aggiornaSchedaGiocatore(selettore, indice, confermato) {
    const personaggio = PERSONAGGI[indice];
    const stat = personaggio.statistiche;
    const scheda = document.querySelector(selettore);

    scheda.innerHTML =
        '<div class="info-nome">' + personaggio.nome +
        (confermato ? '<span class="info-ok">PRONTO</span>' : '') + '</div>' +
        '<div class="info-archetipo">' + personaggio.archetipo + '</div>' +
        '<div class="info-stat">Vita ' + stat.vita +
        ' &middot; Danno ' + stat.danno +
        ' &middot; Velocità ' + stat.velocita +
        ' &middot; Salto ' + Math.abs(stat.salto) + '</div>';
}

/**
 * Sposta il cursore di un giocatore di `passo` posizioni, girando intorno
 */
function spostaCursore(giocatore, passo) {
    const totale = PERSONAGGI.length;

    if (giocatore === 1) {
        if (confermatoP1) return;
        sceltaP1 = (sceltaP1 + passo + totale) % totale;
    } else {
        if (confermatoP2) return;
        sceltaP2 = (sceltaP2 + passo + totale) % totale;
    }

    disegnaSelezione();
}

/**
 * Conferma la scelta di un giocatore
 */
function confermaScelta(giocatore) {
    if (giocatore === 1) {
        confermatoP1 = true;
    } else {
        confermatoP2 = true;
    }

    disegnaSelezione();

    // Si parte solo quando entrambi hanno confermato
    if (confermatoP1 && confermatoP2) {
        avviaPartita(PERSONAGGI[sceltaP1].id, PERSONAGGI[sceltaP2].id);
    }
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

        // --- giocatore 2 ---
        case 'ArrowLeft':
            spostaCursore(2, -1);
            break;

        case 'ArrowRight':
            spostaCursore(2, 1);
            break;

        case 'ù':
            confermaScelta(2);
            break;

        // --- indietro ---
        case 'Escape':
            apriMenu('play');
            break;
    }
}
