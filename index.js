// ========================================
// Controllo di versione (aggiornamento automatico)
// ==========================================
// GitHub Pages tiene l'HTML in cache per ~10 minuti: un telefono può quindi
// mostrare index.html vecchio con CSS o JS nuovi, e la pagina sembra rotta
// (è successo davvero: sfondo piccolo in alto a sinistra e selezione tagliata).
// Qui si chiede versione.json SENZA cache: se il build del server è più recente
// di quello compilato in questo file, la pagina si ricarica da sola una volta.
const BUILD_PAGINA = 3;

(function controlloVersione() {
    if (typeof fetch !== 'function') {
        return;
    }
    fetch('versione.json?t=' + Date.now(), { cache: 'no-store' })
        .then((risposta) => risposta.json())
        .then((dati) => {
            const buildServer = Number(dati && dati.build);
            if (!buildServer || buildServer <= BUILD_PAGINA) {
                try { sessionStorage.removeItem('giriAggiornamento'); } catch (e) { /* niente */ }
                return;
            }
            // massimo due ricaricamenti per sessione: se qualcosa va storto non
            // si entra in un ciclo infinito di ricariche
            let giri = 0;
            try { giri = Number(sessionStorage.getItem('giriAggiornamento') || '0'); } catch (e) { giri = 0; }
            if (giri >= 2) {
                return;
            }
            try { sessionStorage.setItem('giriAggiornamento', String(giri + 1)); } catch (e) { /* niente */ }
            // replace con un parametro nuovo: forza il download dell'HTML
            window.location.replace(window.location.pathname + '?agg=' + Date.now());
        })
        .catch(() => {
            // offline o file aperto da disco: si gioca la versione che c'è
        });
})();

// ========================================
// Configurazione Canvas
// ==========================================
const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');

// ========================================
// Mondo di gioco: dimensioni fisse
// ==========================================
// Il mondo è sempre 1280x720 (16:9). Il CSS scala il canvas dentro lo schermo
// e aggiunge le bande nere quando il rapporto del dispositivo è diverso.
// Se il canvas prendesse le misure della finestra (com'era prima) su un
// telefono in verticale l'arena diventerebbe altissima e stretta: i due
// lottatori finirebbero uno sopra l'altro e il campo cambierebbe da telefono
// a telefono, rendendo la partita ingiocabile.
const MONDO_LARGHEZZA = 1280;
const MONDO_ALTEZZA = 720;

canvas.width = MONDO_LARGHEZZA;
canvas.height = MONDO_ALTEZZA;

c.fillStyle = 'black';
c.fillRect(0, 0, canvas.width, canvas.height);

// --- Meccaniche avanzate (Fase 3) ---
const STUN_FRAMI = 60;                  // 1 secondo a 60 fps
const FINESTRA_PERFETTO = 3;            // frame entro cui la parata è perfetta
const CARICA_ATTACCO_FRAMI = 60;        // 1 secondo di carica prima del colpo caricato
const ULTIMATE_CARICA_FRAME = 100 / (60 * 20); // barra piena in circa 20 secondi
const ULTIMATE_PER_PARATA_PERFETTA = 15; // carica guadagnata dal perfect block
const ULTIMATE_PERSA_PER_STUN = 25;      // carica persa quando si viene stunnati

// Durata dello stato "colpo subito" in frame (24 = 400 ms a 60 fps).
// Sostituisce il setTimeout che non era tracciato (BUG-20): lo stato si chiude
// contando i frame, come il resto delle meccaniche.
const DANNO_FRAMI = 24;

// Elementi dell'HUD letti una sola volta (niente querySelector nel game loop)
const hud = {
    playerHealth: document.querySelector('#player-health'),
    playerStamina: document.querySelector('#player-stamina'),
    playerUltimate: document.querySelector('#player-ultimate'),
    enemyHealth: document.querySelector('#enemy-health'),
    enemyStamina: document.querySelector('#enemy-stamina'),
    enemyUltimate: document.querySelector('#enemy-ultimate'),
    displayText: document.querySelector('#displayText'),
    timer: document.querySelector('#timer')
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
    if (!background.image.loaded || !(background.image.height > 0)) {
        // Se lo sfondo non è ancora pronto si riprova quando carica. Senza
        // questo, se la prima chiamata avveniva prima del caricamento la scala
        // restava quella iniziale (1) e lo sfondo veniva disegnato piccolo in
        // alto a sinistra, con il resto dell'arena nero.
        if (background.image._scalaInAttesa || !background.image.addEventListener) {
            return;
        }
        background.image._scalaInAttesa = true;
        background.image.addEventListener('load', () => {
            background.image._scalaInAttesa = false;
            adattaSfondo();
        }, { once: true });
        return;
    }

    const larghezzaFrame = background.image.width / background.framesMax;
    background.scale = Math.max(
        canvas.width / larghezzaFrame,
        canvas.height / background.image.height
    );
}

/**
 * Adatta canvas, suolo e sfondo alle dimensioni attuali della finestra
 */
function adattaAllaFinestra() {
    // In VS ONLINE il campo è fissato all'inizio della partita: ridimensionarlo
    // farebbe divergere le posizioni tra host e ospite
    if (onlineStato.attivo) {
        adattaCanvasOspite();
        return;
    }

    // Il canvas NON viene ridimensionato: il mondo resta 1280x720. Cambia solo
    // la scala con cui il CSS lo mostra, così HUD e comandi seguono lo schermo
    // senza che il campo di gioco si deformi.
    aggiornaScalaSchermo();

    ground = canvas.height - 40;

    adattaSfondo();
}

/**
 * Calcola quanto è grande l'area di gioco rispetto al mondo (1280x720) e lo
 * espone come variabile CSS `--scala`, usata da HUD e sovrapposizioni per
 * restare proporzionate su telefoni, tablet e monitor.
 */
function aggiornaScalaSchermo() {
    const area = document.getElementById('areaGioco');
    if (!area) {
        return;
    }
    const larghezza = area.clientWidth || window.innerWidth;
    const scala = larghezza / MONDO_LARGHEZZA;
    document.documentElement.style.setProperty('--scala', String(scala));
}

// Chi combatte: i due personaggi scelti nella schermata di selezione.
// Vengono creati da preparaPartita() all'avvio della partita.
let Player;
let Enemy;

// Controller della CPU: valorizzato solo in modalità VS CPU
let cpu = null;

// Proiettili delle ultimate (Bakari, Sekou, Ayo)
const proiettili = [];

// Effetti visivi della partita (particelle, onde, scosse, tinte). Non toccano
// la simulazione: sono solo disegno, e si azzerano a ogni nuova partita.
const effetti = creaSistemaEffetti();

// Sprite del pacchetto Kenney (assets/Effetti/): se mancano restano le forme
// geometriche, quindi il gioco funziona anche senza la cartella.
preparaSpriteEffetti();

// Comandi premuti troppo presto: restano in coda qualche frame (js/Buffer.js)
const bufferComandi = creaBuffer();

// Chi ha chiesto meno movimento al sistema operativo vede meno effetti
const MOVIMENTO_RIDOTTO = typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Contatore dei passi di simulazione: lo usano il buffer, le stelle dello stun
// e window.uvsf7Debug(). Cresce di 1 ogni 1/60 di secondo.
let frameGioco = 0;

// Ultimi personaggi usati: serve alla rivincita con gli stessi lottatori
let ultimiPersonaggi = { p1: null, p2: null };

/**
 * Crea i due lottatori a partire dai personaggi scelti.
 * Il giocatore 2 parte rivolto verso sinistra (le sprite nascono verso destra)
 * e con l'AttackBox dal suo lato.
 */
function preparaPartita(idP1, idP2) {
    // Posizioni ai lati del campo, calcolate sulla larghezza attuale della finestra
    const margine = Math.round(canvas.width * 0.05);

    ultimiPersonaggi = { p1: idP1, p2: idP2 };

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
 * - chiude lo stato di colpo subito dopo DANNO_FRAMI
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

    // Colpo subito: si chiude contando i frame (BUG-20). Prima era un
    // setTimeout per ogni colpo: due colpi ravvicinati si azzeravano il flag
    // a vicenda e lo stato non era deterministico.
    if (lottatore.isTakingDmg) {
        lottatore.framesDanno++;
        if (lottatore.framesDanno >= DANNO_FRAMI) {
            lottatore.isTakingDmg = false;
            lottatore.framesDanno = 0;
        }
    } else {
        lottatore.framesDanno = 0;
    }

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

    // Stun: onde bianche attorno al lottatore e scossa. Le stelle che girano
    // sopra la testa le disegna disegnaStelleStun() finché dura lo stun.
    const puntoStun = puntoImpatto(lottatore);
    aggiungiOnda(effetti, puntoStun.x, puntoStun.y, '#ffffff', 110, 8);
    aggiungiParticelle(effetti, puntoStun.x, puntoStun.y, '#ffd34d', MOVIMENTO_RIDOTTO ? 6 : 14, 4);
    if (!MOVIMENTO_RIDOTTO) {
        scuoti(effetti, 4);
    }

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
    difensore.framesDanno = 0;
    difensore.isParata = false;
    difensore.cambiaSprite('TakeHit');
    difensore.health = Math.max(0, difensore.health - danno);

    // Scintille del colpo: colore dell'attaccante se è un colpo pesante
    particelleDiImpulso(difensore, forza ? coloreEffetti(attaccante) : '#ffffff', 12, 5);
    if (!MOVIMENTO_RIDOTTO) {
        scuoti(effetti, forza ? 6 : 3);
    }

    const barra = difensore === Player ? hud.playerHealth : hud.enemyHealth;
    barra.style.width = percentualeBarra(difensore.health, difensore.statistiche.vita) + '%';
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

        // Scia: qualche particella colorata come l'ultimate (non una per
        // frame, per non mangiare il tetto delle particelle)
        if (!MOVIMENTO_RIDOTTO && p.vita % 2 === 0) {
            aggiungiParticelle(effetti, p.x, p.y, p.colore, 1, 0.6);
        }

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

            particelleDiImpulso(difensore, p.colore, 22, 7);
            aggiungiOnda(effetti, p.x, p.y, p.colore, 130, 9);
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

    // Due cerchi invece di un gradiente radiale: creare un gradiente per ogni
    // proiettile a ogni frame è una delle allocazioni più care del disegno, e
    // il risultato a video è lo stesso.
    for (const p of proiettili) {
        c.fillStyle = p.colore;

        c.globalAlpha = 0.35;
        c.beginPath();
        c.arc(p.x, p.y, p.raggio * 1.9, 0, Math.PI * 2);
        c.fill();

        c.globalAlpha = 1;
        c.beginPath();
        c.arc(p.x, p.y, p.raggio, 0, Math.PI * 2);
        c.fill();
    }
    c.globalAlpha = 1;

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
        const larghezza = larghezzaTesto(nome) + 10;
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
            particelleDiImpulso(difensore, coloreEffetti(attaccante), 24, 8);
            return;
        }

        // Attacco caricato: rompe la parata e stunna
        if (attaccante.attaccoCaricato) {
            applicaDanno(attaccante, difensore, danno);
            stunna(difensore);
            particelleDiImpulso(difensore, '#ff5a4a', 16, 6);
            if (!MOVIMENTO_RIDOTTO) {
                scuoti(effetti, 5);
            }
            return;
        }

        // Perfect block: parata iniziata negli ultimi FINESTRA_PERFETTO frame
        if (difensore.framesParata <= FINESTRA_PERFETTO) {
            difensore.ultimate = Math.min(100, difensore.ultimate + ULTIMATE_PER_PARATA_PERFETTA);
            stunna(attaccante);

            // L'attaccante mostra l'animazione di colpo subito per tutto lo stun
            attaccante.cambiaSprite('TakeHit');

            // Perfect block: anello dorato, flash e scossa. È il momento più
            // importante della partita e prima si vedeva solo una scritta.
            const puntoPerfetto = puntoImpatto(difensore);
            particelleDiImpulso(difensore, '#ffd34d', 20, 7);
            aggiungiOnda(effetti, puntoPerfetto.x, puntoPerfetto.y, '#fff6b0', 150, 10);
            tigni(effetti, '#ffd34d', 0.18, 10);
            if (!MOVIMENTO_RIDOTTO) {
                scuoti(effetti, 6);
            }

            mostraAvviso('PERFECT BLOCK', '#ffd34d');
            return;
        }

        // Blocco normale: nessun danno. La bolla azzurra dice "parata riuscita".
        particelleDiImpulso(difensore, '#8be9fd', 8, 4, 'parata');
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
        return false;
    }

    if (lottatore.ultimate < 100) {
        return false;
    }

    const dati = lottatore.datiUltimate;

    // Ultimate: flash a tutto schermo del colore del personaggio, onda dal
    // corpo e scossa. Vale per ogni tipo (mischia, proiettile, buff).
    const puntoUltimate = puntoImpatto(lottatore);
    segnaImpatto(effetti, puntoUltimate.x, puntoUltimate.y, 16, 'ultimate');
    tigni(effetti, coloreEffetti(lottatore), 0.22, 14);
    aggiungiOnda(effetti, puntoUltimate.x, puntoUltimate.y, coloreEffetti(lottatore), 200, 12);
    aggiungiParticelle(effetti, puntoUltimate.x, puntoUltimate.y, coloreEffetti(lottatore),
        MOVIMENTO_RIDOTTO ? 10 : 26, 8);
    if (!MOVIMENTO_RIDOTTO) {
        scuoti(effetti, 8);
    }

    lottatore.ultimate = 0;

    if (dati.tipo === 'buff') {
        lottatore.buffTimer = dati.durata;
        mostraAvviso(dati.nome, dati.colore || '#7dff7d');
        return true;
    }

    lottatore.avviaAttacco({ ultimate: true });

    if (dati.tipo === 'proiettile') {
        creaProiettile(lottatore);
    }

    mostraAvviso(dati.nome, dati.colore || '#8be9fd');
    return true;
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

// Le larghezze dei testi degli stati si misurano una volta sola: c.measureText
// a ogni frame per ogni etichetta è lavoro inutile (il font non cambia).
const larghezzeTesti = new Map();

function larghezzaTesto(nome) {
    if (!larghezzeTesti.has(nome)) {
        larghezzeTesti.set(nome, c.measureText(nome).width);
    }
    return larghezzeTesti.get(nome);
}

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
// Pianificatore: timestep fisso a 60 Hz
// ==========================================
// animate() gira a ogni fotogramma dello schermo, ma il gioco avanza di 60
// passi al secondo, sempre. Prima ogni fotogramma dello schermo valeva un
// frame di gioco: su un monitor a 144 Hz tutto (animazioni, parate, stamina)
// andava 2,4 volte più veloce, su un PC lento più piano. Vedi js/Tempo.js.
let ultimoTempo = 0;
let accumulatore = 0;
let passiUltimoFotogramma = 0;

function animate(tempo) {
    window.requestAnimationFrame(animate);

    const adesso = (typeof tempo === 'number') ? tempo : performance.now();
    const dt = ultimoTempo ? (adesso - ultimoTempo) : (1000 / 60);
    ultimoTempo = adesso;

    // Fuori dalla partita il tempo non si accumula: altrimenti al ritorno in
    // partita si vedrebbero raffiche di passi arretrati.
    if (statoCorrente !== STATI.PARTITA || reportAperto) {
        accumulatore = 0;
        return;
    }

    const esito = avanzaAccumulatore(accumulatore, dt);
    accumulatore = esito.resto;
    passiUltimoFotogramma = esito.passi;

    for (let i = 0; i < esito.passi; i++) {
        passoSimulazione();
    }
}

// Strumento di diagnosi: dalla console del browser si legge se il ritmo è
// giusto (deve crescere di ~60 al secondo, non 144).
window.uvsf7Debug = function () {
    return {
        frame: frameGioco,
        passiUltimoFotogramma: passiUltimoFotogramma,
        attesaMs: Math.round(accumulatore * 100) / 100,
        comandiInCoda: bufferComandi.voci.length,
        particelle: effetti.particelle.length,
        scossa: Math.round(effetti.scossa * 100) / 100
    };
};

// ========================================
// HUD: scritture solo quando il valore cambia
// ==========================================
// Scrivere style.width a ogni passo fa ricalcolare lo stile al browser anche
// quando il numero è identico: 4 barre x 60 passi = 240 scritture inutili al
// secondo, che sui telefoni si sentono.
const hudPrecedente = {
    playerStamina: -1,
    playerUltimate: -1,
    enemyStamina: -1,
    enemyUltimate: -1
};

function scriviBarra(chiave, elemento, valore, massimo) {
    if (!elemento) {
        return;
    }
    const percento = Math.round(percentualeBarra(valore, massimo) * 10) / 10;
    if (hudPrecedente[chiave] === percento) {
        return;
    }
    hudPrecedente[chiave] = percento;
    elemento.style.width = percento + '%';
}

// ========================================
// Effetti: strumenti
// ==========================================

/**
 * Punto in cui si disegnano gli effetti di un colpo: il petto del difensore.
 */
function puntoImpatto(lottatore) {
    return {
        x: lottatore.position.x + lottatore.centroCorpo,
        y: lottatore.position.y + lottatore.height * 0.42
    };
}

/**
 * Colore degli effetti di un lottatore: quello della sua ultimate, così ogni
 * personaggio ha i suoi colori (i personaggi sono già guidati da dati).
 */
function coloreEffetti(lottatore) {
    const dati = lottatore && lottatore.datiUltimate;
    return (dati && dati.colore) || '#ff8a3d';
}

/**
 * Scintille + onda in un punto: il colpo visto da chi lo prende.
 */
function particelleDiImpulso(lottatore, colore, quante, forza, sprite) {
    const punto = puntoImpatto(lottatore);
    const numero = MOVIMENTO_RIDOTTO ? Math.ceil(quante / 2) : quante;
    aggiungiParticelle(effetti, punto.x, punto.y, colore, numero, forza);
    aggiungiOnda(effetti, punto.x, punto.y, colore, 60, 4);
    segnaImpatto(effetti, punto.x, punto.y, 10, sprite || 'impatto');
}

/**
 * Scossa dello schermo: sposta il canvas di pochi pixel tramite due variabili
 * CSS (css/style.css). Muovere il disegno dentro il canvas lascerebbe comunque
 * i bordi neri attorno al campo.
 */
function applicaScossa() {
    const radice = document.documentElement;
    if (!radice) {
        return;
    }
    if (MOVIMENTO_RIDOTTO || effetti.scossa <= 0) {
        if (radice.style.getPropertyValue('--scossa-x') !== '0') {
            radice.style.setProperty('--scossa-x', '0');
            radice.style.setProperty('--scossa-y', '0');
        }
        return;
    }
    const angolo = Math.random() * Math.PI * 2;
    radice.style.setProperty('--scossa-x', (Math.cos(angolo) * effetti.scossa).toFixed(2));
    radice.style.setProperty('--scossa-y', (Math.sin(angolo) * effetti.scossa).toFixed(2));
}

/**
 * Piccolo segnale sopra la testa quando un comando in coda viene eseguito:
 * è la prova che il gioco ha sentito il tasto.
 */
function segnalaComandoEseguito(lottatore) {
    const x = lottatore.position.x + lottatore.centroCorpo;
    const y = lottatore.position.y - 8;
    aggiungiParticelle(effetti, x, y, '#ffffff', 4, 1.6);
}

// Lampeggio della barra stamina: "hai premuto, ma non hai energia"
const lampeggioTimer = { Player: 0, Enemy: 0 };

function lampeggiaStamina(lottatore) {
    const nome = lottatore === Player ? 'Player' : 'Enemy';
    if (lampeggioTimer[nome] > 0) {
        return;
    }
    lampeggioTimer[nome] = 1;

    const barra = nome === 'Player' ? hud.playerStamina : hud.enemyStamina;
    if (!barra) {
        return;
    }
    barra.style.filter = 'brightness(2.2)';

    setTimeout(() => {
        barra.style.filter = '';
        lampeggioTimer[nome] = 0;
    }, 300);
}

// ========================================
// Azioni dei comandi e buffer
// ==========================================
// Un unico posto in cui "premere un tasto" diventa un effetto di gioco: lo usano
// sia la pressione dal vivo sia il buffer, così una regola non va scritta due
// volte. Restituisce true se l'azione è partita.

function eseguiAzione(azione, lottatore, tenuto = true) {
    if (!lottatore) {
        return false;
    }

    switch (azione) {
        case 'salto':
            return tenuto ? salta(lottatore) : false;

        case 'attacco':
            if (tenuto && lottatore.stamina < lottatore.statistiche.costoStamina) {
                lampeggiaStamina(lottatore);
                return false;
            }
            return tenuto ? iniziaCarica(lottatore) : rilasciaCarica(lottatore);

        case 'parata':
            if (!tenuto) {
                finisciParata(lottatore);
                return false;
            }
            return iniziaParata(lottatore);

        case 'ultimate':
            return tenuto ? attivaUltimate(lottatore) : false;

        default:
            return false;
    }
}

/**
 * Riprova i comandi rimasti in coda: va chiamata a ogni passo di simulazione,
 * dopo le meccaniche e prima della CPU. L'ordine va dal comando più economico
 * al più impegnativo, così uno non "mangia" lo slot di un altro.
 */
function riprovaBuffer() {
    pulisci(bufferComandi, frameGioco);

    for (const giocatore of ['p1', 'p2']) {
        const lottatore = giocatore === 'p1' ? Player : Enemy;
        if (!lottatore || !puoBufferizzare(lottatore) || gameOver) {
            continue;
        }

        for (const azione of ['salto', 'parata', 'attacco', 'ultimate']) {
            if (!consuma(bufferComandi, azione, giocatore, frameGioco)) {
                continue;
            }
            if (!eseguiAzione(azione, lottatore, true)) {
                // ancora non si può: torna in coda e scade da sola
                spingi(bufferComandi, azione, giocatore, frameGioco);
                continue;
            }

            segnalaComandoEseguito(lottatore);

            // Se l'attacco parte quando il tasto è già stato rilasciato, il
            // colpo deve partire subito invece di restare in carica per sempre.
            if (azione === 'attacco' && !tastoAttaccoDi(lottatore).pressed) {
                rilasciaCarica(lottatore);
            }
        }
    }
}

/**
 * Rilascia tutti i tasti e svuota la coda: serve quando il gioco cambia
 * schermata, va in pausa o la finestra perde il fuoco. Senza questo, aprendo la
 * pausa con un tasto giù il lottatore continuava a correre al ritorno.
 */
function rilasciaTuttiITasti() {
    for (const nome in keys) {
        keys[nome].pressed = false;
    }
    for (const lottatore of [Player, Enemy]) {
        if (lottatore) {
            lottatore.isParata = false;
            lottatore.isCaricando = false;
            lottatore.framesCarica = 0;
        }
    }
    if (bufferComandi) {
        bufferComandi.voci.length = 0;
    }
}

window.addEventListener('blur', rilasciaTuttiITasti);

// ========================================
// Movimento comune ai due giocatori
// ==========================================

/**
 * Movimento orizzontale, animazione verticale e costo della parata: valgono
 * identici per i due lottatori (prima erano due copie identiche, una per il
 * giocatore e una per il nemico).
 * `tastoSinistra` e `tastoDestra` sono i nomi dei tasti in `keys`.
 */
function aggiornaParteComune(lottatore, tastoSinistra, tastoDestra) {
    // Movimento orizzontale (game over, stun, carica e congelamento lo bloccano)
    if (!gameOver && !lottatore.isStunned && !lottatore.isCaricando && lottatore.congelamentoTimer <= 0) {
        const invertito = lottatore.inversioneTimer > 0 || lottatore.eclissiTimer > 0;
        let direzione = 0;

        if (keys[tastoSinistra].pressed && lottatore.lastKey === tastoSinistra) {
            direzione = -1;
        } else if (keys[tastoDestra].pressed && lottatore.lastKey === tastoDestra) {
            direzione = 1;
        }

        if (invertito) {
            direzione *= -1;
        }

        if (direzione !== 0) {
            lottatore.velocity.x = direzione * lottatore.statistiche.velocita * lottatore.moltiplicatoreVelocita;
            lottatore.facing = direzione;
            lottatore.cambiaSprite('Run');
        } else if (!lottatore.isParata) {
            lottatore.cambiaSprite('idle');
        }
    }

    // Animazione verticale
    if (lottatore.velocity.y < 0) {
        lottatore.cambiaSprite('Jump');
    } else if (lottatore.velocity.y > 0) {
        lottatore.cambiaSprite('Fall');
    } else if ((lottatore.isStunned || lottatore.congelamentoTimer > 0) && !lottatore.isTakingDmg &&
               lottatore.image !== lottatore.sprites.TakeHit.image) {
        lottatore.cambiaSprite('idle');
    }

    // La parata consuma stamina ogni frame, anche in movimento (BUG-07)
    if (!gameOver && !lottatore.isStunned && lottatore.isParata) {
        lottatore.stamina = Math.max(0, lottatore.stamina - 0.2);
    }
}

// ========================================
// Collisione degli attacchi
// ==========================================

/**
 * Controllo di collisione di un attacco, in un solo posto per entrambi i
 * giocatori. Registra il colpo quando il frame corrente ha raggiunto il frame
 * d'impatto del personaggio e l'attacco non ha ancora fatto centro: così un
 * fotogramma saltato non fa più passare il colpo attraverso l'avversario.
 */
function controllaColpo(attaccante, difensore) {
    if (!attaccante.isAttacking) {
        return false;
    }
    if (!colpoVaRegistrato(attaccante.framesCurrent, attaccante.attacco.frame, attaccante.attaccoHaColpito)) {
        return false;
    }

    const box = attaccante.AttackBox;
    const colpisce = box.position.x < difensore.position.x + difensore.width &&
        box.position.x + box.width > difensore.position.x &&
        box.position.y + box.height >= difensore.position.y &&
        box.position.y <= difensore.position.y + difensore.height;

    if (!colpisce) {
        return false;
    }

    attaccante.attaccoHaColpito = true;
    risolviImpatto(attaccante, difensore);
    return true;
}

// ========================================
// Loop Principale del Gioco
// ==========================================
function passoSimulazione() {
    // Passo di simulazione: 1/60 di secondo. Lo usano il buffer dei comandi,
    // le stelle dello stun e la diagnosi.
    frameGioco++;

    // Fuori dalla partita non si aggiorna nulla: resta visibile il menu
    if (statoCorrente !== STATI.PARTITA) {
        return;
    }

    // Pannello di report bug aperto: il gioco è in pausa
    if (reportAperto) {
        return;
    }

    // VS ONLINE, lato ospite: nessuna simulazione, si disegna lo stato che
    // arriva dall'host (js/Online.js)
    if (onlineStato.attivo && onlineStato.ospite) {
        aggiornaOspite();
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

    // Comandi premuti troppo presto: si riprovano appena il lottatore è pronto
    riprovaBuffer();

    // In VS CPU l'IA decide gli input del giocatore 2 prima del movimento
    if (cpu) {
        aggiornaCPU(cpu);
    }

    // Movimento, animazione verticale e costo della parata: una sola funzione
    // per giocatore e CPU (prima erano due copie identiche, una per Player e
    // una per Enemy, che potevano divergere senza che nessuno se ne accorgesse)
    aggiornaParteComune(Player, 'a', 'd');
    aggiornaParteComune(Enemy, 'ArrowLeft', 'ArrowRight');

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

    // Effetti sopra la scena: particelle, onde, tinte, stelle dello stun
    aggiornaEffetti(effetti);
    disegnaEffetti(effetti, c);
    disegnaStelleStun(c, Player, frameGioco);
    disegnaStelleStun(c, Enemy, frameGioco);
    applicaScossa();

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
    scriviBarra('enemyStamina', hud.enemyStamina, Enemy.stamina, Enemy.statistiche.stamina);
    scriviBarra('playerStamina', hud.playerStamina, Player.stamina, Player.statistiche.stamina);
    scriviBarra('enemyUltimate', hud.enemyUltimate, Enemy.ultimate, 100);
    scriviBarra('playerUltimate', hud.playerUltimate, Player.ultimate, 100);

    // Pannello di debug: attivo con il tasto U
    if (hitboxVisibili) {
        disegnaPannelloDebug();
    }

    // Avviso centrale (PERFECT BLOCK / nome ultimate)
    disegnaAvviso();

    // Rilevamento collisione: la regola è la stessa per i due lottatori
    controllaColpo(Player, Enemy);
    controllaColpo(Enemy, Player);

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

        // A fine partita compare il menu con rivincita e cambio personaggi
        apriMenu('finePartita', STATI.PAUSA);
    }

    // VS ONLINE, lato host: lo stato appena calcolato va all'ospite
    if (onlineStato.attivo) {
        inviaFotogramma();
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

    // Codice della stanza: la tastiera serve al campo di testo del pannello
    if (pannelloOnlineAperto()) {
        return;
    }

    // Schermata dei keybinds: la tastiera serve alla rimappatura
    if (statoCorrente === STATI.KEYBINDS) {
        gestisciInputKeybinds(event);
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

    // Le frecce non devono far scorrere la pagina mentre si gioca (BUG-18)
    if (event.key.startsWith('Arrow') || event.key === ' ') {
        event.preventDefault();
    }

    // Un tasto diventa un'azione tramite i keybinds (js/Keybinds.js): nessun
    // tasto è scritto qui dentro.
    const comando = azioneDaTasto(key);
    if (!comando) {
        return;
    }

    // VS ONLINE, lato ospite: comanda solo il giocatore 2 (il suo)
    if (onlineStato.attivo && onlineStato.ospite && comando.giocatore !== 'p2') {
        return;
    }

    // In VS CPU il giocatore 2 è controllato dall'IA, in VS ONLINE dall'ospite:
    // nessun tasto umano deve toccarlo
    if (comando.giocatore === 'p2' &&
        (modalitaPartita === MODALITA.CPU || modalitaPartita === MODALITA.ONLINE) &&
        !(onlineStato.attivo && onlineStato.ospite)) {
        return;
    }

    premiAzione(comando.giocatore, comando.azione, true);
});

window.addEventListener('keyup', (event) => {
    const key = (event.key && event.key.length === 1) ? event.key.toLowerCase() : event.key;

    // Il rilascio conta solo durante la partita: fuori, i menu non ne hanno bisogno
    if (statoCorrente !== STATI.PARTITA) {
        return;
    }

    const comando = azioneDaTasto(key);
    if (!comando) {
        return;
    }

    // VS ONLINE, lato ospite: il rilascio va comunicato all'host
    if (onlineStato.attivo && onlineStato.ospite && comando.giocatore !== 'p2') {
        return;
    }

    // In VS CPU i tasti del giocatore 2 non devono toccare l'IA
    if (comando.giocatore === 'p2' &&
        (modalitaPartita === MODALITA.CPU || modalitaPartita === MODALITA.ONLINE) &&
        !(onlineStato.attivo && onlineStato.ospite)) {
        return;
    }

    premiAzione(comando.giocatore, comando.azione, false);
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

    // Niente tempo arretrato, niente effetti e niente comandi in coda da prima
    accumulatore = 0;
    ultimoTempo = 0;
    passiUltimoFotogramma = 0;
    frameGioco = 0;
    bufferComandi.voci.length = 0;
    effetti.particelle.length = 0;
    effetti.onde.length = 0;
    effetti.scossa = 0;
    effetti.tinta = null;
    effetti.impatto = null;
    for (const chiave in hudPrecedente) {
        hudPrecedente[chiave] = -1;
    }

    // Ripulisce l'eventuale partita precedente
    clearTimeout(timerId);
    timer = 60;
    document.querySelector('#timer').innerHTML = '60';
    gameOver = false;
    hud.displayText.style.display = 'none';
    hud.displayText.innerHTML = '';
    avvisoTimer = 0;

    // Partita online con account: si apre il conto dei punti sul server
    if (typeof apriPartitaPunti === 'function') {
        apriPartitaPunti();
    }

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

    // In VS ONLINE il tempo lo gestisce solo l'host: l'ospite lo riceve
    // dentro i fotogrammi di stato
    if (!(onlineStato.attivo && onlineStato.ospite)) {
        decreaseTimer();
    }
}

/**
 * Apre il menu di pausa sopra la partita.
 * Funziona anche a partita finita: il risultato resta dietro al menu.
 */
function apriPausa() {
    if (statoCorrente !== STATI.PARTITA) {
        return;
    }

    // Nessun tasto deve restare "premuto" dietro il menu
    rilasciaTuttiITasti();

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

// ========================================
// Rivincita e cambio personaggi
// ========================================

/**
 * Rivincita con gli stessi personaggi.
 * In VS ONLINE deve ripartire per entrambi: l'host rimanda 'avvia', l'ospite
 * chiede all'host di riavviare.
 */
function rivincita() {
    if (!ultimiPersonaggi.p1 || !ultimiPersonaggi.p2) {
        apriMenu('finePartita', STATI.PAUSA);
        return;
    }

    if (modalitaPartita === MODALITA.ONLINE && onlineStato.attivo) {
        if (onlineStato.ospite) {
            Rete.invia({ t: 'rivincita' });
            mostraBadgeOnline('RICHIESTA DI RIVINCITA INVIATA');
            return;
        }
        inviaAvvioOnline();
        return;
    }

    avviaPartita(ultimiPersonaggi.p1, ultimiPersonaggi.p2);
}

/**
 * Torna alla selezione del personaggio. In VS ONLINE la schermata si apre
 * anche dall'altro lato, così i due scelgono di nuovo insieme.
 */
function cambiaPersonaggi() {
    if (modalitaPartita === MODALITA.ONLINE && onlineStato.attivo) {
        Rete.invia({ t: 'selezione' });
        apriSelezione(MODALITA.ONLINE);
        return;
    }
    apriSelezione(modalitaPartita);
}

/**
 * Abbandona la partita e torna al menu principale senza ricaricare la pagina
 */
function esciAlMenu() {
    rilasciaTuttiITasti();
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

    // Chiude stanza e collegamento se la partita era online
    esciOnline();

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

// Se la finestra cambia dimensione, scala dell'HUD, suolo e sfondo si adattano
window.addEventListener('resize', adattaAllaFinestra);

// Prima scala: l'area di gioco è già dimensionata dal CSS all'avvio
aggiornaScalaSchermo();

avviaGiocoQuandoPronto(() => {
    // Gli asset sono pronti: lo sfondo si può scalare in modo definitivo
    aggiornaScalaSchermo();
    adattaSfondo();
    apriMenu('principale');

    // Se c'è un token salvato si riprende la sessione senza chiedere niente:
    // se è scaduto, il primo errore la dimentica e si resta fuori.
    if (typeof riprendiSessione === 'function') {
        riprendiSessione().then(() => { if (statoAccount.dentro) disegnaMenu(); });
    }

    animate();
});
