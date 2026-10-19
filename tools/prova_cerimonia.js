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

const testi = Cerimonia.testoEsito({
    vincitore: 'p1',
    nomeP1: 'Tacco69', verdellineseP1: 'Ousmane Diouf',
    nomeP2: 'CPU', verdellineseP2: 'Amara Diallo',
    motivo: 'ko', vitaP1: 30, vitaP2: 0, durata: 47
});
verifica('Sopra c\'e\' il nome del giocatore', testi.giocatore === 'Tacco69', testi.giocatore);
verifica('Sotto c\'e\' il verdellinese usato', testi.verdellinese === 'Ousmane Diouf', testi.verdellinese);
verifica('Il motivo resta K.O.', testi.motivo === 'K.O.', testi.motivo);
verifica('Il dettaglio riporta la vita rimasta', testi.dettaglio.indexOf('30') !== -1, testi.dettaglio);
verifica('C\'e\' l\'invito a continuare', /Invio/.test(testi.invito), testi.invito);

const testiP2 = Cerimonia.testoEsito({
    vincitore: 'p2',
    nomeP1: 'Tacco69', verdellineseP1: 'Ousmane Diouf',
    nomeP2: 'Ospite 3F2A', verdellineseP2: 'Amara Diallo',
    motivo: 'ko', vitaP1: 12, vitaP2: 40, durata: 52
});
verifica('Se vince P2 si leggono i suoi nomi',
    testiP2.giocatore === 'Ospite 3F2A' && testiP2.verdellinese === 'Amara Diallo',
    testiP2.giocatore + ' / ' + testiP2.verdellinese);

const pareggio = Cerimonia.testoEsito({
    vincitore: null,
    nomeP1: 'Tacco69', verdellineseP1: 'Ousmane Diouf',
    nomeP2: 'CPU', verdellineseP2: 'Amara Diallo',
    motivo: 'tempo', vitaP1: 40, vitaP2: 40, durata: 60
});
verifica('In pareggio non c\'e\' vincitore', pareggio.giocatore === 'PAREGGIO', pareggio.giocatore);
verifica('In pareggio niente verdellinese', pareggio.verdellinese === '', pareggio.verdellinese);
verifica('A tempo scaduto il motivo e\' chiaro', pareggio.motivo === 'TEMPO SCADUTO', pareggio.motivo);

const passate = risultati.filter(Boolean).length;
console.log('\n' + passate + '/' + risultati.length + ' verifiche passate');
process.exit(passate === risultati.length ? 0 : 1);
