// ========================================
// Negozio dei lottatori
// ==========================================
// Il catalogo lo decide il server (dati/negozio.json): il browser non inventa
// prezzi né decide cosa è posseduto. Qui si disegna e si manda l'acquisto.

// Ultimo catalogo letto dal server: lo usa anche Account.js per sapere
// quali lottatori sono gratuiti.
let CATALOGO_NEGOZIO = [];

/** Crea un elemento con classe e testo. */
function negozioCrea(tag, classe, testo) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (testo !== undefined && testo !== null) elemento.textContent = testo;
    return elemento;
}

/** Il personaggio del gioco che corrisponde a un id del catalogo. */
function lottatoreDelCatalogo(id) {
    return PERSONAGGI.find((p) => p.id === id) || null;
}

/** Apre il negozio: senza account non si compra niente. */
async function apriNegozio() {
    if (!statoAccount.dentro) {
        apriAccount();
        messaggioAccount('Per usare il negozio serve un account: accedi o crealo qui sopra.', 'errore');
        return;
    }

    cambiaStato(STATI.NEGOZIO);
    disegnaNegozio('Caricamento del negozio…');
    await caricaNegozio();
}

/** Chiede il catalogo al server e ridisegna. */
async function caricaNegozio() {
    try {
        const dati = await api.chiama('/api/negozio');
        CATALOGO_NEGOZIO = dati.voci || [];
        statoAccount.punti = dati.punti;
        disegnaNegozio('');
    } catch (errore) {
        disegnaNegozio(errore.message, 'errore');
    }
}

/** Disegna la schermata del negozio. */
function disegnaNegozio(messaggio, tipo) {
    const contenitore = document.querySelector('#negozio');
    if (!contenitore) return;

    contenitore.innerHTML = '';

    contenitore.appendChild(negozioCrea('div', 'negozio-titolo', 'NEGOZIO DEI LOTTATORI'));
    contenitore.appendChild(negozioCrea('div', 'negozio-punti', 'Punti disponibili: ' + statoAccount.punti));

    const griglia = negozioCrea('div', 'negozio-griglia');

    for (const voce of CATALOGO_NEGOZIO) {
        const lottatore = lottatoreDelCatalogo(voce.personaggio);
        const scheda = negozioCrea('div', 'negozio-scheda' + (voce.ottenuto ? ' gia-tuo' : ''));

        scheda.appendChild(negozioCrea('div', 'negozio-nome', lottatore ? lottatore.nome : voce.personaggio));

        if (lottatore && lottatore.ultimate && lottatore.ultimate.nome) {
            scheda.appendChild(negozioCrea('div', 'negozio-ultimate', 'Ultimate: ' + lottatore.ultimate.nome));
        }

        if (voce.ottenuto) {
            scheda.appendChild(negozioCrea('div', 'negozio-stato', 'Già tuo'));
        } else {
            scheda.appendChild(negozioCrea('div', 'negozio-prezzo', voce.prezzo + ' punti'));
            const compra = negozioCrea('button', 'negozio-bottone', 'ACQUISTA');
            const abbastanza = statoAccount.punti >= voce.prezzo;
            if (!abbastanza) {
                compra.classList.add('disabilitato');
                compra.title = 'Ti servono ancora ' + (voce.prezzo - statoAccount.punti) + ' punti';
            }
            compra.addEventListener('click', () => acquistaLottatore(voce.personaggio));
            scheda.appendChild(compra);
        }

        griglia.appendChild(scheda);
    }

    contenitore.appendChild(griglia);

    const riga = negozioCrea('div', 'negozio-stato-riga' + (tipo ? ' ' + tipo : ''), messaggio || '');
    riga.id = 'negozioMessaggio';
    contenitore.appendChild(riga);

    const indietro = negozioCrea('button', 'negozio-bottone secondario', 'INDIETRO');
    indietro.addEventListener('click', () => apriMenu('principale'));
    contenitore.appendChild(indietro);
}

/** Manda l'acquisto al server e aggiorna la schermata. */
async function acquistaLottatore(idLottatore) {
    const riga = document.querySelector('#negozioMessaggio');
    if (riga) {
        riga.textContent = 'Acquisto in corso…';
        riga.className = 'negozio-stato-riga attesa';
    }

    try {
        const esito = await api.chiama('/api/negozio/acquisto', { corpo: { personaggio: idLottatore } });
        statoAccount.punti = esito.punti;
        statoAccount.lottatori = esito.personaggi;

        const lottatore = lottatoreDelCatalogo(idLottatore);
        const nome = lottatore ? lottatore.nome : idLottatore;
        await caricaNegozio();

        const nuovaRiga = document.querySelector('#negozioMessaggio');
        if (nuovaRiga) {
            nuovaRiga.textContent = 'Acquistato: ' + nome + '. Ora è selezionabile in partita.';
            nuovaRiga.className = 'negozio-stato-riga ok';
        }
    } catch (errore) {
        const nuovaRiga = document.querySelector('#negozioMessaggio');
        if (nuovaRiga) {
            nuovaRiga.textContent = errore.message;
            nuovaRiga.className = 'negozio-stato-riga errore';
        }
    }
}
