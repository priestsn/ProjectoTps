// ========================================
// Account: iscrizione, accesso, profilo
// ==========================================
// Lo stato dell'account vive in `statoAccount`: lo leggono il negozio e la
// schermata di selezione (per capire quali lottatori sono posseduti).
//
// Senza account si gioca lo stesso: VS LOCALE, VS CPU e VS ONLINE non
// richiedono il login. L'account serve per punti, negozio, classifica e tornei.

const statoAccount = {
    dentro: false,
    nick: null,
    punti: 0,
    elo: 1000,
    lottatori: []
};

/** True se il lottatore è posseduto. Senza account valgono solo i gratuiti. */
function lottatorePosseduto(idLottatore) {
    if (!statoAccount.dentro) {
        return lottatoreGratuito(idLottatore);
    }
    return statoAccount.lottatori.indexOf(idLottatore) !== -1;
}

/** True se il lottatore è fra quelli disponibili dall'inizio. */
function lottatoreGratuito(idLottatore) {
    const voce = voceNegozio(idLottatore);
    return !!(voce && voce.prezzo === 0);
}

/** La voce del catalogo che riguarda un lottatore, se esiste. */
function voceNegozio(idLottatore) {
    if (typeof CATALOGO_NEGOZIO === 'undefined') {
        return null;
    }
    return CATALOGO_NEGOZIO.find((voce) => voce.personaggio === idLottatore) || null;
}

/** Crea un elemento con classe e testo: evita di ripetere createElement. */
function accountCrea(tag, classe, testo) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (testo !== undefined && testo !== null) elemento.textContent = testo;
    return elemento;
}

/** Riga di messaggio sotto i moduli: vuota, oppure verde/rossa. */
function messaggioAccount(testo, tipo) {
    const riga = document.querySelector('#accountStato');
    if (!riga) return;
    riga.textContent = testo || '';
    riga.className = 'account-stato' + (tipo ? ' ' + tipo : '');
}

/** Apre la schermata account e disegna quello che serve. */
function apriAccount() {
    disegnaAccount();
    cambiaStato(STATI.ACCOUNT);
}

/** Ridisegna la schermata: modulo di accesso se fuori, profilo se dentro. */
function disegnaAccount() {
    const contenitore = document.querySelector('#account');
    if (!contenitore) return;

    contenitore.innerHTML = '';

    const titolo = accountCrea('div', 'account-titolo', 'ACCOUNT');
    contenitore.appendChild(titolo);

    if (statoAccount.dentro) {
        contenitore.appendChild(moduloProfilo());
        return;
    }

    const nota = accountCrea('div', 'account-nota',
        'L\'account serve per punti, negozio, classifica e tornei. Per giocare in locale o contro la CPU non serve.');
    contenitore.appendChild(nota);
    contenitore.appendChild(moduloAccesso());
    contenitore.appendChild(moduloIscrizione());

    const stato = accountCrea('div', 'account-stato');
    stato.id = 'accountStato';
    contenitore.appendChild(stato);

    const indietro = accountCrea('button', 'account-bottone secondario', 'INDIETRO');
    indietro.addEventListener('click', () => apriMenu('principale'));
    contenitore.appendChild(indietro);
}

/** Modulo di accesso: nickname e password. */
function moduloAccesso() {
    const modulo = accountCrea('div', 'account-modulo');
    modulo.appendChild(accountCrea('div', 'account-sottotitolo', 'Ho già un account'));

    const nick = accountCrea('input', 'account-campo');
    nick.id = 'accessoNick';
    nick.type = 'text';
    nick.autocomplete = 'username';
    nick.spellcheck = false;
    nick.placeholder = 'Nickname';
    nick.setAttribute('aria-label', 'Nickname per l\'accesso');

    const password = accountCrea('input', 'account-campo');
    password.id = 'accessoPassword';
    password.type = 'password';
    password.autocomplete = 'current-password';
    password.placeholder = 'Password';
    password.setAttribute('aria-label', 'Password per l\'accesso');

    const bottone = accountCrea('button', 'account-bottone', 'ACCEDI');
    bottone.addEventListener('click', () => accediAccount());

    modulo.append(nick, password, bottone);
    return modulo;
}

/** Modulo di iscrizione: nickname, password e conferma. */
function moduloIscrizione() {
    const modulo = accountCrea('div', 'account-modulo');
    modulo.appendChild(accountCrea('div', 'account-sottotitolo', 'Sono nuovo'));

    const nick = accountCrea('input', 'account-campo');
    nick.id = 'iscrizioneNick';
    nick.type = 'text';
    nick.autocomplete = 'username';
    nick.spellcheck = false;
    nick.placeholder = 'Nickname (da 3 a 16 caratteri)';
    nick.setAttribute('aria-label', 'Nuovo nickname');

    const password = accountCrea('input', 'account-campo');
    password.id = 'iscrizionePassword';
    password.type = 'password';
    password.autocomplete = 'new-password';
    password.placeholder = 'Password (almeno 10 caratteri)';
    password.setAttribute('aria-label', 'Nuova password');

    const conferma = accountCrea('input', 'account-campo');
    conferma.id = 'iscrizioneConferma';
    conferma.type = 'password';
    conferma.autocomplete = 'new-password';
    conferma.placeholder = 'Ripeti la password';
    conferma.setAttribute('aria-label', 'Conferma della password');

    const bottone = accountCrea('button', 'account-bottone', 'CREA ACCOUNT');
    bottone.addEventListener('click', () => iscriviAccount());

    modulo.append(nick, password, conferma, bottone);
    return modulo;
}

/** Vista del profilo quando si è dentro. */
function moduloProfilo() {
    const modulo = accountCrea('div', 'account-modulo');
    modulo.appendChild(accountCrea('div', 'account-sottotitolo', 'Collegato come ' + statoAccount.nick));

    const righe = [
        ['Punti', statoAccount.punti],
        ['Punteggio (ELO)', statoAccount.elo],
        ['Lottatori posseduti', statoAccount.lottatori.length]
    ];
    for (const riga of righe) {
        const linea = accountCrea('div', 'account-riga');
        linea.append(accountCrea('span', 'account-etichetta', riga[0]),
            accountCrea('span', 'account-valore', String(riga[1])));
        modulo.appendChild(linea);
    }

    const negozio = accountCrea('button', 'account-bottone', 'NEGOZIO');
    negozio.addEventListener('click', () => apriNegozio());

    const aggiorna = accountCrea('button', 'account-bottone secondario', 'AGGIORNA');
    aggiorna.addEventListener('click', () => aggiornaProfilo(true));

    const esci = accountCrea('button', 'account-bottone secondario', 'ESCI');
    esci.addEventListener('click', () => esciAccount());

    modulo.append(negozio, aggiorna, esci);
    return modulo;
}

/** Iscrizione: controlla i campi, chiama il server, salva il token. */
async function iscriviAccount() {
    const nick = document.querySelector('#iscrizioneNick');
    const password = document.querySelector('#iscrizionePassword');
    const conferma = document.querySelector('#iscrizioneConferma');

    if (!nick || !password || !conferma) return;

    if (password.value !== conferma.value) {
        messaggioAccount('Le due password non coincidono.', 'errore');
        return;
    }

    messaggioAccount('Creazione dell\'account in corso…', 'attesa');
    try {
        const dati = await api.chiama('/api/iscrizione', {
            corpo: { nick: nick.value, password: password.value }
        });
        api.salvaToken(dati.token);
        applicaProfilo(dati.giocatore);
        disegnaAccount();
        messaggioAccount('Account creato. Benvenuto, ' + dati.giocatore.nick + '.', 'ok');
    } catch (errore) {
        messaggioAccount(errore.message, 'errore');
    }
}

/** Accesso: chiama il server, salva il token, entra. */
async function accediAccount() {
    const nick = document.querySelector('#accessoNick');
    const password = document.querySelector('#accessoPassword');
    if (!nick || !password) return;

    messaggioAccount('Accesso in corso…', 'attesa');
    try {
        const dati = await api.chiama('/api/accesso', {
            corpo: { nick: nick.value, password: password.value }
        });
        api.salvaToken(dati.token);
        applicaProfilo(dati.giocatore);
        disegnaAccount();
        messaggioAccount('Accesso eseguito come ' + dati.giocatore.nick + '.', 'ok');
    } catch (errore) {
        messaggioAccount(errore.message, 'errore');
    }
}

/** Esce dall'account: avvisa il server e dimentica il token. */
async function esciAccount() {
    try {
        await api.chiama('/api/uscita', { corpo: {} });
    } catch (errore) {
        // il token era già scaduto: va bene lo stesso
    }
    api.dimenticaToken();
    statoAccount.dentro = false;
    statoAccount.nick = null;
    statoAccount.punti = 0;
    statoAccount.elo = 1000;
    statoAccount.lottatori = [];
    disegnaAccount();
    messaggioAccount('Sei uscito dal tuo account.', 'ok');
}

/** Rilegge il profilo dal server (dopo un acquisto, per esempio). */
async function aggiornaProfilo(ridisegna) {
    if (!api.haToken()) return false;
    try {
        const profilo = await api.chiama('/api/profilo');
        applicaProfilo(profilo);
        if (ridisegna) disegnaAccount();
        return true;
    } catch (errore) {
        statoAccount.dentro = false;
        return false;
    }
}

/** Copia i dati del server nello stato locale. */
function applicaProfilo(profilo) {
    statoAccount.dentro = true;
    statoAccount.nick = profilo.nick;
    statoAccount.punti = profilo.punti;
    statoAccount.elo = profilo.elo;
    statoAccount.lottatori = profilo.personaggi || [];
}

/** All'avvio: se c'è un token salvato si prova a riprendere la sessione. */
async function riprendiSessione() {
    if (!api.haToken()) return;
    await aggiornaProfilo(false);
}
