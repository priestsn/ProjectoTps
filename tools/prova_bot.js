// ========================================
// Verifica del bot Guissè
// ==========================================
// Guissè è un giocatore del server, non uno scherzo lato client: qui si
// controlla che esista, che stia in classifica con 2198, che non si possa
// autenticare come lui, che la coda lo scelga dopo qualche secondo e che una
// partita contro di lui aggiorni DAVVERO l'ELO di tutti e due.
//
// Uso:  node tools/prova_bot.js

const risultati = [];

function verifica(nome, condizione, dettaglio) {
    risultati.push(!!condizione);
    console.log((condizione ? 'OK       ' : 'FALLITO  ') + nome.padEnd(58) + (dettaglio || ''));
}

const account = require('../server/account.js');
const bot = require('../server/bot.js');
const coda = require('../server/coda.js');
const partite = require('../server/partite.js');
const classifica = require('../server/classifica.js');

// Magazzino finto: tutto in memoria, nessun file scritto su disco.
function magazzinoFinto() {
    const archivio = {};
    return {
        leggi: (nome, predefinito) => (nome in archivio ? archivio[nome] : predefinito),
        scrivi: (nome, dati) => { archivio[nome] = JSON.parse(JSON.stringify(dati)); },
        accoda: () => {},
        percorso: (nome) => nome,
        archivio: archivio
    };
}

// --- il bot esiste, con l'ELO chiesto ---
let magazzino = magazzinoFinto();
const record = bot.assicura(magazzino, account);

verifica('Il bot si chiama Guissè', record.nick === 'Guissè', record.nick);
verifica('Il bot parte a 2198', record.elo === 2198, String(record.elo));
verifica('Il bot è marcato come bot', record.bot === true);
verifica('Il bot non è provvisorio', record.provvisorio === false);
verifica('Il bot possiede tutti i verdellinesi', record.personaggi.length === 9,
    String(record.personaggi.length));

// assicura() chiamato due volte non crea doppioni
bot.assicura(magazzino, account);
const quantiBot = Object.values(magazzino.archivio['giocatori.json'].giocatori)
    .filter((g) => g.bot === true).length;
verifica('Chiamarlo due volte non duplica il bot', quantiBot === 1, String(quantiBot));

// --- non ci si può autenticare come Guissè ---
const tentativo = account.accedi(magazzino, { nick: 'Guissè', password: 'qualunque' });
verifica('Nessuno può entrare nell\'account del bot', tentativo.ok === false,
    tentativo.messaggio || '');

// --- sta in classifica, e sta davanti ---
const tabella = classifica.classifica(magazzino, 50);
const posizioneBot = tabella.classifica.findIndex((voce) => voce.bot === true);
verifica('Il bot compare in classifica', posizioneBot >= 0, 'indice ' + posizioneBot);
verifica('Il bot è il primo della classifica', posizioneBot === 0);
verifica('In classifica mostra 2198', tabella.classifica[posizioneBot].elo === 2198,
    String(tabella.classifica[posizioneBot].elo));
verifica('In classifica ha la lega più alta', tabella.classifica[posizioneBot].lega === 'Maestro',
    tabella.classifica[posizioneBot].lega);

// --- uno sfidante vero ---
const iscrizione = account.iscrivi(magazzino, { nick: 'Sfidante', password: 'provabot123' });
verifica('Lo sfidante si iscrive', iscrizione.ok === true, iscrizione.messaggio || '');

const idSfidante = iscrizione.giocatore.id;
let sfidante = () => magazzino.archivio['giocatori.json'].giocatori[idSfidante];
const eloInizialeSfidante = sfidante().elo;

// --- la coda lo abbina al bot solo dopo l'attesa ---
coda.entra(magazzino, sfidante(), partite);

const inCoda = magazzino.archivio['coda.json'];
verifica('Lo sfidante è in coda', Array.isArray(inCoda.inAttesa) && inCoda.inAttesa.length >= 1,
    String((inCoda.inAttesa || []).length));

// adesso la coda è vecchia: come se aspettasse da 10 secondi
inCoda.inAttesa.forEach((voce) => { voce.entrato = Date.now() - 10000; });
magazzino.scrivi('coda.json', inCoda);

const stato = coda.statoCoda(magazzino, sfidante());
verifica('Dopo l\'attesa arriva l\'abbinamento', stato.stato === 'abbinato', stato.stato);
verifica('L\'avversario è il bot', stato.bot === true);
verifica('L\'avversario si chiama Guissè', stato.avversario === 'Guissè', stato.avversario);
verifica('La partita ranked è già aperta', !!stato.partitaId);

// --- il bot resta riconoscibile alla lettura successiva ---
// (il primo giro risponde "appena abbinato", i successivi leggono
// l'abbinamento salvato: devono dire comunque che è il bot, altrimenti il
// client aspetta il codice di una stanza che non esiste)
const seconda = coda.statoCoda(magazzino, sfidante());
verifica('L\'abbinamento ricorda che è il bot', seconda.bot === true, JSON.stringify(seconda).slice(0, 90));
verifica('L\'abbinamento ricorda la partita', seconda.partitaId === stato.partitaId);

// --- la partita è ranked e punta al bot ---
const partita = magazzino.archivio['partite.json'].partite[stato.partitaId];
verifica('La partita è ranked', partita.modo === 'ranked', partita.modo);
verifica('La partita ha il bot come avversario', partita.avversarioId === record.id,
    String(partita.avversarioId));

// la coda è stata svuotata
verifica('Il giocatore è uscito dalla coda',
    !magazzino.archivio['coda.json'].inAttesa.some((voce) => voce.giocatore === idSfidante));

// --- concludere contro il bot aggiorna l'ELO di tutti e due ---
const esito = partite.concludiPartita(magazzino, sfidante(), {
    partitaId: stato.partitaId,
    esito: 'vittoria'
}, account.regole());

verifica('La partita si conclude', esito.ok === true, esito.messaggio || '');
verifica('Lo sfidante guadagna ELO', sfidante().elo > eloInizialeSfidante,
    eloInizialeSfidante + ' -> ' + sfidante().elo);

const eloBotDopo = magazzino.archivio['giocatori.json'].giocatori[bot.ID].elo;
verifica('Il bot perde ELO quando perde', eloBotDopo < 2198, '2198 -> ' + eloBotDopo);
verifica('La somma degli ELO resta invariata',
    (sfidante().elo + eloBotDopo) === (eloInizialeSfidante + 2198),
    String(sfidante().elo + eloBotDopo) + ' vs ' + (eloInizialeSfidante + 2198));
verifica('La partita conta come ranked per lo sfidante',
    (sfidante().partiteRanked || 0) >= 1, String(sfidante().partiteRanked));

// --- il doppio invio resta vietato ---
const doppio = partite.concludiPartita(magazzino, sfidante(), {
    partitaId: stato.partitaId,
    esito: 'vittoria'
}, account.regole());
verifica('Lo stesso esito non si invia due volte', doppio.ok === false, doppio.messaggio || '');

// --- il bot non deve comparire come avversario di se stesso ---
const controSeStesso = partite.avviaPartita(magazzino, magazzino.archivio['giocatori.json'].giocatori[bot.ID], {
    modo: 'ranked', avversario: 'Guissè'
});
verifica('Il bot non può sfidare se stesso', controSeStesso.ok === false,
    controSeStesso.messaggio || '');

const passate = risultati.filter(Boolean).length;
console.log('\n' + passate + '/' + risultati.length + ' verifiche passate');
process.exit(passate === risultati.length ? 0 : 1);
