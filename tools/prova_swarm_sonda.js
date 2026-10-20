// tools/prova_swarm_sonda.js — controlli sulla sonda iniettata nella pagina.
// Non serve il browser: si controlla che il sorgente contenga le sonde del
// catalogo e che NON modifichi il gioco.

const fs = require('fs');
const path = require('path');

const percorso = path.join(__dirname, 'swarm', 'sonda.js');
const sorgente = fs.readFileSync(percorso, 'utf8');

const risultati = [];
function verifica(nome, condizione, dettaglio) {
    risultati.push(!!condizione);
    console.log((condizione ? 'OK   ' : 'NO   ') + nome + (dettaglio ? '  [' + dettaglio + ']' : ''));
}

verifica('espone window._swarm', sorgente.indexOf('window._swarm = sw') !== -1);

verifica('non si aggancia alle funzioni del gioco (nessuna modifica)',
    sorgente.indexOf('window.premiAzione') === -1 &&
    sorgente.indexOf('premiAzione =') === -1 &&
    sorgente.indexOf('avviaPartita =') === -1);

verifica('non scrive mai sullo stato del gioco',
    sorgente.indexOf('Player.health =') === -1 && sorgente.indexOf('.health =') === -1);

['eccezione', 'promessa-non-gestita', 'ciclo-blocco', 'ritmo-basso', 'valore-fuori-scala',
    'timer-negativo', 'timer-fermo', 'schermo-senza-uscita', 'azione-persa', 'colpo-senza-danno'
].forEach((firma) => {
    verifica('sonda presente: ' + firma, sorgente.indexOf("'" + firma + "'") !== -1);
});

verifica('ascolta gli errori della pagina', sorgente.indexOf("addEventListener('error'") !== -1);
verifica('ascolta le promesse rifiutate', sorgente.indexOf('unhandledrejection') !== -1);
verifica('campiona da sola (setInterval)', sorgente.indexOf('setInterval(') !== -1);
verifica('sorveglia da vicino mentre un\'azione è in corso', sorgente.indexOf('_sorveglianza') !== -1);
verifica('limita la ripetizione delle stesse anomalie', sorgente.indexOf('ultimaFirma') !== -1);
verifica('chiude con una IIFE (non sporca lo scope globale)',
    sorgente.trim().indexOf('(function () {') === 0 || sorgente.indexOf('(function () {') !== -1);

const passate = risultati.filter(Boolean).length;
console.log('\n' + passate + '/' + risultati.length + ' verifiche passate');
process.exit(passate === risultati.length ? 0 : 1);
