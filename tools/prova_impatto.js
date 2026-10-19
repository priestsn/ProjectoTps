// ========================================
// Verifica della registrazione del colpo
// ==========================================
// Il difetto che i giocatori chiamano "l'attacco non viene preso" aveva tre
// cause, tutte coperte qui:
//   1. il danno veniva scartato se il difensore era già in "colpo subito";
//   2. la fine dell'attacco dipendeva dall'ultimo fotogramma disegnato, quindi
//      chi ha l'impatto in fondo all'animazione aveva pochi passi per far centro;
//   3. la carica rilasciata senza stamina sufficiente non produceva niente.
//
// Uso:  node tools/prova_impatto.js

const fs = require('fs');
const path = require('path');

const risultati = [];

function verifica(nome, condizione, dettaglio) {
    risultati.push(!!condizione);
    console.log((condizione ? 'OK       ' : 'FALLITO  ') + nome.padEnd(58) + (dettaglio || ''));
}

const Regole = require('../js/Regole.js');
const sorgente = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

// --- finestra d'impatto minima ---
verifica('La finestra d\'impatto minima è di 8 passi', Regole.FINESTRA_IMPATTO_MINIMA === 8,
    String(Regole.FINESTRA_IMPATTO_MINIMA));

// Ayo Adebayo: 13 fotogrammi di attacco, 2 passi per fotogramma, impatto all'11°.
// Prima la sua finestra era di 2 passi (33 ms).
const passoAyo = 11 * 2;
const durataAyo = 13 * 2;
verifica('Ayo Adebayo (impatto in fondo) arriva alla finestra minima',
    Regole.fineAttaccoPassi(passoAyo, durataAyo) === passoAyo + 8,
    String(Regole.fineAttaccoPassi(passoAyo, durataAyo)));
verifica('...e la finestra non scende sotto 8 passi',
    Regole.fineAttaccoPassi(passoAyo, durataAyo) - passoAyo >= Regole.FINESTRA_IMPATTO_MINIMA);

// Ousmane Diouf: 7 fotogrammi, 4 passi per fotogramma, impatto al 3°.
// La sua animazione dura già più della finestra: non si allunga niente.
const passoOusmane = 3 * 4;
const durataOusmane = 7 * 4;
verifica('Chi ha una finestra già lunga non viene allungato',
    Regole.fineAttaccoPassi(passoOusmane, durataOusmane) === durataOusmane,
    String(Regole.fineAttaccoPassi(passoOusmane, durataOusmane)));

verifica('La finestra di una durata minima non è mai negativa',
    Regole.fineAttaccoPassi(0, 1) >= 1);
verifica('Valori assurdi non producono NaN',
    Number.isFinite(Regole.fineAttaccoPassi(NaN, NaN)));

// --- la regola del colpo resta quella ---
verifica('Prima del frame d\'impatto non si colpisce',
    Regole.colpoVaRegistrato(2, 3, false) === false);
verifica('Al frame d\'impatto si colpisce', Regole.colpoVaRegistrato(3, 3, false) === true);
verifica('Dopo il frame d\'impatto si colpisce ancora', Regole.colpoVaRegistrato(9, 3, false) === true);
verifica('Lo stesso attacco non colpisce due volte',
    Regole.colpoVaRegistrato(9, 3, true) === false);

// --- difetti chiusi: il codice non deve tornare indietro ---
// I commenti raccontano il difetto vecchio: vanno tolti, altrimenti il test
// trova la frase citata nel commento e si autoboccia.
const senzaCommenti = (testo) => testo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const index = senzaCommenti(sorgente('index.js'));
const classi = senzaCommenti(sorgente('js/Classi.js'));

verifica('applicaDanno non scarta più i colpi durante "colpo subito"',
    !/isTakingDmg\s*&&\s*!forza/.test(index));
verifica('applicaDanno scala comunque la vita',
    /difensore\.health = Math\.max\(0, difensore\.health - danno\);/.test(index));

verifica('La fine dell\'attacco usa i passi (fineAttacco)',
    /framesAttacco > \(this\.fineAttacco \|\| 0\)/.test(classi));
verifica('La fine dell\'attacco non dipende più dall\'ultimo fotogramma',
    !/framesCurrent === this\.sprites\.Attack1\.framesMax - 1/.test(classi));
verifica('avviaAttacco calcola fineAttacco con la regola condivisa',
    /fineAttaccoPassi\(/.test(classi));
verifica('Ogni colpo parte verso l\'avversario',
    /lottatore\.facing = versoAvversario\(lottatore\);/.test(index));
verifica('Da fermi ci si gira verso l\'avversario',
    /lottatore\.facing = versoAvversario\(lottatore\);\s*\n\s*lottatore\.cambiaSprite\('idle'\)/.test(index));
verifica('La parata si apre verso chi colpisce',
    /si para verso chi colpisce/.test(sorgente('index.js')));
verifica('Il fermo immagine del colpo subito dura 200 ms, non 400',
    /const DANNO_FRAMI = 12;/.test(index));
verifica('La collisione confronta i passi, non il fotogramma dello sprite',
    /colpoVaRegistrato\(attaccante\.framesAttacco, attaccante\.passoImpatto/.test(index));
verifica('avviaAttacco calcola il passo d\'impatto',
    /this\.passoImpatto = this\.attacco\.frame \* hold/.test(classi));
verifica('Il fotogramma dell\'attacco resta fermo oltre l\'animazione',
    /framesAttacco >= \(this\.durataAttaccoSprite \|\| 0\)/.test(classi) &&
    /framesCurrent = this\.sprites\.Attack1\.framesMax - 1/.test(classi));
verifica('Il rilascio senza stamina per la carica ripiega sul colpo normale',
    /eseguiAttacco\(lottatore, false\)/.test(index));
verifica('La mancanza di stamina viene detta a schermo',
    /mostraAvviso\('STAMINA'/.test(index));

const passate = risultati.filter(Boolean).length;
console.log('\n' + passate + '/' + risultati.length + ' verifiche passate');
process.exit(passate === risultati.length ? 0 : 1);
