// ========================================
// Dispositivo mobile
// ==========================================
// Un solo posto per le domande "questo è un telefono?", "lo schermo è in
// verticale?", "il giocatore sta usando la tastiera?".
//
// I comandi a schermo restano in js/Touch.js: lì c'è il disegno dei tasti,
// qui c'è il dispositivo. Prima le due cose stavano nello stesso file e ogni
// modifica al telefono rischiava di toccare il desktop.

const MOBILE_STATO = {
    tastieraFisica: false,   // è stato premuto un tasto vero: niente comandi a schermo
    ultimoVerticale: null
};

/**
 * True su telefono e tablet: dito come puntatore principale e nessun mouse.
 * Un PC con schermo touch (che ha `hover: hover`) resta a tastiera.
 */
function dispositivoTouch() {
    if (!navigator.maxTouchPoints) {
        return false;
    }
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) {
        return true;
    }
    return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
}

/** True se lo schermo è più alto che largo. */
function schermoVerticale() {
    return window.innerHeight > window.innerWidth;
}

/**
 * Un tasto fisico premuto su un dispositivo touch significa che il giocatore
 * sta usando la tastiera (portatile con schermo touch, Chromebook, tablet con
 * tastiera): i comandi a schermo si tolgono di mezzo insieme al dito.
 */
function segnaTastieraFisica() {
    MOBILE_STATO.tastieraFisica = true;
}

/** True se i comandi a schermo devono comparire. */
function comandiTouchUtili() {
    return dispositivoTouch() && !MOBILE_STATO.tastieraFisica;
}

/**
 * Ricalcola tutto quello che dipende dalla forma dello schermo. Richiamata al
 * ridimensionamento e alla rotazione: `resize` da solo non basta, su Android
 * arriva prima che il browser abbia aggiornato le misure.
 */
function aggiornaMobile() {
    MOBILE_STATO.ultimoVerticale = schermoVerticale();

    if (typeof aggiornaComandiTouch === 'function') {
        aggiornaComandiTouch();
    }
    if (typeof aggiornaScalaSchermo === 'function') {
        aggiornaScalaSchermo();
    }
}

// Doppia modalità: script classico nel browser, require nei test.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MOBILE_STATO: MOBILE_STATO,
        dispositivoTouch: dispositivoTouch,
        schermoVerticale: schermoVerticale,
        segnaTastieraFisica: segnaTastieraFisica,
        comandiTouchUtili: comandiTouchUtili,
        aggiornaMobile: aggiornaMobile
    };
}
