// ========================================
// Modello del menu principale
// ==========================================
// Il menu principale è FATTO DI DATI: tre colonne, ognuna con un titolo e le
// sue voci. Niente funzioni dentro i dati (le azioni sono stringhe), così il
// modello si può provare con Node: `node tools/prova_menu.js`.
// Chi disegna il menu (js/Menu.js) traduce l'azione in una funzione.
//
// Regola: ogni destinazione del gioco compare qui una volta sola.

const GRUPPI_PRINCIPALE = [
    {
        id: 'gioca',
        titolo: 'GIOCA',
        voci: [
            { id: 'vsLocale', testo: 'VS LOCALE', nota: 'due giocatori, una tastiera', azione: 'vsLocale' },
            { id: 'vsCpu', testo: 'VS CPU', nota: 'facile, difficile, guissè', azione: 'vsCpu' },
            { id: 'vsOnline', testo: 'VS ONLINE', nota: 'stanze con codice', azione: 'vsOnline' },
            { id: 'ranked', testo: 'RANKED', nota: 'coda per ELO', azione: 'ranked' }
        ]
    },
    {
        id: 'sociale',
        titolo: 'SOCIALE',
        voci: [
            { id: 'amici', testo: 'AMICI', nota: 'richieste e sfide', azione: 'amici' },
            { id: 'classifica', testo: 'CLASSIFICA', nota: 'i migliori per ELO', azione: 'classifica' }
        ]
    },
    {
        id: 'profilo',
        titolo: 'IL TUO PROFILO',
        voci: [
            { id: 'account', testo: 'ACCOUNT', nota: 'accesso e progressi', azione: 'account' },
            { id: 'negozio', testo: 'NEGOZIO', nota: 'sblocca i verdellinesi', azione: 'negozio' },
            { id: 'settings', testo: 'IMPOSTAZIONI', nota: 'schermo e tasti', azione: 'settings' }
        ]
    }
];

// Azioni che js/Menu.js sa eseguire. Una voce con un'azione fuori da questo
// elenco è un refuso, e il test lo segnala.
const AZIONI = ['vsLocale', 'vsCpu', 'vsOnline', 'ranked', 'amici', 'classifica',
    'account', 'negozio', 'settings'];

function vociDi(colonna) {
    const gruppo = GRUPPI_PRINCIPALE[colonna];
    return gruppo ? gruppo.voci : [];
}

function selezionabile(voce) {
    return !!voce && !voce.wip;
}

/** Indice della prima voce scegliibile di una colonna (0 se sono tutte wip). */
function primoIndice(colonna) {
    const voci = vociDi(colonna);
    const indice = voci.findIndex((voce) => selezionabile(voce));
    return indice < 0 ? 0 : indice;
}

/**
 * Sposta l'indice dentro un elenco, in tondo, saltando le voci non
 * selezionabili. La usano sia il menu principale sia i sottomenu.
 */
function spostaInElenco(voci, selezione, passo) {
    const totale = voci.length;
    if (totale === 0) {
        return;
    }
    let indice = selezione.indice;
    for (let i = 0; i < totale; i++) {
        indice = (indice + passo + totale) % totale;
        if (selezionabile(voci[indice])) {
            selezione.indice = indice;
            return;
        }
    }
}

/** Su/giù: resta nella colonna corrente. */
function spostaVert(selezione, passo) {
    spostaInElenco(vociDi(selezione.colonna), selezione, passo);
}

/**
 * Sinistra/destra: cambia colonna in tondo e riporta l'indice dentro i limiti
 * della nuova colonna (l'indice della colonna GIOCA non ha senso nel SOCIALE).
 */
function spostaOrizz(selezione, passo) {
    const totale = GRUPPI_PRINCIPALE.length;
    const colonna = (selezione.colonna + passo + totale) % totale;
    const massimo = Math.max(0, vociDi(colonna).length - 1);

    selezione.colonna = colonna;
    selezione.indice = Math.min(selezione.indice, massimo);

    if (!selezionabile(vociDi(colonna)[selezione.indice])) {
        selezione.indice = primoIndice(colonna);
    }
}

/** La voce sotto la selezione: { gruppo, voce } oppure null. */
function voceSelezionata(selezione) {
    const gruppo = GRUPPI_PRINCIPALE[selezione.colonna];
    if (!gruppo) {
        return null;
    }
    const voce = gruppo.voci[selezione.indice];
    return voce ? { gruppo: gruppo, voce: voce } : null;
}

// Doppia modalità: nel browser è uno script classico, nei test si carica con require.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GRUPPI_PRINCIPALE: GRUPPI_PRINCIPALE,
        AZIONI: AZIONI,
        vociDi: vociDi,
        selezionabile: selezionabile,
        primoIndice: primoIndice,
        spostaInElenco: spostaInElenco,
        spostaVert: spostaVert,
        spostaOrizz: spostaOrizz,
        voceSelezionata: voceSelezionata
    };
}
