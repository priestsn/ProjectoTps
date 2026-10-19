// ========================================
// Invarianti del gioco
// ==========================================
// Questo lavoro deve rendere il gioco più reattivo, NON cambiarlo.
// Qui si controllano i numeri che definiscono il bilanciamento: se uno di
// questi test diventa rosso, qualcuno ha toccato una regola per sbaglio.
//
// Uso:  node tools/prova_invarianti.js

const fs = require('fs');
const path = require('path');

const RADICE = path.resolve(__dirname, '..');
const risultati = [];

function verifica(nome, condizione, dettaglio) {
    risultati.push(!!condizione);
    console.log((condizione ? 'OK       ' : 'FALLITO  ') + nome.padEnd(52) + (dettaglio || ''));
}

function sorgente(relativo) {
    return fs.readFileSync(path.join(RADICE, relativo), 'utf8');
}

const gioco = sorgente('index.js');
const personaggi = sorgente('js/Personaggi.js');
const classi = sorgente('js/Classi.js');
const utili = sorgente('js/Utili.js');

verifica('STUN_FRAMI resta 60', /const STUN_FRAMI = 60;/.test(gioco));
verifica('FINESTRA_PERFETTO resta 3', /const FINESTRA_PERFETTO = 3;/.test(gioco));
verifica('CARICA_ATTACCO_FRAMI resta 60', /const CARICA_ATTACCO_FRAMI = 60;/.test(gioco));
verifica('ULTIMATE_CARICA_FRAME invariata', /const ULTIMATE_CARICA_FRAME = 100 \/ \(60 \* 20\);/.test(gioco));
verifica('ULTIMATE_PER_PARATA_PERFETTA resta 15', /const ULTIMATE_PER_PARATA_PERFETTA = 15;/.test(gioco));
verifica('ULTIMATE_PERSA_PER_STUN resta 25', /const ULTIMATE_PERSA_PER_STUN = 25;/.test(gioco));
verifica('DANNO_FRAMI resta 24', /const DANNO_FRAMI = 24;/.test(gioco));
verifica('Mondo 1280x720', /MONDO_LARGHEZZA = 1280/.test(gioco) && /MONDO_ALTEZZA = 720/.test(gioco));
verifica('ATTACCO_FRAME resta 30', /const ATTACCO_FRAME = 30;/.test(personaggi));
verifica('Nove personaggi', (personaggi.match(/^\s{8}id: '/gm) || []).length === 9,
    String((personaggi.match(/^\s{8}id: '/gm) || []).length));
verifica('Statistiche di Ousmane invariate',
    /statistiche: \{ vita: 100, stamina: 100, danno: 8, costoStamina: 14, velocita: 5, salto: -10 \}/.test(personaggi));
verifica('Parata vietata in aria', /if \(lottatore\.position\.y \+ lottatore\.height < ground\) \{\s*\n\s*return false;/m.test(gioco));
verifica('Drenaggio parata 0.2 presente', (gioco.match(/stamina - 0\.2\)/g) || []).length >= 1,
    (gioco.match(/stamina - 0\.2\)/g) || []).length + ' percorsi');
verifica('Rigenerazione stamina +10 ogni 2 secondi', /stamina \+ 10/.test(utili));
verifica('La morte blocca ogni cambio sprite', /if \(this\.image === this\.sprites\.Death\.image\) \{/.test(classi));
verifica('Colpo dell\'ultimate una volta sola', /ultimateHaColpito/.test(classi));

const passate = risultati.filter(Boolean).length;
console.log('\n' + passate + '/' + risultati.length + ' verifiche passate');
process.exit(passate === risultati.length ? 0 : 1);
