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

// y della superficie del suolo: i piedi dei lottatori poggiano qui.
// 40 = margine di terreno lasciato sotto i piedi.
// I piedi corrispondono a (position.y + height), cioè la base della hitbox.
// Cambia con le dimensioni della finestra, quindi non è un valore fisso.
let ground = canvas.height - 40;

// ========================================
// Inizializzazione Sfondo e Personaggi
// ==========================================
// framesMax: 1 -> sfondo statico. Il scale lo calcola adattaSfondo(),
// per coprire tutta l'altezza della finestra.
const background = new Sprite({ x: 0, y: 0 }, './assets/Background.png', 1, 1, { x: 0, y: 0 });

/**
 * Scala lo sfondo per coprire tutta l'altezza del canvas.
 * L'immagine è molto larga e bassa: riempita in altezza prosegue oltre il bordo
 * destro, quindi il canvas ne mostra la parte sinistra.
 */
function adattaSfondo() {
    if (background.image.loaded && background.image.height > 0) {
        background.scale = canvas.height / background.image.height;
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

// Flag di fine partita: impedisce che il risultato venga ricalcolato a ogni frame
let gameOver = false;

// Debug: con il tasto U si mostrano tutte le hitbox (corpo e area di attacco)
let hitboxVisibili = false;

// ========================================
// Loop Principale del Gioco
// ==========================================
function animate() {
    window.requestAnimationFrame(animate);

    // Fuori dalla partita non si aggiorna nulla: resta visibile il menu
    if (statoCorrente !== STATI.PARTITA) {
        return;
    }

    // Pulisci canvas
    c.fillStyle = 'black';
    c.fillRect(0, 0, canvas.width, canvas.height);

    // Resetta velocità
    Player.velocity.x = 0;
    Enemy.velocity.x = 0;

    // Movimento del giocatore (a partita finita nessuno si muove più)
    if (!gameOver) {
        if (keys.a.pressed && lastKey === 'a') {
            Player.velocity.x = -Player.statistiche.velocita;
            Player.facing = -1;
            Player.cambiaSprite('Run');
        } else if (keys.d.pressed && lastKey === 'd') {
            Player.velocity.x = Player.statistiche.velocita;
            Player.facing = 1;
            Player.cambiaSprite('Run');
        } else if (!Player.isParata) {
            Player.cambiaSprite('idle');
        } else {
            Player.stamina -= 0.2;
        }
    }

    // Movimento verticale del giocatore
    if (Player.velocity.y < 0) {
        Player.cambiaSprite('Jump');
    } else if (Player.velocity.y > 0) {
        Player.cambiaSprite('Fall');
    }

    // Movimento del nemico (a partita finita nessuno si muove più).
    // Il giocatore 2 usa la stessa convenzione del giocatore 1:
    // 1 = guarda a destra, -1 = guarda a sinistra.
    if (!gameOver) {
        if (keys.ArrowLeft.pressed && Enemy.lastKey === 'ArrowLeft') {
            Enemy.velocity.x = -Enemy.statistiche.velocita;
            Enemy.facing = -1;
            Enemy.cambiaSprite('Run');
        } else if (keys.ArrowRight.pressed && Enemy.lastKey === 'ArrowRight') {
            Enemy.velocity.x = Enemy.statistiche.velocita;
            Enemy.facing = 1;
            Enemy.cambiaSprite('Run');
        } else if (!Enemy.isParata) {
            Enemy.cambiaSprite('idle');
        } else {
            Enemy.stamina -= 0.2;
        }
    }

    // Movimento verticale del nemico
    if (Enemy.velocity.y < 0) {
        Enemy.cambiaSprite('Jump');
    } else if (Enemy.velocity.y > 0) {
        Enemy.cambiaSprite('Fall');
    }

    // Resetta i flag di attacco ai frame appropriati
    if (Player.image === Player.sprites.Attack1.image && Player.framesCurrent === 4) {
        Player.isAttacking = false;
    }
    if (Enemy.image === Enemy.sprites.Attack1.image && Enemy.framesCurrent === 3) {
        Enemy.isAttacking = false;
    }

    // Aggiorna e disegna
    background.update();
    Player.update();
    Enemy.update();

    // Aggiorna le barre UI
    document.querySelector('#enemy-stamina').style.width = percentualeBarra(Enemy.stamina, Enemy.statistiche.stamina) + '%';
    document.querySelector('#player-stamina').style.width = percentualeBarra(Player.stamina, Player.statistiche.stamina) + '%';

    // Pannello di debug: attivo con il tasto U
    if (hitboxVisibili) {
        disegnaPannelloDebug();
    }

    // Rilevamento collisione attacco del giocatore
    if (Player.isAttacking &&
        Player.AttackBox.position.x < Enemy.position.x + 50 &&
        Player.AttackBox.position.x + 200 > Enemy.position.x &&
        Player.AttackBox.position.y + Player.AttackBox.height >= Enemy.position.y &&
        Player.AttackBox.position.y <= Enemy.position.y + Enemy.height &&
        !Enemy.isParata &&
        Player.framesCurrent === 3) {

        if (Enemy.image !== Enemy.sprites.TakeHit.image) {
            Enemy.isTakingDmg = true;
            Enemy.cambiaSprite('TakeHit');
            Enemy.health -= Player.statistiche.danno;
            document.querySelector('#enemy-health').style.width = percentualeBarra(Enemy.health, Enemy.statistiche.vita) + '%';
            setTimeout(() => { Enemy.isTakingDmg = false; }, 400);
        }
    }

    // Rilevamento collisione attacco del nemico
    if (Enemy.isAttacking &&
        Enemy.AttackBox.position.x < Player.position.x + 50 &&
        Enemy.AttackBox.position.x + 200 > Player.position.x &&
        Enemy.AttackBox.position.y + Enemy.AttackBox.height >= Player.position.y &&
        Enemy.AttackBox.position.y <= Player.position.y + Player.height &&
        !Player.isParata &&
        Enemy.framesCurrent === 2) {

        if (Player.image !== Player.sprites.TakeHit.image) {
            Player.isTakingDmg = true;
            Player.cambiaSprite('TakeHit');
            Player.health -= Enemy.statistiche.danno;
            document.querySelector('#player-health').style.width = percentualeBarra(Player.health, Player.statistiche.vita) + '%';
            setTimeout(() => { Player.isTakingDmg = false; }, 400);
        }
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
        document.querySelector('#displayText').style.display = 'flex';
        determineWinner(Player, Enemy, timerId);
    }
}

// ========================================
// Event Listener
// ==========================================
window.addEventListener('keydown', async (event) => {
    // Debug: il tasto U mostra o nasconde le hitbox (funziona in ogni schermata)
    if (!event.repeat && (event.key === 'u' || event.key === 'U')) {
        hitboxVisibili = !hitboxVisibili;
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
    // (l'animazione di morte resta comunque libera di completarsi)
    if (gameOver) return;

    const key = (event.key && event.key.length === 1) ? event.key.toLowerCase() : event.key;

    switch (key) {
        case 'w':
            // Salta solo se i piedi sono appoggiati al suolo (niente doppio salto)
            if (Player.position.y + Player.height >= ground && !Player.isDead) {
                Player.velocity.y = Player.statistiche.salto;
            }
            break;

        case 'a':
            if (!Player.isDead) {
                keys.a.pressed = true;
                lastKey = 'a';
                Player.lastKey = 'a';
            }
            break;

        case 'd':
            if (!Player.isDead) {
                keys.d.pressed = true;
                lastKey = 'd';
                Player.lastKey = 'd';
            }
            break;

        case 'h':
            if (!Player.isParata && !Player.isAttacking && Player.stamina >= 20 && !Player.isDead) {
                Player.cambiaSprite('Attack1');
                Player.stamina -= 20;
                keys.h.pressed = true;
                Player.isAttacking = true;
                await new Promise(resolve => setTimeout(resolve, 550));
                Player.isAttacking = false;
                keys.h.pressed = false;
            }
            break;

        case 'j':
            if (Player.stamina >= 0.5) {
                Player.cambiaSprite('ParataIdle');
                keys.j.pressed = true;
                Player.isAttacking = false;
                keys.h.pressed = false;
                Player.isParata = true;
            } else {
                Player.isParata = false;
                keys.j.pressed = false;
                Player.color = 'blue';
            }
            break;

        case 'ArrowUp':
            // Salta solo se i piedi sono appoggiati al suolo (niente doppio salto)
            if (Enemy.position.y + Enemy.height >= ground && !Enemy.isDead) {
                Enemy.velocity.y = Enemy.statistiche.salto;
            }
            break;

        case 'ArrowLeft':
            if (!Enemy.isDead) {
                keys.ArrowLeft.pressed = true;
                Enemy.lastKey = 'ArrowLeft';
            }
            break;

        case 'ArrowRight':
            if (!Enemy.isDead) {
                keys.ArrowRight.pressed = true;
                Enemy.lastKey = 'ArrowRight';
            }
            break;

        case 'ù':
            if (!Enemy.isParata && !Enemy.isAttacking && Enemy.stamina >= 20 && !Enemy.isDead) {
                Enemy.cambiaSprite('Attack1');
                Enemy.stamina -= 20;
                keys.ù.pressed = true;
                Enemy.isAttacking = true;
                await new Promise(resolve => setTimeout(resolve, 400));
                Enemy.isAttacking = false;
                keys.ù.pressed = false;
            }
            break;

        case 'à':
            if (Enemy.stamina >= 0.5) {
                Enemy.cambiaSprite('ParataIdle');
                keys.à.pressed = true;
                Enemy.isAttacking = false;
                keys.ù.pressed = false;
                Enemy.isParata = true;
            } else {
                Enemy.isParata = false;
                keys.à.pressed = false;
                Enemy.color = 'green';
            }
            break;
    }
});

window.addEventListener('keyup', (event) => {
    const key = (event.key && event.key.length === 1) ? event.key.toLowerCase() : event.key;

    switch (key) {
        case 'a':
            keys.a.pressed = false;
            break;

        case 'd':
            keys.d.pressed = false;
            break;

        case 'j':
            keys.j.pressed = false;
            Player.isParata = false;
            Player.color = 'blue';
            break;

        case 'ArrowLeft':
            keys.ArrowLeft.pressed = false;
            break;

        case 'ArrowRight':
            keys.ArrowRight.pressed = false;
            break;

        case 'à':
            keys.à.pressed = false;
            Enemy.isParata = false;
            Enemy.color = 'green';
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
    c.fillRect(x - 12, y - 26, 640, 106);

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
    return etichetta + '  ' + lottatore.personaggio.nome.padEnd(16) +
        ' frame ' + lottatore.framesCurrent + '/' + (lottatore.framesMax - 1) +
        '  attacco ' + (lottatore.isAttacking ? 'si' : 'no') +
        '  parata ' + (lottatore.isParata ? 'si' : 'no');
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

    // Le barre ripartono piene: la vita massima dipende dal personaggio
    document.querySelector('#player-health').style.width = '100%';
    document.querySelector('#enemy-health').style.width = '100%';
    document.querySelector('#player-stamina').style.width = '100%';
    document.querySelector('#enemy-stamina').style.width = '100%';

    cambiaStato(STATI.PARTITA);
    decreaseTimer();
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
