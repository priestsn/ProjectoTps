// ========================================
// Identità: chi sta giocando
// ==========================================
// Ogni giocatore ha un'identità, anche senza account: agli ospiti viene dato un
// id stabile salvato nel browser ("ospite-3F2A") e un nome leggibile
// ("Ospite 3F2A"). Così il resto del gioco non deve più chiedersi se c'è un
// account: chiede un nome e lo ottiene sempre.
//
// L'id dell'account si ricava dal nick in minuscolo: serve solo a distinguere
// due giocatori nella stessa partita online, non è una credenziale.

const CHIAVE_OSPITE = 'uvsf7.ospite';
const ALFABETO_OSPITE = 'ABCDEF0123456789';

let ospiteMemoria = null;

/** Crea un id ospite. `casuale` è iniettabile per poterlo provare. */
function creaIdOspite(casuale) {
    const genera = (typeof casuale === 'function') ? casuale : Math.random;
    let codice = '';
    for (let i = 0; i < 4; i++) {
        const valore = Math.floor(genera() * ALFABETO_OSPITE.length);
        codice += ALFABETO_OSPITE[Math.max(0, Math.min(ALFABETO_OSPITE.length - 1, valore))];
    }
    return 'ospite-' + codice;
}

/** "ospite-3F2A" -> "Ospite 3F2A" */
function nomeDaIdOspite(idOspite) {
    const codice = String(idOspite || '').replace(/^ospite-/, '');
    return 'Ospite ' + (codice || '????');
}

/** Legge l'ospite salvato. Testo rotto o assente -> null (nessuna eccezione). */
function leggiOspiteSalvato(testo) {
    if (!testo) {
        return null;
    }
    try {
        const dati = JSON.parse(testo);
        if (!dati || typeof dati.id !== 'string' || !/^ospite-[A-Z0-9]{4}$/.test(dati.id)) {
            return null;
        }
        return {
            id: dati.id,
            nome: (typeof dati.nome === 'string' && dati.nome) ? dati.nome : nomeDaIdOspite(dati.id),
            creato: Number(dati.creato) || 0,
            partite: Number(dati.partite) || 0
        };
    } catch (errore) {
        return null;
    }
}

/** L'ospite di questo browser: lo crea la prima volta e lo ricorda. */
function ospite() {
    if (ospiteMemoria) {
        return ospiteMemoria;
    }

    let salvato = null;
    try {
        salvato = leggiOspiteSalvato(localStorage.getItem(CHIAVE_OSPITE));
    } catch (errore) {
        salvato = null;                      // navigazione privata senza storage
    }

    ospiteMemoria = salvato || {
        id: creaIdOspite(Math.random),
        nome: '',
        creato: Date.now(),
        partite: 0
    };
    ospiteMemoria.nome = ospiteMemoria.nome || nomeDaIdOspite(ospiteMemoria.id);

    try {
        localStorage.setItem(CHIAVE_OSPITE, JSON.stringify(ospiteMemoria));
    } catch (errore) {
        // senza storage l'id vale per questa sessione: meglio di niente
    }

    return ospiteMemoria;
}

/** L'ospite in uso, senza toccare lo storage (per i test e per il pannello). */
function ospiteInMemoria() {
    return ospiteMemoria;
}

/** Conta una partita giocata da ospite (resta nel browser, non va sul server). */
function contaPartitaOspite() {
    const dati = ospite();
    dati.partite++;
    try {
        localStorage.setItem(CHIAVE_OSPITE, JSON.stringify(dati));
    } catch (errore) {
        // niente storage: il contatore resta in memoria
    }
    return dati.partite;
}

/** L'identità in uso: account se collegato, altrimenti ospite. */
function identitaCorrente() {
    if (typeof statoAccount !== 'undefined' && statoAccount.dentro && statoAccount.nick) {
        return {
            tipo: 'account',
            id: 'acc:' + String(statoAccount.nick).toLowerCase(),
            nome: statoAccount.nick
        };
    }
    const datiOspite = ospite();
    return { tipo: 'ospite', id: datiOspite.id, nome: datiOspite.nome };
}

/**
 * Il nome del giocatore da mostrare: nick, nome ospite, "GIOCATORE 1/2" in VS
 * LOCALE (lì due persone si alternano sullo stesso schermo) e "CPU" per
 * l'avversario del computer.
 */
function nomeGiocatore(giocatore) {
    const modalita = (typeof modalitaPartita !== 'undefined') ? modalitaPartita : 'locale';
    const locale = (typeof MODALITA !== 'undefined') ? MODALITA.LOCALE : 'locale';
    const online = (typeof MODALITA !== 'undefined') ? MODALITA.ONLINE : 'online';

    if (modalita === locale) {
        return giocatore === 'p1' ? 'GIOCATORE 1' : 'GIOCATORE 2';
    }

    if (modalita === online && typeof onlineStato !== 'undefined') {
        const nome = (giocatore === 'p1') ? onlineStato.nomeMio : onlineStato.nomeAvversario;
        if (nome) {
            return nome;
        }
        return giocatore === 'p1' ? 'TU' : 'AVVERSARIO';
    }

    return giocatore === 'p1' ? identitaCorrente().nome : 'CPU';
}

// Doppia modalità: script classico nel browser, require nei test.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CHIAVE_OSPITE: CHIAVE_OSPITE,
        creaIdOspite: creaIdOspite,
        nomeDaIdOspite: nomeDaIdOspite,
        leggiOspiteSalvato: leggiOspiteSalvato,
        ospite: ospite,
        ospiteInMemoria: ospiteInMemoria,
        contaPartitaOspite: contaPartitaOspite,
        identitaCorrente: identitaCorrente,
        nomeGiocatore: nomeGiocatore
    };
}
