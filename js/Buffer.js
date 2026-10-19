// ========================================
// Buffer dei comandi
// ==========================================
// Un tasto premuto un attimo prima che il lottatore sia pronto non va perso.
// Quando un'azione non può partire (recupero attacco, atterraggio, fine colpo)
// si mette in coda per pochi frame e il gioco la esegue al primo momento utile.
// È il trucco che rende "responsivi" i picchiaduro veri.
//
// Lo stun NON è coperto: se vieni stunnato, i comandi premuti prima dello stun
// non si accodano (sarebbe una scorciatoia che cambia le regole).

// 9 frame = 150 ms a 60 fps: abbastanza per perdonare una pressione in anticipo,
// poco per non far partire comandi "vecchi" che il giocatore ha già scordato.
const BUFFER_FRAMI = 9;

function creaBuffer() {
    return { voci: [] };
}

/**
 * Mette in coda un comando. Se lo stesso comando dello stesso giocatore è già
 * in coda, si aggiorna la scadenza invece di duplicarlo.
 */
function spingi(buffer, azione, giocatore, frame) {
    buffer.voci = buffer.voci.filter((v) => !(v.azione === azione && v.giocatore === giocatore));
    buffer.voci.push({ azione: azione, giocatore: giocatore, scade: frame + BUFFER_FRAMI });
}

/**
 * Consuma un comando se è ancora valido. Restituisce true se c'era.
 */
function consuma(buffer, azione, giocatore, frame) {
    for (let i = 0; i < buffer.voci.length; i++) {
        const voce = buffer.voci[i];
        if (voce.azione === azione && voce.giocatore === giocatore && frame <= voce.scade) {
            buffer.voci.splice(i, 1);
            // Restituisce la voce (non `true`): chi la consuma deve poter sapere
            // se il tasto è ancora premuto, per non lasciare in coda un comando
            // che il giocatore ha già lasciato andare.
            return voce;
        }
    }
    return null;
}

/**
 * Toglie dalla coda i comandi scaduti (ogni passo di simulazione).
 */
function pulisci(buffer, frame) {
    buffer.voci = buffer.voci.filter((voce) => frame <= voce.scade);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BUFFER_FRAMI: BUFFER_FRAMI,
        creaBuffer: creaBuffer,
        spingi: spingi,
        consuma: consuma,
        pulisci: pulisci
    };
}
