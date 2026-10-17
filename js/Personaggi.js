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
// `frame` è il lato di un singolo fotogramma (i fogli hanno frame quadrati) e
// `ritaglio` è il riquadro esatto del personaggio dentro il frame: serve a
// ritagliare i ritratti nella schermata di selezione.
//
// `parry.png` è l'animazione di parata (blocco) di ogni personaggio.
//
// Bilanciamento attacchi: `danno` e `costoStamina` crescono con la pesantezza
// del colpo (frame d'impatto piu' lontano e hitbox piu' larga o alta).
// Attacchi veloci e corti: meno danno, meno stamina. Colpi lenti e grandi:
// piu' danno e piu' costo. La tabella completa e' in `sviluppo.md`.
//
// NOTA: salto e caduta di Bakari Traore sono provvisori (assenti nel pacchetto originale).

// Durata dell'animazione di attacco, in frame di gioco (a 60 fps: 30 = mezzo secondo).
// Serve perché i personaggi hanno da 4 a 13 frame di attacco: senza questo,
// l'attacco più corto durerebbe 0,7 s e il più lungo 2,2 s.
const ATTACCO_FRAME = 30;

// `attacco` descrive l'area del colpo al frame d'impatto, misurata sui pixel
// reali di attack.png per ogni personaggio:
//   - dx / larghezza: estensione orizzontale dal centro del corpo;
//   - dy / altezza: estensione verticale rispetto alla sommità del corpo.
// Prima dy e altezza erano uguali per tutti (42 / 126): ora seguono l'arma
// o l'effetto effettivamente disegnato nel frame d'impatto.

const PERSONAGGI = [
    {
        id: 'OusmaneDiouf',
        nome: 'Ousmane Diouf',
        archetipo: 'Cavaliere',
        ultimate: {
            nome: 'Radici del Baobab', tipo: 'mischia', danno: 20,
            effetto: 'rallentamento', durata: 240, colore: '#8ab4ff',
            descrizione: 'Rallenta movimento e attacchi del nemico per 4 s'
        },
        statistiche: { vita: 100, stamina: 100, danno: 8, costoStamina: 14, velocita: 5, salto: -10 },
        sprite: {
            cartella: './assets/Personaggi/OusmaneDiouf/',
            scale: 4.12,
            offset: { x: 398, y: 260 },
            corpo: { larghezza: 194, altezza: 210 },
            attacco: { frame: 3, dx: 97, dy: -29, larghezza: 58, altezza: 202 },
            frame: 180,
            ritaglio: { x: 73, y: 63, larghezza: 47, altezza: 51 },
            frames: { idle: 11, run: 8, jump: 3, fall: 3, attack: 7, takehit: 4, death: 11, parry: 11 }
        }
    },
    {
        id: 'KwameMensah',
        nome: 'Kwame Mensah',
        archetipo: 'Cavaliere agile',
        ultimate: {
            nome: 'Vortice di Vento', tipo: 'mischia', danno: 18,
            effetto: 'inversione', durata: 180, colore: '#d29bff',
            descrizione: 'Inverte i comandi del nemico per 3 s'
        },
        statistiche: { vita: 95, stamina: 100, danno: 11, costoStamina: 19, velocita: 5.5, salto: -11 },
        sprite: {
            cartella: './assets/Personaggi/KwameMensah/',
            scale: 5.38,
            offset: { x: 377, y: 237 },
            corpo: { larghezza: 172, altezza: 210 },
            attacco: { frame: 4, dx: 86, dy: -54, larghezza: 183, altezza: 242 },
            frame: 140,
            ritaglio: { x: 54, y: 44, larghezza: 32, altezza: 39 },
            frames: { idle: 11, run: 8, jump: 4, fall: 4, attack: 6, takehit: 4, death: 9, parry: 11 }
        }
    },
    {
        id: 'ChidiOkonkwo',
        nome: 'Chidi Okonkwo',
        ultimate: {
            nome: 'Ruggito del Leone', tipo: 'mischia', danno: 24,
            effetto: 'congelamento', durata: 90, colore: '#8be9fd',
            descrizione: 'Congela il nemico per 1,5 s'
        },
        archetipo: 'Lottatore',
        statistiche: { vita: 110, stamina: 100, danno: 14, costoStamina: 24, velocita: 4.6, salto: -9 },
        sprite: {
            cartella: './assets/Personaggi/ChidiOkonkwo/',
            scale: 4.04,
            offset: { x: 382, y: 283 },
            corpo: { larghezza: 149, altezza: 210 },
            attacco: { frame: 4, dx: 75, dy: -61, larghezza: 311, altezza: 242 },
            frame: 200,
            ritaglio: { x: 76, y: 70, larghezza: 37, altezza: 52 },
            frames: { idle: 8, run: 8, jump: 2, fall: 2, attack: 6, takehit: 4, death: 6, parry: 8 }
        }
    },
    {
        id: 'AmaraDiallo',
        nome: 'Amara Diallo',
        archetipo: 'Lottatore veloce',
        ultimate: {
            nome: 'Danza Fulminea', tipo: 'buff', danno: 0,
            effetto: 'velocita', durata: 300, colore: '#7dff7d',
            descrizione: 'Velocità e attacchi aumentati per 5 s'
        },
        statistiche: { vita: 90, stamina: 100, danno: 9, costoStamina: 17, velocita: 6, salto: -11.5 },
        sprite: {
            cartella: './assets/Personaggi/AmaraDiallo/',
            scale: 3.75,
            offset: { x: 366, y: 270 },
            corpo: { larghezza: 124, altezza: 210 },
            attacco: { frame: 2, dx: 62, dy: -15, larghezza: 263, altezza: 218 },
            frame: 200,
            ritaglio: { x: 81, y: 72, larghezza: 33, altezza: 56 },
            frames: { idle: 4, run: 8, jump: 2, fall: 2, attack: 4, takehit: 3, death: 7, parry: 4 }
        }
    },
    {
        id: 'TarisaiMoyo',
        nome: 'Tarisai Moyo',
        archetipo: 'Tecnico',
        ultimate: {
            nome: 'Cerchio Ancestrale', tipo: 'mischia', danno: 20,
            effetto: 'veleno', durata: 240, dannoContinuo: 12, colore: '#7dff7d',
            descrizione: 'Avvelena il nemico: 12 danni in 4 s'
        },
        statistiche: { vita: 95, stamina: 105, danno: 11, costoStamina: 21, velocita: 5.2, salto: -10.5 },
        sprite: {
            cartella: './assets/Personaggi/TarisaiMoyo/',
            scale: 5.38,
            offset: { x: 366, y: 231 },
            corpo: { larghezza: 237, altezza: 210 },
            attacco: { frame: 4, dx: 119, dy: -177, larghezza: 194, altezza: 371 },
            frame: 126,
            ritaglio: { x: 46, y: 43, larghezza: 44, altezza: 39 },
            frames: { idle: 10, run: 8, jump: 3, fall: 3, attack: 7, takehit: 3, death: 11, parry: 10 }
        }
    },
    {
        id: 'ZuriNkosi',
        nome: 'Zuri Nkosi',
        ultimate: {
            nome: 'Freccia della Savana', tipo: 'mischia', danno: 18,
            effetto: 'marchio', durata: 300, colore: '#ff6b6b',
            descrizione: 'Marchia il nemico: +30% danni subiti per 5 s'
        },
        archetipo: 'Cacciatrice',
        statistiche: { vita: 88, stamina: 100, danno: 10, costoStamina: 18, velocita: 5.8, salto: -11.5 },
        sprite: {
            cartella: './assets/Personaggi/ZuriNkosi/',
            scale: 5,
            offset: { x: 385, y: 275 },
            corpo: { larghezza: 160, altezza: 210 },
            attacco: { frame: 3, dx: 80, dy: -100, larghezza: 170, altezza: 285 },
            frame: 150,
            ritaglio: { x: 61, y: 55, larghezza: 32, altezza: 42 },
            frames: { idle: 8, run: 8, jump: 2, fall: 2, attack: 5, takehit: 3, death: 8, parry: 8 }
        }
    },
    {
        id: 'BakariTraore',
        nome: 'Bakari Traore',
        archetipo: 'Mago',
        ultimate: {
            nome: 'Pioggia di Stelle', tipo: 'proiettile', danno: 24,
            effetto: 'bruciatura', durata: 240, dannoContinuo: 14,
            colore: '#ff8a3d', descrizione: 'Palla di fuoco: 24 danni + bruciatura'
        },
        statistiche: { vita: 85, stamina: 110, danno: 13, costoStamina: 20, velocita: 4.4, salto: -9 },
        sprite: {
            cartella: './assets/Personaggi/BakariTraore/',
            scale: 3.82,
            offset: { x: 279, y: 172 },
            corpo: { larghezza: 122, altezza: 210 },
            attacco: { frame: 4, dx: 61, dy: 34, larghezza: 199, altezza: 141 },
            frame: 150,
            ritaglio: { x: 57, y: 45, larghezza: 32, altezza: 55 },
            frames: { idle: 8, run: 8, jump: 8, fall: 8, attack: 8, takehit: 4, death: 5, parry: 8 }
        }
    },
    {
        id: 'SekouCamara',
        nome: 'Sekou Camara',
        archetipo: 'Mago anziano',
        ultimate: {
            nome: 'Giudizio degli Antenati', tipo: 'proiettile', danno: 22,
            effetto: 'silenzio', durata: 240, colore: '#b06aff',
            descrizione: 'Onda spiritica: blocca ultimate e drena stamina'
        },
        statistiche: { vita: 95, stamina: 105, danno: 12, costoStamina: 19, velocita: 4.6, salto: -9.5 },
        sprite: {
            cartella: './assets/Personaggi/SekouCamara/',
            scale: 2.21,
            offset: { x: 302, y: 159 },
            corpo: { larghezza: 126, altezza: 210 },
            attacco: { frame: 4, dx: 63, dy: -44, larghezza: 159, altezza: 219 },
            frame: 250,
            ritaglio: { x: 108, y: 72, larghezza: 57, altezza: 95 },
            frames: { idle: 8, run: 8, jump: 2, fall: 2, attack: 8, takehit: 3, death: 7, parry: 8 }
        }
    },
    {
        id: 'AyoAdebayo',
        nome: 'Ayo Adebayo',
        ultimate: {
            nome: 'Eclissi Arcana', tipo: 'proiettile', danno: 26,
            effetto: 'eclissi', durata: 180, colore: '#d29bff',
            descrizione: 'Dardo arcano: inverte i comandi e rallenta per 3 s'
        },
        archetipo: 'Arcimago',
        statistiche: { vita: 88, stamina: 100, danno: 14, costoStamina: 22, velocita: 5, salto: -10 },
        sprite: {
            cartella: './assets/Personaggi/AyoAdebayo/',
            scale: 3.96,
            offset: { x: 291, y: 174 },
            corpo: { larghezza: 131, altezza: 210 },
            attacco: { frame: 11, dx: 66, dy: 32, larghezza: 190, altezza: 32 },
            frame: 140,
            ritaglio: { x: 57, y: 44, larghezza: 33, altezza: 53 },
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

    // Quanti frame di gioco dedicare a ogni fotogramma dell'attacco,
    // per farlo durare all'incirca ATTACCO_FRAME frame
    const framesHoldAttacco = Math.max(2, Math.round(ATTACCO_FRAME / frames.attack));

    return {
        idle: crea('idle', frames.idle),
        Run: crea('run', frames.run),
        Jump: crea('jump', frames.jump),
        Fall: crea('fall', frames.fall),
        Attack1: Object.assign(crea('attack', frames.attack), { framesHold: framesHoldAttacco }),
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
        statistiche: personaggio.statistiche,
        corpo: sprite.corpo,
        attacco: sprite.attacco,
        ultimate: personaggio.ultimate
    });

    lottatore.facing = facing;

    // Il lottatore tiene il riferimento al personaggio: serve per il pannello di
    // debug e, più avanti, per hitbox e frame d'attacco specifici per personaggio.
    lottatore.personaggio = personaggio;

    return lottatore;
}

/**
 * Registra le immagini di tutti i personaggi tra gli asset da attendere.
 * Cosi' la schermata di caricamento le scarica tutte e in partita non ci sono
 * ritardi quando si sceglie un personaggio.
 */
function precaricaPersonaggi() {
    for (const personaggio of PERSONAGGI) {
        const sprites = spriteDelPersonaggio(personaggio);
        for (const chiave in sprites) {
            creaImmagine(sprites[chiave].imageSrc);
        }
    }
}
