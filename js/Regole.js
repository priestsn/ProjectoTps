// ========================================
// Regole pure del combattimento
// ==========================================
// Funzioni senza DOM e senza stato: si possono provare con Node e valgono
// identiche nel browser. Se una regola è scritta qui, non va riscritta altrove.

/**
 * Decide se un attacco in corso deve registrare il colpo.
 * Prima si confrontava il frame corrente con un uguale secco
 * (`framesCurrent === attacco.frame`): bastava che il loop saltasse un
 * fotogramma e il colpo non entrava mai. Ora basta essere arrivati al frame
 * d'impatto, e `haGiaColpito` impedisce che lo stesso attacco colpisca due volte.
 */
function colpoVaRegistrato(framesCurrent, frameImpatto, haGiaColpito) {
    if (haGiaColpito) {
        return false;
    }
    return framesCurrent >= frameImpatto;
}

// Passi minimi in cui il colpo può essere registrato DOPO il frame d'impatto.
// Serve perché l'impatto è un fotogramma dell'animazione e l'animazione finisce
// pochi passi dopo: con Ayo Adebayo (impatto all'11° di 13 fotogrammi, 2 passi
// per fotogramma) restavano 33 ms per far centro, e bastava che l'avversario
// facesse un passo indietro per far mancare il colpo. È resa, non bilanciamento:
// non cambia danno, stamina né area del colpo.
const FINESTRA_IMPATTO_MINIMA = 8;

/**
 * Durata dell'attacco in passi di gioco: la sua animazione, oppure — se è più
 * lunga — la finestra d'impatto minima. Restituisce sempre un numero intero.
 */
function fineAttaccoPassi(passoImpatto, durataSprite, finestraMinima) {
    const finestra = (typeof finestraMinima === 'number') ? finestraMinima : FINESTRA_IMPATTO_MINIMA;
    const impatto = Math.max(0, Math.round(passoImpatto) || 0);
    const durata = Math.max(1, Math.round(durataSprite) || 1);
    return Math.max(durata, impatto + Math.max(0, Math.round(finestra)));
}

/**
 * Chi può ricevere comandi in coda: non i morti, non gli stunnati.
 * (Lo stun deve restare uno stato senza scampo: si è voluto così.)
 */
function puoBufferizzare(lottatore) {
    if (!lottatore) {
        return false;
    }
    return !lottatore.isStunned && !lottatore.isDead;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FINESTRA_IMPATTO_MINIMA: FINESTRA_IMPATTO_MINIMA,
        colpoVaRegistrato: colpoVaRegistrato,
        fineAttaccoPassi: fineAttaccoPassi,
        puoBufferizzare: puoBufferizzare
    };
}
