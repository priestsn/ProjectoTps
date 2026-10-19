// ========================================
// Verifica del modello del menu principale
// ==========================================
// Il menu principale è fatto di dati (colonne, voci, azioni): qui si controlla
// che le colonne siano tre, che nessuna destinazione si perda e che il
// movimento della selezione faccia quello che ci si aspetta.
//
// Uso:  node tools/prova_menu.js

const risultati = [];

function verifica(nome, condizione, dettaglio) {
    risultati.push(!!condizione);
    console.log((condizione ? 'OK       ' : 'FALLITO  ') + nome.padEnd(54) + (dettaglio || ''));
}

const Menu = require('../js/MenuModello.js');

const GRUPPI = Menu.GRUPPI_PRINCIPALE;
const vociPiatte = GRUPPI.reduce((elenco, gruppo) => elenco.concat(gruppo.voci), []);

verifica('Il menu principale ha tre colonne', GRUPPI.length === 3, String(GRUPPI.length));
verifica('Le voci totali sono nove', vociPiatte.length === 9, String(vociPiatte.length));

const attese = ['vsLocale', 'vsCpu', 'vsOnline', 'ranked', 'amici', 'classifica',
    'account', 'negozio', 'settings'];
verifica('Ci sono tutte le destinazioni, una per una',
    attese.every((id) => vociPiatte.filter((v) => v.id === id).length === 1),
    vociPiatte.map((v) => v.id).join(','));

verifica('Nessun id ripetuto',
    new Set(vociPiatte.map((v) => v.id)).size === vociPiatte.length);
verifica('Ogni voce ha testo e azione',
    vociPiatte.every((v) => typeof v.testo === 'string' && v.testo.length > 0 &&
        typeof v.azione === 'string' && v.azione.length > 0));
verifica('Ogni colonna ha un titolo',
    GRUPPI.every((g) => typeof g.titolo === 'string' && g.titolo.length > 0));

verifica('La colonna GIOCA ha quattro voci', Menu.vociDi(0).length === 4, String(Menu.vociDi(0).length));
verifica('Una colonna che non esiste non ha voci', Menu.vociDi(99).length === 0);
verifica('La prima selezione è la prima voce della prima colonna',
    Menu.primoIndice(0) === 0 && Menu.voceSelezionata({ colonna: 0, indice: 0 }).voce.id === 'vsLocale');

let selezione = { colonna: 0, indice: 0 };
Menu.spostaVert(selezione, -1);
verifica('Su dalla prima voce porta all\'ultima della colonna',
    selezione.indice === 3 && Menu.voceSelezionata(selezione).voce.id === 'ranked',
    'indice ' + selezione.indice);

Menu.spostaVert(selezione, 1);
verifica('Giù dall\'ultima torna alla prima', selezione.indice === 0,
    Menu.voceSelezionata(selezione).voce.id);

selezione = { colonna: 0, indice: 3 };
Menu.spostaOrizz(selezione, 1);
verifica('A destra si passa alla colonna dopo e l\'indice si accorcia',
    selezione.colonna === 1 && selezione.indice === 1,
    'colonna ' + selezione.colonna + ' indice ' + selezione.indice);

Menu.spostaOrizz(selezione, 1);
verifica('A destra di nuovo si arriva al profilo',
    selezione.colonna === 2 && Menu.voceSelezionata(selezione).voce.id === 'negozio',
    Menu.voceSelezionata(selezione).voce.id);

Menu.spostaOrizz(selezione, 1);
verifica('A destra dall\'ultima colonna si torna alla prima',
    selezione.colonna === 0, 'colonna ' + selezione.colonna);

selezione = { colonna: 0, indice: 0 };
Menu.spostaOrizz(selezione, -1);
verifica('A sinistra dalla prima colonna si va all\'ultima',
    selezione.colonna === 2, 'colonna ' + selezione.colonna);

// le voci "wip" si vedono ma non si possono scegliere
const fintaColonna = [
    { id: 'uno', testo: 'UNO', azione: 'uno' },
    { id: 'due', testo: 'DUE', azione: 'due', wip: true },
    { id: 'tre', testo: 'TRE', azione: 'tre' }
];
const prova = { colonna: 0, indice: 0 };
Menu.spostaInElenco(fintaColonna, prova, 1);
verifica('Il movimento salta le voci non disponibili', prova.indice === 2, 'indice ' + prova.indice);

verifica('Tutte le azioni del menu sono gestite dal gioco',
    vociPiatte.every((v) => Menu.AZIONI.includes(v.azione)),
    vociPiatte.map((v) => v.azione).filter((a) => !Menu.AZIONI.includes(a)).join(',') || 'tutte gestite');

const passate = risultati.filter(Boolean).length;
console.log('\n' + passate + '/' + risultati.length + ' verifiche passate');
process.exit(passate === risultati.length ? 0 : 1);
