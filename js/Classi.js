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

        // Direzione dello sprite: 1 = guarda a destra, -1 = guarda a sinistra.
        // Sta qui e non solo in Lottatore perché draw() la usa per ogni Sprite,
        // sfondo compreso (BUG-10).
        this.facing = 1;

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

        // Il moltiplicatore permette di rallentare o accelerare le animazioni
        // (stati delle ultimate). Per lo sfondo vale 1.
        const hold = Math.max(1, Math.round(this.framesHold * (this.moltiplicatoreAnimazione || 1)));

        if (this.framesElapsed % hold === 0) {
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
        const { position = { x: 0, y: 0 }, velocity = { x: 0, y: 0 }, imageSrc, scale = 1, framesMax = 1, offset = { x: 0, y: 0 }, sprites, statistiche, corpo, attacco, ultimate } = options;
        super({ position }, imageSrc, scale, framesMax, offset);

        // Statistiche del personaggio. Se non vengono passate si usano i valori
        // base, cosi' la classe resta utilizzabile anche senza un personaggio.
        this.statistiche = Object.assign(
            { vita: 100, stamina: 100, danno: 10, costoStamina: 20, velocita: 5, salto: -10 },
            statistiche
        );

        // Convenzione unica per entrambi i lottatori: 1 = guarda a destra,
        // -1 = guarda a sinistra. La direzione la decide il movimento (o la
        // CPU) e da `facing` dipendono sprite e AttackBox (BUG-14).
        this.facing = 1;

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
        this.spinta = 0;   // spostamento residuo dovuto a un colpo (si spegne da solo)
        this.isParata = false; // Stato di parata
        this.isAttacking = false; // Stato di attacco
        this.isTakingDmg = false; // Stato di danno
        this.framesDanno = 0;     // frame passati dall'inizio del colpo subito (BUG-20)
        this.health = this.statistiche.vita;
        this.stamina = this.statistiche.stamina;
        this.isDead = false;

        // --- Meccaniche avanzate (Fase 3) ---
        this.isStunned = false;          // non può agire
        this.stunTimer = 0;              // frame di stun rimasti
        this.framesParata = 0;           // frame dall'inizio della parata
        this.ultimate = 0;               // carica 0..100
        this.datiUltimate = ultimate || {
            nome: 'Ultimate', tipo: 'mischia', danno: 20,
            effetto: null, durata: 0, colore: '#8be9fd'
        };
        this.attaccoCaricato = false;    // colpo in corso che rompe la parata
        this.attaccoUltimate = false;    // ultimate in corso
        this.ultimateHaColpito = false;  // l'ultimate ha già fatto centro
        this.attaccoHaColpito = false;   // questo attacco ha già fatto centro (una volta sola)
        this.framesAttacco = 0;          // frame dall'inizio dell'attacco
        this.isCaricando = false;        // tasto attacco tenuto premuto
        this.framesCarica = 0;           // frame di carica accumulati

        // --- Stati alterati dalle ultimate ---
        this.rallentamentoTimer = 0;     // movimento e animazioni rallentati
        this.inversioneTimer = 0;        // comandi invertiti
        this.congelamentoTimer = 0;      // non può agire
        this.velenoTimer = 0;            // danno nel tempo
        this.velenoPerFrame = 0;
        this.marchioTimer = 0;           // subisce più danno
        this.bruciaturaTimer = 0;        // danno nel tempo + niente rigenerazione stamina
        this.bruciaturaPerFrame = 0;
        this.bloccoStaminaTimer = 0;
        this.silenzioTimer = 0;          // ultimate bloccata e stamina in calo
        this.eclissiTimer = 0;           // inversione + rallentamento
        this.buffTimer = 0;              // velocità e attacchi aumentati
        this.moltiplicatoreVelocita = 1;
        this.moltiplicatoreAnimazione = 1;

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

    /**
     * Durante l'attacco, superata la durata dell'animazione, il fotogramma
     * resta fermo sull'ultimo: prima ripartiva da capo, e negli ultimi passi
     * della finestra d'impatto si vedeva il colpo ricominciare.
     */
    animateFrames() {
        if (this.isAttacking && this.framesAttacco >= (this.durataAttaccoSprite || 0)) {
            this.framesCurrent = this.sprites.Attack1.framesMax - 1;
            return;
        }
        super.animateFrames();
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

        // Passi dall'inizio dell'attacco: serve alla finestra di cancellazione
        // (js/Comandi.js -> puoCancellareAttacco). Prima il campo veniva
        // azzerato ma mai incrementato.
        if (this.isAttacking) {
            this.framesAttacco++;
        }

        // L'attacco dura i passi decisi in avviaAttacco (animazione, ma con la
        // finestra d'impatto minima garantita). Prima si chiudeva quando veniva
        // disegnato l'ultimo fotogramma: chi ha l'impatto in fondo
        // all'animazione perdeva il colpo, perché la collisione si controlla
        // DOPO update() e su quel passo l'attacco era già spento.
        // `>` e non `>=`: framesAttacco è già stato incrementato qui sopra, e
        // la collisione si controlla dopo update(). Con `>=` l'ultimo passo
        // utile della finestra veniva spento prima di poterlo valutare.
        if (this.isAttacking &&
            this.framesAttacco > (this.fineAttacco || 0)) {
            this.isAttacking = false;
            this.attaccoCaricato = false;
            this.attaccoUltimate = false;
            this.framesAttacco = 0;
        }

        // La morte si completa da sola: raggiunto l'ultimo frame dell'animazione
        // il lottatore passa a isDead e l'animazione si ferma sull'ultimo disegno.
        if (this.image === this.sprites.Death.image && this.framesCurrent === this.sprites.Death.framesMax - 1) {
            this.isDead = true;
        }

        if (!this.isDead) {
            // Durante lo stun l'animazione di colpo subito si ferma sull'ultimo
            // frame: resta visibile per tutta la durata dello stun invece di
            // ripartire in loop.
            const takeHitFermo = this.isStunned &&
                this.image === this.sprites.TakeHit.image &&
                this.framesCurrent === this.sprites.TakeHit.framesMax - 1;

            if (!takeHitFermo) {
                this.animateFrames();
            }
        }

        // Spinta del colpo: si somma al movimento e si spegne in pochi passi.
        // Sta fuori da velocity perché il movimento orizzontale la sovrascrive
        // a ogni passo (aggiornaParteComune).
        if (this.spinta !== 0) {
            this.position.x += this.spinta;
            this.spinta *= 0.72;
            if (Math.abs(this.spinta) < 0.4) {
                this.spinta = 0;
            }
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

    /**
     * Avvia un attacco (normale, caricato o ultimate) dal primo frame.
     * Centralizza il reset dei flag: chi chiama non deve sapere come funziona
     * l'animazione.
     */
    avviaAttacco({ caricato = false, ultimate = false } = {}) {
        // Durata dell'attacco in passi: l'animazione, ma con una finestra
        // d'impatto minima garantita (js/Regole.js). Prima la fine la decideva
        // l'ultimo fotogramma disegnato, quindi chi ha l'impatto in fondo
        // all'animazione aveva pochi passi per far centro.
        const spriteAttacco = this.sprites.Attack1;
        const hold = spriteAttacco.framesHold || 30;
        this.durataAttaccoSprite = spriteAttacco.framesMax * hold;
        // Il frame d'impatto è un FOTOGRAMMA dell'animazione: qui diventa un
        // momento in passi di gioco. Serve perché dopo l'ultimo fotogramma
        // l'animazione riparte da capo e il contatore dei fotogrammi torna a
        // zero: confrontare quello faceva "sparire" la finestra d'impatto
        // proprio nei passi in cui l'attacco è ancora in corso.
        this.passoImpatto = this.attacco.frame * hold;
        this.fineAttacco = (typeof fineAttaccoPassi === 'function')
            ? fineAttaccoPassi(this.passoImpatto, this.durataAttaccoSprite)
            : this.durataAttaccoSprite;

        this.cambiaSprite('Attack1');
        this.isAttacking = true;
        this.attaccoCaricato = caricato;
        this.attaccoUltimate = ultimate;
        this.ultimateHaColpito = false;
        this.attaccoHaColpito = false;
        this.framesAttacco = 0;
        this.isCaricando = false;
        this.framesCarica = 0;
    }

    cambiaSprite(sprite) {
        // La morte ha priorità su tutto: una volta avviata, lo sprite non cambia più.
        // L'animazione arriva fino in fondo e isDead viene impostato in update().
        if (this.image === this.sprites.Death.image) {
            return;
        }

        // Un colpo subito annulla l'attacco in corso: altrimenti resterebbe
        // isAttacking true anche dopo l'animazione di TakeHit.
        if (sprite === 'TakeHit' || sprite === 'Death') {
            this.isAttacking = false;
            this.attaccoCaricato = false;
            this.attaccoUltimate = false;
            this.attaccoHaColpito = false;
            this.framesAttacco = 0;
            this.isCaricando = false;
            this.framesCarica = 0;
        }

        // Attacco e colpo subito non si interrompono mai... tranne che per la morte.
        // Senza questa eccezione l'animazione di morte non partirebbe quando il colpo
        // mortale lascia il lottatore a metà di "Attack1" o di "TakeHit".
        if (sprite !== 'Death') {
            // Un attacco in corso si interrompe solo se si viene colpiti.
            // Il controllo è sul flag e non sul frame corrente: prima, sul frame
            // finale, Jump/Fall potevano sostituire Attack1 e isAttacking restava
            // true per sempre (attacco bloccato).
            if (this.isAttacking && !this.isTakingDmg) {
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
        } else if (spriteData && sprite === 'Attack1' && !this.isAttacking) {
            // Lo stesso attacco ripetuto deve ripartire dal primo frame:
            // prima restava sull'ultimo frame e sembrava bloccato.
            this.framesCurrent = 0;
            this.framesElapsed = 0;
        }
    }
}