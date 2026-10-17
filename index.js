// ========================================
// Configurazione Canvas
// ==========================================
const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');

// ========================================
// Dimensioni della finestra
// ==========================================
// Il canvas prende le misure della finestra: nessuna dimensione fissa.
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

c.fillStyle = 'black';
c.fillRect(0, 0, canvas.width, canvas.height);

// ========================================
// Costanti di Gioco
// ==========================================
const gravity = 0.25;

// --- Meccaniche avanzate (Fase 3) ---
const STUN_FRAMI = 60;                  // 1 secondo a 60 fps
const FINESTRA_PERFETTO = 3;            // frame entro cui la parata è perfetta
const CARICA_ATTACCO_FRAMI = 60;        // 1 secondo di carica prima del colpo caricato
const ULTIMATE_CARICA_FRAME = 100 / (60 * 20); // barra piena in circa 20 secondi
const ULTIMATE_PER_PARATA_PERFETTA = 15; // carica guadagnata dal perfect block
const ULTIMATE_PERSA_PER_STUN = 25;      // carica persa quando si viene stunnati

// Elementi dell'HUD letti una sola volta (niente querySelector nel game loop)
const hud = {
    playerHealth: document.querySelector('#player-health'),
    playerStamina: document.querySelector('#player-stamina'),
    playerUltimate: document.querySelector('#player-ultimate'),
    enemyHealth: document.querySelector('#enemy-health'),
    enemyStamina: document.querySelector('#enemy-stamina'),
    enemyUltimate: document.querySelector('#enemy-ultimate'),
    displayText: document.querySelector('#displayText')
};

// y della superficie del suolo: i piedi dei lottatori poggiano qui.
// 40 = margine di terreno lasciato sotto i piedi.
// I piedi corrispondono a (position.y + height), cioè la base della hitbox.
// Cambia con le dimensioni della finestra, quindi non è un valore fisso.
let ground = canvas.height - 40;

// ========================================
// Inizializzazione Sfondo e Personaggi
// ==========================================
// Background.png è un foglio di 5 frame (384 x 221 ciascuno): si anima con la
// stessa logica degli sprite (framesMax + framesCurrent). Non va tagliato a
// mano e non va fatto scorrere.
const background = new Sprite({ x: 0, y: 0 }, './assets/Background.png', 1, 5, { x: 0, y: 0 });

/**
 * Scala il singolo frame dello sfondo per coprire tutto il canvas.
 * Ogni frame è largo image.width / framesMax: si usa la scala più grande tra
 * quella in larghezza e quella in altezza ("cover"), così non restano bordi
 * vuoti su nessun lato. L'eventuale eccedenza viene ritagliata dal canvas.
 */
function adattaSfondo() {
    if (background.image.loaded && background.image.height > 0) {
        const larghezzaFrame = background.image.width / background.framesMax;
        background.scale = Math.max(
            canvas.width / larghezzaFrame,
            canvas.height / background.image.height
        );
    }
}

/**
 * Adatta canvas, suolo e sfondo alle dimensioni attuali della finestra
 */
function adattaAllaFinestra() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ground = canvas.height - 40;

    adattaSfondo();
}

// Chi combatte: i due personaggi scelti nella schermata di selezione.
// Vengono creati da preparaPartita() all'avvio della partita.
let Player;
let Enemy;

// Controller della CPU: valorizzato solo in modalità VS CPU
let cpu = null;

// Proiettili delle ultimate (Bakari, Sekou, Ayo)
const proiettili = [];

/**
 * Crea i due lottatori a partire dai personaggi scelti.
 * Il giocatore 2 parte rivolto verso sinistra (le sprite nascono verso destra)
 * e con l'AttackBox dal suo lato.
 */
function preparaPartita(idP1, idP2) {
    // Posizioni ai lati del campo, calcolate sulla larghezza attuale della finestra
    const margine = Math.round(canvas.width * 0.05);

    Player = creaLottatore(trovaPersonaggio(idP1), margine, 1);
    Enemy = creaLottatore(trovaPersonaggio(idP2), canvas.width - margine, -1);
    Enemy.lastKey = 'ArrowLeft';
}

// ========================================
// Gestione Input
// ==========================================
let lastKey;
const keys = {
    a: { pressed: false },
    d: { pressed: false },
    w: { pressed: false },
    h: { pressed: false },
    j: { pressed: false },
    ArrowLeft: { pressed: false },
    ArrowRight: { pressed: false },
    ArrowUp: { pressed: false },
    ù: { pressed: false },
    à: { pressed: false }
};

// Tasti riservati al giocatore 2: in VS CPU vengono ignorati
const TASTI_P2 = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'ù', 'à', 'l'];

// Flag di fine partita: impedisce che il risultato venga ricalcolato a ogni frame
let gameOver = false;

// Debug: con il tasto U si mostrano tutte le hitbox (corpo e area di attacco)
let hitboxVisibili = false;

// ========================================
// Combattimento
// ==========================================
// La fine dell'attacco e' gestita da Lottatore.update(): il lottatore conosce
// la propria animazione e puo' chiudere isAttacking sull'ultimo frame, senza
// che Jump/Fall o idle lo sostituiscano prima.

// --- Meccaniche avanzate: perfect block, stun, attacco caricato, ultimate ---

// Testo temporaneo al centro dello schermo ("PERFECT BLOCK", nome ultimate)
let avvisoTimer = 0;
let avvisoTesto = '';
let avvisoColore = 'white';

function mostraAvviso(testo, colore) {
    avvisoTesto = testo;
    avvisoColore = colore;
    avvisoTimer = 60; // circa 1 secondo
}

/**
 * Aggiorna una volta per frame le meccaniche del lottatore.
 * - carica ultimate nel tempo
 * - conta i frame di stun
 * - conta i frame dall'inizio della parata (per il perfect block)
 * - trasforma un attacco tenuto premuto in attacco caricato
 */
function aggiornaMeccaniche(lottatore) {
    if (gameOver || lottatore.isDead) {
        return;
    }

    // Ultimate: si carica col tempo
    lottatore.ultimate = Math.min(100, lottatore.ultimate + ULTIMATE_CARICA_FRAME);

    // Stun: conta alla rovescia e libera il lottatore
    if (lottatore.isStunned) {
        lottatore.stunTimer--;
        if (lottatore.stunTimer <= 0) {
            lottatore.isStunned = false;
            lottatore.stunTimer = 0;
        }
    }

    // Parata: quanti frame sono passati dall'inizio
    lottatore.framesParata = lottatore.isParata ? lottatore.framesParata + 1 : 0;

    // Carica dell'attacco: si riempie solo mentre il tasto è tenuto premuto.
    // Il colpo parte al rilascio (vedi rilasciaCarica).
    if (lottatore.isCaricando) {
        lottatore.framesCarica = Math.min(CARICA_ATTACCO_FRAMI, lottatore.framesCarica + 1);
        lottatore.cambiaSprite('idle');
    } else {
        lottatore.framesCarica = 0;
    }

    // --- Stati alterati dalle ultimate ---
    if (lottatore.velenoTimer > 0) {
        lottatore.velenoTimer--;
        applicaDannoContinuo(lottatore, lottatore.velenoPerFrame);
    }

    if (lottatore.bruciaturaTimer > 0) {
        lottatore.bruciaturaTimer--;
        applicaDannoContinuo(lottatore, lottatore.bruciaturaPerFrame);
    }

    if (lottatore.silenzioTimer > 0) {
        lottatore.silenzioTimer--;
        lottatore.stamina = Math.max(0, lottatore.stamina - 0.08);
    }

    for (const campo of ['rallentamentoTimer', 'inversioneTimer', 'congelamentoTimer',
        'marchioTimer', 'bloccoStaminaTimer', 'eclissiTimer', 'buffTimer']) {
        if (lottatore[campo] > 0) {
            lottatore[campo]--;
        }
    }

    // Rallentamento/eclissi contro il buff di Amara
    const rallentato = lottatore.rallentamentoTimer > 0 || lottatore.eclissiTimer > 0;
    let velocita = 1;
    let animazione = 1;

    if (rallentato) {
        velocita *= 0.5;
        animazione *= 1.8;
    }
    if (lottatore.buffTimer > 0) {
        velocita *= 1.5;
        animazione *= 0.6;
    }

    lottatore.moltiplicatoreVelocita = velocita;
    lottatore.moltiplicatoreAnimazione = animazione;
}

/**
 * Stunna un lottatore per STUN_FRAMI frame: ferma attacco e parata,
 * azzera gli input e fa perdere un po' di carica ultimate.
 */
function stunna(lottatore) {
    lottatore.isStunned = true;
    lottatore.stunTimer = STUN_FRAMI;
    lottatore.isParata = false;
    lottatore.isAttacking = false;
    lottatore.attaccoCaricato = false;
    lottatore.attaccoUltimate = false;
    lottatore.framesAttacco = 0;
    lottatore.isCaricando = false;
    lottatore.framesCarica = 0;
    lottatore.framesParata = 0;
    lottatore.ultimate = Math.max(0, lottatore.ultimate - ULTIMATE_PERSA_PER_STUN);

    // Rilascia i tasti del lottatore stunnato
    if (lottatore === Player) {
        keys.a.pressed = false;
        keys.d.pressed = false;
        keys.h.pressed = false;
        keys.j.pressed = false;
    } else {
        keys.ArrowLeft.pressed = false;
        keys.ArrowRight.pressed = false;
        keys.ù.pressed = false;
        keys.à.pressed = false;
    }
}

/**
 * Applica danno e animazione di colpo subito, con clamp della vita.
 */
function applicaDanno(attaccante, difensore, danno, forza = false) {
    if (difensore.isTakingDmg && !forza) {
        return;
    }

    difensore.isTakingDmg = true;
    difensore.isParata = false;
    difensore.cambiaSprite('TakeHit');
    difensore.health = Math.max(0, difensore.health - danno);

    const barra = difensore === Player ? hud.playerHealth : hud.enemyHealth;
    barra.style.width = percentualeBarra(difensore.health, difensore.statistiche.vita) + '%';

    setTimeout(() => { difensore.isTakingDmg = false; }, 400);
}

/**
 * Danno nel tempo (veleno, bruciatura), senza animazione di colpo subito
 */
function applicaDannoContinuo(lottatore, quantita) {
    if (lottatore.isDead || quantita <= 0) {
        return;
    }

    lottatore.health = Math.max(0, lottatore.health - quantita);

    const barra = lottatore === Player ? hud.playerHealth : hud.enemyHealth;
    barra.style.width = percentualeBarra(lottatore.health, lottatore.statistiche.vita) + '%';
}

/**
 * Applica lo stato speciale dell'ultimate al difensore
 */
function applicaEffettoUltimate(attaccante, difensore) {
    const dati = attaccante.datiUltimate || {};
    const durata = dati.durata || 120;

    switch (dati.effetto) {
        case 'rallentamento':
            difensore.rallentamentoTimer = durata;
            break;

        case 'inversione':
            difensore.inversioneTimer = durata;
            break;

        case 'congelamento':
            difensore.congelamentoTimer = durata;
            difensore.isAttacking = false;
            difensore.isParata = false;
            difensore.isCaricando = false;
            difensore.framesCarica = 0;
            difensore.velocity.x = 0;
            break;

        case 'veleno':
            difensore.velenoTimer = durata;
            difensore.velenoPerFrame = (dati.dannoContinuo || 12) / durata;
            break;

        case 'marchio':
            difensore.marchioTimer = durata;
            break;

        case 'bruciatura':
            difensore.bruciaturaTimer = durata;
            difensore.bruciaturaPerFrame = (dati.dannoContinuo || 14) / durata;
            difensore.bloccoStaminaTimer = durata;
            break;

        case 'silenzio':
            difensore.silenzioTimer = durata;
            break;

        case 'eclissi':
            difensore.eclissiTimer = durata;
            break;
    }
}

/**
 * Crea il proiettile di un'ultimate a distanza
 */
function creaProiettile(lottatore) {
    const dati = lottatore.datiUltimate;
    const direzione = lottatore.facing >= 0 ? 1 : -1;

    proiettili.push({
        proprietario: lottatore,
        x: lottatore.position.x + lottatore.centroCorpo + direzione * (lottatore.width / 2 + 26),
        y: lottatore.position.y + lottatore.height * 0.45,
        vx: direzione * 9,
        raggio: 20,
        danno: dati.danno,
        colore: dati.colore || '#ff8a3d',
        vita: 240
    });
}

/**
 * Muove i proiettili e applica danno + stato al primo bersaglio colpito
 */
function aggiornaProiettili() {
    for (let i = proiettili.length - 1; i >= 0; i--) {
        const p = proiettili[i];
        p.x += p.vx;
        p.vita--;

        const difensore = p.proprietario === Player ? Enemy : Player;

        const colpisce = !difensore.isDead &&
            p.x + p.raggio > difensore.position.x &&
            p.x - p.raggio < difensore.position.x + difensore.width &&
            p.y + p.raggio > difensore.position.y &&
            p.y - p.raggio < difensore.position.y + difensore.height;

        if (colpisce) {
            // L'ultimate rompe la parata
            difensore.isParata = false;

            let danno = p.danno;
            if (difensore.marchioTimer > 0) {
                danno *= 1.3;
            }

            applicaDanno(p.proprietario, difensore, danno, true);
            applicaEffettoUltimate(p.proprietario, difensore);
            proiettili.splice(i, 1);
            continue;
        }

        if (p.vita <= 0 || p.x < -120 || p.x > canvas.width + 120) {
            proiettili.splice(i, 1);
        }
    }
}

/**
 * Disegna i proiettili come sfere con alone colorato
 */
function disegnaProiettili() {
    c.save();

    for (const p of proiettili) {
        const gradiente = c.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.raggio);
        gradiente.addColorStop(0, '#ffffff');
        gradiente.addColorStop(0.35, p.colore);
        gradiente.addColorStop(1, 'rgba(0, 0, 0, 0)');

        c.fillStyle = gradiente;
        c.beginPath();
        c.arc(p.x, p.y, p.raggio, 0, Math.PI * 2);
        c.fill();
    }

    c.restore();
}

/**
 * Etichette degli stati alterati sopra il lottatore
 */
function disegnaStati(lottatore) {
    const stati = [];

    if (lottatore.congelamentoTimer > 0) stati.push(['CONGELATO', '#8be9fd']);
    if (lottatore.velenoTimer > 0) stati.push(['VELENO', '#7dff7d']);
    if (lottatore.bruciaturaTimer > 0) stati.push(['BRUCIATO', '#ff8a3d']);
    if (lottatore.eclissiTimer > 0) {
        stati.push(['ECLISSI', '#d29bff']);
    } else {
        if (lottatore.inversioneTimer > 0) stati.push(['INVERSO', '#d29bff']);
        if (lottatore.rallentamentoTimer > 0) stati.push(['RALLENTATO', '#8ab4ff']);
    }
    if (lottatore.marchioTimer > 0) stati.push(['MARCHIATO', '#ff6b6b']);
    if (lottatore.silenzioTimer > 0) stati.push(['SILENZIO', '#ffd34d']);
    if (lottatore.buffTimer > 0) stati.push(['VELOCE', '#7dff7d']);

    if (stati.length === 0) {
        return;
    }

    c.save();
    c.font = 'bold 14px sans-serif';
    c.textAlign = 'center';

    const visibili = stati.slice(0, 3);
    const passo = 90;
    let x = lottatore.position.x + lottatore.centroCorpo - ((visibili.length - 1) * passo) / 2;
    const y = lottatore.position.y - 44;

    for (const [nome, colore] of visibili) {
        c.fillStyle = 'rgba(0, 0, 0, 0.65)';
        const larghezza = c.measureText(nome).width + 10;
        c.fillRect(x - larghezza / 2, y - 13, larghezza, 18);

        c.fillStyle = colore;
        c.fillText(nome, x, y);

        x += passo;
    }

    c.restore();
}

/**
 * Decide l'esito del colpo quando l'AttackBox tocca il corpo.
 * - parata normale: nessun danno
 * - perfect block: nessun danno, attaccante stunnato, carica ultimate
 * - attacco caricato: rompe la parata, danno e stun
 * - ultimate: rompe la parata, danno e stato speciale
 * - senza parata: danno normale
 */
function risolviImpatto(attaccante, difensore) {
    // Gli ultimate a proiettile non fanno danno da mischia: ci pensa il proiettile
    if (attaccante.attaccoUltimate && attaccante.datiUltimate.tipo === 'proiettile') {
        return;
    }

    // La stessa ultimate non può colpire due volte nello stesso attacco
    if (attaccante.attaccoUltimate && attaccante.ultimateHaColpito) {
        return;
    }

    let danno = attaccante.attaccoUltimate
        ? attaccante.datiUltimate.danno
        : attaccante.statistiche.danno;

    // Marchio: il difensore subisce più danno
    if (difensore.marchioTimer > 0) {
        danno *= 1.3;
    }

    if (difensore.isParata) {
        // L'ultimate rompe la parata e applica il suo stato
        if (attaccante.attaccoUltimate) {
            attaccante.ultimateHaColpito = true;
            difensore.isParata = false;
            applicaDanno(attaccante, difensore, danno, true);
            applicaEffettoUltimate(attaccante, difensore);
            return;
        }

        // Attacco caricato: rompe la parata e stunna
        if (attaccante.attaccoCaricato) {
            applicaDanno(attaccante, difensore, danno);
            stunna(difensore);
            return;
        }

        // Perfect block: parata iniziata negli ultimi FINESTRA_PERFETTO frame
        if (difensore.framesParata <= FINESTRA_PERFETTO) {
            difensore.ultimate = Math.min(100, difensore.ultimate + ULTIMATE_PER_PARATA_PERFETTA);
            stunna(attaccante);

            // L'attaccante mostra l'animazione di colpo subito per tutto lo stun
            attaccante.cambiaSprite('TakeHit');

            mostraAvviso('PERFECT BLOCK', '#ffd34d');
            return;
        }

        // Blocco normale: nessun danno
        return;
    }

    if (attaccante.attaccoUltimate) {
        attaccante.ultimateHaColpito = true;
    }

    applicaDanno(attaccante, difensore, danno, attaccante.attaccoUltimate);

    if (attaccante.attaccoUltimate) {
        applicaEffettoUltimate(attaccante, difensore);
    }
}

/**
 * Attiva l'ultimate se la barra è piena.
 * - mischia: colpo potente con stato speciale
 * - proiettile: colpo a distanza con stato speciale
 * - buff: potenziamento del lottatore
 */
function attivaUltimate(lottatore) {
    if (gameOver || lottatore.isDead || lottatore.isStunned ||
        lottatore.isAttacking || lottatore.isParata || lottatore.isCaricando ||
        lottatore.isTakingDmg || lottatore.congelamentoTimer > 0 ||
        lottatore.silenzioTimer > 0) {
        return;
    }

    if (lottatore.ultimate < 100) {
        return;
    }

    const dati = lottatore.datiUltimate;
    lottatore.ultimate = 0;

    if (dati.tipo === 'buff') {
        lottatore.buffTimer = dati.durata;
        mostraAvviso(dati.nome, dati.colore || '#7dff7d');
        return;
    }

    lottatore.avviaAttacco({ ultimate: true });

    if (dati.tipo === 'proiettile') {
        creaProiettile(lottatore);
    }

    mostraAvviso(dati.nome, dati.colore || '#8be9fd');
}

// --- Comandi condivisi tra giocatori umani e CPU ---
// Evitano di duplicare le regole (costo stamina, parata solo da terra, ecc.)
// dentro gli handler della tastiera e dentro l'IA.

function tastoAttaccoDi(lottatore) {
    return lottatore === Player ? keys.h : keys.ù;
}

function tastoParataDi(lottatore) {
    return lottatore === Player ? keys.j : keys.à;
}

/**
 * Salta, solo da terra. Saltare annulla la parata (BUG-25).
 */
function salta(lottatore) {
    if (lottatore.isDead || lottatore.isStunned || lottatore.isCaricando ||
        lottatore.isTakingDmg || lottatore.congelamentoTimer > 0) {
        return false;
    }
    if (lottatore.position.y + lottatore.height < ground) {
        return false;
    }

    lottatore.isParata = false;
    lottatore.framesParata = 0;
    tastoParataDi(lottatore).pressed = false;
    lottatore.velocity.y = lottatore.statistiche.salto;
    return true;
}

/**
 * Esegue il colpo vero e proprio.
 * `caricato` indica che la carica è stata completata: rompe la parata e stunna.
 */
function eseguiAttacco(lottatore, caricato) {
    if (gameOver || lottatore.isDead || lottatore.isStunned ||
        lottatore.isParata || lottatore.isAttacking || lottatore.isTakingDmg ||
        lottatore.congelamentoTimer > 0) {
        return false;
    }

    const costo = lottatore.statistiche.costoStamina * (caricato ? 1.5 : 1);
    if (lottatore.stamina < costo) {
        return false;
    }

    lottatore.stamina -= costo;
    lottatore.avviaAttacco({ caricato });
    return true;
}

/**
 * Inizia la carica dell'attacco. Il colpo parte solo al rilascio:
 * - rilascio prima di CARICA_ATTACCO_FRAMI -> attacco normale
 * - rilascio dopo -> attacco caricato (rompe la parata, stunna)
 * Durante la carica non si può muovere, saltare, parare o usare l'ultimate.
 */
function iniziaCarica(lottatore) {
    if (gameOver || lottatore.isDead || lottatore.isStunned || lottatore.isAttacking ||
        lottatore.isParata || lottatore.isCaricando || lottatore.isTakingDmg ||
        lottatore.congelamentoTimer > 0) {
        return false;
    }
    if (lottatore.position.y + lottatore.height < ground) {
        return false;
    }
    if (lottatore.stamina < lottatore.statistiche.costoStamina) {
        return false;
    }

    lottatore.isCaricando = true;
    lottatore.framesCarica = 0;
    lottatore.cambiaSprite('idle');
    return true;
}

/**
 * Rilascia la carica e fa partire l'attacco
 */
function rilasciaCarica(lottatore) {
    if (!lottatore.isCaricando) {
        return false;
    }

    const caricato = lottatore.framesCarica >= CARICA_ATTACCO_FRAMI;
    lottatore.isCaricando = false;
    lottatore.framesCarica = 0;

    return eseguiAttacco(lottatore, caricato);
}

/**
 * Inizia la parata, solo da terra. Annulla un attacco in corso.
 */
function iniziaParata(lottatore) {
    if (lottatore.isDead || lottatore.isStunned || lottatore.isCaricando ||
        lottatore.isTakingDmg || lottatore.congelamentoTimer > 0) {
        return false;
    }
    if (lottatore.stamina < 0.5) {
        return false;
    }
    if (lottatore.position.y + lottatore.height < ground) {
        return false;
    }

    lottatore.isAttacking = false;
    lottatore.attaccoCaricato = false;
    lottatore.attaccoUltimate = false;
    lottatore.framesAttacco = 0;
    lottatore.cambiaSprite('ParataIdle');
    lottatore.isParata = true;
    lottatore.framesParata = 0;
    tastoParataDi(lottatore).pressed = true;
    tastoAttaccoDi(lottatore).pressed = false;
    return true;
}

/**
 * Termina la parata
 */
function finisciParata(lottatore) {
    lottatore.isParata = false;
    lottatore.framesParata = 0;
    tastoParataDi(lottatore).pressed = false;
}

/**
 * Disegna l'avviso temporaneo (perfect block o ultimate)
 */
/**
 * Barra di carica sopra il lottatore che sta tenendo premuto l'attacco
 */
function disegnaCarica(lottatore) {
    if (!lottatore.isCaricando) {
        return;
    }

    c.save();

    const larghezza = 80;
    const x = lottatore.position.x + lottatore.centroCorpo - larghezza / 2;
    const y = lottatore.position.y - 26;
    const frazione = Math.min(1, lottatore.framesCarica / CARICA_ATTACCO_FRAMI);

    c.fillStyle = 'rgba(0, 0, 0, 0.7)';
    c.fillRect(x, y, larghezza, 9);

    c.fillStyle = frazione >= 1 ? '#ffd34d' : '#ff6b4a';
    c.fillRect(x, y, larghezza * frazione, 9);

    c.strokeStyle = 'black';
    c.lineWidth = 1;
    c.strokeRect(x, y, larghezza, 9);

    if (frazione >= 1) {
        c.fillStyle = '#ffd34d';
        c.font = 'bold 15px sans-serif';
        c.textAlign = 'center';
        c.fillText('CARICATO', x + larghezza / 2, y - 7);
    }

    c.restore();
}

function disegnaAvviso() {
    if (avvisoTimer <= 0) {
        return;
    }

    avvisoTimer--;

    c.save();
    c.globalAlpha = Math.min(1, avvisoTimer / 20);
    c.font = 'bold 46px sans-serif';
    c.textAlign = 'center';
    c.lineWidth = 8;
    c.strokeStyle = 'black';
    c.fillStyle = avvisoColore;
    c.strokeText(avvisoTesto, canvas.width / 2, 180);
    c.fillText(avvisoTesto, canvas.width / 2, 180);
    c.restore();
}

// ========================================
// Loop Principale del Gioco
// ==========================================
function animate() {
    window.requestAnimationFrame(animate);

    // Fuori dalla partita non si aggiorna nulla: resta visibile il menu
    if (statoCorrente !== STATI.PARTITA) {
        return;
    }

    // Pannello di report bug aperto: il gioco è in pausa
    if (reportAperto) {
        return;
    }

    // Pulisci canvas
    c.fillStyle = 'black';
    c.fillRect(0, 0, canvas.width, canvas.height);

    // Resetta velocità
    Player.velocity.x = 0;
    Enemy.velocity.x = 0;

    // Meccaniche per frame: ultimate, stun, finestra di parata, attacco caricato
    aggiornaMeccaniche(Player);
    aggiornaMeccaniche(Enemy);

    // In VS CPU l'IA decide gli input del giocatore 2 prima del movimento
    if (cpu) {
        aggiornaCPU(cpu);
    }

    // Movimento del giocatore (game over, stun, carica o congelamento lo bloccano)
    if (!gameOver && !Player.isStunned && !Player.isCaricando && Player.congelamentoTimer <= 0) {
        const invertito = Player.inversioneTimer > 0 || Player.eclissiTimer > 0;
        let direzione = 0;

        if (keys.a.pressed && lastKey === 'a') {
            direzione = -1;
        } else if (keys.d.pressed && lastKey === 'd') {
            direzione = 1;
        }

        if (invertito) {
            direzione *= -1;
        }

        if (direzione !== 0) {
            Player.velocity.x = direzione * Player.statistiche.velocita * Player.moltiplicatoreVelocita;
            Player.facing = direzione;
            Player.cambiaSprite('Run');
        } else if (!Player.isParata) {
            Player.cambiaSprite('idle');
        }
    }

    // Movimento verticale del giocatore
    if (Player.velocity.y < 0) {
        Player.cambiaSprite('Jump');
    } else if (Player.velocity.y > 0) {
        Player.cambiaSprite('Fall');
    } else if ((Player.isStunned || Player.congelamentoTimer > 0) && !Player.isTakingDmg &&
               Player.image !== Player.sprites.TakeHit.image) {
        Player.cambiaSprite('idle');
    }

    // La parata consuma stamina ogni frame, anche in movimento (BUG-07)
    if (!gameOver && !Player.isStunned && Player.isParata) {
        Player.stamina = Math.max(0, Player.stamina - 0.2);
    }

    // Movimento del nemico (game over, stun, carica o congelamento lo bloccano).
    // Il giocatore 2 usa la stessa convenzione del giocatore 1:
    // 1 = guarda a destra, -1 = guarda a sinistra.
    if (!gameOver && !Enemy.isStunned && !Enemy.isCaricando && Enemy.congelamentoTimer <= 0) {
        const invertito = Enemy.inversioneTimer > 0 || Enemy.eclissiTimer > 0;
        let direzione = 0;

        if (keys.ArrowLeft.pressed && Enemy.lastKey === 'ArrowLeft') {
            direzione = -1;
        } else if (keys.ArrowRight.pressed && Enemy.lastKey === 'ArrowRight') {
            direzione = 1;
        }

        if (invertito) {
            direzione *= -1;
        }

        if (direzione !== 0) {
            Enemy.velocity.x = direzione * Enemy.statistiche.velocita * Enemy.moltiplicatoreVelocita;
            Enemy.facing = direzione;
            Enemy.cambiaSprite('Run');
        } else if (!Enemy.isParata) {
            Enemy.cambiaSprite('idle');
        }
    }

    // Movimento verticale del nemico
    if (Enemy.velocity.y < 0) {
        Enemy.cambiaSprite('Jump');
    } else if (Enemy.velocity.y > 0) {
        Enemy.cambiaSprite('Fall');
    } else if ((Enemy.isStunned || Enemy.congelamentoTimer > 0) && !Enemy.isTakingDmg &&
               Enemy.image !== Enemy.sprites.TakeHit.image) {
        Enemy.cambiaSprite('idle');
    }

    // La parata consuma stamina ogni frame, anche in movimento (BUG-07)
    if (!gameOver && !Enemy.isStunned && Enemy.isParata) {
        Enemy.stamina = Math.max(0, Enemy.stamina - 0.2);
    }

    // Aggiorna e disegna
    background.update();
    Player.update();
    Enemy.update();

    // Barre di carica sopra i lottatori
    disegnaCarica(Player);
    disegnaCarica(Enemy);

    // Proiettili e stati alterati delle ultimate
    aggiornaProiettili();
    disegnaProiettili();
    disegnaStati(Player);
    disegnaStati(Enemy);

    // A partita finita il vincitore non deve restare in loop di attacco o parata
    if (gameOver) {
        proiettili.length = 0;

        for (const lottatore of [Player, Enemy]) {
            lottatore.isStunned = false;
            lottatore.stunTimer = 0;
            lottatore.isCaricando = false;
            lottatore.framesCarica = 0;
            lottatore.isParata = false;
            lottatore.framesParata = 0;

            // Gli stati alterati non devono restare sul risultato finale
            lottatore.rallentamentoTimer = 0;
            lottatore.inversioneTimer = 0;
            lottatore.congelamentoTimer = 0;
            lottatore.velenoTimer = 0;
            lottatore.marchioTimer = 0;
            lottatore.bruciaturaTimer = 0;
            lottatore.bloccoStaminaTimer = 0;
            lottatore.silenzioTimer = 0;
            lottatore.eclissiTimer = 0;
            lottatore.buffTimer = 0;
            lottatore.moltiplicatoreVelocita = 1;
            lottatore.moltiplicatoreAnimazione = 1;

            if (!lottatore.isDead && !lottatore.isAttacking && !lottatore.isTakingDmg) {
                lottatore.cambiaSprite('idle');
            }
        }
    }

    // Aggiorna le barre UI (elementi in cache, niente querySelector per frame)
    hud.enemyStamina.style.width = percentualeBarra(Enemy.stamina, Enemy.statistiche.stamina) + '%';
    hud.playerStamina.style.width = percentualeBarra(Player.stamina, Player.statistiche.stamina) + '%';
    hud.enemyUltimate.style.width = percentualeBarra(Enemy.ultimate, 100) + '%';
    hud.playerUltimate.style.width = percentualeBarra(Player.ultimate, 100) + '%';

    // Pannello di debug: attivo con il tasto U
    if (hitboxVisibili) {
        disegnaPannelloDebug();
    }

    // Avviso centrale (PERFECT BLOCK / nome ultimate)
    disegnaAvviso();

    // Rilevamento collisione attacco del giocatore.
    // Le misure sono quelle del personaggio: ogni lottatore ha il suo riquadro.
    if (Player.isAttacking &&
        Player.AttackBox.position.x < Enemy.position.x + Enemy.width &&
        Player.AttackBox.position.x + Player.AttackBox.width > Enemy.position.x &&
        Player.AttackBox.position.y + Player.AttackBox.height >= Enemy.position.y &&
        Player.AttackBox.position.y <= Enemy.position.y + Enemy.height &&
        Player.framesCurrent === Player.attacco.frame) {

        risolviImpatto(Player, Enemy);
    }

    // Rilevamento collisione attacco del nemico
    if (Enemy.isAttacking &&
        Enemy.AttackBox.position.x < Player.position.x + Player.width &&
        Enemy.AttackBox.position.x + Enemy.AttackBox.width > Player.position.x &&
        Enemy.AttackBox.position.y + Enemy.AttackBox.height >= Player.position.y &&
        Enemy.AttackBox.position.y <= Player.position.y + Player.height &&
        Enemy.framesCurrent === Enemy.attacco.frame) {

        risolviImpatto(Enemy, Player);
    }

    // Condizione di fine gioco (eseguita una sola volta)
    if (!gameOver && (Player.health <= 0 || Enemy.health <= 0)) {
        gameOver = true;
        if (Player.health <= 0) {
            Player.cambiaSprite('Death');
        }
        if (Enemy.health <= 0) {
            Enemy.cambiaSprite('Death');
        }
        hud.displayText.style.display = 'flex';
        determineWinner(Player, Enemy, timerId);
    }
}

// ========================================
// Event Listener
// ==========================================
window.addEventListener('keydown', (event) => {
    // Con il report bug aperto la tastiera serve solo al pannello
    if (reportAperto) {
        return;
    }

    // Debug: il tasto U mostra o nasconde le hitbox (funziona in ogni schermata)
    if (!event.repeat && (event.key === 'u' || event.key === 'U')) {
        hitboxVisibili = !hitboxVisibili;
        return;
    }

    // La pressione prolungata non deve generare comandi a raffica:
    // i tasti tenuti premuti restano attivi tramite i flag in `keys`.
    if (event.repeat) {
        return;
    }

    // Fuori dalla partita gli input servono alla selezione o ai menu
    if (statoCorrente === STATI.SELEZIONE) {
        gestisciInputSelezione(event);
        return;
    }

    if (statoCorrente !== STATI.PARTITA) {
        gestisciInputMenu(event);
        return;
    }

    // A partita finita gli input non hanno più alcun effetto
    // (l'animazione di morte resta comunque libera di completarsi),
    // ma Esc deve poter aprire la pausa anche sul risultato finale.
    if (event.key === 'Escape') {
        apriPausa();
        return;
    }

    if (gameOver) return;

    const key = (event.key && event.key.length === 1) ? event.key.toLowerCase() : event.key;

    // In VS CPU il giocatore 2 è controllato dall'IA: nessun tasto umano
    if (modalitaPartita === MODALITA.CPU && TASTI_P2.includes(key)) {
        return;
    }

    switch (key) {
        case 'w':
            salta(Player);
            break;

        case 'a':
            if (!Player.isDead && !Player.isStunned) {
                keys.a.pressed = true;
                lastKey = 'a';
                Player.lastKey = 'a';
            }
            break;

        case 'd':
            if (!Player.isDead && !Player.isStunned) {
                keys.d.pressed = true;
                lastKey = 'd';
                Player.lastKey = 'd';
            }
            break;

        case 'h':
            iniziaCarica(Player);
            break;

        case 'j':
            iniziaParata(Player);
            break;

        case 'g':
            // Ultimate del giocatore 1
            attivaUltimate(Player);
            break;

        case 'ArrowUp':
            salta(Enemy);
            break;

        case 'ArrowLeft':
            if (!Enemy.isDead && !Enemy.isStunned) {
                keys.ArrowLeft.pressed = true;
                Enemy.lastKey = 'ArrowLeft';
            }
            break;

        case 'ArrowRight':
            if (!Enemy.isDead && !Enemy.isStunned) {
                keys.ArrowRight.pressed = true;
                Enemy.lastKey = 'ArrowRight';
            }
            break;

        case 'ù':
            iniziaCarica(Enemy);
            break;

        case 'à':
            iniziaParata(Enemy);
            break;

        case 'l':
            // Ultimate del giocatore 2
            attivaUltimate(Enemy);
            break;
    }
});

window.addEventListener('keyup', (event) => {
    const key = (event.key && event.key.length === 1) ? event.key.toLowerCase() : event.key;

    // In VS CPU i tasti del giocatore 2 non devono toccare l'IA
    if (modalitaPartita === MODALITA.CPU && TASTI_P2.includes(key)) {
        return;
    }

    switch (key) {
        case 'a':
            keys.a.pressed = false;
            break;

        case 'd':
            keys.d.pressed = false;
            break;

        case 'h':
            if (statoCorrente === STATI.PARTITA) {
                rilasciaCarica(Player);
            }
            break;

        case 'j':
            finisciParata(Player);
            break;

        case 'ArrowLeft':
            keys.ArrowLeft.pressed = false;
            break;

        case 'ArrowRight':
            keys.ArrowRight.pressed = false;
            break;

        case 'ù':
            if (statoCorrente === STATI.PARTITA) {
                rilasciaCarica(Enemy);
            }
            break;

        case 'à':
            finisciParata(Enemy);
            break;
    }
});

// ========================================
// Strumenti di Debug
// ==========================================
/**
 * Mostra i riquadri di collisione e i dati utili per calibrarli.
 * Si attiva e si disattiva con il tasto U.
 */
function disegnaPannelloDebug() {
    const x = 24;
    const y = 130;

    c.fillStyle = 'rgba(0, 0, 0, 0.7)';
    c.fillRect(x - 12, y - 26, 1000, 106);

    c.fillStyle = 'white';
    c.font = '18px monospace';
    c.fillText('HITBOX VISIBILI  (premi U per nascondere)', x, y);
    c.fillText(rigaDebug('P1', Player), x, y + 28);
    c.fillText(rigaDebug('P2', Enemy), x, y + 56);
}

/**
 * Riga con i dati di un lottatore: personaggio, frame corrente, stati.
 * Il frame corrente è quello che serve per decidere quando un attacco colpisce.
 */
function rigaDebug(etichetta, lottatore) {
    const tipoAttacco = lottatore.attaccoUltimate
        ? 'ULT'
        : (lottatore.attaccoCaricato ? 'CAR' : 'si');

    return etichetta + '  ' + lottatore.personaggio.nome.padEnd(16) +
        ' frame ' + lottatore.framesCurrent + '/' + (lottatore.framesMax - 1) +
        '  attacco ' + (lottatore.isAttacking ? tipoAttacco : 'no') +
        '  parata ' + (lottatore.isParata ? 'si ' + lottatore.framesParata : 'no') +
        '  stun ' + (lottatore.isStunned ? lottatore.stunTimer : 'no') +
        '  ult ' + Math.round(lottatore.ultimate) + '%';
}

// ========================================
// Avvio della Partita
// ==========================================
/**
 * Avvia una partita: chiude il menu e fa partire timer e game loop
 */
function avviaPartita(idP1, idP2) {
    // Crea i lottatori con i personaggi scelti nella selezione
    preparaPartita(idP1, idP2);

    // Nessun proiettile deve sopravvivere alla partita precedente
    proiettili.length = 0;

    // Ripulisce l'eventuale partita precedente
    clearTimeout(timerId);
    timer = 60;
    document.querySelector('#timer').innerHTML = '60';
    gameOver = false;
    hud.displayText.style.display = 'none';
    hud.displayText.innerHTML = '';
    avvisoTimer = 0;

    // Rilascia tutti gli input rimasti premuti
    for (const tasto in keys) {
        keys[tasto].pressed = false;
    }
    lastKey = undefined;

    // In VS CPU crea il controller; in VS locale resta null
    cpu = modalitaPartita === MODALITA.CPU ? creaCPU(difficoltaCPU) : null;

    // Le barre ripartono piene: la vita massima dipende dal personaggio
    hud.playerHealth.style.width = '100%';
    hud.enemyHealth.style.width = '100%';
    hud.playerStamina.style.width = '100%';
    hud.enemyStamina.style.width = '100%';
    hud.playerUltimate.style.width = '0%';
    hud.enemyUltimate.style.width = '0%';

    cambiaStato(STATI.PARTITA);
    decreaseTimer();
}

/**
 * Apre il menu di pausa sopra la partita.
 * Funziona anche a partita finita: il risultato resta dietro al menu.
 */
function apriPausa() {
    if (statoCorrente !== STATI.PARTITA) {
        return;
    }

    // La pausa annulla le cariche in corso: al ritorno non restano tasti "fantasma"
    for (const lottatore of [Player, Enemy]) {
        if (lottatore) {
            lottatore.isCaricando = false;
            lottatore.framesCarica = 0;
        }
    }

    apriMenu('pausa', STATI.PAUSA);
}

/**
 * Chiude la pausa e riprende la partita
 */
function chiudiPausa() {
    if (statoCorrente !== STATI.PAUSA) {
        return;
    }

    document.querySelector('#menu').classList.remove('pausa');
    cambiaStato(STATI.PARTITA);
}

/**
 * Abbandona la partita e torna al menu principale senza ricaricare la pagina
 */
function esciAlMenu() {
    clearTimeout(timerId);
    gameOver = false;

    hud.displayText.style.display = 'none';
    hud.displayText.innerHTML = '';

    for (const tasto in keys) {
        keys[tasto].pressed = false;
    }
    lastKey = undefined;
    cpu = null;
    modalitaPartita = MODALITA.LOCALE;
    proiettili.length = 0;

    // Chiude un eventuale report rimasto aperto
    reportAperto = false;
    const report = document.querySelector('#reportBug');
    if (report) {
        report.classList.remove('aperto');
    }

    apriMenu('principale');
}

// ========================================
// Avvio del Gioco
// ==========================================
// Si parte dalla schermata di caricamento. Quando TUTTI gli asset sono pronti
// si passa al menu: la partita parte solo da li' (voce PLAY -> VS LOCALE).
aggiornaVisibilita();

// Le immagini di tutti i personaggi entrano nel caricamento iniziale, cosi'
// scegliere un personaggio non provoca ritardi
precaricaPersonaggi();

// Se la finestra cambia dimensione, canvas, suolo e sfondo si adattano
window.addEventListener('resize', adattaAllaFinestra);

avviaGiocoQuandoPronto(() => {
    // Gli asset sono pronti: lo sfondo si può scalare in modo definitivo
    adattaSfondo();
    apriMenu('principale');
    animate();
});
