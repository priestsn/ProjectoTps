// ========================================
// Verifica della cerimonia di fine partita
// ==========================================
// Tre fasi: colpo, caduta, esito. Il test controlla che durino il giusto e che
// alla fine la cerimonia si dichiari chiusa (allora si apre il menu).
//
// Uso:  node tools/prova_cerimonia.js

const risultati = [];

function verifica(nome, condizione, dettaglio) {
    risultati.push(!!condizione);
    console.log((condizione ? 'OK       ' : 'FALLITO  ') + nome.padEnd(54) + (dettaglio || ''));
}

const Cerimonia = require('../js/CerimoniaFine.js');

verifica('Tre fasi', Cerimonia.FASI.length === 3, String(Cerimonia.FASI.length));
verifica('Le fasi si chiamano colpo, caduta, esito',
    Cerimonia.FASI.map((f) => f.nome).join(',') === 'colpo,caduta,esito');

const totale = Cerimonia.passiTotali();
verifica('La cerimonia dura fra 2 e 3 secondi',
    totale >= 120 && totale <= 180, totale + ' passi');

const cerimonia = Cerimonia.creaCerimonia({ vincitore: 'p1', motivo: 'ko', vitaP1: 30, vitaP2: 0, durata: 47 });
verifica('La cerimonia parte dalla prima fase', cerimonia.fase === 0 && cerimonia.passi === 0);
verifica('Appena creata non è finita', Cerimonia.cerimoniaFinita(cerimonia) === false);
verifica('La prima fase è il colpo', Cerimonia.faseCerimonia(cerimonia) === 'colpo');

Cerimonia.aggiornaCerimonia(cerimonia);
verifica('Un passo fa avanzare il contatore', cerimonia.passi === 1);

for (let i = 0; i < Cerimonia.FASI[0].passi; i++) {
    Cerimonia.aggiornaCerimonia(cerimonia);
}
verifica('Finita la prima fase si passa alla seconda', cerimonia.fase === 1, 'fase ' + cerimonia.fase);

for (let i = 0; i < totale + 10; i++) {
    Cerimonia.aggiornaCerimonia(cerimonia);
}
verifica('Alla fine la cerimonia è chiusa', Cerimonia.cerimoniaFinita(cerimonia) === true);
verifica('Dopo la fine non si avanza più',
    Cerimonia.aggiornaCerimonia(cerimonia) === false);

const saltata = Cerimonia.creaCerimonia({ vincitore: 'p2', motivo: 'ko' });
Cerimonia.concludiCerimonia(saltata);
verifica('Concludi la chiude subito', Cerimonia.cerimoniaFinita(saltata) === true);

const testo = Cerimonia.testoEsito({ vincitore: 'p1', motivo: 'ko', vitaP1: 30, vitaP2: 0, durata: 47 }, 'Ousmane Diouf');
verifica('L\'esito nomina il vincitore', testo.vincitore === 'Ousmane Diouf', testo.vincitore);
verifica('L\'esito dice come è finita', testo.motivo === 'K.O.', testo.motivo);
verifica('L\'esito riporta la vita rimasta', testo.dettaglio.indexOf('30') !== -1, testo.dettaglio);

const pareggio = Cerimonia.testoEsito({ vincitore: null, motivo: 'tempo', vitaP1: 40, vitaP2: 40, durata: 60 }, 'Ousmane Diouf');
verifica('In pareggio non c\'è un vincitore', pareggio.vincitore === 'PAREGGIO', pareggio.vincitore);
verifica('A tempo scaduto il motivo è chiaro', pareggio.motivo === 'TEMPO SCADUTO', pareggio.motivo);

const passate = risultati.filter(Boolean).length;
console.log('\n' + passate + '/' + risultati.length + ' verifiche passate');
process.exit(passate === risultati.length ? 0 : 1);
