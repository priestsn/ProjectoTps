// ========================================
// Coda ranked: trovare un avversario
// ==========================================
// Chi entra in coda resta in attesa finché non arriva qualcuno con un ELO
// vicino al suo. La finestra si allarga con l'attesa: prima si accetta solo
// chi è a 300 punti, poi 600, poi 1000, così una coda semivuota non blocca
// nessuno per sempre.
//
// Il primo che aspettava fa da padrone della stanza: è lui che crea la partita
// sul server e che alla fine comunica l'esito (l'ELO viene aggiornato a
// entrambi da /api/partita/concludi).

const crypto = require('crypto');

const ATTESA_MASSIMA_SECONDI = 120;
// Dopo quanti secondi di coda si passa al bot Guissè (server/bot.js)
const BOT_DOPO_SECONDI = 8;
const FASCE = [
    { entroSecondi: 10, differenza: 300 },
    { entroSecondi: 20, differenza: 600 },
    { entroSecondi: 600, differenza: 1000 }
];

/** Differenza di ELO accettata dopo una certa attesa. */
function finestra(attesaSecondi) {
    for (const fascia of FASCE) {
        if (attesaSecondi <= fascia.entroSecondi) return fascia.differenza;
    }
    return FASCE[FASCE.length - 1].differenza;
}

/** Quanti secondi aspetta un giocatore in coda. */
function attesaDi(voce, adesso) {
    return Math.max(0, Math.floor(((adesso || Date.now()) - voce.entrato) / 1000));
}

/** True se due giocatori in coda possono affrontarsi. */
function compatibile(uno, altro, adesso) {
    if (uno.giocatore === altro.giocatore) return false;
    const differenza = Math.abs((uno.elo || 0) - (altro.elo || 0));
    // Conta la finestra più larga fra i due: chi aspetta da più tempo allarga
    // la ricerca anche per l'altro.
    const larga = Math.max(finestra(attesaDi(uno, adesso)), finestra(attesaDi(altro, adesso)));
    return differenza <= larga;
}

/**
 * Il candidato migliore per me: fra tutti i compatibili, quello con l'ELO più
 * vicino (a parità, chi aspetta da più tempo).
 */
function scegliAvversario(inAttesa, io, adesso) {
    const candidati = inAttesa.filter((voce) => compatibile(voce, io, adesso));

    if (!candidati.length) return null;

    candidati.sort((uno, altro) => {
        const distanzaUno = Math.abs((uno.elo || 0) - (io.elo || 0));
        const distanzaAltro = Math.abs((altro.elo || 0) - (io.elo || 0));
        if (distanzaUno !== distanzaAltro) return distanzaUno - distanzaAltro;
        return uno.entrato - altro.entrato;
    });

    return candidati[0];
}

/** Stato della coda, sempre con gli array validi. */
function leggiStato(magazzino) {
    const stato = magazzino.leggi('coda.json', { versione: 1, inAttesa: [], abbinamenti: {} });
    if (!Array.isArray(stato.inAttesa)) stato.inAttesa = [];
    if (!stato.abbinamenti || typeof stato.abbinamenti !== 'object') stato.abbinamenti = {};
    return stato;
}

/** Toglie dalla coda chi aspetta da troppo tempo (o chi non c'è più). */
function pulisci(stato, adesso) {
    stato.inAttesa = stato.inAttesa.filter((voce) => attesaDi(voce, adesso) <= ATTESA_MASSIMA_SECONDI);

    // Gli abbinamenti servono solo per pochi minuti: dopo, la partita è scaduta
    // comunque e il codice della stanza non serve più a nessuno.
    for (const [id, abbinamento] of Object.entries(stato.abbinamenti)) {
        if (adesso - abbinamento.creato > 5 * 60000) delete stato.abbinamenti[id];
    }
}

/** Toglie un giocatore dalla coda, se c'è. */
function togliDallaCoda(stato, idGiocatore) {
    stato.inAttesa = stato.inAttesa.filter((voce) => voce.giocatore !== idGiocatore);
}

/**
 * Entra in coda. Restituisce:
 * - { stato: 'abbinato', ruolo, avversario, partitaId }
 * - { stato: 'inAttesa', posizione, inCoda, attesaSecondi, finestra }
 */
function entra(magazzino, giocatore, partite) {
    const adesso = Date.now();
    const stato = leggiStato(magazzino);
    pulisci(stato, adesso);

    // Chi rientra non deve comparire due volte.
    togliDallaCoda(stato, giocatore.id);

    const io = { giocatore: giocatore.id, nick: giocatore.nick, elo: giocatore.elo || 1000, entrato: adesso };
    const avversario = scegliAvversario(stato.inAttesa, io, adesso);

    if (!avversario) {
        stato.inAttesa.push(io);
        magazzino.scrivi('coda.json', stato);
        return {
            ok: true,
            stato: 'inAttesa',
            posizione: stato.inAttesa.length,
            inCoda: stato.inAttesa.length,
            attesaSecondi: 0,
            finestra: finestra(0)
        };
    }

    // Il primo che aspettava fa da padrone: la partita la apre lui.
    const padrone = avversario.entrato <= io.entrato ? avversario : io;
    const ospite = padrone === io ? avversario : io;

    const padroneGiocatore = padrone.giocatore === giocatore.id
        ? giocatore
        : { id: padrone.giocatore, nick: padrone.nick };

    // Serve il giocatore vero per aprire la partita: se il padrone non sono io,
    // la sua partita la apro con i dati che ho in coda.
    const esitoPartita = partite.avviaPartita(magazzino, padroneGiocatore, {
        modo: 'ranked',
        avversario: ospite.nick
    });

    if (!esitoPartita.ok) {
        // Se non si riesce ad aprire la partita, nessuno resta bloccato: si
        // torna in attesa con un messaggio chiaro.
        rimettiInCoda(stato, io, magazzino);
        return { ok: false, stato: 500, messaggio: esitoPartita.messaggio || 'Abbinamento non riuscito.' };
    }

    togliDallaCoda(stato, padrone.giocatore);
    togliDallaCoda(stato, ospite.giocatore);

    stato.abbinamenti[padrone.giocatore] = {
        partitaId: esitoPartita.partitaId,
        ruolo: 'padrone',
        avversario: ospite.nick,
        creato: adesso,
        consegnato: false
    };
    stato.abbinamenti[ospite.giocatore] = {
        partitaId: esitoPartita.partitaId,
        ruolo: 'ospite',
        avversario: padrone.nick,
        creato: adesso,
        consegnato: false
    };

    magazzino.scrivi('coda.json', stato);

    return {
        ok: true,
        stato: 'abbinato',
        ruolo: padrone === io ? 'padrone' : 'ospite',
        avversario: padrone === io ? ospite.nick : padrone.nick,
        partitaId: esitoPartita.partitaId
    };
}

/** Rimette in coda senza far danni (usata quando l'abbinamento non riesce). */
function rimettiInCoda(stato, io, magazzino) {
    togliDallaCoda(stato, io.giocatore);
    stato.inAttesa.push(io);
    magazzino.scrivi('coda.json', stato);
}

/**
 * Stato per chi sta aspettando. L'abbinamento si consegna una volta sola
 * (campo `consegnato`), così il client non avvia due volte la stessa partita;
 * la voce resta nel file per poter ricevere il codice della stanza.
 */
/**
 * Apre una partita ranked contro Guissè e toglie il giocatore dalla coda.
 * Restituisce { partitaId, avversario, elo } oppure null se non si può.
 */
function abbinaAlBot(magazzino, giocatore, stato) {
    // require dentro la funzione: allo spegnimento dei moduli api.js -> coda.js
    // -> partite.js -> bot.js l'ordine non è garantito.
    const bot = require('./bot.js');
    const partite = require('./partite.js');

    const record = bot.assicura(magazzino);
    const esito = partite.avviaPartita(magazzino, giocatore, {
        modo: 'ranked',
        avversario: record.nick
    });

    if (!esito || !esito.ok) return null;

    togliDallaCoda(stato, giocatore.id);
    stato.abbinamenti[giocatore.id] = {
        creato: Date.now(),
        consegnato: false,
        ruolo: 'padrone',
        avversario: record.nick,
        bot: true,
        eloAvversario: record.elo,
        partitaId: esito.partitaId
    };
    magazzino.scrivi('coda.json', stato);

    return { partitaId: esito.partitaId, avversario: record.nick, elo: record.elo };
}

function statoCoda(magazzino, giocatore) {
    const adesso = Date.now();
    const stato = leggiStato(magazzino);
    pulisci(stato, adesso);

    const abbinamento = stato.abbinamenti[giocatore.id];

    if (abbinamento && !abbinamento.consegnato && adesso - abbinamento.creato <= ATTESA_MASSIMA_SECONDI * 1000) {
        abbinamento.consegnato = true;
        magazzino.scrivi('coda.json', stato);
        return {
            ok: true,
            stato: 'abbinato',
            ruolo: abbinamento.ruolo,
            avversario: abbinamento.avversario,
            // `bot` deve viaggiare anche qui: se manca, il client tratta
            // l'abbinamento con Guissè come una stanza fra umani e resta in
            // attesa di un codice che non arriverà mai.
            bot: abbinamento.bot === true,
            eloAvversario: abbinamento.eloAvversario || null,
            partitaId: abbinamento.partitaId
        };
    }

    const mia = stato.inAttesa.find((voce) => voce.giocatore === giocatore.id);
    magazzino.scrivi('coda.json', stato);

    if (!mia) {
        return { ok: true, stato: 'fuori', inCoda: stato.inAttesa.length };
    }

    const attesa = attesaDi(mia, adesso);

    // Nessun umano trovato da un po': si gioca contro Guissè. La partita
    // ranked viene aperta qui sul server, quindi l'esito aggiorna l'ELO di
    // entrambi esattamente come in una sfida fra due persone.
    if (attesa >= BOT_DOPO_SECONDI) {
        const abbinamento = abbinaAlBot(magazzino, giocatore, stato);
        if (abbinamento) {
            return {
                ok: true,
                stato: 'abbinato',
                ruolo: 'padrone',
                avversario: abbinamento.avversario,
                bot: true,
                eloAvversario: abbinamento.elo,
                partitaId: abbinamento.partitaId
            };
        }
    }

    return {
        ok: true,
        stato: 'inAttesa',
        posizione: stato.inAttesa.findIndex((voce) => voce.giocatore === giocatore.id) + 1,
        inCoda: stato.inAttesa.length,
        attesaSecondi: attesa,
        finestra: finestra(attesa)
    };
}

/** Esce dalla coda e dimentica l'abbinamento. */
function esci(magazzino, giocatore) {
    const stato = leggiStato(magazzino);
    togliDallaCoda(stato, giocatore.id);
    delete stato.abbinamenti[giocatore.id];
    magazzino.scrivi('coda.json', stato);
    return { ok: true, stato: 'fuori' };
}

/**
 * Il padrone comunica il codice della stanza creata, così l'ospite può entrare
 * da solo senza digitare niente.
 */
function consegnaCodice(magazzino, giocatore, codice) {
    const pulito = String(codice || '').trim().toUpperCase();
    if (pulito.length !== 4) {
        return { ok: false, stato: 400, messaggio: 'Il codice della stanza ha 4 caratteri.' };
    }

    const stato = leggiStato(magazzino);
    const mio = stato.abbinamenti[giocatore.id];

    if (!mio || mio.ruolo !== 'padrone') {
        return { ok: false, stato: 409, messaggio: 'Nessun abbinamento da padrone in corso.' };
    }

    stato.codici = stato.codici || {};
    stato.codici[mio.partitaId] = { codice: pulito, quando: Date.now() };
    magazzino.scrivi('coda.json', stato);

    return { ok: true, messaggio: 'Codice consegnato all\'avversario.', codice: pulito };
}

/** L'ospite legge il codice della stanza, se il padrone l'ha già creato. */
function codiceDisponibile(magazzino, giocatore) {
    const stato = leggiStato(magazzino);
    const mio = stato.abbinamenti[giocatore.id];

    if (!mio) {
        return { ok: true, stato: 'nessuno' };
    }

    const voce = (stato.codici || {})[mio.partitaId];
    if (!voce) {
        return { ok: true, stato: 'attesa', partitaId: mio.partitaId, ruolo: mio.ruolo };
    }

    return { ok: true, stato: 'pronto', codice: voce.codice, partitaId: mio.partitaId, ruolo: mio.ruolo };
}

module.exports = {
    entra, statoCoda, esci, consegnaCodice, codiceDisponibile,
    finestra, compatibile, scegliAvversario, attesaDi,
    ATTESA_MASSIMA_SECONDI
};
