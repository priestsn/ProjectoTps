// tools/prova_swarm_godibilita.js — le misure di godibilità, con partite finte.
// Puro: numeri inventati, nessun browser.

const path = require('path');
const { valutaGodibilita, sezioneGodibilita, SOGLIE_GODIBILITA } = require(path.join(__dirname, 'swarm', 'rapporto.js'));

const risultati = [];
function verifica(nome, condizione, dettaglio) {
    risultati.push(!!condizione);
    console.log((condizione ? 'OK   ' : 'NO   ') + nome + (dettaglio ? '  [' + dettaglio + ']' : ''));
}

function partita(durata, colpiP1, colpiP2, esito, finitaPerTempo, nome1, nome2, ultimate) {
    return {
        tipo: 'metriche', durataSec: durata, colpiP1: colpiP1, colpiP2: colpiP2, esito: esito,
        finitaPerTempo: !!finitaPerTempo, verdellinesi: [nome1 || 'OusmaneDiouf', nome2 || 'KwameMensah'],
        ultimateP1: ultimate || 0, ultimateP2: ultimate || 0, vitaFinale: [30, 10]
    };
}

// --- una raccolta sana: partite di media durata, esiti alterni, varietà ---
const sane = [
    partita(38, 9, 8, 'p1', false, 'OusmaneDiouf', 'KwameMensah', 1),
    partita(42, 10, 11, 'p2', false, 'ChidiOkonkwo', 'AmaraDiallo', 2),
    partita(35, 8, 7, 'p1', false, 'TarisaiMoyo', 'ZuriNkosi', 1),
    partita(44, 12, 9, 'p2', false, 'BakariTraore', 'SekouCamara', 2),
    partita(40, 9, 10, 'p1', false, 'AyoAdebayo', 'OusmaneDiouf', 1),
    partita(39, 11, 11, 'p2', false, 'KwameMensah', 'ChidiOkonkwo', 0)
];

const valutazione = valutaGodibilita(sane);
verifica('conta le partite', valutazione.partite === 6, String(valutazione.partite));
verifica('durata media corretta',
    Math.abs(valutazione.durataMedia - 39.7) < 0.2, String(valutazione.durataMedia));
// 115 colpi in 238 secondi = 29 al minuto: il conto è questo, non un'impressione
verifica('colpi al minuto calcolati',
    Math.abs(valutazione.colpiAlMinuto - 29) < 0.6, String(valutazione.colpiAlMinuto));
verifica('conta i verdellinesi diversi', valutazione.verdellinesi.length >= 4, String(valutazione.verdellinesi.length));
verifica('una raccolta sana non produce osservazioni negative',
    valutazione.osservazioni.length === 0, valutazione.riassunto);

// --- partite troppo corte ---
const corte = valutaGodibilita([partita(12, 3, 2, 'p1'), partita(10, 2, 3, 'p2'), partita(14, 4, 3, 'p1')]);
verifica('partite corte segnalate',
    corte.osservazioni.some((o) => o.indexOf('Partite corte') !== -1), corte.riassunto);

// --- quasi tutte decise dal tempo ---
const lunghe = valutaGodibilita([
    partita(59, 5, 5, 'p1', true), partita(58, 4, 6, 'p2', true), partita(60, 5, 5, 'pari', true)
]);
verifica('partite decise dal tempo segnalate',
    lunghe.osservazioni.some((o) => o.indexOf('decise dal tempo') !== -1), lunghe.riassunto);

// --- sbilanciamento ---
const sbilanciate = [];
for (let giro = 0; giro < 8; giro++) sbilanciate.push(partita(30, 8, 5, 'p1'));
const sbilanci = valutaGodibilita(sbilanciate);
verifica('sbilanciamento segnalato',
    sbilanci.osservazioni.some((o) => o.indexOf('sbilanciati') !== -1), sbilanci.riassunto);
verifica('la quota di vittorie è quella del lato vincente', sbilanci.quotaVittorie === 100,
    String(sbilanci.quotaVittorie));

// --- ritmo ---
const ferme = valutaGodibilita([partita(40, 1, 1, 'p1'), partita(40, 2, 1, 'p2')]);
verifica('pochi colpi al minuto segnalati',
    ferme.osservazioni.some((o) => o.indexOf('Pochi colpi') !== -1), ferme.riassunto);

// --- pareggi ---
const pareggi = [];
for (let giro = 0; giro < 5; giro++) pareggi.push(partita(40, 8, 8, 'pari', true));
const tantiPareggi = valutaGodibilita(pareggi);
verifica('i pareggi eccessivi sono segnalati',
    tantiPareggi.osservazioni.some((o) => o.indexOf('pareggi') !== -1), tantiPareggi.riassunto);

// --- nessuna partita ---
const vuota = valutaGodibilita([]);
verifica('senza partite non si inventa niente',
    vuota.partite === 0 && vuota.osservazioni.length === 0 && vuota.riassunto === 'nessuna partita misurata');

// --- markdown ---
const testo = sezioneGodibilita(valutazione);
verifica('la sezione Markdown riporta durata e colpi',
    testo.indexOf('## Godibilità') !== -1 && testo.indexOf('al minuto') !== -1);
verifica('la sezione senza partite è vuota', sezioneGodibilita(valutaGodibilita([])) === '');
verifica('le soglie sono dichiarate in un posto solo',
    typeof SOGLIE_GODIBILITA.durataCortaSec === 'number' && SOGLIE_GODIBILITA.durataCortaSec === 25);

const passate = risultati.filter(Boolean).length;
console.log('\n' + passate + '/' + risultati.length + ' verifiche passate');
process.exit(passate === risultati.length ? 0 : 1);
