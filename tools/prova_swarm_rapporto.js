// tools/prova_swarm_rapporto.js — il raggruppamento degli eventi in rapporto.
// Puro: eventi finti, nessun browser, nessuna chiamata.

const path = require('path');
const { costruisciRapporto, raggruppa } = require(path.join(__dirname, 'swarm', 'rapporto.js'));

const risultati = [];
function verifica(nome, condizione, dettaglio) {
    risultati.push(!!condizione);
    console.log((condizione ? 'OK   ' : 'NO   ') + nome + (dettaglio ? '  [' + dettaglio + ']' : ''));
}

const contesto = {
    stato: 'partita', timer: 41,
    p1: { personaggio: 'OusmaneDiouf', x: 1210, vita: 80 },
    p2: { personaggio: 'ChidiOkonkwo', x: 1180, vita: 60 }
};

const eventi = [
    { tipo: 'anomalia', bot: 1, partita: 1, firma: 'azione-persa', gravita: 'grave',
        messaggio: 'Attacco premuto, il lottatore non è in attacco dopo 250 ms', contesto: contesto, decimi: 120 },
    { tipo: 'anomalia', bot: 2, partita: 2, firma: 'azione-persa', gravita: 'grave',
        messaggio: 'Attacco premuto, il lottatore non è in attacco dopo 250 ms', contesto: contesto, decimi: 300 },
    { tipo: 'anomalia', bot: 1, partita: 1, firma: 'ritmo-basso', gravita: 'fastidiosa',
        messaggio: 'Ritmo 48 passi/s invece di 60', contesto: contesto, decimi: 200 },
    { tipo: 'anomalia', bot: 3, partita: 1, firma: 'bot-non-partito', gravita: 'fastidiosa',
        messaggio: 'Il bot non è partito: Chrome non ha aperto il debugger', contesto: null, decimi: 0 },
    { tipo: 'giudizio', bot: 1, partita: 1, difetto: 0.82, categoria: 'sprite', gravita: 3,
        secondo: 0.7, costoStimato: 0.00005, immagine: 'schermo-1-2.png', contesto: contesto, decimi: 150 },
    { tipo: 'giudizio', bot: 2, partita: 2, difetto: 0.61, categoria: 'sprite', gravita: 3,
        secondo: 0.8, costoStimato: 0.00005, immagine: 'schermo-2-1.png', contesto: contesto, decimi: 320 },
    // questi due NON devono comparire
    { tipo: 'giudizio', bot: 1, partita: 1, difetto: 0.3, categoria: 'hud', gravita: 2,
        secondo: 0.7, costoStimato: 0.00005, immagine: null, contesto: contesto, decimi: 160 },
    { tipo: 'giudizio', bot: 1, partita: 1, difetto: 0.9, categoria: 'nessuno', gravita: 0,
        secondo: 0.7, costoStimato: 0.00005, immagine: null, contesto: contesto, decimi: 170 }
];

// --- raggruppamento ---
const gruppi = raggruppa(eventi);
const azionePersa = gruppi.anomalie.find((voce) => voce.firma === 'azione-persa');
const sprite = gruppi.giudizi.find((voce) => voce.categoria === 'sprite');

verifica('due anomalie con la stessa firma diventano un gruppo con 2 occorrenze',
    !!azionePersa && azionePersa.occorrenze === 2, azionePersa ? String(azionePersa.occorrenze) : 'assente');
verifica('il gruppo conta i bot distinti', !!azionePersa && azionePersa.bot.size === 2);
verifica('gravità decrescente: il grave viene prima del fastidioso',
    gruppi.anomalie[0].firma === 'azione-persa', gruppi.anomalie[0].firma);
verifica('il giudizio a 0.3 di difetto non entra nei gruppi',
    gruppi.giudizi.every((voce) => voce.categoria !== 'hud'));
verifica('la categoria "nessuno" non entra nei gruppi',
    gruppi.giudizi.every((voce) => voce.categoria !== 'nessuno'));
verifica('i giudizi sopra soglia sono raggruppati per categoria e gravità',
    !!sprite && sprite.occorrenze === 2);
verifica('i giudizi totali contano anche quelli scartati', gruppi.totaleGiudizi === 4,
    String(gruppi.totaleGiudizi));
verifica('il costo è la somma dei giudizi', Math.abs(gruppi.costo - 0.0002) < 1e-9,
    String(gruppi.costo));

// --- markdown ---
const markdown = costruisciRapporto(eventi, {
    bot: 3, minuti: 5, partite: 4, build: '15',
    dataLeggibile: '20/10/2026 19:30',
    immagineEsiste: (nome) => nome === 'schermo-1-2.png'
});

verifica('il titolo riporta bot, minuti e partite',
    markdown.indexOf('3 bot, 5 minuti, 4 partite') !== -1);
verifica('la riga di testa riporta la build', markdown.indexOf('build 15') !== -1);
verifica('c\'è la sezione delle sonde', markdown.indexOf('## Difetti delle sonde') !== -1);
verifica('c\'è la sezione di Jev', markdown.indexOf('## Difetti visti da Jev') !== -1);
// il gruppo cita la PRIMA segnalazione: schermo-1-2.png è quella che esiste
verifica('l\'immagine esistente è citata senza avviso',
    markdown.indexOf('schermo-1-2.png') !== -1 &&
    markdown.indexOf('schermo-1-2.png (immagine mancante)') === -1);

// stessa cosa ma dicendo che il file non c'è: l'avviso deve comparire
const markdownMancante = costruisciRapporto(eventi, {
    bot: 3, minuti: 5, partite: 4, build: '15',
    dataLeggibile: '20/10/2026 19:30',
    immagineEsiste: () => false
});
verifica('l\'immagine mancante è segnalata', markdownMancante.indexOf('(immagine mancante)') !== -1);
verifica('nessuna riga supera 400 caratteri',
    markdown.split('\n').every((riga) => riga.length <= 400));
verifica('il testo usa "lottatore"/"verdellinese", non "personaggio" per i lottatori',
    markdown.indexOf('personaggio ') === -1);

const vuoto = costruisciRapporto([], { bot: 1, minuti: 1, partite: 1 });
verifica('senza eventi il rapporto dice "Nessun difetto rilevato"',
    vuoto.indexOf('## Nessun difetto rilevato') !== -1);
verifica('il rapporto vuoto non è un file vuoto', vuoto.length > 200);

const passate = risultati.filter(Boolean).length;
console.log('\n' + passate + '/' + risultati.length + ' verifiche passate');
process.exit(passate === risultati.length ? 0 : 1);
