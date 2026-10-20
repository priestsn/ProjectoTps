// tools/prova_swarm_politica.js — le decisioni del bot, senza browser.
// La politica è pura: se sbaglia, sbaglia qui, non in partita.

const path = require('path');
const fs = require('fs');

const percorso = path.join(__dirname, 'swarm', 'politica.js');
const { prossimaAzione, azioneCasuale, casualeConSeme, DISTANZA_ATTACCO } = require(percorso);

const risultati = [];
function verifica(nome, condizione, dettaglio) {
    risultati.push(!!condizione);
    console.log((condizione ? 'OK   ' : 'NO   ') + nome + (dettaglio ? '  [' + dettaglio + ']' : ''));
}

// Stato di partenza: i due lottatori si vedono, nessuno dei due sta facendo nulla.
function statoBase(modifiche) {
    return Object.assign({
        stato: 'partita',
        gameOver: false,
        timer: 55,
        p1: { x: 400, y: 700, vita: 100, stamina: 90, ultimate: 0, attacco: false, parata: false, stun: false, danno: false },
        p2: { x: 470, y: 700, vita: 100, stamina: 90, ultimate: 0, attacco: false, parata: false, stun: false, danno: false }
    }, modifiche || {});
}

const fermo = () => 0.5;

verifica('senza stato non decide nulla', prossimaAzione(null, fermo) === null);
verifica('fuori partita non decide nulla',
    prossimaAzione(statoBase({ stato: 'menu' }), fermo) === null);
verifica('a partita finita non decide nulla',
    prossimaAzione(statoBase({ gameOver: true }), fermo) === null);
verifica('con lo stun non decide nulla',
    prossimaAzione(statoBase({ p1: Object.assign({}, statoBase().p1, { stun: true }) }), fermo) === null);
verifica('mentre incassa il danno non decide nulla',
    prossimaAzione(statoBase({ p1: Object.assign({}, statoBase().p1, { danno: true }) }), fermo) === null);

verifica('avversario vicino: attacca', prossimaAzione(statoBase(), fermo) === 'attacco');

verifica('avversario lontano a destra: va a destra',
    prossimaAzione(statoBase({ p2: Object.assign({}, statoBase().p2, { x: 800 }) }), fermo) === 'destra');
verifica('avversario lontano a sinistra: va a sinistra',
    prossimaAzione(statoBase({ p2: Object.assign({}, statoBase().p2, { x: 100 }) }), fermo) === 'sinistra');

verifica('avversario che attacca e vicino: para',
    prossimaAzione(statoBase({ p2: Object.assign({}, statoBase().p2, { attacco: true }) }), fermo) === 'parata');

verifica('ultimate carica e avversario vicino: ultimate',
    prossimaAzione(statoBase({
        p1: Object.assign({}, statoBase().p1, { ultimate: 100 }),
        p2: Object.assign({}, statoBase().p2, { x: 600 })
    }), fermo) === 'ultimate');

verifica('sotto la distanza d\'attacco la distanza è quella dichiarata',
    DISTANZA_ATTACCO === 150, String(DISTANZA_ATTACCO));

// --- generatore casuale ---
verifica('stesso seme, stesso numero', casualeConSeme(7)() === casualeConSeme(7)());
verifica('semi diversi, numeri diversi', casualeConSeme(7)() !== casualeConSeme(8)());
verifica('il generatore resta fra 0 e 1', (function () {
    const dado = casualeConSeme(42);
    for (let giro = 0; giro < 500; giro++) {
        const valore = dado();
        if (valore < 0 || valore >= 1) return false;
    }
    return true;
})());

verifica('azioneCasuale restituisce un\'azione vera',
    ['sinistra', 'destra', 'salto', 'attacco', 'parata'].indexOf(azioneCasuale(casualeConSeme(1))) !== -1);

// --- il modulo è caricabile anche dal browser (doppia modalità, come il resto del repo) ---
const sorgente = fs.readFileSync(percorso, 'utf8');
verifica('il modulo ha la doppia modalità (browser + require)',
    sorgente.indexOf("if (typeof module !== 'undefined' && module.exports)") !== -1);
verifica('il modulo non tocca il DOM', sorgente.indexOf('document.') === -1);

const passate = risultati.filter(Boolean).length;
console.log('\n' + passate + '/' + risultati.length + ' verifiche passate');
process.exit(passate === risultati.length ? 0 : 1);
