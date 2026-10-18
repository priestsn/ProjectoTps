// ========================================
// Amici: richieste, accettazione, rimozione
// ==========================================
// Le amicizie sono simmetriche e vivono in un file a parte
// (dati/runtime/amici.json): così una richiesta non tocca mai il file dei
// giocatori, che contiene gli hash delle password.
//
// Regole:
// - non ci si può aggiungere da soli;
// - se la richiesta opposta è già in attesa, si diventa amici subito;
// - due richieste identiche non si duplicano;
// - un giocatore non può avere più di 100 amici né 20 richieste in uscita.

const { accoda } = require('./dati.js');

const MASSIMO_AMICI = 100;
const MASSIMO_RICHIESTE = 20;
const MASSIMO_RISULTATI_RICERCA = 10;

/** Stato delle amicizie, sempre con array validi. */
function leggiStato(magazzino) {
    const stato = magazzino.leggi('amici.json', { versione: 1, amicizie: [], richieste: [] });
    if (!Array.isArray(stato.amicizie)) stato.amicizie = [];
    if (!Array.isArray(stato.richieste)) stato.richieste = [];
    return stato;
}

/** Normalizza un nickname per i confronti. */
function normalizza(nick) {
    return String(nick || '').trim().toLowerCase();
}

/** Il giocatore con quel nickname, oppure null. */
function trovaGiocatore(giocatori, nick) {
    const cercato = normalizza(nick);
    if (!cercato) return null;
    return giocatori.find((g) => g.nickNormalizzato === cercato) || null;
}

/** True se i due sono già amici. */
function sonoAmici(stato, uno, altro) {
    return stato.amicizie.some((amicizia) =>
        (amicizia.a === uno && amicizia.b === altro) || (amicizia.a === altro && amicizia.b === uno));
}

/** La richiesta in attesa fra due giocatori, se esiste. */
function richiestaFra(stato, da, a) {
    return stato.richieste.find((richiesta) => richiesta.da === da && richiesta.a === a) || null;
}

/** Quante richieste ha mandato un giocatore. */
function richiesteInviate(stato, giocatore) {
    return stato.richieste.filter((richiesta) => richiesta.da === giocatore).length;
}

/** Aggiunge l'amicizia nelle due direzioni, in un solo posto. */
function creaAmicizia(stato, uno, altro) {
    stato.amicizie.push({ a: uno, b: altro, quando: new Date().toISOString() });
}

/** Toglie l'eventuale richiesta fra i due. */
function togliRichiesta(stato, da, a) {
    stato.richieste = stato.richieste.filter((richiesta) => !(richiesta.da === da && richiesta.a === a));
}

/** Il nickname di un giocatore per id, con un segnaposto se l'account non c'è più. */
function nickPerId(giocatori, id) {
    const giocatore = giocatori.find((g) => g.id === id);
    return giocatore ? giocatore.nick : '(account rimosso)';
}

/**
 * Elenco completo per la schermata amici: amici, richieste ricevute e inviate.
 */
function elenco(magazzino, giocatore, giocatori) {
    const stato = leggiStato(magazzino);

    const amici = stato.amicizie
        .filter((amicizia) => amicizia.a === giocatore.id || amicizia.b === giocatore.id)
        .map((amicizia) => {
            const idAltro = amicizia.a === giocatore.id ? amicizia.b : amicizia.a;
            return { nick: nickPerId(giocatori, idAltro), dal: amicizia.quando };
        });

    const ricevute = stato.richieste
        .filter((richiesta) => richiesta.a === giocatore.id)
        .map((richiesta) => ({ nick: nickPerId(giocatori, richiesta.da), quando: richiesta.quando }));

    const inviate = stato.richieste
        .filter((richiesta) => richiesta.da === giocatore.id)
        .map((richiesta) => ({ nick: nickPerId(giocatori, richiesta.a), quando: richiesta.quando }));

    return { amici: amici, ricevute: ricevute, inviate: inviate };
}

/**
 * Ricerca per nickname: cerca anche nei nomi parziali, così si trova un amico
 * senza ricordarselo per intero.
 */
function cerca(magazzino, giocatore, giocatori, nick) {
    const cercato = normalizza(nick);
    if (cercato.length < 2) {
        return { ok: false, stato: 400, messaggio: 'Scrivi almeno due lettere del nickname.' };
    }

    const stato = leggiStato(magazzino);
    const trovati = [];

    for (const altro of giocatori) {
        if (altro.nickNormalizzato.indexOf(cercato) === -1) continue;
        if (trovati.length >= MASSIMO_RISULTATI_RICERCA) break;

        let relazione = 'nessuna';
        if (altro.id === giocatore.id) relazione = 'me';
        else if (sonoAmici(stato, giocatore.id, altro.id)) relazione = 'amico';
        else if (richiestaFra(stato, altro.id, giocatore.id)) relazione = 'richiestaRicevuta';
        else if (richiestaFra(stato, giocatore.id, altro.id)) relazione = 'richiestaInviata';

        trovati.push({ nick: altro.nick, relazione: relazione });
    }

    return { ok: true, risultati: trovati };
}

/**
 * Manda una richiesta di amicizia.
 * Se l'altro ce l'aveva già mandata a noi, si diventa amici senza altri passaggi.
 */
function chiedi(magazzino, giocatore, giocatori, nick) {
    const altro = trovaGiocatore(giocatori, nick);
    if (!altro) return { ok: false, stato: 404, messaggio: 'Nessun giocatore con questo nickname.' };
    if (altro.id === giocatore.id) return { ok: false, stato: 400, messaggio: 'Non puoi aggiungere te stesso.' };

    const stato = leggiStato(magazzino);

    if (sonoAmici(stato, giocatore.id, altro.id)) {
        return { ok: false, stato: 409, messaggio: 'Siete già amici.' };
    }

    // L'altro ci aveva già chiesto l'amicizia: la richiesta opposta vale come
    // accettazione, senza farlo aspettare un secondo passaggio.
    if (richiestaFra(stato, altro.id, giocatore.id)) {
        togliRichiesta(stato, altro.id, giocatore.id);
        creaAmicizia(stato, giocatore.id, altro.id);
        magazzino.scrivi('amici.json', stato);
        accoda(magazzino.percorso('amici.jsonl'), {
            evento: 'amicizia',
            a: giocatore.nick,
            b: altro.nick,
            quando: new Date().toISOString()
        });
        return { ok: true, accettata: true, messaggio: 'Ora siete amici.' };
    }

    if (richiestaFra(stato, giocatore.id, altro.id)) {
        return { ok: false, stato: 409, messaggio: 'Richiesta già inviata: aspetta che risponda.' };
    }

    if (richiesteInviate(stato, giocatore.id) >= MASSIMO_RICHIESTE) {
        return { ok: false, stato: 429, messaggio: 'Hai troppe richieste in attesa. Aspetta una risposta.' };
    }

    stato.richieste.push({
        da: giocatore.id,
        a: altro.id,
        quando: new Date().toISOString()
    });
    magazzino.scrivi('amici.json', stato);
    accoda(magazzino.percorso('amici.jsonl'), {
        evento: 'richiesta',
        da: giocatore.nick,
        a: altro.nick,
        quando: new Date().toISOString()
    });

    return { ok: true, accettata: false, messaggio: 'Richiesta inviata a ' + altro.nick + '.' };
}

/** Accetta una richiesta ricevuta. */
function accetta(magazzino, giocatore, giocatori, nick) {
    const altro = trovaGiocatore(giocatori, nick);
    if (!altro) return { ok: false, stato: 404, messaggio: 'Nessun giocatore con questo nickname.' };

    const stato = leggiStato(magazzino);

    if (sonoAmici(stato, giocatore.id, altro.id)) {
        return { ok: false, stato: 409, messaggio: 'Siete già amici.' };
    }

    if (!richiestaFra(stato, altro.id, giocatore.id)) {
        return { ok: false, stato: 404, messaggio: 'Nessuna richiesta in attesa da ' + altro.nick + '.' };
    }

    const amiciAttuali = stato.amicizie.filter((amicizia) =>
        amicizia.a === giocatore.id || amicizia.b === giocatore.id).length;
    if (amiciAttuali >= MASSIMO_AMICI) {
        return { ok: false, stato: 429, messaggio: 'Hai raggiunto il massimo di ' + MASSIMO_AMICI + ' amici.' };
    }

    togliRichiesta(stato, altro.id, giocatore.id);
    creaAmicizia(stato, giocatore.id, altro.id);
    magazzino.scrivi('amici.json', stato);
    accoda(magazzino.percorso('amici.jsonl'), {
        evento: 'amicizia',
        a: giocatore.nick,
        b: altro.nick,
        quando: new Date().toISOString()
    });

    return { ok: true, messaggio: 'Ora sei amico di ' + altro.nick + '.' };
}

/** Rifiuta una richiesta ricevuta: sparisce senza avvisare l'altro. */
function rifiuta(magazzino, giocatore, giocatori, nick) {
    const altro = trovaGiocatore(giocatori, nick);
    if (!altro) return { ok: false, stato: 404, messaggio: 'Nessun giocatore con questo nickname.' };

    const stato = leggiStato(magazzino);
    if (!richiestaFra(stato, altro.id, giocatore.id)) {
        return { ok: false, stato: 404, messaggio: 'Nessuna richiesta in attesa da ' + altro.nick + '.' };
    }

    togliRichiesta(stato, altro.id, giocatore.id);
    magazzino.scrivi('amici.json', stato);
    accoda(magazzino.percorso('amici.jsonl'), {
        evento: 'rifiuto',
        da: giocatore.nick,
        di: altro.nick,
        quando: new Date().toISOString()
    });

    return { ok: true, messaggio: 'Richiesta di ' + altro.nick + ' rifiutata.' };
}

/** Toglie un amico: l'amicizia sparisce per entrambi. */
function rimuovi(magazzino, giocatore, giocatori, nick) {
    const altro = trovaGiocatore(giocatori, nick);
    if (!altro) return { ok: false, stato: 404, messaggio: 'Nessun giocatore con questo nickname.' };

    const stato = leggiStato(magazzino);
    if (!sonoAmici(stato, giocatore.id, altro.id)) {
        return { ok: false, stato: 404, messaggio: altro.nick + ' non è fra i tuoi amici.' };
    }

    stato.amicizie = stato.amicizie.filter((amicizia) =>
        !((amicizia.a === giocatore.id && amicizia.b === altro.id) ||
            (amicizia.a === altro.id && amicizia.b === giocatore.id)));
    magazzino.scrivi('amici.json', stato);
    accoda(magazzino.percorso('amici.jsonl'), {
        evento: 'rimozione',
        da: giocatore.nick,
        di: altro.nick,
        quando: new Date().toISOString()
    });

    return { ok: true, messaggio: altro.nick + ' rimosso dagli amici.' };
}

module.exports = {
    elenco, cerca, chiedi, accetta, rifiuta, rimuovi,
    MASSIMO_AMICI, MASSIMO_RICHIESTE, MASSIMO_RISULTATI_RICERCA
};
