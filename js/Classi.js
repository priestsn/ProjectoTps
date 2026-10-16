/**
 * Classe sprite base per il rendering e l'animazione dei personaggi
 */
class Sprite {
    constructor(position, imageSrc, scale = 1, framesMax = 1, offset) {
        this.position = position.position || { x: 0, y: 0 };
        this.height = 150;
        this.width = 50;
        // creaImmagine() (in Utili.js) registra l'asset tra quelli da
        // attendere prima di avviare il gioco, e ne traccia il caricamento
        // sulla proprietà .loaded dell'immagine stessa.
        this.image = creaImmagine(imageSrc);
        this.scale = scale;
        this.framesMax = framesMax;
        this.framesCurrent = 0;
        this.framesElapsed = 0;
        this.framesHold = 30; // Controlla la velocità dell'animazione
        this.offset = offset || { x: 0, y: 0 };
    }

    draw() {
        // Si disegna solo quando l'immagine corrente (non quella iniziale) è pronta.
        // Se cambia sprite, .loaded segue automaticamente la nuova immagine.
        if (this.image.loaded) {
            c.save();
            c.translate(this.position.x, this.position.y);
            c.scale(this.facing, 1); // Ribalta orizzontalmente se facing = -1
            c.drawImage(
                this.image,
                this.framesCurrent * (this.image.width / this.framesMax),
                0,
                this.image.width / this.framesMax,
                this.image.height,
                -this.offset.x,
                -this.offset.y,
                (this.image.width / this.framesMax) * this.scale,
                this.image.height * this.scale
            );
            c.restore();
        }
    }

    animateFrames() {
        this.framesElapsed++;
        if (this.framesElapsed % this.framesHold === 0) {
            if (this.framesCurrent < this.framesMax - 1) {
                this.framesCurrent++;
            } else {
                this.framesCurrent = 0;
            }
        }
    }

    update() {
        this.draw();
        this.animateFrames();
    }
}


/**
 * Classe lottatore che estende Sprite con meccaniche di combattimento
 */
class Lottatore extends Sprite {
    constructor(options = {}) {
        const { position = { x: 0, y: 0 }, velocity = { x: 0, y: 0 }, imageSrc, scale = 1, framesMax = 1, offset = { x: 0, y: 0 }, sprites } = options;
        super({ position }, imageSrc, scale, framesMax, offset);

        this.facing = 1; // 1 per destra, -1 per sinistra
        this.width = 50;
        this.height = 150;
        this.lastKey = null; // Traccia l'ultimo input direzionale
        this.AttackBox = {
            position: { x: this.position.x, y: this.position.y },
            width: 200,
            height: 200
        };
        this.velocity = velocity;
        this.isParata = false; // Stato di parata
        this.isAttacking = false; // Stato di attacco
        this.isTakingDmg = false; // Stato di danno
        this.health = 100;
        this.stamina = 100;
        this.isDead = false;
        this.framesCurrent = 0;
        this.framesElapsed = 0;
        this.framesHold = 10;
        this.sprites = sprites;

        // Carica tutti gli sprite delle animazioni (ognuno tracciato per il caricamento)
        for (const sprite in this.sprites) {
            this.sprites[sprite].image = creaImmagine(this.sprites[sprite].imageSrc);
        }
    }

    draw() {
        super.draw();
        c.fillStyle = 'transparent';

        if (this.isAttacking) {
            const currentLastKey = (this.lastKey !== null && this.lastKey !== undefined)
                ? this.lastKey
                : (this === Player ? lastKey : null);
            const facingLeft = currentLastKey === 'ArrowLeft' || currentLastKey === 'a';

            if (facingLeft) {
                this.AttackBox.position.x = this.position.x - this.AttackBox.width;
            } else {
                this.AttackBox.position.x = this.position.x;
            }
            this.AttackBox.position.y = this.position.y;
            c.fillRect(this.AttackBox.position.x, this.AttackBox.position.y - 100, this.AttackBox.width, this.AttackBox.height);
        }
    }

    update() {
        this.draw();

        // La morte si completa da sola: raggiunto l'ultimo frame dell'animazione
        // il lottatore passa a isDead e l'animazione si ferma sull'ultimo disegno.
        if (this.image === this.sprites.Death.image && this.framesCurrent === this.sprites.Death.framesMax - 1) {
            this.isDead = true;
        }

        if (!this.isDead) {
            this.animateFrames();
        }

        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;

        // Clamp posizione orizzontale: resta dentro il canvas
        this.position.x = Math.max(0, Math.min(canvas.width - this.width, this.position.x));

        // Clamp posizione verticale: i piedi non scendono sotto il suolo.
        // Ground - altezza è l'esatta posizione di riposo, quindi atterrare è deterministico.
        this.position.y = Math.max(0, Math.min(ground - this.height, this.position.y));

        // Applica gravità: si azzera quando i piedi raggiungono il suolo
        if (this.position.y + this.height + this.velocity.y >= ground) {
            this.velocity.y = 0;
        } else {
            this.velocity.y += gravity;
        }
    }

    cambiaSprite(sprite) {
        // La morte ha priorità su tutto: una volta avviata, lo sprite non cambia più.
        // L'animazione arriva fino in fondo e isDead viene impostato in update().
        if (this.image === this.sprites.Death.image) {
            return;
        }

        // Attacco e colpo subito non si interrompono mai... tranne che per la morte.
        // Senza questa eccezione l'animazione di morte non partirebbe quando il colpo
        // mortale lascia il lottatore a metà di "Attack1" o di "TakeHit".
        if (sprite !== 'Death') {
            if (this.image === this.sprites.Attack1.image && !this.isTakingDmg && this.framesCurrent < this.sprites.Attack1.framesMax - 1) {
                return;
            }
            if (this.image === this.sprites.TakeHit.image && this.framesCurrent < this.sprites.TakeHit.framesMax - 1) {
                return;
            }
        }

        const spriteMap = {
            'idle': this.sprites.idle,
            'Run': this.sprites.Run,
            'Jump': this.sprites.Jump,
            'Fall': this.sprites.Fall,
            'Attack1': this.sprites.Attack1,
            'TakeHit': this.sprites.TakeHit,
            'Death': this.sprites.Death,
            'ParataIdle': this.sprites.ParataIdle
        };

        const spriteData = spriteMap[sprite];
        if (spriteData && this.image !== spriteData.image) {
            this.image = spriteData.image;
            this.framesMax = spriteData.framesMax;
            this.framesCurrent = 0;
        }
    }
}