// tools/prova_swarm_revisore.js — il secondo parere sulle anomalie.
// Puro: si prova la regola di decisione e la forma delle domande, senza rete.

const path = require('path');
const { decidiVerdetto, descriviContesto, DOMANDE, REGOLE } = require(path.join(__dirname, 'swarm', 'revisore.js'));

const risultati = [];
function verifica(nome, condizione, dettaglio) {
    risultati.push(!!condizione);
    console.log((condizione ? 'OK   ' : 'NO   ') + nome + (dettaglio ? '  [' + dettaglio + ']' : ''));
}

// --- la regola di decisione ---
verifica('spiegabile dalle regole (>=0.5) = rumore, qualunque cosa dica la choice',
    decidiVerdetto(0.72, 'difetto_reale') === 'rumore', decidiVerdetto(0.72, 'difetto_reale'));

verifica('non spiegabile e il modello dice difetto = difetto',
    decidiVerdetto(0.12, 'difetto_reale') === 'difetto_reale');

verifica('non spiegabile ma modello incerto = incerto',
    decidiVerdetto(0.12, 'incerto') === 'incerto');

verifica('zona di mezzo con modello che dice rumore = rumore',
    decidiVerdetto(0.4, 'rumore') === 'rumore');

verifica('zona di mezzo senza indicazioni = incerto',
    decidiVerdetto(0.4, 'difetto_reale') === 'incerto');

verifica('probabilità altissima resta rumore anche se il modello insiste',
    decidiVerdetto(0.95, 'difetto_reale') === 'rumore');

// --- il contesto si legge in una riga ---
const contesto = {
    timer: 41,
    p1: { personaggio: 'ZuriNkosi', x: 400, vita: 22, stamina: 30, attacco: true, inAria: false },
    p2: { personaggio: 'KwameMensah', x: 587, vita: 47, stamina: 60, attacco: false }
};
const riga = descriviContesto(contesto);
verifica('il contesto dice verdellinesi, posizioni e vita',
    riga.indexOf('ZuriNkosi') !== -1 && riga.indexOf('x400') !== -1 && riga.indexOf('vita 22') !== -1, riga);
verifica('il contesto segnala chi sta attaccando', riga.indexOf('(in attacco)') !== -1);
verifica('senza contesto non si inventa niente',
    descriviContesto(null) === 'contesto assente');

// --- le regole del gioco devono essere nella domanda, non solo nel documento ---
const istruzioni = DOMANDE.compatibile.instructions;
['stamina', 'recupero', 'parata', 'vita massima', 'ritmo'].forEach((parola) => {
    verifica('la domanda cita la regola su "' + parola + '"',
        istruzioni.toLowerCase().indexOf(parola) !== -1);
});

verifica('le regole elencano almeno 8 punti', REGOLE.split(';').length >= 8);
verifica('la choice ha le tre uscite previste',
    Object.keys(DOMANDE.verdetto.criteria).join(',') === 'difetto_reale,rumore,incerto');

const passate = risultati.filter(Boolean).length;
console.log('\n' + passate + '/' + risultati.length + ' verifiche passate');
process.exit(passate === risultati.length ? 0 : 1);
