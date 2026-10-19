// ========================================
// Account, sessioni e negozio
// ==========================================
// Tutto qui dentro parla solo di dati: nessuna riga conosce HTTP o WebSocket.
// Le password non si salvano mai: si salva il risultato di scrypt con un sale
// diverso per ogni giocatore, e il confronto avviene in tempo costante.

const crypto = require('crypto');
const path = require('path');
const { leggi } = require('./dati.js');
const leghe = require('./leghe.js');

const RADICE = path.resolve(__dirname, '..');

const REGOLE = leggi(path.join(RADICE, 'dati', 'regole.json'), {
    account: { nickMinimo: 3, nickMassimo: 16, passwordMinima: 10, puntiIniziali: 500, durataSessioneOre: 168 },
    elo: { iniziale: 1000, k: 32, minimo: 100 },
    paroleBloccate: [],
    admin: { nickIniziali: [] }
});

const NEGOZIO = leggi(path.join(RADICE, 'dati', 'negozio.json'), { voci: [] });

const IMPOSTAZIONI_SCRYPT = { N: 16384, r: 8, p: 1 };

/** Le regole del gioco, così chi ne ha bisogno non rilegge il file. */
function regole() {
    return REGOLE;
}

/** Il catalogo del negozio. */
function negozio() {
    return NEGOZIO;
}

/** Lottatori che si hanno appena creato l'account. */
function personaggiIniziali() {
    return NEGOZIO.voci.filter((voce) => voce.ottenutoAllInizio).map((voce) => voce.personaggio);
}

/** Stato vuoto del file dei giocatori. */
function statoVuoto() {
    return { versione: 1, giocatori: {}, sessioni: {} };
}

function leggiStato(magazzino) {
    const stato = magazzino.leggi('giocatori.json', null);
    if (!stato || !stato.giocatori) return statoVuoto();
    if (!stato.sessioni) stato.sessioni = {};
    return stato;
}

function normalizza(nick) {
    return String(nick || '').trim().toLowerCase();
}

/** True se il nickname non contiene una parola dell'elenco bloccato. */
function nickAccettabile(nick) {
    const normalizzato = normalizza(nick);
    return !REGOLE.paroleBloccate.some((parola) => normalizzato.includes(parola));
}

/** Quello che il client può vedere di un giocatore: niente sale, niente hash. */
function pubblico(giocatore) {
    const lega = leghe.legaDi(giocatore.elo || 0);

    return {
        id: giocatore.id,
        nick: giocatore.nick,
        ruolo: giocatore.ruolo,
        punti: giocatore.punti,
        elo: giocatore.elo,
        lega: lega.nome,
        legaColore: lega.colore,
        legaProssima: lega.prossima,
        legaMancano: lega.mancano,
        protezioneUsata: !!giocatore.protezioneUsata,
        personaggi: giocatore.personaggi,
        vittorie: giocatore.vittorie,
        sconfitte: giocatore.sconfitte,
        pareggi: giocatore.pareggi || 0,
        partiteGiocate: giocatore.partiteGiocate || 0,
        partiteRanked: giocatore.partiteRanked || 0,
        partiteOggi: giocatore.partiteOggi || 0,
        serie: giocatore.serie,
        provvisorio: giocatore.provvisorio,
        piazzamento: giocatore.piazzamento,
        titoli: giocatore.titoli || [],
        creatoIl: giocatore.creatoIl
    };
}

/** Crea un account. Restituisce { ok, giocatore } oppure { ok:false, stato, messaggio }. */
function iscrivi(magazzino, corpo) {
    const nickPulito = String(corpo.nick || '').trim();
    const normalizzato = normalizza(nickPulito);
    const passwordTesto = String(corpo.password || '');

    if (nickPulito.length < REGOLE.account.nickMinimo || nickPulito.length > REGOLE.account.nickMassimo) {
        return { ok: false, stato: 400, messaggio: 'Il nickname deve avere da ' + REGOLE.account.nickMinimo + ' a ' + REGOLE.account.nickMassimo + ' caratteri.' };
    }
    if (!/^[A-Za-z0-9_]+$/.test(nickPulito)) {
        return { ok: false, stato: 400, messaggio: 'Il nickname può contenere solo lettere, numeri e trattino basso.' };
    }
    if (passwordTesto.length < REGOLE.account.passwordMinima) {
        return { ok: false, stato: 400, messaggio: 'La password deve avere almeno ' + REGOLE.account.passwordMinima + ' caratteri.' };
    }
    if (!nickAccettabile(nickPulito)) {
        return { ok: false, stato: 400, messaggio: 'Questo nickname non è ammesso.' };
    }

    const stato = leggiStato(magazzino);
    const gia = Object.values(stato.giocatori).some((g) => g.nickNormalizzato === normalizzato);
    if (gia) {
        return { ok: false, stato: 409, messaggio: 'Questo nickname è già in uso.' };
    }

    const sale = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(passwordTesto, sale, 32, IMPOSTAZIONI_SCRYPT).toString('hex');
    const id = crypto.randomUUID();
    const adesso = new Date().toISOString();
    const adminIniziale = (REGOLE.admin && REGOLE.admin.nickIniziali || []).map(normalizza).includes(normalizzato);

    const giocatore = {
        id: id,
        nick: nickPulito,
        nickNormalizzato: normalizzato,
        sale: sale,
        hash: hash,
        ruolo: adminIniziale ? 'admin' : 'giocatore',
        punti: REGOLE.account.puntiIniziali,
        elo: REGOLE.elo.iniziale,
        eloPersonaggio: {},
        personaggi: personaggiIniziali(),
        vittorie: 0,
        sconfitte: 0,
        pareggi: 0,
        serie: 0,
        miglioreSerie: 0,
        partiteGiocate: 0,
        piazzamento: 0,
        provvisorio: true,
        protezioneUsata: false,
        partiteBotOggi: 0,
        giornoBot: null,
        bloccatoFinoA: 0,
        titoli: [],
        amici: [],
        richiesteRicevute: [],
        richiesteInviate: [],
        bloccati: [],
        creatoIl: adesso,
        ultimoAccesso: adesso
    };

    stato.giocatori[id] = giocatore;
    magazzino.scrivi('giocatori.json', stato);
    return { ok: true, giocatore: giocatore };
}

/** Verifica la password di un giocatore. */
function passwordCorretta(giocatore, password) {
    try {
        const calcolato = crypto.scryptSync(String(password || ''), giocatore.sale, 32, IMPOSTAZIONI_SCRYPT);
        const salvato = Buffer.from(giocatore.hash, 'hex');
        return salvato.length === calcolato.length && crypto.timingSafeEqual(salvato, calcolato);
    } catch (errore) {
        return false;
    }
}

/** Accesso: restituisce { ok, token, giocatore } oppure { ok:false, stato, messaggio }. */
function accedi(magazzino, corpo) {
    const stato = leggiStato(magazzino);
    const normalizzato = normalizza(corpo.nick);
    const giocatore = Object.values(stato.giocatori).find((g) => g.nickNormalizzato === normalizzato);

    if (!giocatore || !passwordCorretta(giocatore, corpo.password)) {
        return { ok: false, stato: 401, messaggio: 'Nickname o password non corretti.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const ore = REGOLE.account.durataSessioneOre;
    stato.sessioni[token] = { giocatore: giocatore.id, scade: Date.now() + ore * 3600000 };
    giocatore.ultimoAccesso = new Date().toISOString();
    magazzino.scrivi('giocatori.json', stato);

    return { ok: true, token: token, giocatore: giocatore };
}

/** Chiude la sessione del token indicato. Sempre riuscita. */
function esci(magazzino, token) {
    const stato = leggiStato(magazzino);
    if (token && stato.sessioni[token]) {
        delete stato.sessioni[token];
        magazzino.scrivi('giocatori.json', stato);
    }
    return { ok: true };
}

/** Giocatore collegato a un token, oppure null se il token non vale più. */
function daToken(magazzino, token) {
    if (!token) return null;
    const stato = leggiStato(magazzino);
    const sessione = stato.sessioni[token];
    if (!sessione) return null;
    if (sessione.scade < Date.now()) {
        delete stato.sessioni[token];
        magazzino.scrivi('giocatori.json', stato);
        return null;
    }
    return stato.giocatori[sessione.giocatore] || null;
}

/** Rilegge un giocatore dal disco. */
function leggiGiocatore(magazzino, id) {
    return leggiStato(magazzino).giocatori[id] || null;
}

/** Salva un giocatore modificato. */
function salvaGiocatore(magazzino, giocatore) {
    const stato = leggiStato(magazzino);
    stato.giocatori[giocatore.id] = giocatore;
    magazzino.scrivi('giocatori.json', stato);
    return giocatore;
}

/** Tutti i giocatori. */
function elencoGiocatori(magazzino) {
    return Object.values(leggiStato(magazzino).giocatori);
}

/** Promuove un giocatore ad amministratore. Restituisce il giocatore o null. */
function promuoviAdmin(magazzino, nick) {
    const stato = leggiStato(magazzino);
    const normalizzato = normalizza(nick);
    const giocatore = Object.values(stato.giocatori).find((g) => g.nickNormalizzato === normalizzato);
    if (!giocatore) return null;
    giocatore.ruolo = 'admin';
    magazzino.scrivi('giocatori.json', stato);
    return giocatore;
}

/** Acquisto nel negozio: scala i punti e aggiunge il lottatore. */
function acquista(magazzino, giocatore, idPersonaggio) {
    const voce = NEGOZIO.voci.find((v) => v.personaggio === idPersonaggio);
    if (!voce) {
        return { ok: false, stato: 404, messaggio: 'Lottatore non presente nel negozio.' };
    }
    if (giocatore.personaggi.includes(idPersonaggio)) {
        return { ok: false, stato: 409, messaggio: 'Possiedi già questo lottatore.' };
    }
    if (giocatore.punti < voce.prezzo) {
        return { ok: false, stato: 402, messaggio: 'Punti insufficienti: ne servono ' + voce.prezzo + '.' };
    }

    giocatore.punti -= voce.prezzo;
    giocatore.personaggi.push(idPersonaggio);
    salvaGiocatore(magazzino, giocatore);
    return { ok: true, punti: giocatore.punti, personaggi: giocatore.personaggi };
}

/** Accredita punti a un giocatore (usato da partite, tornei e missioni). */
function accredita(magazzino, giocatore, punti) {
    giocatore.punti = Math.max(0, giocatore.punti + Math.round(punti));
    salvaGiocatore(magazzino, giocatore);
    return giocatore.punti;
}

module.exports = {
    regole, negozio, personaggiIniziali, pubblico, nickAccettabile,
    iscrivi, accedi, esci, daToken, leggiGiocatore, salvaGiocatore,
    elencoGiocatori, promuoviAdmin, acquista, accredita
};
