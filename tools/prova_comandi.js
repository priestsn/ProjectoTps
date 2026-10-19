// ========================================
// Verifica delle regole dei comandi
// ==========================================
// Regole pure usate dal ciclo di gioco per capire se una parata va chiusa, se
// un comando in coda è ancora valido e se un attacco si può cancellare.
//
// Uso:  node tools/prova_comandi.js

const risultati = [];

function verifica(nome, condizione, dettaglio) {
    risultati.push(!!condizione);
    console.log((condizione ? 'OK       ' : 'FALLITO  ') + nome.padEnd(54) + (dettaglio || ''));
}

const Comandi = require('../js/Comandi.js');

// --- parata da chiudere ---
verifica('Parata attiva e tasto lasciato: si chiude',
    Comandi.parataDaChiudere({ isParata: true }, false) === true);
verifica('Parata attiva e tasto ancora premuto: resta',
    Comandi.parataDaChiudere({ isParata: true }, true) === false);
verifica('Nessuna parata: non c\'è niente da chiudere',
    Comandi.parataDaChiudere({ isParata: false }, false) === false);
verifica('Lottatore assente: nessun errore',
    Comandi.parataDaChiudere(null, false) === false);

// --- carica da rilasciare ---
verifica('Carica in corso e tasto lasciato: si rilascia',
    Comandi.caricaDaRilasciare({ isCaricando: true }, false) === true);
verifica('Carica in corso e tasto premuto: continua',
    Comandi.caricaDaRilasciare({ isCaricando: true }, true) === false);

// --- un comando in coda vale finché il tasto è giù, altrimenti ha la sua finestra ---
const voce = { azione: 'attacco', giocatore: 'p1', scade: 100 };
verifica('Comando in coda, tasto ancora giù: vale anche dopo la finestra',
    Comandi.comandoAncoraValido(voce, 200, true) === true);
verifica('Comando in coda, tasto lasciato dentro la finestra: vale',
    Comandi.comandoAncoraValido(voce, 100, false) === true);
verifica('Comando in coda, tasto lasciato fuori finestra: scade',
    Comandi.comandoAncoraValido(voce, 101, false) === false);
verifica('Voce assente: non vale',
    Comandi.comandoAncoraValido(null, 0, true) === false);

// --- finestra di recupero dell'attacco ---
verifica('La finestra di recupero è 16 passi', Comandi.FINESTRA_RECUPERO === 16,
    String(Comandi.FINESTRA_RECUPERO));
verifica('Attacco appena partito: non si cancella',
    Comandi.puoCancellareAttacco({ isAttacking: true, framesAttacco: 2 }, 16) === false);
verifica('Attacco arrivato al recupero: si cancella',
    Comandi.puoCancellareAttacco({ isAttacking: true, framesAttacco: 16 }, 16) === true);
verifica('Attacco non in corso: niente da cancellare',
    Comandi.puoCancellareAttacco({ isAttacking: false, framesAttacco: 40 }, 16) === false);

const passate = risultati.filter(Boolean).length;
console.log('\n' + passate + '/' + risultati.length + ' verifiche passate');
process.exit(passate === risultati.length ? 0 : 1);
