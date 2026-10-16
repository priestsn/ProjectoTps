// ========================================
// Personaggi
// ==========================================
// Tutti i personaggi giocabili: statistiche e sprite.
//
// Gli sprite stanno in assets/Personaggi/<Cartella>/ con un file per stato:
//   idle, run, jump, fall, attack, takehit, death, parry
//
// `scale`, `offset` e il numero di frame sono stati ricavati leggendo i pixel
// reali delle immagini: il riquadro del personaggio viene allineato al suolo e
// al centro della hitbox, così i piedi poggiano sempre a terra anche con frame
// di dimensioni diverse.
//
// NOTA: `parry.png` al momento è una copia di `idle.png` (segnaposto).
// Va sostituito con l'animazione di parata definitiva di ogni personaggio.
//
// NOTA: i valori dentro `statistiche` sono un primo bilanciamento da confermare.

const PERSONAGGI = [
    {
        id: 'OusmaneDiouf',
        nome: 'Ousmane Diouf',
        archetipo: 'Cavaliere',
        statistiche: { vita: 100, stamina: 100, danno: 10, velocita: 5, salto: -10 },
        sprite: {
            cartella: './assets/Personaggi/OusmaneDiouf/',
            scale: 4.12,
            offset: { x: 373, y: 320 },
            frames: { idle: 11, run: 8, jump: 3, fall: 3, attack: 7, takehit: 4, death: 11, parry: 11 }
        }
    },
    {
        id: 'KwameMensah',
        nome: 'Kwame Mensah',
        archetipo: 'Cavaliere agile',
        statistiche: { vita: 95, stamina: 100, danno: 9, velocita: 5.5, salto: -11 },
        sprite: {
            cartella: './assets/Personaggi/KwameMensah/',
            scale: 5.38,
            offset: { x: 352, y: 297 },
            frames: { idle: 11, run: 8, jump: 4, fall: 4, attack: 6, takehit: 4, death: 9, parry: 11 }
        }
    },
    {
        id: 'ChidiOkonkwo',
        nome: 'Chidi Okonkwo',
        archetipo: 'Lottatore',
        statistiche: { vita: 110, stamina: 100, danno: 12, velocita: 4.6, salto: -9 },
        sprite: {
            cartella: './assets/Personaggi/ChidiOkonkwo/',
            scale: 4.04,
            offset: { x: 357, y: 343 },
            frames: { idle: 8, run: 8, jump: 2, fall: 2, attack: 6, takehit: 4, death: 6, parry: 8 }
        }
    },
    {
        id: 'AmaraDiallo',
        nome: 'Amara Diallo',
        archetipo: 'Lottatore veloce',
        statistiche: { vita: 90, stamina: 100, danno: 8, velocita: 6, salto: -11.5 },
        sprite: {
            cartella: './assets/Personaggi/AmaraDiallo/',
            scale: 3.75,
            offset: { x: 341, y: 330 },
            frames: { idle: 4, run: 8, jump: 2, fall: 2, attack: 4, takehit: 3, death: 7, parry: 4 }
        }
    },
    {
        id: 'TarisaiMoyo',
        nome: 'Tarisai Moyo',
        archetipo: 'Tecnico',
        statistiche: { vita: 95, stamina: 105, danno: 10, velocita: 5.2, salto: -10.5 },
        sprite: {
            cartella: './assets/Personaggi/TarisaiMoyo/',
            scale: 5.38,
            offset: { x: 341, y: 291 },
            frames: { idle: 10, run: 8, jump: 3, fall: 3, attack: 7, takehit: 3, death: 11, parry: 10 }
        }
    },
    {
        id: 'ZuriNkosi',
        nome: 'Zuri Nkosi',
        archetipo: 'Cacciatrice',
        statistiche: { vita: 88, stamina: 100, danno: 9, velocita: 5.8, salto: -11.5 },
        sprite: {
            cartella: './assets/Personaggi/ZuriNkosi/',
            scale: 5,
            offset: { x: 360, y: 335 },
            frames: { idle: 8, run: 8, jump: 2, fall: 2, attack: 5, takehit: 3, death: 8, parry: 8 }
        }
    },
    {
        id: 'BakariTraore',
        nome: 'Bakari Traore',
        archetipo: 'Mago',
        statistiche: { vita: 85, stamina: 110, danno: 13, velocita: 4.4, salto: -9 },
        sprite: {
            cartella: './assets/Personaggi/BakariTraore/',
            scale: 3.82,
            offset: { x: 254, y: 232 },
            frames: { idle: 8, run: 8, jump: 8, fall: 8, attack: 8, takehit: 4, death: 5, parry: 8 }
        }
    },
    {
        id: 'SekouCamara',
        nome: 'Sekou Camara',
        archetipo: 'Mago anziano',
        statistiche: { vita: 95, stamina: 105, danno: 12, velocita: 4.6, salto: -9.5 },
        sprite: {
            cartella: './assets/Personaggi/SekouCamara/',
            scale: 2.21,
            offset: { x: 277, y: 219 },
            frames: { idle: 8, run: 8, jump: 2, fall: 2, attack: 8, takehit: 3, death: 7, parry: 8 }
        }
    },
    {
        id: 'AyoAdebayo',
        nome: 'Ayo Adebayo',
        archetipo: 'Arcimago',
        statistiche: { vita: 88, stamina: 100, danno: 14, velocita: 5, salto: -10 },
        sprite: {
            cartella: './assets/Personaggi/AyoAdebayo/',
            scale: 3.96,
            offset: { x: 266, y: 234 },
            frames: { idle: 10, run: 8, jump: 3, fall: 3, attack: 13, takehit: 3, death: 18, parry: 10 }
        }
    }
];

/**
 * Cerca un personaggio per id
 */
function trovaPersonaggio(id) {
    return PERSONAGGI.find(personaggio => personaggio.id === id);
}

/**
 * Costruisce l'oggetto `sprites` atteso dalla classe Lottatore.
 * I nomi degli stati sono quelli usati dal gioco: idle, Run, Jump, Fall,
 * Attack1, TakeHit, Death, ParataIdle.
 */
function spriteDelPersonaggio(personaggio) {
    const cartella = personaggio.sprite.cartella;
    const frames = personaggio.sprite.frames;
    const crea = (file, framesMax) => ({ imageSrc: cartella + file + '.png', framesMax });

    return {
        idle: crea('idle', frames.idle),
        Run: crea('run', frames.run),
        Jump: crea('jump', frames.jump),
        Fall: crea('fall', frames.fall),
        Attack1: crea('attack', frames.attack),
        TakeHit: crea('takehit', frames.takehit),
        Death: crea('death', frames.death),
        ParataIdle: crea('parry', frames.parry)
    };
}

/**
 * Crea un lottatore pronto per la partita.
 * `facing` vale 1 se il personaggio guarda a destra, -1 se guarda a sinistra
 * (il giocatore 2 parte rivolto verso sinistra).
 */
function creaLottatore(personaggio, x, facing) {
    const sprite = personaggio.sprite;

    const lottatore = new Lottatore({
        position: { x: x, y: 0 },
        velocity: { x: 0, y: 5 },
        imageSrc: sprite.cartella + 'idle.png',
        scale: sprite.scale,
        framesMax: sprite.frames.idle,
        offset: { x: sprite.offset.x, y: sprite.offset.y },
        sprites: spriteDelPersonaggio(personaggio),
        statistiche: personaggio.statistiche
    });

    lottatore.facing = facing;
    return lottatore;
}
