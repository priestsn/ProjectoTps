// ========================================
// Configurazione Canvas
// ==========================================
const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');

canvas.width = 1600;
canvas.height = 900;

c.fillStyle = 'black';
c.fillRect(0, 0, canvas.width, canvas.height);

// ========================================
// Costanti di Gioco
// ==========================================
const gravity = 0.25;

// ========================================
// Inizializzazione Sfondo e Personaggi
// ==========================================
const background = new Sprite({ x: 0, y: 0 }, './img/Background.png', 1, 5, { x: 0, y: 0 }, );

const Player = new Lottatore({
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 5 },
    imageSrc: './img/Player/idle.png',
    scale: 5,
    framesMax: 8,
    offset: { x: 350, y: 320 },
    sprites: {
        idle: { imageSrc: './img/Player/idle.png', framesMax: 8 },
        Run: { imageSrc: './img/Player/Run.png', framesMax: 8 },
        Jump: { imageSrc: './img/Player/Jump.png', framesMax: 2 },
        Fall: { imageSrc: './img/Player/Fall.png', framesMax: 2 },
        Attack1: { imageSrc: './img/Player/Attack1.png', framesMax: 5 },
        TakeHit: { imageSrc: './img/Player/Take hit.png', framesMax: 3 },
        Death: { imageSrc: './img/Player/Death.png', framesMax: 8 },
        ParataIdle: { imageSrc: './img/Player/IdleBlock.png', framesMax: 8 }
    }
});

const Enemy = new Lottatore({
    position: { x: 1500, y: 0 },
    velocity: { x: 0, y: 5 },
    imageSrc: './img/Enemy/Idle.png',
    scale: 4.2,
    framesMax: 4,
    offset: { x: 370, y: 370 },
    sprites: {
        idle: { imageSrc: './img/Enemy/Idle.png', framesMax: 4 },
        Run: { imageSrc: './img/Enemy/Run.png', framesMax: 8 },
        Jump: { imageSrc: './img/Enemy/Jump.png', framesMax: 2 },
        Fall: { imageSrc: './img/Enemy/Fall.png', framesMax: 2 },
        Attack1: { imageSrc: './img/Enemy/Attack1.png', framesMax: 4 },
        TakeHit: { imageSrc: './img/Enemy/Take hit.png', framesMax: 3 },
        Death: { imageSrc: './img/Enemy/Death.png', framesMax: 7 },
        ParataIdle: { imageSrc: './img/Enemy/IdleBlock.png', framesMax: 4 }
    }
});

Enemy.lastKey = 'ArrowRight';

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

decreaseTimer();

// ========================================
// Loop Principale del Gioco
// ==========================================
function animate() {
    window.requestAnimationFrame(animate);

    // Pulisci canvas
    c.fillStyle = 'black';
    c.fillRect(0, 0, canvas.width, canvas.height);

    // Resetta velocità
    Player.velocity.x = 0;
    Enemy.velocity.x = 0;

    // Movimento del giocatore
    if (keys.a.pressed && lastKey === 'a') {
        Player.velocity.x = -5;
        Player.facing = -1;
        Player.cambiaSprite('Run');
    } else if (keys.d.pressed && lastKey === 'd') {
        Player.velocity.x = 5;
        Player.facing = 1;
        Player.cambiaSprite('Run');
    } else if (!Player.isParata) {
        Player.cambiaSprite('idle');
    } else {
        Player.stamina -= 0.2;
    }

    // Movimento verticale del giocatore
    if (Player.velocity.y < 0) {
        Player.cambiaSprite('Jump');
    } else if (Player.velocity.y > 0) {
        Player.cambiaSprite('Fall');
    }

    // Movimento del nemico
    if (keys.ArrowLeft.pressed && Enemy.lastKey === 'ArrowLeft') {
        Enemy.velocity.x = -5;
        Enemy.facing = 1;
        Enemy.cambiaSprite('Run');
    } else if (keys.ArrowRight.pressed && Enemy.lastKey === 'ArrowRight') {
        Enemy.velocity.x = 5;
        Enemy.facing = -1;
        Enemy.cambiaSprite('Run');
    } else if (!Enemy.isParata) {
        Enemy.cambiaSprite('idle');
    } else {
        Enemy.stamina -= 0.2;
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
    document.querySelector('#enemy-stamina').style.width = Enemy.stamina + '%';
    document.querySelector('#player-stamina').style.width = Player.stamina + '%';

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
            Enemy.health -= 10;
            document.querySelector('#enemy-health').style.width = Enemy.health + '%';
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
            Player.health -= 10;
            document.querySelector('#player-health').style.width = Player.health + '%';
            setTimeout(() => { Player.isTakingDmg = false; }, 400);
        }
    }

    // Condizione di fine gioco
    if (Player.health <= 0 || Enemy.health <= 0) {
        if (Player.health <= 0) {
            Player.cambiaSprite('Death');
        }
        if (Enemy.health <= 0) {
            Enemy.cambiaSprite('Death');
        }
        document.querySelector('#displayText').style.display = 'flex';
        determineWinner({ Player, Enemy, timerId });
    }
}

animate();

// ========================================
// Event Listener
// ==========================================
window.addEventListener('keydown', async (event) => {
    const key = (event.key && event.key.length === 1) ? event.key.toLowerCase() : event.key;

    switch (key) {
        case 'w':
            if (Player.position.y === 710 && !Player.isDead) {
                Player.velocity.y = -10;
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
            if (Enemy.position.y === 710 && !Enemy.isDead) {
                Enemy.velocity.y = -10;
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
