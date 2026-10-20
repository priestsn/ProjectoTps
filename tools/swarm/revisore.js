// tools/swarm/revisore.js
// Secondo parere sulle anomalie raccolte dallo sciame.
//
// Il problema che risolve: le sonde producono decine di segnalazioni, quasi
// tutte rumore (carico della macchina, regole del gioco che la sonda non
// conosce). Chi legge il rapporto non deve ricontrollarle a mano una per una.
// Qui ogni FIRMA viene riletta una volta sola — con i suoi esempi e con le
// regole vere del gioco scritte nero su bianco — e Jev dice se regge.
//
// Una chiamata per firma, non per occorrenza: 80 segnalazioni diventano 4-6
// domande e costano meno di un centesimo.

const fs = require('fs');
const crypto = require('crypto');

const URL_JEV = 'https://api.typesafe.ai/v1/systemone';
const PERCORSO_ENV = process.env.JEV_ENV || 'C:/Users/boh/AppData/Local/hermes/.env';
const PREZZO_INPUT = 0.042 / 1000000;

// Le regole del gioco che rendono "sospetto" un comportamento che invece è
// voluto. Sono le stesse scritte in docs/swarm.md, e sono la ragione per cui
// senza questo contesto il revisore direbbe di sì a tutto.
const REGOLE = "Regole vere di questo picchiaduro (UVSF7), che vanno considerate prima di " +
    "chiamare difetto un comportamento: " +
    "1) l'attacco costa stamina (statistiche.costoStamina): sotto la soglia il comando viene " +
    "rifiutato di proposito e appare la scritta STAMINA; " +
    "2) attacco e parata partono solo da terra: in aria vengono rifiutati; " +
    "3) dopo un attacco c'è una finestra di recupero di 16 passi in cui il comando successivo " +
    "può essere ignorato; " +
    "4) la parata annulla il danno: un colpo che 'non toglie vita' può essere un blocco normale o " +
    "un perfect block, che è un esito voluto; " +
    "5) ogni verdellinese ha la sua vita massima (da 85 a 110), non 100; " +
    "6) il timer scende una volta al secondo, quindi due letture ravvicinate con lo stesso valore " +
    "sono normali; " +
    "7) con molti bot sulla stessa macchina il ritmo cala (45-50 passi/s invece di 60): è carico " +
    "della macchina, non un difetto del gioco; " +
    "8) a fine partita lo stato passa a 'pausa' e alcune schermate cambiano senza che sia un errore.";

const DOMANDE = {
    compatibile: {
        type: 'noul',
        instructions: REGOLE + " Detta l'anomalia: è spiegabile con una di queste regole o con il " +
            'normale funzionamento del gioco?',
        criteria: {
            true: 'spiegabile con una regola o con il funzionamento normale',
            false: 'non è spiegabile: potrebbe essere un difetto vero'
        }
    },
    verdetto: {
        type: 'choice',
        instructions: 'Alla luce delle regole, questa anomalia va segnalata come difetto o archiviata? ' +
            'Se UNA QUALSIASI delle regole la spiega, la risposta è rumore: non serve che sia ' +
            'la segnalazione più grave del rapporto.',
        criteria: {
            difetto_reale: 'nessuna regola la spiega e il comportamento è sbagliato',
            rumore: 'spiegata dalle regole o dalla strumentazione',
            incerto: 'non si può decidere dai dati: serve guardarla a mano'
        }
    },
    confidenza: {
        type: 'score',
        instructions: 'Quanto sei sicuro di questo verdetto?',
        criteria: ['nulla', 'poca', 'media', 'buona', 'totale']
    }
};

/**
 * Il verdetto si ricava dalla probabilità di "spiegabile dalle regole", non
 * dalla choice: in prova il modello ha risposto "spiegabile: sì" e poi
 * "difetto_reale" nella stessa chiamata, quindi la scelta libera non è
 * affidabile. Funzione pura, provabile senza rete.
 */
function decidiVerdetto(compatibile, scelto) {
    if (compatibile >= 0.5) return 'rumore';
    if (scelto === 'rumore' && compatibile >= 0.35) return 'rumore';
    if (compatibile < 0.35 && scelto === 'difetto_reale') return 'difetto_reale';
    return 'incerto';
}

let chiaveInMemoria = null;

function chiaveJev() {
    if (chiaveInMemoria) return chiaveInMemoria;
    const contenuto = fs.readFileSync(PERCORSO_ENV, 'utf8');
    for (const riga of contenuto.split('\n')) {
        if (riga.indexOf('TYPESAFE_API_KEY=') === 0) {
            chiaveInMemoria = riga.split('=')[1].trim();
            break;
        }
    }
    if (!chiaveInMemoria) throw new Error('TYPESAFE_API_KEY mancante in ' + PERCORSO_ENV);
    return chiaveInMemoria;
}

/** Il contesto di un'esempio in forma leggibile. */
function descriviContesto(contesto) {
    if (!contesto) return 'contesto assente';
    const p1 = contesto.p1 || {};
    const p2 = contesto.p2 || {};
    return 'timer ' + (contesto.timer === null || contesto.timer === undefined ? '?' : contesto.timer) +
        ', P1 ' + (p1.personaggio || '?') + ' x' + p1.x + ' vita ' + p1.vita + ' stamina ' + p1.stamina +
        (p1.attacco ? ' (in attacco)' : '') + (p1.parata ? ' (in parata)' : '') +
        (p1.stun ? ' (stun)' : '') + (p1.inAria ? ' (in aria)' : '') +
        ', P2 ' + (p2.personaggio || '?') + ' x' + p2.x + ' vita ' + p2.vita + ' stamina ' + p2.stamina +
        (p2.attacco ? ' (in attacco)' : '');
}

/**
 * Rilegge una firma di anomalia con i suoi esempi.
 * Ritorna {firma, verdetto, compatibile, confidenza, costoStimato} oppure null.
 */
async function rivediFirma(firma, esempi, opzioni) {
    const scelte = Object.assign({ modello: 'jev-latest' }, opzioni || {});
    const elenco = (esempi || []).slice(0, 4);
    if (!elenco.length) return null;

    const messaggi = [];
    const visti = {};
    for (const esempio of elenco) {
        const testo = String(esempio.messaggio || '');
        if (visti[testo]) continue;
        visti[testo] = true;
        messaggi.push('- ' + testo + ' | ' + descriviContesto(esempio.contesto));
    }

    const stato = 'Anomalia segnalata dalla sonda: "' + firma + '"\n' +
        'Occorrenze: ' + (esempi.length) + '\n' +
        'Esempi (messaggio | stato del gioco):\n' + messaggi.join('\n') +
        '\n\nValuta se questa anomalia è un difetto vero o rumore.';

    const corpo = {
        model: scelte.modello,
        state: stato,
        questions: DOMANDE
    };

    const partenza = Date.now();
    const risposta = await fetch(URL_JEV, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + chiaveJev(), 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo)
    });

    if (!risposta.ok) {
        const dettaglio = await risposta.text();
        throw new Error('Jev ' + risposta.status + ': ' + dettaglio.slice(0, 160));
    }

    const risultato = await risposta.json();
    const risposte = risultato.answers || {};
    const token = (risultato.usage && risultato.usage.input_tokens) || 0;

    const compatibile = (risposte.compatibile && risposte.compatibile.noul) || 0;
    const scelto = (risposte.verdetto && risposte.verdetto.choice) || 'incerto';

    // Il verdetto NON si prende dalla choice: in prova il modello ha risposto
    // "spiegabile dalle regole: sì" e poi "difetto_reale" nella stessa chiamata.
    // La decisione si ricava dal noul, che è una probabilità e non un'opinione:
    // se una regola spiega l'anomalia, è rumore.
    const verdetto = decidiVerdetto(compatibile, scelto);

    return {
        firma: firma,
        verdetto: verdetto,
        sceltoDalModello: scelto,
        compatibile: compatibile,
        confidenza: (risposte.confidenza && risposte.confidenza.score) || 0,
        secondo: (Date.now() - partenza) / 1000,
        costoStimato: token * PREZZO_INPUT
    };
}

/**
 * Rilegge tutte le firme di un elenco di eventi.
 * Ritorna {verdetti: {firma: verdetto}, costo, chiamate}.
 */
async function rivediEventi(eventi, opzioni) {
    const perFirma = new Map();
    for (const evento of (eventi || [])) {
        if (!evento || evento.tipo !== 'anomalia') continue;
        const firma = evento.firma || 'senza-firma';
        if (!perFirma.has(firma)) perFirma.set(firma, []);
        perFirma.get(firma).push(evento);
    }

    const verdetti = {};
    let costo = 0;
    let chiamate = 0;

    for (const [firma, esempi] of perFirma) {
        try {
            const verdetto = await rivediFirma(firma, esempi, opzioni);
            if (verdetto) {
                verdetti[firma] = verdetto;
                costo += verdetto.costoStimato;
                chiamate += 1;
            }
        } catch (errore) {
            verdetti[firma] = { firma: firma, verdetto: 'incerto', errore: errore.message };
        }
    }

    return { verdetti: verdetti, costo: costo, chiamate: chiamate };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { rivediFirma, rivediEventi, descriviContesto, decidiVerdetto, DOMANDE, REGOLE };
}
