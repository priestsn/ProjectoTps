// ========================================
// Verifica delle frasi del negoziante
// ==========================================
// Uso:  node tools/prova_negoziante.js

const risultati = [];

function verifica(nome, condizione, dettaglio) {
    risultati.push(!!condizione);
    console.log((condizione ? 'OK       ' : 'FALLITO  ') + nome.padEnd(54) + (dettaglio || ''));
}

const Negoziante = require('../js/FrasiNegoziante.js');
const frasi = Negoziante.FRASI_NEGOZIANTE;

verifica('Ci sono almeno 20 frasi', frasi.length >= 20, String(frasi.length));
verifica('Nessuna frase vuota',
    frasi.every(f => typeof f === 'string' && f.trim().length > 0));
verifica('Nessuna frase oltre 160 caratteri',
    frasi.every(f => f.length <= 160),
    'massimo ' + Math.max.apply(null, frasi.map(f => f.length)));
verifica('Nessun doppione',
    new Set(frasi).size === frasi.length, new Set(frasi).size + '/' + frasi.length);
verifica('Almeno metà delle frasi nomina Guissè',
    frasi.filter(f => f.toLowerCase().indexOf('guiss') >= 0).length >= frasi.length / 2,
    String(frasi.filter(f => f.toLowerCase().indexOf('guiss') >= 0).length));
verifica('Nessuna frase rivela numeri interni',
    frasi.every(f => !/DANNO_FRAMI|FINESTRA_IMPATTO|FINESTRA_RECUPERO/.test(f)));
verifica('Nessuna frase parla di bug o crash',
    frasi.every(f => !/crash|errore|bug tecnico/i.test(f)));

const primo = Negoziante.scegliFraseNegoziante(0);
const ultimo = Negoziante.scegliFraseNegoziante(0.9999);
verifica('Casuale 0 prende la prima frase', primo === frasi[0]);
verifica('Casuale quasi 1 prende l\'ultima frase', ultimo === frasi[frasi.length - 1]);
verifica('Casuale fuori scala non esplode',
    typeof Negoziante.scegliFraseNegoziante(7) === 'string');
verifica('Valore non numerico: si usa Math.random',
    typeof Negoziante.scegliFraseNegoziante('pippo') === 'string');

const ripetuta = Negoziante.fraseDiversaDa(frasi[0], 0);
verifica('La frase dopo non ripete quella appena detta', ripetuta !== frasi[0], ripetuta.slice(0, 30));
verifica('Frase diversa da un valore assente: nessun errore',
    typeof Negoziante.fraseDiversaDa(null, 0) === 'string');

const passate = risultati.filter(Boolean).length;
console.log('\n' + passate + '/' + risultati.length + ' verifiche passate');
process.exit(passate === risultati.length ? 0 : 1);
