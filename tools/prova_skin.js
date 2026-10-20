// ========================================
// Verifica delle skin dei verdellinesi
// ==========================================
// Le skin sono ricolorazioni: per il gioco è solo un'altra cartella di sprite.
// Qui si controlla che le cartelle esistano davvero, che la chiave del negozio
// sia quella giusta e che la scelta di cosa indossare funzioni.
//
// Uso:  node tools/prova_skin.js

const fs = require('fs');
const path = require('path');

const risultati = [];

function verifica(nome, condizione, dettaglio) {
    risultati.push(!!condizione);
    console.log((condizione ? 'OK       ' : 'FALLITO  ') + nome.padEnd(56) + (dettaglio || ''));
}

// --- finto localStorage per provare possesso e scelta ---
const magazzino = {};
global.localStorage = {
    getItem: (chiave) => (chiave in magazzino ? magazzino[chiave] : null),
    setItem: (chiave, valore) => { magazzino[chiave] = String(valore); },
    removeItem: (chiave) => { delete magazzino[chiave]; }
};

const Skins = require('../js/Skins.js');
const RADICE = path.join(__dirname, '..');

// --- cartelle e file veri ---
const personaggi = fs.readdirSync(path.join(RADICE, 'assets', 'Personaggi'))
    .filter((nome) => fs.statSync(path.join(RADICE, 'assets', 'Personaggi', nome)).isDirectory());

verifica('Ci sono i nove verdellinesi', personaggi.length === 9, String(personaggi.length));

const STATI_SKIN = ['idle', 'run', 'attack', 'parry', 'takehit', 'death', 'jump', 'fall'];
let completi = 0;
const mancanti = [];
for (const personaggio of personaggi) {
    for (const skin of ['raro', 'ombrosa']) {
        const cartella = path.join(RADICE, 'assets', 'Skins', personaggio + '-' + skin);
        const ok = fs.existsSync(cartella) &&
            STATI_SKIN.every((s) => fs.existsSync(path.join(cartella, s + '.png'))) &&
            fs.existsSync(path.join(cartella, 'ritratto.png'));
        if (ok) completi++;
        else mancanti.push(personaggio + '-' + skin);
    }
}
verifica('Ogni verdellinese ha le skin "raro" e "ombrosa"', completi === personaggi.length * 2,
    completi + '/' + personaggi.length * 2 + (mancanti.length ? ' mancano: ' + mancanti.slice(0, 4).join(', ') : ''));

// --- chiavi e nomi ---
verifica('Chiave di una skin', Skins.chiaveSkin('OusmaneDiouf', 'raro') === 'OusmaneDiouf:raro');
verifica('Cartella sprite della skin',
    Skins.cartellaSkin('OusmaneDiouf', 'raro') === './assets/Skins/OusmaneDiouf-raro/',
    Skins.cartellaSkin('OusmaneDiouf', 'raro'));
verifica('Skin inesistente: nessuna cartella', Skins.cartellaSkin('OusmaneDiouf', 'arcobaleno') === null);
verifica('Nome colore della skin', Skins.nomeColoreSkin('AmaraDiallo', 'raro') === 'Smeraldo',
    Skins.nomeColoreSkin('AmaraDiallo', 'raro'));
verifica('Il prezzo della skin rara è 1000', Skins.SKINS.raro.prezzo === 1000,
    String(Skins.SKINS.raro.prezzo));

// --- possesso ---
magazzino['uvsf7-skins-possedute'] = JSON.stringify([]);
verifica('Senza acquisti non possiede niente', Skins.possiedeSkin('OusmaneDiouf', 'raro') === false);
verifica('Senza skin indossate non indossa niente', Skins.skinIndossata('OusmaneDiouf') === null);

Skins.aggiungiSkinLocale('OusmaneDiouf', 'raro');
verifica('Dopo l\'acquisto la skin è posseduta', Skins.possiedeSkin('OusmaneDiouf', 'raro') === true);
verifica('Possedere la skin non la indossa da sola', Skins.skinIndossata('OusmaneDiouf') === null);

// --- indossare ---
verifica('Indossare restituisce la skin attiva', Skins.indossaSkin('OusmaneDiouf', 'raro') === 'raro');
verifica('La skin indossata viene ricordata', Skins.skinIndossata('OusmaneDiouf') === 'raro');
verifica('Togliere la skin torna all\'aspetto base', Skins.indossaSkin('OusmaneDiouf', null) === null);
verifica('Dopo averla tolta non risulta indossata', Skins.skinIndossata('OusmaneDiouf') === null);

Skins.indossaSkin('OusmaneDiouf', 'raro');
verifica('Una skin posseduta si può indossare', Skins.skinIndossata('OusmaneDiouf') === 'raro');

// una skin non posseduta non si può indossare
verifica('Una skin non posseduta non si indossa', Skins.indossaSkin('KwameMensah', 'raro') === null);
verifica('Il tentativo non sporca la scelta', Skins.skinIndossata('KwameMensah') === null);

// --- verso il gioco ---
global.VERDELLINESI = [{
    id: 'OusmaneDiouf',
    nome: 'Ousmane Diouf',
    statistica: 1,
    sprite: { cartella: './assets/Personaggi/OusmaneDiouf/', frames: { idle: 11 } }
}];

const conSkin = Skins.personaggioConSkin('OusmaneDiouf');
verifica('In partita si usa la cartella della skin',
    conSkin.sprite.cartella === './assets/Skins/OusmaneDiouf-raro/',
    conSkin.sprite.cartella);
verifica('Le statistiche restano quelle del verdellinese', conSkin.statistica === 1);
verifica('Il verdellinese di base non viene modificato',
    global.VERDELLINESI[0].sprite.cartella === './assets/Personaggi/OusmaneDiouf/');
verifica('I fotogrammi restano gli stessi', conSkin.sprite.frames.idle === 11);

Skins.indossaSkin('OusmaneDiouf', null);
verifica('Senza skin si torna allo sprite originale',
    Skins.personaggioConSkin('OusmaneDiouf').sprite.cartella === './assets/Personaggi/OusmaneDiouf/');
verifica('Verdellinese inesistente: nessun errore', Skins.personaggioConSkin('Boh') === null);

// --- catalogo del negozio ---
const Negozio = require('../js/Negozio.js');
const voci = Negozio.CATALOGO_PREDEFINITO;
const skin = voci.filter((v) => v.skin);
const verdellinesi = voci.filter((v) => !v.skin);

verifica('Il catalogo ha due skin per verdellinese', skin.length === 18, String(skin.length));
verifica('Le skin "raro" costano 1000',
    skin.filter((v) => v.skin === 'raro').every((v) => v.prezzo === 1000));
verifica('Le skin "ombrosa" costano 1500',
    skin.filter((v) => v.skin === 'ombrosa').every((v) => v.prezzo === 1500),
    String(skin.filter((v) => v.skin === 'ombrosa').length) + ' voci');
verifica('Ogni skin ha la sua cartella di sprite',
    skin.every((v) => Skins.cartellaSkin(v.personaggio, v.skin) !== null));
verifica('Nessuna skin è gratis all\'inizio', skin.every((v) => v.ottenutoAllInizio === false));
verifica('Ogni verdellinese ha la skin "raro"',
    verdellinesi.every((v) => skin.some((s) => s.skin === 'raro' && s.personaggio === v.personaggio)));
verifica('Ogni verdellinese ha la skin "ombrosa"',
    verdellinesi.every((v) => skin.some((s) => s.skin === 'ombrosa' && s.personaggio === v.personaggio)));
verifica('La chiave della skin è personaggio:skin',
    Negozio.chiaveDiVoce({ personaggio: 'AyoAdebayo', skin: 'raro' }) === 'AyoAdebayo:raro');
verifica('La chiave del verdellinese è il suo id',
    Negozio.chiaveDiVoce({ personaggio: 'AyoAdebayo' }) === 'AyoAdebayo');
// Il nome arriva dal catalogo (il server lo manda): "Raro Azzurro"
const skinZuri = skin.find((v) => v.personaggio === 'ZuriNkosi');
verifica('Il nome della skin è leggibile',
    Negozio.nomeSkin(skinZuri) === 'Raro Azzurro', Negozio.nomeSkin(skinZuri));

// Senza `nome` nel catalogo il nome si ricava dal colore (js/Skins.js)
global.nomeColoreSkin = Skins.nomeColoreSkin;
verifica('Senza nome nel catalogo si usa il colore',
    Negozio.nomeSkin({ personaggio: 'ZuriNkosi', skin: 'raro' }) === 'Raro Azzurro',
    Negozio.nomeSkin({ personaggio: 'ZuriNkosi', skin: 'raro' }));

const passate = risultati.filter(Boolean).length;
console.log('\n' + passate + '/' + risultati.length + ' verifiche passate');
process.exit(passate === risultati.length ? 0 : 1);
