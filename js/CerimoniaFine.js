// ========================================
// Cerimonia di fine partita
// ==========================================
// Quando la vita arriva a zero (o scade il tempo) il gioco NON apre subito il
// menu: mostra il colpo finale, la caduta e un cartello con l'esito. Le fasi
// sono dati e si contano in passi di simulazione (1/60 di secondo), così la
// durata è la stessa su ogni schermo.
//
// Modulo puro: si prova con `node tools/prova_cerimonia.js`.

const FASI = [
    { nome: 'colpo', passi: 12 },    // 0,20 s: flash, scossa, colpo finale
    { nome: 'caduta', passi: 54 },   // 0,90 s: morte dell'avversario + "K.O."
    { nome: 'esito', passi: 70 }     // 1,17 s: cartello con il risultato
];

function creaCerimonia(esito) {
    return {
        fase: 0,
        passi: 0,
        esito: esito,
        finita: false
    };
}

/** Avanza di un passo. Restituisce true se è cambiata fase. */
function aggiornaCerimonia(cerimonia) {
    if (!cerimonia || cerimonia.finita) {
        return false;
    }

    cerimonia.passi++;

    if (cerimonia.passi < FASI[cerimonia.fase].passi) {
        return false;
    }

    cerimonia.passi = 0;
    cerimonia.fase++;

    if (cerimonia.fase >= FASI.length) {
        cerimonia.fase = FASI.length - 1;
        cerimonia.finita = true;
    }

    return true;
}

function faseCerimonia(cerimonia) {
    if (!cerimonia) {
        return null;
    }
    return FASI[cerimonia.fase] ? FASI[cerimonia.fase].nome : null;
}

function cerimoniaFinita(cerimonia) {
    return !!(cerimonia && cerimonia.finita);
}

/** Salta subito alla fine (Invio o Spazio durante la cerimonia). */
function concludiCerimonia(cerimonia) {
    if (!cerimonia) {
        return;
    }
    cerimonia.fase = FASI.length - 1;
    cerimonia.passi = 0;
    cerimonia.finita = true;
}

function passiTotali() {
    return FASI.reduce((somma, fase) => somma + fase.passi, 0);
}

/**
 * Testi del cartello finale: il nome del giocatore e, sotto, il verdellinese
 * che ha usato. L'esito porta i nomi di tutti e due fin dalla creazione, così
 * il modulo non deve sapere chi ha vinto "guardando fuori".
 */
function testoEsito(esito) {
    const dati = esito || {};
    const vincitore = dati.vincitore || null;
    const nome = (vincitore === 'p2') ? dati.nomeP2 : dati.nomeP1;
    const verdellinese = (vincitore === 'p2') ? dati.verdellineseP2 : dati.verdellineseP1;
    const vita = (typeof dati.vitaP1 === 'number')
        ? Math.max(0, Math.round(dati.vitaP1)) + '%'
        : '—';

    return {
        motivo: (dati.motivo === 'tempo') ? 'TEMPO SCADUTO' : 'K.O.',
        giocatore: vincitore ? String(nome || 'GIOCATORE') : 'PAREGGIO',
        verdellinese: vincitore ? String(verdellinese || '') : '',
        dettaglio: 'Vita rimasta ' + vita + ' · ' + (dati.durata || 0) + ' s di partita',
        invito: 'Invio per continuare'
    };
}

// Doppia modalità: nel browser è uno script classico, nei test si carica con require.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FASI: FASI,
        creaCerimonia: creaCerimonia,
        aggiornaCerimonia: aggiornaCerimonia,
        faseCerimonia: faseCerimonia,
        cerimoniaFinita: cerimoniaFinita,
        concludiCerimonia: concludiCerimonia,
        passiTotali: passiTotali,
        testoEsito: testoEsito
    };
}
