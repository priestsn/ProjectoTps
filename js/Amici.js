// ========================================
// Amici: ricerca, richieste, elenco
// ==========================================
// Tutto passa dal server: qui si disegna e si mandano le intenzioni. Le regole
// (doppie richieste, richiesta incrociata, massimo di amici) stanno in
// server/amici.js, così il browser non può aggirarle.

/** Apre la schermata amici: senza account non c'è niente da mostrare. */
async function apriAmici() {
    if (!statoAccount.dentro) {
        apriAccount();
        messaggioAccount('Per gli amici serve un account: accedi o crealo qui sopra.', 'errore');
        return;
    }

    cambiaStato(STATI.AMICI);
    disegnaAmici({}, '');
    await aggiornaAmici();
}

/** Elemento con classe e testo, come negli altri moduli. */
function amiciCrea(tag, classe, testo) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (testo !== undefined && testo !== null) elemento.textContent = testo;
    return elemento;
}

/** Rilegge amici e richieste dal server e ridisegna. */
async function aggiornaAmici() {
    try {
        const dati = await api.chiama('/api/amici');
        disegnaAmici(dati, '');
    } catch (errore) {
        disegnaAmici({}, errore.message, 'errore');
    }
}

/**
 * Disegna la schermata.
 * `dati` ha la forma { amici: [], ricevute: [], inviate: [] }.
 */
function disegnaAmici(dati, messaggio, tipo) {
    const contenitore = document.querySelector('#amici');
    if (!contenitore) return;

    const ricerca = document.querySelector('#amiciRicerca');
    const testoRicerca = ricerca ? ricerca.value : '';

    contenitore.innerHTML = '';
    contenitore.appendChild(amiciCrea('div', 'amici-titolo', 'AMICI'));

    // --- ricerca -----------------------------------------------------------
    const bloccoRicerca = amiciCrea('div', 'amici-blocco');
    bloccoRicerca.appendChild(amiciCrea('div', 'amici-sottotitolo', 'Cerca un giocatore'));

    const rigaRicerca = amiciCrea('div', 'amici-riga');
    const campo = amiciCrea('input', 'account-campo');
    campo.id = 'amiciRicerca';
    campo.type = 'text';
    campo.spellcheck = false;
    campo.placeholder = 'Nickname (anche parziale)';
    campo.value = testoRicerca;
    campo.setAttribute('aria-label', 'Nickname da cercare');

    const bottoneCerca = amiciCrea('button', 'account-bottone', 'CERCA');
    bottoneCerca.addEventListener('click', () => cercaAmici());

    rigaRicerca.append(campo, bottoneCerca);
    bloccoRicerca.appendChild(rigaRicerca);

    const risultati = amiciCrea('div', 'amici-risultati');
    risultati.id = 'amiciRisultati';
    bloccoRicerca.appendChild(risultati);
    contenitore.appendChild(bloccoRicerca);

    // --- richieste ricevute ------------------------------------------------
    if (dati.ricevute && dati.ricevute.length) {
        const blocco = amiciCrea('div', 'amici-blocco');
        blocco.appendChild(amiciCrea('div', 'amici-sottotitolo',
            'Richieste ricevute (' + dati.ricevute.length + ')'));

        for (const richiesta of dati.ricevute) {
            blocco.appendChild(rigaAmico(richiesta.nick, [
                { testo: 'ACCETTA', azione: () => rispondiRichiesta('accetta', richiesta.nick) },
                { testo: 'RIFIUTA', secondario: true, azione: () => rispondiRichiesta('rifiuta', richiesta.nick) }
            ]));
        }
        contenitore.appendChild(blocco);
    }

    // --- amici -------------------------------------------------------------
    const bloccoAmici = amiciCrea('div', 'amici-blocco');
    const quanti = dati.amici ? dati.amici.length : 0;
    bloccoAmici.appendChild(amiciCrea('div', 'amici-sottotitolo', 'I tuoi amici (' + quanti + ')'));

    if (!quanti) {
        bloccoAmici.appendChild(amiciCrea('div', 'amici-vuoto',
            'Nessun amico per ora: cerca un nickname qui sopra e manda la richiesta.'));
    } else {
        for (const amico of dati.amici) {
            bloccoAmici.appendChild(rigaAmico(amico.nick, [
                { testo: 'RIMUOVI', secondario: true, azione: () => rimuoviAmico(amico.nick) }
            ]));
        }
    }
    contenitore.appendChild(bloccoAmici);

    // --- richieste inviate -------------------------------------------------
    if (dati.inviate && dati.inviate.length) {
        const blocco = amiciCrea('div', 'amici-blocco');
        blocco.appendChild(amiciCrea('div', 'amici-sottotitolo',
            'Richieste in attesa (' + dati.inviate.length + ')'));
        for (const inviata of dati.inviate) {
            blocco.appendChild(rigaAmico(inviata.nick, []));
        }
        contenitore.appendChild(blocco);
    }

    const stato = amiciCrea('div', 'account-stato' + (tipo ? ' ' + tipo : ''), messaggio || '');
    stato.id = 'amiciStato';
    contenitore.appendChild(stato);

    const indietro = amiciCrea('button', 'account-bottone secondario', 'INDIETRO');
    indietro.addEventListener('click', () => apriMenu('principale'));
    contenitore.appendChild(indietro);

    // Il campo di ricerca si riprende il fuoco dopo un ridisegno
    if (testoRicerca) campo.focus();
}

/** Una riga con nickname e pulsanti. */
function rigaAmico(nick, pulsanti) {
    const riga = amiciCrea('div', 'amici-riga-amico');
    riga.appendChild(amiciCrea('span', 'amici-nome', nick));

    const azioni = amiciCrea('span', 'amici-azioni');
    for (const pulsante of pulsanti) {
        const bottone = amiciCrea('button',
            'account-bottone' + (pulsante.secondario ? ' secondario' : '') + ' piccolo', pulsante.testo);
        bottone.addEventListener('click', pulsante.azione);
        azioni.appendChild(bottone);
    }
    riga.appendChild(azioni);
    return riga;
}

/** Messaggio sotto l'elenco. */
function messaggioAmici(testo, tipo) {
    const riga = document.querySelector('#amiciStato');
    if (!riga) return;
    riga.textContent = testo || '';
    riga.className = 'account-stato' + (tipo ? ' ' + tipo : '');
}

/** Cerca e mostra i risultati con il pulsante giusto per ogni relazione. */
async function cercaAmici() {
    const campo = document.querySelector('#amiciRicerca');
    if (!campo) return;

    const nick = campo.value.trim();
    if (nick.length < 2) {
        messaggioAmici('Scrivi almeno due lettere del nickname.', 'errore');
        return;
    }

    messaggioAmici('Ricerca in corso…', 'attesa');
    try {
        const dati = await api.chiama('/api/amici/cerca', { corpo: { nick: nick } });
        const zona = document.querySelector('#amiciRisultati');
        if (!zona) return;
        zona.innerHTML = '';

        if (!dati.risultati.length) {
            zona.appendChild(amiciCrea('div', 'amici-vuoto', 'Nessun giocatore trovato.'));
        }

        for (const risultato of dati.risultati) {
            const pulsanti = [];
            if (risultato.relazione === 'nessuna') {
                pulsanti.push({ testo: 'CHIEDI', azione: () => chiediAmico(risultato.nick) });
            } else if (risultato.relazione === 'richiestaRicevuta') {
                pulsanti.push({ testo: 'ACCETTA', azione: () => rispondiRichiesta('accetta', risultato.nick) });
                pulsanti.push({ testo: 'RIFIUTA', secondario: true, azione: () => rispondiRichiesta('rifiuta', risultato.nick) });
            }

            const riga = rigaAmico(risultato.nick, pulsanti);
            riga.appendChild(amiciCrea('span', 'amici-relazione', etichettaRelazione(risultato.relazione)));
            zona.appendChild(riga);
        }

        messaggioAmici(dati.risultati.length + ' risultati.', '');
    } catch (errore) {
        messaggioAmici(errore.message, 'errore');
    }
}

/** Come si chiama la relazione a schermo. */
function etichettaRelazione(relazione) {
    if (relazione === 'me') return 'sei tu';
    if (relazione === 'amico') return 'già amico';
    if (relazione === 'richiestaInviata') return 'richiesta inviata';
    if (relazione === 'richiestaRicevuta') return 'ti ha chiesto l\'amicizia';
    return '';
}

/** Manda una richiesta di amicizia. */
async function chiediAmico(nick) {
    messaggioAmici('Invio della richiesta…', 'attesa');
    try {
        const esito = await api.chiama('/api/amici/chiedi', { corpo: { nick: nick } });
        await aggiornaAmici();
        messaggioAmici(esito.messaggio, 'ok');
        if (esito.accettata) await cercaAmici();
    } catch (errore) {
        messaggioAmici(errore.message, 'errore');
    }
}

/** Accetta o rifiuta una richiesta ricevuta. */
async function rispondiRichiesta(azione, nick) {
    messaggioAmici('Aggiornamento…', 'attesa');
    try {
        const esito = await api.chiama('/api/amici/' + azione, { corpo: { nick: nick } });
        await aggiornaAmici();
        messaggioAmici(esito.messaggio, 'ok');
    } catch (errore) {
        messaggioAmici(errore.message, 'errore');
    }
}

/** Toglie un amico. */
async function rimuoviAmico(nick) {
    messaggioAmici('Rimozione…', 'attesa');
    try {
        const esito = await api.chiama('/api/amici/rimuovi', { corpo: { nick: nick } });
        await aggiornaAmici();
        messaggioAmici(esito.messaggio, 'ok');
    } catch (errore) {
        messaggioAmici(errore.message, 'errore');
    }
}
