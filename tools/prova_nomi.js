// ========================================
// Verifica delle parole dell'interfaccia
// ==========================================
// I lottatori si chiamano "verdellinesi". Il test legge i file davvero e
// controlla che nessuna scritta mostrata al giocatore usi ancora "personaggio".
//
// Uso:  node tools/prova_nomi.js

const fs = require('fs');
const path = require('path');

const risultati = [];

function verifica(nome, condizione, dettaglio) {
    risultati.push(!!condizione);
    console.log((condizione ? 'OK       ' : 'FALLITO  ') + nome.padEnd(58) + (dettaglio || ''));
}

function leggi(percorso) {
    return fs.readFileSync(path.join(__dirname, '..', percorso), 'utf8');
}

/**
 * Testi fra apici che finiscono a schermo. La chiave tecnica `personaggio` e i
 * campi `lottatore.personaggio` non contano: sono identificativi, non parole.
 */
function stringheVisibili(sorgente) {
    const chiaviTecniche = /^(personaggio|idPersonaggio|nomePersonaggio)$/;
    const trovate = [];

    sorgente.split('\n').forEach((riga, numero) => {
        const senzaCommento = riga.replace(/\/\/.*$/, '');
        const pezzi = senzaCommento.match(/'[^']*'|"[^"]*"/g) || [];
        pezzi.forEach((pezzo) => {
            const testo = pezzo.slice(1, -1);
            if (chiaviTecniche.test(testo)) {
                return;                      // chiave tecnica, non una parola
            }
            if (/personagg/i.test(testo)) {
                trovate.push((numero + 1) + ': ' + pezzo.trim());
            }
        });
    });

    return trovate;
}

const FILE_UI = ['js/Menu.js', 'js/Selezione.js', 'js/Online.js', 'js/Negozio.js',
                 'js/Account.js', 'js/Classifica.js', 'js/Coda.js', 'js/Amici.js',
                 'js/CerimoniaFine.js', 'index.html'];

FILE_UI.forEach((file) => {
    const trovate = stringheVisibili(leggi(file));
    verifica(file + ' non dice piu\' "personaggio"', trovate.length === 0, trovate.join(' | '));
});

verifica('index.html chiede di scegliere il verdellinese',
    /SCEGLI IL VERDELLINESE/.test(leggi('index.html')));
verifica('Il modulo si chiama js/Verdellinesi.js',
    fs.existsSync(path.join(__dirname, '..', 'js', 'Verdellinesi.js')));
verifica('js/Personaggi.js non esiste piu\'',
    !fs.existsSync(path.join(__dirname, '..', 'js', 'Personaggi.js')));
verifica('La costante si chiama VERDELLINESI',
    /const VERDELLINESI = \[/.test(leggi('js/Verdellinesi.js')));
verifica('Le costanti di nome esistono',
    /const NOME_VERDELLINESE = 'verdellinese';/.test(leggi('js/Verdellinesi.js'))
    && /const NOME_VERDELLINESI = 'verdellinesi';/.test(leggi('js/Verdellinesi.js')));
verifica('index.html carica il modulo rinominato',
    /js\/Verdellinesi\.js\?v=/.test(leggi('index.html')));
verifica('Nessun file carica piu\' Personaggi.js',
    !/js\/Personaggi\.js/.test(leggi('index.html')));

const passate = risultati.filter(Boolean).length;
console.log('\n' + passate + '/' + risultati.length + ' verifiche passate');
process.exit(passate === risultati.length ? 0 : 1);
