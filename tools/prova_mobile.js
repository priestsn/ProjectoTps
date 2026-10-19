// ========================================
// Verifica delle regole mobile
// ==========================================
// Il telefono vive in file suoi: `css/mobile.css` e `js/Mobile.js`. Questo test
// controlla che la separazione regga, che il desktop non sia stato toccato e
// che le regole "da dito" ci siano davvero.
//
// Uso:  node tools/prova_mobile.js

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

const esiste = (percorso) => fs.existsSync(path.join(__dirname, '..', percorso));

const mobile = leggi('css/mobile.css');
const stile = leggi('css/style.css');
const touch = leggi('js/Touch.js');
const modulo = leggi('js/Mobile.js');
const html = leggi('index.html');

// --- separazione dei file ---
verifica('css/mobile.css esiste', esiste('css/mobile.css'));
verifica('css/mobile.css è collegato dopo style.css',
    html.indexOf('css/style.css') < html.indexOf('css/mobile.css') && html.indexOf('css/mobile.css') > 0);
verifica('js/Mobile.js esiste', esiste('js/Mobile.js'));
verifica('js/Mobile.js è caricato prima di js/Touch.js',
    html.indexOf('src="js/Mobile.js') > 0
    && html.indexOf('src="js/Mobile.js') < html.indexOf('src="js/Touch.js'));

// --- il desktop non è stato toccato ---
verifica('Le regole per le finestre basse restano in style.css',
    /@media \(max-height: 720px\)/.test(stile));
verifica('style.css non ha più i blocchi dei comandi touch',
    !/@media \(max-width: 700px\)/.test(stile));
verifica('mobile.css non contiene regole solo dimensionali',
    !/@media \(max-height: 720px\)/.test(mobile));

// --- regole "da dito" ---
verifica('mobile.css filtra sul dito', /pointer: coarse/.test(mobile));
verifica('I comandi touch hanno una dimensione minima da dito',
    /min-width: 64px/.test(mobile) && /min-height: 64px/.test(mobile));
verifica('I comandi spenti sono semitrasparenti', /opacity: 0\.72/.test(mobile));
verifica('La safe area laterale è gestita', /safe-area-inset-left/.test(mobile));
verifica('L\'HUD lascia spazio alla tacca', /#hud \{[^}]*safe-area-inset/.test(mobile.replace(/\r/g, '')));
verifica('Niente zoom col dito sopra i comandi', /touch-action: none/.test(mobile));
// I commenti non contano: si tolgono prima di cercare i selettori
const mobileSenzaCommenti = mobile.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\r/g, '');
verifica('mobile.css non usa :has() (WebView vecchie)', !/:has\(/.test(mobileSenzaCommenti));

// --- modulo del dispositivo ---
verifica('js/Mobile.js definisce dispositivoTouch', /function dispositivoTouch/.test(modulo));
verifica('js/Touch.js non ridefinisce dispositivoTouch', !/function dispositivoTouch/.test(touch));
verifica('js/Touch.js usa comandiTouchUtili', /comandiTouchUtili\(\)/.test(touch));
verifica('js/Mobile.js conosce la tastiera fisica', /function segnaTastieraFisica/.test(modulo));
verifica('js/Mobile.js ricalcola scala e comandi insieme', /function aggiornaMobile/.test(modulo));
verifica('La rotazione passa da aggiornaMobile', /orientationchange[\s\S]{0,120}aggiornaMobile/.test(touch));

// --- comportamento (funzioni vere, ambiente finto) ---
// Su Node 22 `navigator` è sola lettura: si ridefinisce per poterlo fingere
function fingiNavigator(maxTouchPoints) {
    Object.defineProperty(globalThis, 'navigator', {
        value: { maxTouchPoints: maxTouchPoints },
        configurable: true,
        writable: true
    });
}

fingiNavigator(0);
global.window = { innerWidth: 1400, innerHeight: 900, matchMedia: () => ({ matches: false }) };
const Mobile = require('../js/Mobile.js');

verifica('Senza dito non è un dispositivo touch', Mobile.dispositivoTouch() === false);
fingiNavigator(5);
global.window.matchMedia = (query) => ({ matches: query === '(hover: none)' });
verifica('Con il dito è un dispositivo touch', Mobile.dispositivoTouch() === true);
verifica('I comandi servono finché non si usa la tastiera', Mobile.comandiTouchUtili() === true);

Mobile.segnaTastieraFisica();
verifica('Un tasto vero toglie i comandi a schermo', Mobile.comandiTouchUtili() === false);

global.window.innerWidth = 390;
global.window.innerHeight = 844;
verifica('Lo schermo verticale viene riconosciuto', Mobile.schermoVerticale() === true);
global.window.innerWidth = 844;
global.window.innerHeight = 390;
verifica('Lo schermo orizzontale viene riconosciuto', Mobile.schermoVerticale() === false);

const passate = risultati.filter(Boolean).length;
console.log('\n' + passate + '/' + risultati.length + ' verifiche passate');
process.exit(passate === risultati.length ? 0 : 1);
