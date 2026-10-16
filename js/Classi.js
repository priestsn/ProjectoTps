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

        // Asse di ribaltamento orizzontale, rispetto a position.x.
        // I lottatori lo impostano al centro del corpo (vedi Lottatore);
        // per gli sprite senza corpo, come lo sfondo, resta 0.
        this.centroCorpo = 0;
    }

    draw() {
        // Si disegna solo quando l'immagine corrente (non quella iniziale) è pronta.
        // Se cambia sprite, .loaded segue automaticamente la nuova immagine.
        if (this.image.loaded) {
            c.save();
            // Il ribaltamento avviene attorno al centro del corpo e non
            // all'angolo: così chi guarda a sinistra resta allineato alla sua
            // hitbox invece di risultare spostato di mezza larghezza.
            c.translate(this.position.x + this.centroCorpo, this.position.y);
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
        const { position = { x: 0, y: 0 }, velocity = { x: 0, y: 0 }, imageSrc, scale = 1, framesMax = 1, offset = { x: 0, y: 0 }, sprites, statistiche, corpo, attacco } = options;
        super({ position }, imageSrc, scale, framesMax, offset);

        // Statistiche del personaggio. Se non vengono passate si usano i valori
        // base, cosi' la classe resta utilizzabile anche senza un personaggio.
        this.statistiche = Object.assign(
            { vita: 100, stamina: 100, danno: 10, velocita: 5, salto: -10 },
            statistiche
        );

        this.facing = 1; // 1 per destra, -1 per sinistra

        // Riquadro di collisione del corpo: dipende dal personaggio, perché
        // ogni sprite ha proporzioni proprie
        this.width = corpo ? corpo.larghezza : 50;
        this.height = corpo ? corpo.altezza : 150;

        // Asse di ribaltamento dello sprite: il centro del corpo
        this.centroCorpo = this.width / 2;

        // Dati dell'attacco: frame d'impatto e area del colpo
        this.attacco = attacco || { frame: 3, dx: 100, dy: 0, larghezza: 200, altezza: 200 };

        this.lastKey = null; // Traccia l'ultimo input direzionale
        this.AttackBox = {
            position: { x: this.position.x, y: this.position.y },
            width: this.attacco.larghezza,
            height: this.attacco.altezza
        };
        this.velocity = velocity;
        this.isParata = false; // Stato di parata
        this.isAttacking = false; // Stato di attacco
        this.isTakingDmg = false; // Stato di danno
        this.health = this.statistiche.vita;
        this.stamina = this.statistiche.stamina;
        this.isDead = false;
        this.framesCurrent = 0;
        this.framesElapsed = 0;
        this.framesHold = 10;
        // Velocità standard delle animazioni, usata quando uno stato non ne
        // dichiara una propria
        this.framesHoldBase = 10;
        this.sprites = sprites;

        // Carica tutti gli sprite delle animazioni (ognuno tracciato per il caricamento)
        for (const sprite in this.sprites) {
            this.sprites[sprite].image = creaImmagine(this.sprites[sprite].imageSrc);
        }
    }

    draw() {
        super.draw();

        // La posizione dell'AttackBox va aggiornata sempre: la usano le collisioni.
        // Solo il DISEGNO dei riquadri dipende dal tasto U.
        if (this.isAttacking) {
            this.aggiornaAttackBox();
        }

        if (hitboxVisibili) {
            this.disegnaHitbox();
        }
    }

    /**
     * Calcola dove si trova l'area di attacco, in base alla direzione del lottatore
     */
    aggiornaAttackBox() {
        const attacco = this.attacco;

        // L'area parte dal bordo anteriore del corpo e si specchia insieme al
        // personaggio: guardando a sinistra finisce a sinistra.
        this.AttackBox.position.x = (this.facing >= 0)
            ? this.position.x + this.centroCorpo + attacco.dx
            : this.position.x + this.centroCorpo - attacco.dx - attacco.larghezza;

        this.AttackBox.position.y = this.position.y + attacco.dy;
    }

    /**
     * Disegna i riquadri di collisione (debug, tasto U).
     * I rettangoli sono esattamente quelli usati dai controlli di collisione:
     * - blu: il corpo del lottatore
     * - rosso: l'area di attacco, solo mentre sta attaccando
     */
    disegnaHitbox() {
        c.lineWidth = 2;

        // Corpo del lottatore
        c.fillStyle = 'rgba(0, 200, 255, 0.22)';
        c.fillRect(this.position.x, this.position.y, this.width, this.height);
        c.strokeStyle = 'rgba(0, 200, 255, 0.9)';
        c.strokeRect(this.position.x, this.position.y, this.width, this.height);

        // Area di attacco
        if (this.isAttacking) {
            c.fillStyle = 'rgba(255, 40, 40, 0.25)';
            c.fillRect(this.AttackBox.position.x, this.AttackBox.position.y, this.AttackBox.width, this.AttackBox.height);
            c.strokeStyle = 'rgba(255, 40, 40, 0.95)';
            c.strokeRect(this.AttackBox.position.x, this.AttackBox.position.y, this.AttackBox.width, this.AttackBox.height);
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
            // Alcune animazioni dichiarano una velocità propria: il numero di
            // frame cambia molto da personaggio a personaggio
            this.framesHold = spriteData.framesHold || this.framesHoldBase;
            this.framesCurrent = 0;
        }
    }
}