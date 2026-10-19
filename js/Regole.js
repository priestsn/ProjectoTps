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
        colpoVaRegistrato: colpoVaRegistrato,
        puoBufferizzare: puoBufferizzare
    };
}
