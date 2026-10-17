// ========================================
// CPU
// ==========================================
// L'IA controlla il giocatore 2 usando gli stessi input del giocatore umano:
// scrive sui flag di `keys` e su `Enemy.lastKey`, poi chiama i comandi
// condivisi di index.js (salta, attacca, iniziaParata, finisciParata,
// attivaUltimate). Così il game loop non ha due logiche di combattimento.
//
// Le tre difficoltà cambiano tempi di reazione, aggressività, uso della
// parata (anche perfetta), attacco caricato e ultimate.

const DIFFICOLTA_CPU = {
    facile: {
        nome: 'Facile',
        reazione: 20,        // frame tra due decisioni offensive
        aggressivita: 0.35,  // probabilità di attaccare quando è a portata
        parata: 0.20,        // probabilità di tentare una parata
        perfetto: 0.0,       // probabilità di puntare al perfect block
        carica: 0.05,        // probabilità di attacco caricato (1 s fermo)
        ultimate: 0.10,      // probabilità di usare l'ultimate a barra piena
        ritiro: 0.05         // probabilità di arretrare
    },
    difficile: {
        nome: 'Difficile',
        reazione: 11,
        aggressivita: 0.62,
        parata: 0.50,
        perfetto: 0.45,
        carica: 0.25,
        ultimate: 0.55,
        ritiro: 0.12
    },
    guisse: {
        nome: 'Guissè',
        reazione: 5,
        aggressivita: 0.88,
        parata: 0.85,
        perfetto: 0.90,
        carica: 0.45,
        ultimate: 0.95,
        ritiro: 0.18
    }
};

/**
 * Crea lo stato dell'IA per una partita
 */
function creaCPU(difficolta) {
    const parametri = DIFFICOLTA_CPU[difficolta] || DIFFICOLTA_CPU.difficile;

    return {
        parametri,
        timerDecisione: 0,
        timerReazione: 0,
        haVistoAttacco: false,
        pianoParata: null,      // 'subito' | 'perfetto'
        haParato: false,
        framesParata: 0,
        framesTenutaAttacco: 0
    };
}

/**
 * Rilascia solo i tasti di movimento (l'attacco caricato ha il suo timer)
 */
function fermaMovimentoCPU() {
    keys.ArrowLeft.pressed = false;
    keys.ArrowRight.pressed = false;
}

/**
 * Rilascia tutti i comandi della CPU
 */
function fermaCPU() {
    fermaMovimentoCPU();
    keys.ù.pressed = false;
}

/**
 * Muove la CPU verso il giocatore (1) o lo allontana (-1)
 */
function muoviCPU(direzione) {
    fermaMovimentoCPU();

    if (direzione < 0) {
        keys.ArrowLeft.pressed = true;
        Enemy.lastKey = 'ArrowLeft';
        Enemy.facing = -1;
    } else if (direzione > 0) {
        keys.ArrowRight.pressed = true;
        Enemy.lastKey = 'ArrowRight';
        Enemy.facing = 1;
    }
}

/**
 * Distanza tra i centri dei due lottatori
 */
function distanzaLottatori(a, b) {
    const centroA = a.position.x + a.width / 2;
    const centroB = b.position.x + b.width / 2;
    return Math.abs(centroA - centroB);
}

/**
 * Portata orizzontale dell'attacco, misurata dal centro del corpo
 */
function portataAttacco(lottatore) {
    return lottatore.attacco.dx + lottatore.attacco.larghezza;
}

/**
 * Aggiorna l'IA del giocatore 2.
 * Va chiamata una volta per frame, prima del movimento, solo in modalità CPU.
 */
function aggiornaCPU(cpu) {
    if (!cpu || gameOver || Enemy.isDead) {
        return;
    }

    // Durante stun o congelamento la CPU non può fare nulla
    if (Enemy.isStunned || Enemy.congelamentoTimer > 0) {
        fermaCPU();
        return;
    }

    const p = cpu.parametri;
    const distanza = distanzaLottatori(Player, Enemy);
    const portata = portataAttacco(Enemy) + Player.width / 2;
    const versoGiocatore = Player.position.x < Enemy.position.x ? -1 : 1;

    // --- Rilascio dell'attacco (normale o caricato) ---
    if (cpu.framesTenutaAttacco > 0) {
        cpu.framesTenutaAttacco--;
        if (cpu.framesTenutaAttacco === 0) {
            rilasciaCarica(Enemy);

            if (Enemy.isAttacking) {
                fermaMovimentoCPU();
                return;
            }
        }
    }

    // Mentre carica non fa altro: è il drawback del colpo caricato
    if (Enemy.isCaricando) {
        fermaMovimentoCPU();
        return;
    }

    // --- Parata a tempo ---
    if (cpu.framesParata > 0) {
        cpu.framesParata--;
        if (cpu.framesParata === 0) {
            finisciParata(Enemy);
        }
    }

    // --- Reazione all'attacco del giocatore ---
    if (Player.isAttacking && distanza <= portata + 60) {
        if (!cpu.haVistoAttacco) {
            cpu.timerReazione = p.reazione;
            cpu.haVistoAttacco = true;
            cpu.pianoParata = null;
            cpu.haParato = false;
        }

        // La reazione non è istantanea
        if (cpu.timerReazione > 0) {
            cpu.timerReazione--;

            // Si decide solo se l'impatto non è ancora arrivato
            if (cpu.timerReazione === 0 &&
                Player.framesCurrent <= Player.attacco.frame - 1 &&
                Math.random() < p.parata) {
                cpu.pianoParata = Math.random() < p.perfetto ? 'perfetto' : 'subito';
            }
        }

        // Parata immediata: blocco normale
        if (cpu.pianoParata === 'subito' && !Enemy.isParata && !cpu.haParato &&
            Player.framesCurrent <= Player.attacco.frame - 1) {
            fermaMovimentoCPU();
            if (iniziaParata(Enemy)) {
                cpu.framesParata = 30;
                cpu.haParato = true;
                cpu.pianoParata = null;
            }
        }

        // Parata perfetta: si preme un frame prima dell'impatto
        if (cpu.pianoParata === 'perfetto' && !Enemy.isParata && !cpu.haParato &&
            Player.framesCurrent >= Player.attacco.frame - 1) {
            fermaMovimentoCPU();
            if (iniziaParata(Enemy)) {
                cpu.framesParata = 15;
                cpu.haParato = true;
                cpu.pianoParata = null;
            }
        }
    } else if (!Player.isAttacking) {
        // Il giocatore ha smesso di attaccare: si azzera la reazione
        cpu.haVistoAttacco = false;
        cpu.pianoParata = null;
        cpu.haParato = false;
        cpu.timerReazione = 0;
    }

    // --- Decisione offensiva a intervalli ---
    cpu.timerDecisione--;
    if (cpu.timerDecisione > 0) {
        return;
    }
    cpu.timerDecisione = p.reazione;

    // Se sta già attaccando o parando, resta fermo
    if (Enemy.isAttacking || Enemy.isParata) {
        fermaMovimentoCPU();
        return;
    }

    // --- Ultimate (valutata solo alla decisione, non ogni frame) ---
    if (Enemy.ultimate >= 100 && Math.random() < p.ultimate) {
        fermaCPU();
        attivaUltimate(Enemy);
        return;
    }

    // Si guarda sempre il giocatore
    Enemy.facing = versoGiocatore;

    // Fuori portata: si avvicina
    if (distanza > portata - 20) {
        muoviCPU(versoGiocatore);
        return;
    }

    // A portata: attacca oppure arretra
    if (Math.random() < p.aggressivita) {
        fermaMovimentoCPU();
        const caricato = Math.random() < p.carica;

        if (iniziaCarica(Enemy)) {
            // Il colpo parte al rilascio: 1 secondo di carica oppure tap breve
            cpu.framesTenutaAttacco = caricato ? CARICA_ATTACCO_FRAMI + 2 : 3;
        }
    } else if (Math.random() < p.ritiro) {
        muoviCPU(-versoGiocatore);
    } else {
        fermaMovimentoCPU();
    }
}
