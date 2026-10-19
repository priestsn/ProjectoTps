// ========================================
// Costanti condivise da tutti gli script
// ==========================================
// `gravity` sta qui e non in index.js: e' usata da js/Classi.js (Lottatore),
// che viene caricato prima e non deve dipendere da un file successivo (BUG-12).
const gravity = 0.25;

// ========================================
// Caricamento degli Asset
// ==========================================
const immaginiDaCaricare = [];  // tutte le Image create dal gioco
let immaginiCaricate = 0;       // quante hanno finito (caricate o fallite)

/**
 * Crea una Image e la registra tra gli asset da attendere prima di giocare.
 * Da usare al posto di "new Image()" così nessun asset viene dimenticato.
 */
function creaImmagine(imageSrc) {
    const img = new Image();
    img.loaded = false;

    const fine = () => {
        img.loaded = true;
        immaginiCaricate++;
        aggiornaSchermataCaricamento();
    };

    img.onload = fine;
    img.onerror = () => {
        // Un asset mancante non deve bloccare l'avvio: lo segnaliamo e proseguiamo
        console.error('Asset non caricato:', imageSrc);
        fine();
    };

    img.src = imageSrc;
    immaginiDaCaricare.push(img);
    return img;
}

/**
 * Aggiorna il contatore mostrato nella schermata di caricamento
 */
function aggiornaSchermataCaricamento() {
    const testo = document.querySelector('#loadingTesto');
    if (testo) {
        testo.innerHTML = 'Caricamento… ' + immaginiCaricate + '/' + immaginiDaCaricare.length;
    }
}

/**
 * Aspetta che TUTTI gli asset siano pronti, poi nasconde la schermata di
 * caricamento ed esegue la funzione che avvia il gioco.
 */
function avviaGiocoQuandoPronto(avviaIlGioco) {
    const attese = immaginiDaCaricare.map(img => {
        // Già pronta (es. presente in cache): nessuna attesa
        if (img.complete) return Promise.resolve();

        // Si attende sia 'load' sia 'error': se un asset manca il gioco
        // deve partire comunque, non restare bloccato per sempre.
        return new Promise(resolve => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
        });
    });

    Promise.all(attese).then(() => {
        // La schermata di caricamento viene nascosta dal cambio di stato,
        // che avviene dentro la funzione di avvio (vedi index.js)
        avviaIlGioco();
    });
}

/**
 * Percentuale da usare nelle barre dell'HUD, sempre tra 0 e 100
 */
function percentualeBarra(valore, massimo) {
    return Math.max(0, Math.min(100, (valore / massimo) * 100));
}

// ========================================
// Fine Partita
// ==========================================

/**
 * Chiude la partita dal lato "regole": ferma il timer e manda l'esito al
 * server. Il testo del risultato NON si scrive più qui: lo disegna il cartello
 * della cerimonia di fine partita (disegnaEsito in index.js), altrimenti
 * comparirebbe per un istante sotto al menu.
 * I parametri sono posizionali: così è impossibile confondere "Player" con
 * "player" (il bug nasceva dal destructuring, che lavora per NOME).
 */
function determineWinner(player, enemy, timerId) {
    clearTimeout(timerId);

    // VS ONLINE con account: si comunica l'esito al server, che calcola i punti.
    // In locale e contro la CPU non si accredita niente.
    if (typeof chiudiPartitaPunti === 'function' && typeof esitoPerP1 === 'function') {
        chiudiPartitaPunti(esitoPerP1());
    }
}

let timer = 60;
let timerId;

/**
 * Timer di conto alla rovescia che gestisce la rigenerazione della stamina e la fine del gioco
 */
function decreaseTimer() {
    // Il primo decremento avviene dopo 1 secondo: cosi' la partita dura davvero 60s
    // (prima il contatore calava subito all'avvio e partiva da 59)
    timerId = setTimeout(() => {
        // In pausa (menu di pausa o report bug) il tempo non scorre
        if (reportAperto || statoCorrente === STATI.PAUSA) {
            decreaseTimer();
            return;
        }

        timer--;
        document.querySelector('#timer').innerHTML = timer;

        // Rigenera stamina ogni 2 secondi, senza superare il massimo del personaggio.
        // La bruciatura di Bakari blocca la rigenerazione.
        if (timer % 2 === 0) {
            if (Player.bloccoStaminaTimer <= 0) {
                Player.stamina = Math.min(Player.statistiche.stamina, Player.stamina + 10);
            }
            if (Enemy.bloccoStaminaTimer <= 0) {
                Enemy.stamina = Math.min(Enemy.statistiche.stamina, Enemy.stamina + 10);
            }
        }

        if (timer > 0) {
            decreaseTimer();
        } else {
            // Allo scadere del tempo la partita è finita: gli input non devono
            // più avere effetto (prima gameOver restava false)
            gameOver = true;
            determineWinner(Player, Enemy, timerId);

            // Anche a tempo scaduto si passa dalla cerimonia (BUG-32): il menu
            // FINE PARTITA arriva dopo il cartello, non al posto suo
            avviaCerimoniaFine('tempo');
        }
    }, 1000);
}