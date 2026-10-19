// ========================================
// Classifica: i primi della ranked
// ==========================================
// La classifica è pubblica: si guarda anche senza account. Il proprio nick
// resta evidenziato quando si è collegati.
//
// Chi è "provvisorio" ha giocato meno di dieci partite ranked: l'ELO c'è, ma
// non è ancora una misura affidabile.

/** Apre la schermata classifica e la riempie. */
async function apriClassifica() {
    cambiaStato(STATI.CLASSIFICA);
    disegnaClassifica([], '', 'Caricamento…');
    await aggiornaClassifica();
}

/** Elemento con classe e testo. */
function classificaCrea(tag, classe, testo) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (testo !== undefined && testo !== null) elemento.textContent = testo;
    return elemento;
}

/** Rilegge la classifica dal server. */
async function aggiornaClassifica() {
    try {
        const dati = await api.chiama('/api/classifica');
        disegnaClassifica(dati.classifica || [], '', '');
    } catch (errore) {
        disegnaClassifica([], errore.message, 'errore');
    }
}

/** Disegna la tabella della classifica. */
function disegnaClassifica(voci, messaggio, tipo) {
    const contenitore = document.querySelector('#classifica');
    if (!contenitore) return;

    contenitore.innerHTML = '';
    contenitore.appendChild(classificaCrea('div', 'classifica-titolo', 'CLASSIFICA'));
    contenitore.appendChild(classificaCrea('div', 'classifica-nota',
        'Ordinata per ELO. I provvisori hanno giocato meno di dieci partite ranked.'));

    const tabella = classificaCrea('div', 'classifica-tabella');

    const intestazione = classificaCrea('div', 'classifica-riga intestazione');
    intestazione.append(
        classificaCrea('span', 'classifica-pos', '#'),
        classificaCrea('span', 'classifica-nick', 'Giocatore'),
        classificaCrea('span', 'classifica-numero', 'ELO'),
        classificaCrea('span', 'classifica-numero', 'Partite'),
        classificaCrea('span', 'classifica-numero', 'V/S')
    );
    tabella.appendChild(intestazione);

    if (!voci.length) {
        tabella.appendChild(classificaCrea('div', 'classifica-vuota',
            'Nessuna partita ranked registrata finora.'));
    }

    for (const voce of voci) {
        const mia = statoAccount.dentro && statoAccount.nick &&
            voce.nick.toLowerCase() === String(statoAccount.nick).toLowerCase();

        const riga = classificaCrea('div', 'classifica-riga' + (mia ? ' mia' : '') + (voce.provvisorio ? ' provvisoria' : ''));

        const cellaNick = classificaCrea('span', 'classifica-nick');
        cellaNick.appendChild(document.createTextNode(voce.nick + (voce.provvisorio ? ' ·' : ' ')));
        const distintivo = classificaCrea('span', 'lega-badge piccolo', voce.lega || '');
        distintivo.style.color = voce.legaColore || '#9a9a9a';
        distintivo.style.borderColor = voce.legaColore || '#9a9a9a';
        cellaNick.appendChild(distintivo);

        riga.append(
            classificaCrea('span', 'classifica-pos', String(voce.posizione)),
            cellaNick,
            classificaCrea('span', 'classifica-numero', String(voce.elo)),
            classificaCrea('span', 'classifica-numero', String(voce.partite)),
            classificaCrea('span', 'classifica-numero', voce.vittorie + '/' + voce.sconfitte)
        );
        tabella.appendChild(riga);
    }

    contenitore.appendChild(tabella);

    const stato = classificaCrea('div', 'account-stato' + (tipo ? ' ' + tipo : ''), messaggio || '');
    stato.id = 'classificaStato';
    contenitore.appendChild(stato);

    const aggiorna = classificaCrea('button', 'account-bottone secondario', 'AGGIORNA');
    aggiorna.addEventListener('click', () => aggiornaClassifica());

    const indietro = classificaCrea('button', 'account-bottone secondario', 'INDIETRO');
    indietro.addEventListener('click', () => apriMenu('principale'));

    contenitore.append(aggiorna, indietro);
}
