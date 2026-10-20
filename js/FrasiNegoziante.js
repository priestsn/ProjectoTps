// ========================================
// Frasi del negoziante
// ==========================================
// Il negoziante parla di Guissè, la difficoltà CPU più forte del gioco
// (js/CPU.js, DIFFICOLTA_CPU.guisse). Sono fatti di colore: non toccano il
// bilanciamento, non rivelano numeri interni e non nominano problemi tecnici.
//
// Una frase per visita: si sceglie all'apertura del negozio (vedi js/Negozio.js).
//
// File puro: si prova con node in tools/prova_negoziante.js.

const FRASI_NEGOZIANTE = [
    // --- il giocatore più forte mai visto ---
    'Guissè è il miglior giocatore che questa bottega abbia mai visto.',
    'Non lo dico io che Guissè è il più forte: lo dicono le sconfitte.',
    'Guissè non para gli attacchi. Li concede.',
    'Ho visto uno battere Guissè. Poi mi sono svegliato.',
    'Guissè ha imparato a leggere il buffer guardando me.',
    'Dicono che Guissè non abbia mai premuto due tasti insieme per sbaglio.',
    'Guissè non corre: arriva.',
    'Una volta ho chiesto un consiglio a Guissè. Mi ha risposto con una parata perfetta.',
    'Guissè conta i tuoi fotogrammi di recupero. Li conta meglio di me.',
    'Guissè non sbaglia la parata: cambia idea prima di te.',
    'Guissè non ha un verdellinese preferito: li ha battuti tutti.',
    'Quando vedi Guissè caricare, hai già sbagliato una mossa fa.',
    'Guissè non ha una barra della stamina: ha una lista di cose da fare.',
    'Guissè si è fermato un secondo, una volta. Era per farti sentire bravo.',
    'Se Guissè ti offre una rivincita, chiedigli prima cosa vuole in cambio.',
    'La prima regola del mercato: non contrattare con Guissè.',
    'Guissè ha battuto la CPU difficile in due round. La CPU difficile era Guissè.',
    'Una volta Guissè ha pareggiato. Dice che non vale e non se ne parla più.',

    // --- il ragazzone ---
    'Guissè è un ragazzone grosso e nero. Le sue mani coprono mezzo schermo.',
    'Guissè entra nella bottega e non serve chiedergli niente: te lo dice lui.',
    'Ho visto Guissè ridere una volta. Ho ancora paura.',
    'Guissè parla poco. Quando parla, di solito è per chiedere la rivincita.',

    // --- l'igiene, lasciamo perdere ---
    'Guissè puzza un po\'. Nessuno ha mai avuto il coraggio di dirglielo.',
    'Guissè non si lava. Dice che l\'acqua gli toglie i riflessi.',
    'Nel mio negozio c\'è un cartello: vietato sedersi accanto a Guissè.',
    'Ho provato a vendergli un deodorante. Ha comprato una spada.',
    'Guissè tiene il joystick a trenta centimetri dalla faccia. Per motivi suoi.',

    // --- il lavoro e la scuola ---
    'Guissè non ha un lavoro. Ha un record.',
    'Guissè è stato bocciato tre volte. Poi ha smesso di contarci.',
    'Dicono che a trent\'anni Guissè facesse ancora le superiori. Le faceva bene, però.',
    'Il professore di Guissè gli ha chiesto l\'autografo. Sulla scheda di valutazione.',
    'Guissè non è mai arrivato tardi a scuola. Non è mai arrivato proprio.',
    'Guissè ha imparato le tabelline leggendo le statistiche dei verdellinesi.',
    'La mamma di Guissè mi chiede sempre se ha trovato lavoro. Io le dico di no.',

    // --- il negoziante che ci prova ---
    'Io vendo verdellinesi. Guissè vende illusioni.',
    'Nella mia bottega non vendo verdellinesi. Quelli li vende Guissè.',
    'Il prezzo giusto di un verdellinese lo sa Guissè. Io lo arrotondo.',
    'Ho provato a vendergli un alimentatore. Mi ha chiesto la scheda tecnica.',
    'Il mio banco apre alle otto. Guissè è aperto da sempre.',
    'I miei punti li spendo tutti qui. Guissè li vince tutti.'
];

/**
 * Sceglie una frase. `casuale` è un numero fra 0 e 1 (si può iniettare nei test),
 * altrimenti si usa Math.random.
 */
function scegliFraseNegoziante(casuale) {
    const dado = (typeof casuale === 'number' && isFinite(casuale)) ? casuale : Math.random();
    const indice = Math.floor(dado * FRASI_NEGOZIANTE.length) % FRASI_NEGOZIANTE.length;
    return FRASI_NEGOZIANTE[indice];
}

/** Restituisce una frase diversa da quella data: così due visite di fila non si ripetono. */
function fraseDiversaDa(frasePrecedente, casuale) {
    if (FRASI_NEGOZIANTE.length < 2) return scegliFraseNegoziante(casuale);

    let frase = scegliFraseNegoziante(casuale);
    if (frase === frasePrecedente) {
        const indice = (FRASI_NEGOZIANTE.indexOf(frase) + 1) % FRASI_NEGOZIANTE.length;
        frase = FRASI_NEGOZIANTE[indice];
    }
    return frase;
}

// Doppia modalità: nel browser è uno script classico, nei test si carica con require.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FRASI_NEGOZIANTE: FRASI_NEGOZIANTE,
        scegliFraseNegoziante: scegliFraseNegoziante,
        fraseDiversaDa: fraseDiversaDa
    };
}
