// tools/swarm/giudice.js
// Il giudice: manda a Jev uno screenshot + lo stato del gioco e riceve risposte
// tipizzate. NON pilota nulla: Jev ha ~0,7 s di latenza, il gioco gira a 60
// passi al secondo. Il pilota è politica.js.
//
// FORMATO IMMAGINE, VERIFICATO DAL VIVO CON: node tools/swarm/prova_jev_immagine.js
//   multipart: prima parte "request" (il JSON), poi la parte "immagine_1" (il PNG)
//   nel JSON un campo "assets": { "<segnaposto>": {"type":"image","part":"immagine_1"} }
//   e il segnaposto va scritto DENTRO lo state, altrimenti l'API risponde
//   "api_usage_error: Every part after the request must be claimed by an asset"
//   header obbligatorio: TypeSafe-Danger-Zone-Images: true
//   (l'esempio ufficiale è in https://api.typesafe.ai/openapi.json)

const fs = require('fs');
const crypto = require('crypto');

const URL_JEV = 'https://api.typesafe.ai/v1/systemone';
const PERCORSO_ENV = process.env.JEV_ENV || 'C:/Users/boh/AppData/Local/hermes/.env';
const PREZZO_INPUT = 0.042 / 1000000;

// Le etichette sono condivise con rapporto.js: cambiarle qui senza cambiarle là
// rompe il raggruppamento.
const CATEGORIE = ['nessuno', 'hud', 'sprite', 'sfondo', 'effetti', 'testo'];

// Taratura obbligatoria: senza dire al modello com'è fatto l'HUD normale, ogni
// schermata sembra rotta. Verificato sulla prima cattura vera: il giudice
// descriveva le due barre della vita come "bande nere e blu che glitchano
// l'interfaccia" — era l'interfaccia, disegnata così.
const NORMALE = "Contesto: è un picchiaduro 2D in pixel art, ambientato in una città notturna al neon. " +
    "L'interfaccia normale ha la barra della vita del giocatore in alto a sinistra " +
    "(riempimento verde o giallo con bordo nero), la barra dell'avversario in alto a destra " +
    "(riempimento blu o di colore acceso con bordo nero), due barre sottili di stamina e ultimate sotto " +
    "di esse, e il timer in un riquadro nero al centro. " +
    "Colori molto accesi, bordi neri spessi, strisce colorate e insegne al neon sullo sfondo sono NORMALI. " +
    "Sono NORMALI anche i lottatori che impugnano spade, lance o bastoni (l'arma fa parte del disegno), " +
    "le scie bianche e le esplosioni dei colpi, e le scritte grandi al centro dello schermo con bordo nero " +
    "(STAMINA, PERFECT BLOCK, K.O., un avviso sui punti): sono messaggi voluti dal gioco, non errori. " +
    "Un difetto è qualcosa che rompe la figura: un lottatore tagliato a metà o senza testa, due corpi " +
    "fusi nello stesso punto, un elemento dell'interfaccia sopra i lottatori, un'immagine nera o vuota. ";

const DOMANDE = {
    difetto_visibile: {
        type: 'noul',
        instructions: NORMALE + "L'immagine mostra un difetto grafico evidente? " +
            'Esempi veri: un lottatore disegnato a metà o senza testa, due sprite fusi insieme nel posto sbagliato, ' +
            'una barra della vita che sborda oltre il bordo dello schermo, un testo tagliato o sovrapposto, ' +
            'lo schermo completamente nero o vuoto, un elemento dell\'interfaccia sopra i lottatori.',
        criteria: { true: 'si vede un difetto', false: 'immagine plausibile, nessun difetto' }
    },
    categoria: {
        type: 'choice',
        instructions: "Se c'è un difetto, di che tipo è?",
        criteria: {
            nessuno: 'nessun difetto',
            hud: "barre, timer, testi dell'interfaccia",
            sprite: 'lottatore disegnato male, posa sbagliata, sovrapposizione',
            sfondo: 'scenario, canvas nero o vuoto',
            effetti: 'particelle, onde, animazioni fuori posto',
            testo: 'scritte tagliate, sovrapposte o illeggibili'
        }
    },
    gravita: {
        type: 'score',
        instructions: 'Quanto è grave per chi gioca?',
        criteria: ['nessuna', 'cosmetica', 'fastidiosa', 'grave', 'bloccante']
    }
};

let chiaveInMemoria = null;

/** Legge TYPESAFE_API_KEY dal .env. Non stampa mai la chiave. */
function chiaveJev() {
    if (chiaveInMemoria) return chiaveInMemoria;
    let contenuto = '';
    try {
        contenuto = fs.readFileSync(PERCORSO_ENV, 'utf8');
    } catch (errore) {
        throw new Error('file delle chiavi non leggibile: ' + PERCORSO_ENV);
    }
    for (const riga of contenuto.split('\n')) {
        if (riga.indexOf('TYPESAFE_API_KEY=') === 0) {
            chiaveInMemoria = riga.split('=')[1].trim();
            break;
        }
    }
    if (!chiaveInMemoria) throw new Error('TYPESAFE_API_KEY mancante in ' + PERCORSO_ENV);
    return chiaveInMemoria;
}

/**
 * Manda uno screenshot (base64 PNG) + il contesto testuale e torna il giudizio.
 * Ritorna {difetto, categoria, gravita, modello, secondo, costoStimato} o null.
 */
async function giudica(immagineBase64, contestoTesto, opzioni) {
    const scelte = Object.assign({ massimoByte: 4 * 1024 * 1024, modello: 'jev-latest' }, opzioni || {});

    if (!immagineBase64 || typeof immagineBase64 !== 'string') return null;

    const dati = Buffer.from(immagineBase64, 'base64');
    if (dati.length > scelte.massimoByte) return null;    // troppo grossa: si scarta invece di pagarla

    // Il segnaposto va citato nello state: è così che l'API sa quale parte
    // immagine sostituire (verificato: senza, risponde 400 api_usage_error).
    const segnaposto = 'schermo_' + crypto.randomUUID();

    const corpo = {
        model: scelte.modello,
        state: String(contestoTesto || '').slice(0, 1500) + '\n\nImmagine da giudicare: ' + segnaposto,
        questions: DOMANDE,
        assets: {
            [segnaposto]: { type: 'image', part: 'immagine_1' }
        }
    };

    const modulo = new FormData();
    modulo.append('request', new Blob([JSON.stringify(corpo)], { type: 'application/json' }), 'request.json');
    modulo.append('immagine_1', new Blob([dati], { type: 'image/png' }), 'schermo.png');

    const partenza = Date.now();
    const risposta = await fetch(URL_JEV, {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + chiaveJev(),
            'TypeSafe-Danger-Zone-Images': 'true'
        },
        body: modulo
    });

    if (!risposta.ok) {
        const dettaglio = await risposta.text();
        throw new Error('Jev ' + risposta.status + ': ' + dettaglio.slice(0, 200));
    }

    const risultato = await risposta.json();
    const risposte = risultato.answers || {};
    const token = (risultato.usage && risultato.usage.input_tokens) || 0;

    return {
        difetto: (risposte.difetto_visibile && risposte.difetto_visibile.noul) || 0,
        categoria: (risposte.categoria && risposte.categoria.choice) || 'nessuno',
        gravita: (risposte.gravita && risposte.gravita.score) || 0,
        modello: risultato.model || scelte.modello,
        secondo: (Date.now() - partenza) / 1000,
        costoStimato: token * PREZZO_INPUT
    };
}

/** True se il giudizio vale la pena di essere riportato. */
function eDifetto(giudizio) {
    return !!giudizio && giudizio.difetto >= 0.5 && giudizio.categoria !== 'nessuno';
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { giudica, eDifetto, DOMANDE, CATEGORIE, chiaveJev };
}
