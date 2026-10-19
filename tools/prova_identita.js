// ========================================
// Verifica dell'identità del giocatore
// ==========================================
// Un id ospite stabile, un nome leggibile e il nome giusto in ogni modalità.
//
// Uso:  node tools/prova_identita.js

const risultati = [];

function verifica(nome, condizione, dettaglio) {
    risultati.push(!!condizione);
    console.log((condizione ? 'OK       ' : 'FALLITO  ') + nome.padEnd(58) + (dettaglio || ''));
}

// Il modulo usa localStorage solo dentro ospite(): qui lo si finge.
const magazzino = {};
global.localStorage = {
    getItem: (chiave) => (chiave in magazzino ? magazzino[chiave] : null),
    setItem: (chiave, valore) => { magazzino[chiave] = String(valore); },
    removeItem: (chiave) => { delete magazzino[chiave]; }
};

global.MODALITA = { LOCALE: 'locale', CPU: 'cpu', ONLINE: 'online' };
global.modalitaPartita = global.MODALITA.LOCALE;
global.onlineStato = { nomeMio: null, nomeAvversario: null };
global.statoAccount = { dentro: false, nick: null };

const Identita = require('../js/Identita.js');

// --- generazione dell'id ---
const id = Identita.creaIdOspite(() => 0);
verifica('L\'id ospite ha la forma giusta', /^ospite-[A-Z0-9]{4}$/.test(id), id);
verifica('Con casuale 0 esce sempre lo stesso id', id === 'ospite-AAAA', id);

const idDue = Identita.creaIdOspite(() => 0.99);
verifica('Con casuale 0,99 esce un id diverso', idDue !== id, idDue);
verifica('Un valore fuori scala non rompe l\'id',
    /^ospite-[A-Z0-9]{4}$/.test(Identita.creaIdOspite(() => 1.5)));

verifica('Il nome si legge bene', Identita.nomeDaIdOspite('ospite-3F2A') === 'Ospite 3F2A');
verifica('Un id vuoto non rompe il nome', Identita.nomeDaIdOspite('') === 'Ospite ????');

// --- lettura del salvato ---
verifica('Senza testo non c\'è ospite', Identita.leggiOspiteSalvato(null) === null);
verifica('Testo non JSON -> null', Identita.leggiOspiteSalvato('{rotto') === null);
verifica('Oggetto senza id -> null', Identita.leggiOspiteSalvato('{"nome":"x"}') === null);
verifica('Id malformato -> null', Identita.leggiOspiteSalvato('{"id":"cane"}') === null);

const buono = Identita.leggiOspiteSalvato('{"id":"ospite-3F2A","creato":1,"partite":7}');
verifica('Un ospite valido viene letto', !!buono && buono.id === 'ospite-3F2A');
verifica('Se il nome manca viene ricostruito', buono.nome === 'Ospite 3F2A', buono.nome);
verifica('Il contatore partite viene letto', buono.partite === 7);

// --- ospite stabile nel browser ---
const primo = Identita.ospite();
verifica('L\'ospite viene creato la prima volta', /^ospite-/.test(primo.id), primo.id);
verifica('Il nome viene ricavato dall\'id', primo.nome === Identita.nomeDaIdOspite(primo.id));
verifica('L\'id resta lo stesso alla seconda chiamata', Identita.ospite().id === primo.id);
verifica('L\'ospite è stato salvato', !!magazzino[Identita.CHIAVE_OSPITE]);
verifica('Rileggendo lo storage si ritrova lo stesso id',
    Identita.leggiOspiteSalvato(magazzino[Identita.CHIAVE_OSPITE]).id === primo.id);

verifica('La prima partita conta 1', Identita.contaPartitaOspite() === 1);
verifica('La seconda conta 2', Identita.contaPartitaOspite() === 2);
verifica('Anche il salvato riporta 2 partite',
    Identita.leggiOspiteSalvato(magazzino[Identita.CHIAVE_OSPITE]).partite === 2);

// --- identità in uso ---
const senzaAccount = Identita.identitaCorrente();
verifica('Senza account l\'identità è un ospite', senzaAccount.tipo === 'ospite', senzaAccount.tipo);
verifica('L\'ospite ha un id', /^ospite-/.test(senzaAccount.id));

global.statoAccount = { dentro: true, nick: 'Tacco69' };
const conAccount = Identita.identitaCorrente();
verifica('Con account l\'identità è l\'account', conAccount.tipo === 'account');
verifica('Il nome dell\'account è il nick', conAccount.nome === 'Tacco69');
verifica('L\'id dell\'account è normalizzato', conAccount.id === 'acc:tacco69', conAccount.id);

// --- nomi in partita ---
global.modalitaPartita = global.MODALITA.LOCALE;
verifica('In VS LOCALE il nome di P1', Identita.nomeGiocatore('p1') === 'GIOCATORE 1');
verifica('In VS LOCALE il nome di P2', Identita.nomeGiocatore('p2') === 'GIOCATORE 2');

global.modalitaPartita = global.MODALITA.CPU;
verifica('VS CPU: P1 usa il nick', Identita.nomeGiocatore('p1') === 'Tacco69');
verifica('VS CPU: P2 è la CPU', Identita.nomeGiocatore('p2') === 'CPU');

global.modalitaPartita = global.MODALITA.ONLINE;
global.onlineStato = { nomeMio: 'Tacco69', nomeAvversario: 'Ospite 3F2A' };
verifica('Online: il mio nome', Identita.nomeGiocatore('p1') === 'Tacco69');
verifica('Online: il nome dell\'altro', Identita.nomeGiocatore('p2') === 'Ospite 3F2A');
global.onlineStato = { nomeMio: null, nomeAvversario: null };
verifica('Online senza nomi: ripiego chiaro', Identita.nomeGiocatore('p2') === 'AVVERSARIO');

// --- senza account, in VS CPU, gioca l'ospite ---
global.modalitaPartita = global.MODALITA.CPU;
global.statoAccount = { dentro: false, nick: null };
verifica('Da ospite in VS CPU si legge "Ospite XXXX"',
    /^Ospite [A-Z0-9]{4}$/.test(Identita.nomeGiocatore('p1')), Identita.nomeGiocatore('p1'));

const passate = risultati.filter(Boolean).length;
console.log('\n' + passate + '/' + risultati.length + ' verifiche passate');
process.exit(passate === risultati.length ? 0 : 1);
