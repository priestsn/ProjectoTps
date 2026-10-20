// ========================================
// Verifica degli acquisti di skin nel negozio
// ==========================================
// Non passa dalla rete: chiama le funzioni vere del server con un magazzino
// finto in memoria. Copre le regole che contano:
//   - una skin si compra anche possedendo già il verdellinese
//   - la skin finisce in `skins`, non in `personaggi`
//   - non si compra due volte e non si compra senza punti
//   - il catalogo espone la chiave giusta ("OusmaneDiouf:raro")
//
// Uso:  node tools/prova_negozio_skin.js

const risultati = [];

function verifica(nome, condizione, dettaglio) {
    risultati.push(!!condizione);
    console.log((condizione ? 'OK       ' : 'FALLITO  ') + nome.padEnd(58) + (dettaglio || ''));
}

const account = require('../server/account.js');

// Finto magazzino: tiene i dati in memoria invece che su disco.
function magazzinoFinto() {
    const archivio = { 'giocatori.json': { versione: 1, giocatori: {}, sessioni: {} } };
    return {
        leggi: (nome, predefinito) => (nome in archivio ? archivio[nome] : predefinito),
        scrivi: (nome, dati) => { archivio[nome] = dati; },
        accoda: () => {},
        archivio: archivio
    };
}

function giocatoreDiProva(punti) {
    return {
        id: 'prova',
        nick: 'Prova',
        punti: punti,
        personaggi: ['OusmaneDiouf'],
        skins: [],
        elo: 1000,
        vittorie: 0,
        sconfitte: 0,
        pareggi: 0,
        serie: 0
    };
}

// --- catalogo ---
const catalogo = account.negozio().voci;
const skinVoci = catalogo.filter((v) => v.skin);
verifica('Il catalogo ha due skin per verdellinese', skinVoci.length === 18, String(skinVoci.length));
verifica('Le skin "raro" costano 1000', skinVoci.filter((v) => v.skin === 'raro').every((v) => v.prezzo === 1000));
verifica('Le skin "ombrosa" costano 1500', skinVoci.filter((v) => v.skin === 'ombrosa').every((v) => v.prezzo === 1500));
verifica('Nessuna skin è regalata alla creazione',
    skinVoci.every((v) => v.ottenutoAllInizio === false));
const primaRaro = skinVoci.find((v) => v.skin === 'raro');
verifica('La chiave della skin è personaggio:skin',
    account.chiaveVoce(primaRaro) === primaRaro.personaggio + ':raro',
    account.chiaveVoce(primaRaro));
verifica('La chiave del verdellinese resta il suo id',
    account.chiaveVoce(catalogo[0]) === catalogo[0].personaggio);

// --- acquisto della skin possedendo già il verdellinese ---
let magazzino = magazzinoFinto();
let giocatore = giocatoreDiProva(1200);

const esito = account.acquista(magazzino, giocatore, 'OusmaneDiouf:raro');
verifica('La skin si compra anche col verdellinese già posseduto', esito.ok === true,
    esito.messaggio || '');
verifica('I punti sono scalati', giocatore.punti === 200, String(giocatore.punti));
verifica('La skin finisce in skins', giocatore.skins.includes('OusmaneDiouf:raro'));
verifica('Il verdellinese resta in personaggi', giocatore.personaggi.length === 1);

// --- acquisto di una skin complessa (1500) ---
magazzino = magazzinoFinto();
giocatore = giocatoreDiProva(2000);
const complessa = account.acquista(magazzino, giocatore, 'OusmaneDiouf:ombrosa');
verifica('La skin complessa si compra', complessa.ok === true, complessa.messaggio || '');
verifica('La skin complessa costa 1500', giocatore.punti === 500, String(giocatore.punti));
verifica('La skin complessa finisce in skins', giocatore.skins.includes('OusmaneDiouf:ombrosa'));
verifica('La skin raro e quella ombrosa sono distinte',
    giocatore.skins.length === 1 && !giocatore.skins.includes('OusmaneDiouf:raro'));

// --- doppio acquisto ---
magazzino = magazzinoFinto();
giocatore = giocatoreDiProva(1200);
account.acquista(magazzino, giocatore, 'OusmaneDiouf:raro');   // primo acquisto
const doppio = account.acquista(magazzino, giocatore, 'OusmaneDiouf:raro');
verifica('La stessa skin non si compra due volte', doppio.ok === false && doppio.stato === 409,
    doppio.messaggio || '');
verifica('Il secondo tentativo non scala punti', giocatore.punti === 200, String(giocatore.punti));

// --- punti insufficienti ---
magazzino = magazzinoFinto();
giocatore = giocatoreDiProva(999);
const povero = account.acquista(magazzino, giocatore, 'KwameMensah:raro');
verifica('Senza punti la skin non si compra', povero.ok === false && povero.stato === 402,
    povero.messaggio || '');
verifica('Chi non ha punti resta senza skin', giocatore.skins.length === 0);
verifica('I punti non vanno sotto zero', giocatore.punti === 999);

// --- skin inesistente ---
const inventata = account.acquista(magazzino, giocatore, 'OusmaneDiouf:arcobaleno');
verifica('Una skin inventata non esiste', inventata.ok === false && inventata.stato === 404);

// --- il vecchio modo di comprare funziona ancora ---
magazzino = magazzinoFinto();
giocatore = giocatoreDiProva(3000);
giocatore.personaggi = [];
const vecchio = account.acquista(magazzino, giocatore, 'BakariTraore');
verifica('Il vecchio acquisto per id verdellinese funziona ancora', vecchio.ok === true,
    vecchio.messaggio || '');
verifica('Il verdellinese comprato finisce in personaggi',
    giocatore.personaggi.includes('BakariTraore'));

// --- il possesso è separato: verdellinese vs skin ---
magazzino = magazzinoFinto();
giocatore = giocatoreDiProva(5000);
giocatore.personaggi = [];
giocatore.skins = [];
const soloSkin = account.acquista(magazzino, giocatore, 'AyoAdebayo:raro');
verifica('Si può comprare la skin di un verdellinese che non hai', soloSkin.ok === true);
verifica('Comprata la skin, il verdellinese NON risulta posseduto',
    giocatore.personaggi.indexOf('AyoAdebayo') === -1);

const senzaVerdellinese = account.acquista(magazzino, giocatore, 'AyoAdebayo:raro');
verifica('Ricomprare la skin resta vietato', senzaVerdellinese.ok === false);

// --- il profilo pubblico porta le skin ---
const profilo = account.pubblico(giocatore);
verifica('Il profilo pubblico espone le skin',
    Array.isArray(profilo.skins) && profilo.skins.includes('AyoAdebayo:raro'),
    JSON.stringify(profilo.skins));

const passate = risultati.filter(Boolean).length;
console.log('\n' + passate + '/' + risultati.length + ' verifiche passate');
process.exit(passate === risultati.length ? 0 : 1);
