// ========================================
// Verifica delle uscite dalle schermate
// ==========================================
// Ogni schermata informativa deve avere un modo per tornare al menu, e il
// pulsante di logout non deve chiamarsi come quello di uscita dalla pagina:
// prima, da dentro l'account, restava solo ricaricare il browser.
//
// Uso:  node tools/prova_schermate.js

const fs = require('fs');
const path = require('path');

const risultati = [];

function verifica(nome, condizione, dettaglio) {
    risultati.push(!!condizione);
    console.log((condizione ? 'OK       ' : 'FALLITO  ') + nome.padEnd(56) + (dettaglio || ''));
}

function leggi(percorso) {
    return fs.readFileSync(path.join(__dirname, '..', percorso), 'utf8');
}

const account = leggi('js/Account.js');
const menu = leggi('js/Menu.js');

verifica('Account: esiste il pulsante TORNA AL MENU', account.indexOf('TORNA AL MENU') >= 0);

// Il pulsante deve stare DOPO moduloProfilo(): se sta prima, chi è loggato
// esce dalla funzione senza mai crearlo (era il bug).
verifica('Account: TORNA AL MENU viene creato anche da loggati',
    account.indexOf('TORNA AL MENU') > account.indexOf('moduloProfilo()'),
    'indice ' + account.indexOf('TORNA AL MENU'));

verifica('Account: il logout si chiama ESCI DALL\'ACCOUNT',
    account.indexOf("ESCI DALL\\'ACCOUNT") >= 0);

verifica('Account: non esiste più un pulsante chiamato solo ESCI',
    !/'ESCI'/.test(account));

verifica('Menu: Esc chiude le schermate informative',
    /Escape[\s\S]{0,400}STATI\.ACCOUNT/.test(menu));

verifica('Menu: Esc dal negozio ferma il negoziante',
    /chiudiNegoziante/.test(menu));

const altre = ['js/Negozio.js', 'js/Classifica.js', 'js/Amici.js', 'js/Coda.js'];
for (const file of altre) {
    const testo = leggi(file);
    verifica(file + ': ha un ritorno al menu', testo.indexOf("apriMenu('principale')") >= 0);
}

verifica('Negozio: uscendo col pulsante si ferma il negoziante',
    /chiudiNegoziante[\s\S]{0,80}apriMenu\('principale'\)/.test(leggi('js/Negozio.js')));

const passate = risultati.filter(Boolean).length;
console.log('\n' + passate + '/' + risultati.length + ' verifiche passate');
process.exit(passate === risultati.length ? 0 : 1);
