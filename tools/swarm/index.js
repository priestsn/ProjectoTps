// tools/swarm/index.js
// Lo sciame: N bot che giocano a UVSF7 e riportano i difetti.
//
// Uso:
//   node tools/swarm/index.js --bot 4 --minuti 6 --jev
//   node tools/swarm/index.js --bot 2 --minuti 2 --partite 1       (senza Jev: gratis)
//
// Opzioni:
//   --bot N            quanti bot in parallelo (default 3)
//   --minuti N         durata della corsa (default 5)
//   --partite N        partite massime per bot (default 3)
//   --jev              accende il giudice sulle immagini (costa pochi centesimi)
//   --jev-ogni N       secondi fra due giudizi per bot (default 12)
//   --max-chiamate N   tetto di sicurezza delle chiamate a Jev (default 300)
//   --porta N          porta del server di prova (default 8300)
//   --uscita DIR       dove scrivere rapporto e immagini (default bug_reports)

const fs = require('fs');
const path = require('path');

const { avviaServerDiProva, fermaServerDiProva } = require('./serverProva.js');
const { corriSciame, corriGiro } = require('./corridore.js');
const { costruisciRapporto } = require('./rapporto.js');

const RADICE = path.join(__dirname, '..', '..');

function argomenti(elenco) {
    const scelte = {
        bot: 3, minuti: 5, partite: 3, jev: false, jevOgni: 12,
        maxChiamate: 300, porta: 8300, uscita: path.join(RADICE, 'bug_reports'),
        giro: false, ripetizioni: 2, account: false
    };

    for (let indice = 0; indice < elenco.length; indice++) {
        const voce = elenco[indice];
        const prossimo = () => elenco[++indice];
        if (voce === '--bot') scelte.bot = Number(prossimo());
        else if (voce === '--minuti') scelte.minuti = Number(prossimo());
        else if (voce === '--partite') scelte.partite = Number(prossimo());
        else if (voce === '--jev') scelte.jev = true;
        else if (voce === '--jev-ogni') scelte.jevOgni = Number(prossimo());
        else if (voce === '--max-chiamate') scelte.maxChiamate = Number(prossimo());
        else if (voce === '--porta') scelte.porta = Number(prossimo());
        else if (voce === '--uscita') scelte.uscita = path.resolve(prossimo());
        else if (voce === '--giro') scelte.giro = true;
        else if (voce === '--ripetizioni') scelte.ripetizioni = Number(prossimo());
        else if (voce === '--account') scelte.account = true;
    }

    return scelte;
}

function marcaTempo() {
    const adesso = new Date();
    const dueCifre = (numero) => String(numero).padStart(2, '0');
    return adesso.getFullYear() + '-' + dueCifre(adesso.getMonth() + 1) + '-' + dueCifre(adesso.getDate()) +
        '_' + dueCifre(adesso.getHours()) + dueCifre(adesso.getMinutes());
}

async function main() {
    const scelte = argomenti(process.argv.slice(2));

    const cartella = path.join(scelte.uscita, 'swarm-' + marcaTempo());
    fs.mkdirSync(cartella, { recursive: true });
    const percorsoEventi = path.join(cartella, 'eventi.jsonl');
    const gettone = fs.createWriteStream(percorsoEventi, { flags: 'a' });

    const eventi = [];
    let chiamateJev = 0;
    let tettoRaggiunto = false;

    function scriviEvento(evento) {
        evento.quando = new Date().toISOString();
        eventi.push(evento);
        gettone.write(JSON.stringify(evento) + '\n');

        if (evento.tipo === 'anomalia') {
            console.log('  [bot ' + evento.bot + '] ' + evento.firma + ': ' + evento.messaggio);
        }
        if (evento.tipo === 'giudizio') {
            chiamateJev += 1;
            if (chiamateJev >= scelte.maxChiamate) tettoRaggiunto = true;
            if (evento.immagine) {
                console.log('  [bot ' + evento.bot + '] Jev: ' + evento.categoria +
                    ' gravità ' + evento.gravita + ' → ' + evento.immagine);
            }
        }
    }

    console.log(scelte.giro
        ? 'Giro schermate: ' + scelte.bot + ' bot, ' + scelte.ripetizioni + ' giri a bot'
        : 'Sciame: ' + scelte.bot + ' bot, ' + scelte.minuti + ' minuti, ' +
            scelte.partite + ' partite a bot' + (scelte.jev ? ', con giudice Jev' : ', senza Jev'));
    console.log('Cartella: ' + cartella);
    console.log('');

    const server = await avviaServerDiProva(scelte.porta);
    let esiti = [];

    try {
        if (scelte.giro) {
            // Giro delle schermate: non è una partita, è la navigazione.
            // Cerca schermate senza uscita, Escape che non torna al menu e
            // funzioni che non aprono niente.
            const lavori = [];
            for (let numero = 1; numero <= scelte.bot; numero++) {
                lavori.push(corriGiro({
                    numero: numero,
                    url: server.url,
                    portaCdp: 9600 + numero,
                    ripetizioni: scelte.ripetizioni,
                    account: scelte.account,
                    cartella: cartella,
                    scriviEvento: scriviEvento
                }));
            }
            esiti = await Promise.all(lavori);
        } else {
        esiti = await corriSciame({
            bot: scelte.bot,
            url: server.url,
            minuti: scelte.minuti,
            partite: scelte.partite,
            basePorta: 9500,
            usaGiudice: scelte.jev && !tettoRaggiunto,
            ogniGiudizioSec: scelte.jevOgni,
            cartella: cartella,
            scriviEvento: scriviEvento
        });
        }
    } finally {
        fermaServerDiProva(server);
        gettone.end();
    }

    const partiteGiocate = esiti.reduce((somma, esito) => somma + (esito.partite || 0), 0);
    const versione = (function () {
        try { return JSON.parse(fs.readFileSync(path.join(RADICE, 'versione.json'), 'utf8')).build; }
        catch (errore) { return '?'; }
    })();

    const markdown = costruisciRapporto(eventi, {
        bot: scelte.bot,
        minuti: scelte.minuti,
        partite: partiteGiocate,
        modo: scelte.giro ? 'giro' : 'sciame',
        build: versione,
        dataLeggibile: new Date().toLocaleString('it-IT'),
        immagineEsiste: (nome) => fs.existsSync(path.join(cartella, nome))
    });

    const percorsoRapporto = path.join(cartella, 'rapporto.md');
    fs.writeFileSync(percorsoRapporto, markdown, 'utf8');

    const gravi = eventi.filter((evento) => evento.tipo === 'anomalia' && evento.gravita === 'grave').length;
    const daOcchio = eventi.filter((evento) => evento.tipo === 'giudizio' && evento.immagine).length;
    const costo = eventi.reduce((somma, evento) => somma + (evento.costoStimato || 0), 0);

    console.log('');
    console.log('Anomalie gravi: ' + gravi + ' · difetti visti da Jev: ' + daOcchio +
        ' · chiamate Jev: ' + chiamateJev + ' · costo: $' + costo.toFixed(4));
    console.log('Rapporto: ' + percorsoRapporto);
}

main().catch((errore) => {
    console.error('SCIAME FALLITO:', errore.message);
    process.exit(1);
});
