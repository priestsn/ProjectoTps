// ========================================
// Verifica del consenso di fine partita online
// ==========================================
// Rivincita e cambio verdellinese devono portare a un esito solo quando le due
// scelte sono uguali: è la regola che impedisce all'host di decidere da solo.
// L'uscita al menu invece è libera: basta la scelta di uno dei due.
//
// Uso:  node tools/prova_online_fine.js

const risultati = [];

function verifica(nome, condizione, dettaglio) {
    risultati.push(!!condizione);
    console.log((condizione ? 'OK       ' : 'FALLITO  ') + nome.padEnd(54) + (dettaglio || ''));
}

const Fine = require('../js/OnlineFine.js');

// --- stato iniziale ---
const vuoto = Fine.consensoIniziale();
verifica('Consenso iniziale: nessuna scelta',
    vuoto.mia === null && vuoto.altra === null);
verifica('Consenso appena creato: attesa',
    Fine.esitoFine(vuoto) === 'attesa');
verifica('Consenso nullo: attesa senza errori',
    Fine.esitoFine(null) === 'attesa');

// --- una scelta sola ---
const soloMia = Fine.segnaSceltaFine(vuoto, 'mia', 'rivincita');
verifica('Solo la mia rivincita: ancora attesa',
    Fine.esitoFine(soloMia) === 'attesa', Fine.esitoFine(soloMia));
verifica('La scelta non modifica il consenso di partenza',
    vuoto.mia === null);

// --- accordo sulla rivincita ---
const rivincita = Fine.segnaSceltaFine(soloMia, 'altra', 'rivincita');
verifica('Rivincita chiesta da entrambi: si parte',
    Fine.esitoFine(rivincita) === 'rivincita', Fine.esitoFine(rivincita));

// --- accordo sul cambio verdellinese ---
const cambio = Fine.segnaSceltaFine(
    Fine.segnaSceltaFine(vuoto, 'mia', 'cambia'), 'altra', 'cambia');
verifica('Cambio chiesto da entrambi: si cambia',
    Fine.esitoFine(cambio) === 'cambia');

// --- disaccordo (il cuore del problema: l'host non comanda) ---
const litigio = Fine.segnaSceltaFine(soloMia, 'altra', 'cambia');
verifica('Io rivincita, lui cambia: nessuno decide da solo',
    Fine.esitoFine(litigio) === 'disaccordo', Fine.esitoFine(litigio));
verifica('Disaccordo: la rivincita NON parte',
    Fine.esitoFine(litigio) !== 'rivincita');

// --- si può cambiare idea ---
const ripensamento = Fine.segnaSceltaFine(litigio, 'altra', 'rivincita');
verifica('L\'avversario cambia idea: si torna d\'accordo',
    Fine.esitoFine(ripensamento) === 'rivincita');

// --- l'uscita è libera ---
const escoSoloIo = Fine.segnaSceltaFine(vuoto, 'mia', 'esci');
verifica('Esco io da solo: si esce subito',
    Fine.esitoFine(escoSoloIo) === 'esci', Fine.esitoFine(escoSoloIo));
verifica('Esce solo l\'avversario: si esce lo stesso',
    Fine.esitoFine(Fine.segnaSceltaFine(vuoto, 'altra', 'esci')) === 'esci');
verifica('Uscita: non serve l\'accordo',
    Fine.serveAccordo('esci') === false);
verifica('Rivincita: serve l\'accordo',
    Fine.serveAccordo('rivincita') === true);
verifica('Cambio verdellinese: serve l\'accordo',
    Fine.serveAccordo('cambia') === true);

// --- scelte non valide ---
verifica('Scelta inventata: ignorata',
    Fine.esitoFine(Fine.segnaSceltaFine(vuoto, 'mia', 'patatine')) === 'attesa');
verifica('Lato inventato: ignorato',
    Fine.segnaSceltaFine(vuoto, 'terzi', 'esci').altra === null);
verifica('Consenso assente: segnare non esplode',
    Fine.segnaSceltaFine(null, 'mia', 'rivincita').mia === 'rivincita');

// --- testi per l'interfaccia ---
verifica('Nessuna voce di menu mostra "undefined"',
    Fine.testoStatoFine(Fine.consensoIniziale(), 'das').indexOf('undefined') === -1,
    Fine.testoStatoFine(Fine.consensoIniziale(), 'das'));
verifica('Testo in attesa nomina l\'avversario',
    Fine.testoStatoFine(soloMia, 'das').indexOf('das') >= 0,
    Fine.testoStatoFine(soloMia, 'das'));
verifica('Testo di disaccordo dice cosa ha scelto l\'altro',
    Fine.testoStatoFine(litigio, 'das').indexOf('CAMBIA VERDELLINESI') >= 0);
verifica('Etichetta: accettata quando coincide',
    Fine.etichettaFinePartita('rivincita', rivincita) === 'RIVINCITA (accettata)',
    Fine.etichettaFinePartita('rivincita', rivincita));
verifica('Etichetta: in attesa quando l\'ho scelta solo io',
    Fine.etichettaFinePartita('rivincita', soloMia) === 'RIVINCITA (in attesa)');
verifica('Etichetta normale senza consenso',
    Fine.etichettaFinePartita('cambia', null) === 'CAMBIA VERDELLINESI');

const passate = risultati.filter(Boolean).length;
console.log('\n' + passate + '/' + risultati.length + ' verifiche passate');
process.exit(passate === risultati.length ? 0 : 1);
