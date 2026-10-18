// ========================================
// Coda ranked: cercare un avversario vero
// ==========================================
// Il server tiene la coda e abbina due giocatori con ELO vicino (la finestra si
// allarga con l'attesa). Da qui si guarda la risposta ogni secondo e mezzo.
//
// Quando arriva l'abbinamento:
// - il padrone crea la stanza e comunica il codice al server;
// - l'ospite aspetta quel codice e entra da solo, senza digitare niente.
//
// La partita ranked l'ha già aperta il server: qui si memorizza solo il suo
// identificativo in `partitaPunti`, così a fine incontro i punti e l'ELO
// vengono chiusi sulla partita giusta.

let codaTimer = null;
let codiciTimer = null;
let codaRuolo = null;
let codaPartita = null;
let codaAttesaSecondi = 0;
let codaInAttesaDiCodice = false;

/** Elemento con classe e testo. */
function codaCrea(tag, classe, testo) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (testo !== undefined && testo !== null) elemento.textContent = testo;
    return elemento;
}

/** Apre la schermata della coda. */
function apriCodaRanked() {
    if (!statoAccount.dentro) {
        apriAccount();
        messaggioAccount('La ranked richiede un account: accedi o crealo qui sopra.', 'errore');
        return;
    }

    cambiaStato(STATI.CODA);
    disegnaCoda();
}

/** Disegna la schermata: un pulsante per cercare, uno per annullare. */
function disegnaCoda() {
    const contenitore = document.querySelector('#coda');
    if (!contenitore) return;

    contenitore.innerHTML = '';
    contenitore.appendChild(codaCrea('div', 'coda-titolo', 'PARTITA RANKED'));
    contenitore.appendChild(codaCrea('div', 'coda-nota',
        'Si cerca un avversario con un ELO vicino al tuo. La ricerca si allarga con l\'attesa: da 300 punti, poi 600, poi 1000.'));

    const riga = codaCrea('div', 'coda-riga');
    riga.appendChild(codaCrea('span', 'coda-etichetta', 'Il tuo ELO'));
    riga.appendChild(codaCrea('span', 'coda-valore', String(statoAccount.elo || 1000)));
    contenitore.appendChild(riga);

    const cerca = codaCrea('button', 'account-bottone', 'CERCA AVVERSARIO');
    cerca.id = 'codaCerca';
    cerca.addEventListener('click', () => cercaPartitaRanked());

    const annulla = codaCrea('button', 'account-bottone secondario', 'ANNULLA');
    annulla.id = 'codaAnnulla';
    annulla.addEventListener('click', () => annullaCoda());

    const stato = codaCrea('div', 'account-stato');
    stato.id = 'codaStato';
    contenitore.append(cerca, annulla, stato);

    const indietro = codaCrea('button', 'account-bottone secondario', 'INDIETRO');
    indietro.addEventListener('click', () => { annullaCoda(); apriMenu('principale'); });
    contenitore.appendChild(indietro);
}

/** Messaggio sotto i pulsanti. */
function messaggioCoda(testo, tipo) {
    const riga = document.querySelector('#codaStato');
    if (!riga) return;
    riga.textContent = testo || '';
    riga.className = 'account-stato' + (tipo ? ' ' + tipo : '');
}

/** Entra in coda e comincia a controllare. */
async function cercaPartitaRanked() {
    messaggioCoda('Ricerca dell\'avversario…', 'attesa');
    codaAttesaSecondi = 0;

    try {
        const dati = await api.chiama('/api/coda/entra', { corpo: {} });
        if (dati.stato === 'abbinato') {
            gestisciAbbinamento(dati);
            return;
        }
        messaggioCoda('In coda (posizione ' + dati.posizione + ' di ' + dati.inCoda + '). Attendo…', 'attesa');
        fermaTimer();
        codaTimer = setInterval(controllaCoda, 1500);
    } catch (errore) {
        messaggioCoda(errore.message, 'errore');
    }
}

/** Un giro di controllo della coda. */
async function controllaCoda() {
    if (!statoAccount.dentro) {
        fermaTimer();
        return;
    }

    try {
        const dati = await api.chiama('/api/coda/stato');

        if (dati.stato === 'abbinato') {
            gestisciAbbinamento(dati);
            return;
        }

        if (dati.stato === 'inAttesa') {
            codaAttesaSecondi = dati.attesaSecondi || 0;
            messaggioCoda('In coda da ' + codaAttesaSecondi + ' s. Cerco entro ±' + dati.finestra + ' di ELO.', 'attesa');
            return;
        }

        // Fuori dalla coda senza abbinamento: si torna in attesa di un comando.
        fermaTimer();
        messaggioCoda('Non sei più in coda.', '');
    } catch (errore) {
        fermaTimer();
        messaggioCoda(errore.message, 'errore');
    }
}

/** L'abbinamento è arrivato: padrone crea la stanza, ospite aspetta il codice. */
function gestisciAbbinamento(dati) {
    fermaTimer();
    codaRuolo = dati.ruolo;
    codaPartita = dati.partitaId;

    if (dati.ruolo === 'padrone') {
        // La partita ranked l'ha già aperta il server: qui si ricorda solo quale.
        partitaPunti = dati.partitaId;
        partitaPuntiInviata = false;
        codaInAttesaDiCodice = true;

        messaggioCoda('Avversario: ' + dati.avversario + '. Creo la stanza…', 'ok');
        creaStanzaOnline();
        return;
    }

    messaggioCoda('Avversario: ' + dati.avversario + '. Attendo il codice della stanza…', 'ok');
    attendiCodiceStanza();
}

/** Il padrone comunica al server il codice della stanza appena creata. */
async function pubblicaCodiceCoda(codice) {
    if (!codaInAttesaDiCodice) return;
    codaInAttesaDiCodice = false;

    try {
        await api.chiama('/api/coda/codice', { corpo: { codice: codice } });
    } catch (errore) {
        messaggioCoda('Codice non consegnato all\'avversario: ' + errore.message, 'errore');
    }
}

/** L'ospite aspetta il codice, poi entra da solo nella stanza. */
function attendiCodiceStanza() {
    fermaTimer();
    let giri = 0;

    codiciTimer = setInterval(async () => {
        giri++;

        if (giri > 40) {
            fermaTimer();
            messaggioCoda('Il padrone non ha creato la stanza in tempo.', 'errore');
            return;
        }

        try {
            const dati = await api.chiama('/api/coda/codice');
            if (dati.stato !== 'pronto') return;

            fermaTimer();
            const campo = document.querySelector('#onlineCodice');
            if (campo) campo.value = dati.codice;
            messaggioCoda('Stanza ' + dati.codice + ': entro…', 'ok');
            entraStanzaOnline();
        } catch (errore) {
            fermaTimer();
            messaggioCoda(errore.message, 'errore');
        }
    }, 1200);
}

/** Ferma tutti i controlli periodici. */
function fermaTimer() {
    if (codaTimer) { clearInterval(codaTimer); codaTimer = null; }
    if (codiciTimer) { clearInterval(codiciTimer); codiciTimer = null; }
}

/** Esce dalla coda. */
async function annullaCoda() {
    fermaTimer();
    codaInAttesaDiCodice = false;
    codaRuolo = null;
    codaPartita = null;

    try {
        await api.chiama('/api/coda/esci', { corpo: {} });
    } catch (errore) {
        // Se il server non risponde non c'è niente da annullare
    }
    messaggioCoda('Ricerca annullata.', '');
}
