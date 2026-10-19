// ========================================
// Verifica del motore di gioco (logica pura)
// ==========================================
// I moduli controllati qui non toccano il DOM: sono pezzi di motore che la
// pagina usa nel browser e che i test caricano con require.
//
// Uso:  node tools/prova_motore.js

const risultati = [];

function verifica(nome, condizione, dettaglio) {
    risultati.push(!!condizione);
    console.log((condizione ? 'OK       ' : 'FALLITO  ') + nome.padEnd(52) + (dettaglio || ''));
}

function vicino(a, b, tolleranza) {
    return Math.abs(a - b) <= (tolleranza === undefined ? 0.01 : tolleranza);
}

function sezione(titolo) {
    console.log('\n--- ' + titolo + ' ---');
}

// --- Tempo: timestep fisso a 60 Hz ---
const Tempo = require('../js/Tempo.js');

sezione('Tempo');
verifica('Il passo vale 1/60 di secondo', vicino(Tempo.PASSO_MS, 1000 / 60, 0.0001));

let esito = Tempo.avanzaAccumulatore(0, 10);
verifica('10 ms non bastano per un passo', esito.passi === 0 && vicino(esito.resto, 10));

esito = Tempo.avanzaAccumulatore(10, 10);
verifica('20 ms accumulati fanno un passo', esito.passi === 1 && vicino(esito.resto, 20 - 1000 / 60));

esito = Tempo.avanzaAccumulatore(0, 1000 / 60);
verifica('Un fotogramma a 60 Hz fa esattamente un passo', esito.passi === 1);

esito = Tempo.avanzaAccumulatore(0, 1000 / 144);
verifica('A 144 Hz un fotogramma non fa sempre un passo', esito.passi === 0 || esito.passi === 1);

esito = Tempo.avanzaAccumulatore(0, 1000);
verifica('Un secondo intero si ferma al tetto dei passi', esito.passi === Tempo.MAX_PASSI,
    'passi ' + esito.passi);

esito = Tempo.avanzaAccumulatore(0, 5000);
verifica('Un buco enorme non fa esplodere il gioco', esito.passi === Tempo.MAX_PASSI);

let resto = 0;
let passi = 0;
for (let i = 0; i < 144 * 3; i++) {          // 3 secondi a 144 Hz
    const r = Tempo.avanzaAccumulatore(resto, 1000 / 144);
    resto = r.resto;
    passi += r.passi;
}
verifica('3 secondi a 144 Hz = 180 passi, non 432', Math.abs(passi - 180) <= 2, 'passi ' + passi);

resto = 0;
passi = 0;
for (let i = 0; i < 30 * 3; i++) {           // 3 secondi a 30 Hz
    const r = Tempo.avanzaAccumulatore(resto, 1000 / 30);
    resto = r.resto;
    passi += r.passi;
}
verifica('3 secondi a 30 Hz = 180 passi', Math.abs(passi - 180) <= 2, 'passi ' + passi);

// --- Buffer dei comandi ---
const Buffer = require('../js/Buffer.js');

sezione('Buffer');
const buf = Buffer.creaBuffer();
Buffer.spingi(buf, 'attacco', 'p1', 100);
verifica('Un comando appena premuto si consuma', Buffer.consuma(buf, 'attacco', 'p1', 103) === true);
verifica('Un comando consumato non si consuma due volte', Buffer.consuma(buf, 'attacco', 'p1', 104) === false);

Buffer.spingi(buf, 'salto', 'p1', 100);
verifica('Dentro la finestra vale', Buffer.consuma(buf, 'salto', 'p1', 105) === true);

Buffer.spingi(buf, 'salto', 'p1', 100);
verifica('Oltre la finestra scade', Buffer.consuma(buf, 'salto', 'p1', 100 + Buffer.BUFFER_FRAMI + 1) === false);

const buf2 = Buffer.creaBuffer();
Buffer.spingi(buf2, 'parata', 'p1', 10);
Buffer.spingi(buf2, 'parata', 'p1', 12);
verifica('Lo stesso comando ripetuto resta una voce sola', buf2.voci.length === 1, String(buf2.voci.length));

Buffer.spingi(buf2, 'parata', 'p2', 12);
verifica('I due giocatori hanno buffer separati', buf2.voci.length === 2, String(buf2.voci.length));

Buffer.pulisci(buf2, 500);
verifica('La pulizia toglie i comandi scaduti', buf2.voci.length === 0, String(buf2.voci.length));

// --- Regole pure ---
const Regole = require('../js/Regole.js');

sezione('Regole');
verifica('Prima del frame d\'impatto niente colpo', Regole.colpoVaRegistrato(2, 3, false) === false);
verifica('Sul frame d\'impatto il colpo vale', Regole.colpoVaRegistrato(3, 3, false) === true);
verifica('Un frame saltato non perde il colpo', Regole.colpoVaRegistrato(4, 3, false) === true);
verifica('Lo stesso attacco non colpisce due volte', Regole.colpoVaRegistrato(4, 3, true) === false);
verifica('Un lottatore libero può bufferizzare', Regole.puoBufferizzare({ isStunned: false, isDead: false }) === true);
verifica('Uno stunnato non bufferizza', Regole.puoBufferizzare({ isStunned: true, isDead: false }) === false);
verifica('Un morto non bufferizza', Regole.puoBufferizzare({ isStunned: false, isDead: true }) === false);
verifica('Un lottatore assente non bufferizza', Regole.puoBufferizzare(null) === false);

// --- Effetti ---
const Effetti = require('../js/Effetti.js');

sezione('Effetti');
const sistema = Effetti.creaSistemaEffetti();
verifica('Un sistema nuovo è vuoto', sistema.particelle.length === 0 && sistema.onde.length === 0);

Effetti.aggiungiParticelle(sistema, 100, 100, '#ffffff', 10, 6);
verifica('Le particelle nascono', sistema.particelle.length === 10);

Effetti.aggiungiParticelle(sistema, 100, 100, '#ffffff', 500, 6);
verifica('Le particelle hanno un tetto', sistema.particelle.length === Effetti.MASSIMO_PARTICELLE,
    String(sistema.particelle.length));

for (let i = 0; i < 120; i++) { Effetti.aggiornaEffetti(sistema); }
verifica('Le particelle finiscono da sole', sistema.particelle.length === 0);

Effetti.aggiungiOnda(sistema, 10, 10, '#ffd34d', 90);
verifica('L\'onda nasce e si allarga', sistema.onde.length === 1 && sistema.onde[0].raggioMassimo === 90);

Effetti.scuoti(sistema, 4);
Effetti.scuoti(sistema, 2);
verifica('La scossa tiene la forza più alta', vicino(sistema.scossa, 4, 0.001));

Effetti.tigni(sistema, '#ffd34d', 0.2, 3);
Effetti.aggiornaEffetti(sistema);
Effetti.aggiornaEffetti(sistema);
Effetti.aggiornaEffetti(sistema);
verifica('La tinta scade', sistema.tinta === null);

Effetti.segnaImpatto(sistema, 50, 50, 5);
Effetti.aggiornaEffetti(sistema);
verifica('L\'impatto conta alla rovescia', sistema.impatto !== null && sistema.impatto.timer === 4);
for (let i = 0; i < 5; i++) { Effetti.aggiornaEffetti(sistema); }
verifica('L\'impatto finisce', sistema.impatto === null);

const passate = risultati.filter(Boolean).length;
console.log('\n' + passate + '/' + risultati.length + ' verifiche passate');
process.exit(passate === risultati.length ? 0 : 1);
