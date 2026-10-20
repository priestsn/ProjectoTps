// tools/swarm/prova_jev_immagine.js
// Prova del formato immagine di Jev con una richiesta vera: è il test di
// sopravvivenza di giudice.js. Se Jev cambia il modo di accettare le immagini,
// è questo script a dirlo — non una corsa dello swarm andata a vuoto.
//
// Uso: node tools/swarm/prova_jev_immagine.js <file.png>
// Esito buono:  http 200  con le risposte alle tre domande.

const fs = require('fs');
const { chiaveJev, DOMANDE } = require('./giudice.js');

const URL_JEV = 'https://api.typesafe.ai/v1/systemone';

async function main() {
    const file = process.argv[2];
    if (!file) throw new Error('uso: node tools/swarm/prova_jev_immagine.js <file.png>');
    if (!fs.existsSync(file)) throw new Error('file non trovato: ' + file);

    const immagine = fs.readFileSync(file);
    console.log('immagine:', file, '|', Math.round(immagine.length / 1024) + ' KB');

    const segnaposto = 'schermo_' + require('crypto').randomUUID();
    const corpo = {
        model: 'jev-latest',
        state: 'Screenshot di un picchiaduro 2D in pixel art: due lottatori, barre della vita, timer.\n\n' +
            'Immagine da giudicare: ' + segnaposto,
        questions: DOMANDE,
        assets: { [segnaposto]: { type: 'image', part: 'immagine_1' } }
    };

    const modulo = new FormData();
    modulo.append('request', new Blob([JSON.stringify(corpo)], { type: 'application/json' }), 'request.json');
    modulo.append('immagine_1', new Blob([immagine], { type: 'image/png' }), 'schermo.png');

    const partenza = Date.now();
    const risposta = await fetch(URL_JEV, {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + chiaveJev(),
            'TypeSafe-Danger-Zone-Images': 'true'
        },
        body: modulo
    });

    const testo = await risposta.text();
    console.log('http', risposta.status, '| secondi', ((Date.now() - partenza) / 1000).toFixed(2));

    if (risposta.status !== 200) {
        console.log('RISPOSTA:', testo.slice(0, 600));
        console.log('\nFORMATO NON ACCETTATO: provare lo state inline con le immagini nel JSON.');
        process.exit(1);
    }

    const risultato = JSON.parse(testo);
    const risposte = risultato.answers || {};
    console.log('modello:', risultato.model);
    console.log('difetto_visibile:', risposte.difetto_visibile && risposte.difetto_visibile.noul);
    console.log('categoria:', risposte.categoria && risposte.categoria.choice);
    console.log('gravita:', risposte.gravita && risposte.gravita.score);
    console.log('token in ingresso:', risultato.usage && risultato.usage.input_tokens);
    console.log('\nFORMATO IMMAGINE ACCETTATO');
}

main().catch((errore) => {
    console.error('FALLITO:', errore.message);
    process.exit(1);
});
