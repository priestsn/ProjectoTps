// ========================================
// VS ONLINE
// ==========================================
// Come funziona la partita in rete (Fase 5):
//
//   host  = chi crea la stanza. Simula la partita nel proprio browser, esattamente
//           come in VS locale, e manda 30 volte al secondo lo stato dei due
//           lottatori all'ospite.
//   ospite = chi entra con il codice. Non simula nulla: disegna lo stato che
//           riceve e manda i propri tasti all'host, che li applica al
//           giocatore 2 con gli stessi comandi usati dalla CPU.
//
// Il server non calcola il combattimento: fa solo da ponte (vedi server/server.js).
// Il campo di gioco è fissato all'inizio della partita (stesse misure del canvas
// dell'host) così le posizioni ricevute cadono negli stessi pixel.

// Stato della modalità online (letta anche da index.js, Menu.js, Selezione.js)
const onlineStato = {
    attivo: false,        // partita online in corso
    ospite: false,        // true = questo browser è il giocatore 2
    codice: null,         // codice della stanza
    idAvversario: null,   // personaggio scelto dall'altro
    fotogramma: null,     // ultimo stato ricevuto (solo ospite)
    contatoreInvio: 0,    // usato per mandare un fotogramma ogni due frame
    fineMostrata: false   // il menu di fine partita è già comparso (solo ospite)
};

// Campi degli stati alterati, nell'ordine in cui viaggiano nel fotogramma
const CAMPI_STATI = [
    'rallentamentoTimer', 'inversioneTimer', 'congelamentoTimer', 'velenoTimer',
    'marchioTimer', 'bruciaturaTimer', 'silenzioTimer', 'eclissiTimer',
    'buffTimer', 'bloccoStaminaTimer'
];

// ========================================
// Pannello di ingresso e badge della stanza
// ========================================

/**
 * True quando il pannello per digitare il codice è aperto: la tastiera serve
 * al campo di testo e non ai menu.
 */
function pannelloOnlineAperto() {
    const pannello = document.querySelector('#online');
    return !!pannello && pannello.classList.contains('aperto');
}

/**
 * Apre il pannello di ingresso in una stanza
 */
function apriIngressoOnline() {
    const pannello = document.querySelector('#online');
    const campo = document.querySelector('#onlineCodice');
    const stato = document.querySelector('#onlineStato');
    if (!pannello || !campo) {
        return;
    }

    pannello.classList.add('aperto');
    pannello.style.display = 'flex';
    campo.value = '';
    if (stato) {
        stato.innerHTML = 'Digita il codice di 4 caratteri della stanza.';
    }
    campo.focus();
}

/**
 * Chiude il pannello di ingresso
 */
function chiudiPannelloOnline() {
    const pannello = document.querySelector('#online');
    if (pannello) {
        pannello.classList.remove('aperto');
        pannello.style.display = 'none';
    }
}

/**
 * Mostra un messaggio nella riga di stato del pannello
 */
function messaggioPannelloOnline(testo) {
    const stato = document.querySelector('#onlineStato');
    if (stato) {
        stato.innerHTML = testo;
    }
}

/**
 * Testo piccolo sempre visibile durante attesa e partita
 */
function mostraBadgeOnline(testo) {
    const badge = document.querySelector('#onlineBadge');
    if (badge) {
        badge.innerHTML = testo;
        badge.style.display = 'block';
    }
}

function nascondiBadgeOnline() {
    const badge = document.querySelector('#onlineBadge');
    if (badge) {
        badge.innerHTML = '';
        badge.style.display = 'none';
    }
}

/**
 * Riscrive il badge in base allo stato della stanza
 */
function aggiornaBadgeOnline() {
    if (!onlineStato.codice) {
        nascondiBadgeOnline();
        return;
    }

    if (onlineStato.attivo) {
        mostraBadgeOnline('STANZA ' + onlineStato.codice + ' - ' +
            (onlineStato.ospite ? 'GIOCATORE 2' : 'GIOCATORE 1'));
    } else if (onlineStato.ospite) {
        // L'ospite sceglie il proprio personaggio: non aspetta nessuno
        mostraBadgeOnline('STANZA ' + onlineStato.codice + ' - SCEGLI IL PERSONAGGIO');
    } else {
        mostraBadgeOnline('STANZA ' + onlineStato.codice +
            (onlineStato.idAvversario ? ' - AVVERSARIO COLLEGATO' : ' - IN ATTESA DELL\'AVVERSARIO'));
    }
}

// ========================================
// Creazione e ingresso nella stanza
// ========================================

/**
 * Crea una stanza: si diventa host e si apre la selezione del personaggio.
 * Il codice viene mostrato nel badge mentre si aspetta l'avversario.
 */
function creaStanzaOnline() {
    mostraBadgeOnline('COLLEGAMENTO AL SERVER...');
    preparaRete();

    Rete.collega((esito) => {
        if (!esito) {
            mostraBadgeOnline('SERVER NON RAGGIUNGIBILE');
            setTimeout(() => {
                nascondiBadgeOnline();
                apriMenu('online');
            }, 2500);
            return;
        }
        Rete.invia({ t: 'crea' });
    });
}

/**
 * Entra in una stanza esistente usando il codice digitato nel pannello
 */
function entraStanzaOnline() {
    const campo = document.querySelector('#onlineCodice');
    const codice = campo ? campo.value.trim().toUpperCase() : '';

    if (codice.length !== 4) {
        messaggioPannelloOnline('Il codice ha 4 caratteri.');
        return;
    }

    messaggioPannelloOnline('Collegamento al server...');
    preparaRete();

    Rete.collega((esito) => {
        if (!esito) {
            messaggioPannelloOnline('Server non raggiungibile. Riprova tra poco.');
            return;
        }
        Rete.invia({ t: 'entra', codice: codice });
    });
}

/**
 * Imposta i gestori dei messaggi del server
 */
function preparaRete() {
    Rete.onMessaggio = gestisciMessaggioOnline;
    Rete.onChiusura = onlineConnessionePersa;
}

/**
 * Chiude tutto: stanza, collegamento, badge. Sicura anche se non si è online.
 */
function esciOnline() {
    Rete.onMessaggio = null;
    Rete.onChiusura = null;
    Rete.invia({ t: 'esci' });
    Rete.chiudi();

    onlineStato.attivo = false;
    onlineStato.ospite = false;
    onlineStato.codice = null;
    onlineStato.idAvversario = null;
    onlineStato.fotogramma = null;
    onlineStato.contatoreInvio = 0;

    chiudiPannelloOnline();
    nascondiBadgeOnline();

    if (canvas.style.width) {
        canvas.style.width = '';
        canvas.style.height = '';
    }
}

/**
 * Il collegamento è caduto: si avvisa e si torna al menu
 */
function onlineConnessionePersa() {
    if (!onlineStato.codice && !onlineStato.attivo) {
        return;
    }

    onlineStato.attivo = false;
    onlineStato.codice = null;
    mostrareAvvisoRete('COLLEGAMENTO PERSO');
}

/**
 * Messaggio di rete da mostrare per qualche secondo sopra il menu
 */
function mostrareAvvisoRete(testo) {
    onlineStato.ospite = false;
    esciAlMenu();
    mostraBadgeOnline(testo);
    setTimeout(() => {
        nascondiBadgeOnline();
        apriMenu('online');
    }, 2500);
}

// ========================================
// Messaggi in arrivo
// ========================================
function gestisciMessaggioOnline(dati) {
    switch (dati.t) {
        case 'creata': {
            onlineStato.codice = dati.codice;
            onlineStato.ospite = false;
            onlineStato.idAvversario = null;

            // Se la stanza nasce dalla coda ranked, il codice va comunicato al
            // server: l'avversario lo sta aspettando per entrare da solo.
            if (typeof pubblicaCodiceCoda === 'function') {
                pubblicaCodiceCoda(dati.codice);
            }

            chiudiPannelloOnline();
            aggiornaBadgeOnline();
            apriSelezione(MODALITA.ONLINE);
            return;
        }

        case 'entrato': {
            onlineStato.codice = dati.codice;
            onlineStato.ospite = true;
            onlineStato.idAvversario = null;
            chiudiPannelloOnline();
            aggiornaBadgeOnline();
            apriSelezione(MODALITA.ONLINE);
            return;
        }

        case 'errore': {
            messaggioPannelloOnline(dati.msg || 'Errore del server');
            return;
        }

        case 'avversario': {
            // L'host sa che l'ospite è entrato: si può scegliere il personaggio
            aggiornaBadgeOnline();
            return;
        }

        case 'scelta': {
            // Il personaggio scelto dall'altro giocatore
            onlineStato.idAvversario = dati.id;
            const indice = PERSONAGGI.findIndex(personaggio => personaggio.id === dati.id);

            if (indice >= 0) {
                if (onlineStato.ospite) {
                    sceltaP1 = indice;
                    confermatoP1 = true;
                } else {
                    sceltaP2 = indice;
                    confermatoP2 = true;
                }
                if (statoCorrente === STATI.SELEZIONE) {
                    disegnaSelezione();
                }
            }

            // L'host può avviare appena ha confermato anche il proprio
            if (!onlineStato.ospite && confermatoP1 && confermatoP2) {
                inviaAvvioOnline();
            }
            return;
        }

        case 'avvia': {
            // L'host ha avviato: l'ospite adotta le scelte e le misure del campo
            const indiceP1 = PERSONAGGI.findIndex(personaggio => personaggio.id === dati.p1);
            const indiceP2 = PERSONAGGI.findIndex(personaggio => personaggio.id === dati.p2);

            if (indiceP1 >= 0) sceltaP1 = indiceP1;
            if (indiceP2 >= 0) sceltaP2 = indiceP2;
            confermatoP1 = true;
            confermatoP2 = true;

            avviaPartitaOnline(true, dati.p1, dati.p2, dati.w, dati.h);
            return;
        }

        case 'azione': {
            applicaAzioneRemota(dati.g, dati.a, dati.giu);
            return;
        }

        case 'rivincita': {
            // L'ospite ha chiesto la rivincita: riparte l'host, che rimanda 'avvia'
            if (!onlineStato.ospite) {
                inviaAvvioOnline();
            }
            return;
        }

        case 'selezione': {
            // L'altro vuole cambiare personaggi: si riapre la selezione qui
            if (statoCorrente !== STATI.SELEZIONE) {
                apriSelezione(MODALITA.ONLINE);
            }
            return;
        }

        case 'fotogramma': {
            if (onlineStato.ospite) {
                onlineStato.fotogramma = dati;
            }
            return;
        }

        case 'avversarioUscito': {
            onlineStato.attivo = false;
            onlineStato.codice = null;
            mostrareAvvisoRete('L\'AVVERSARIO HA LASCIATO LA STANZA');
            return;
        }
    }
}

/**
 * Scelta del personaggio: si manda all'altro giocatore
 */
function inviaSceltaOnline(id) {
    Rete.invia({ t: 'scelta', id: id });
}

/**
 * L'host avvia la partita e comunica all'ospite personaggi e misure del campo
 */
function inviaAvvioOnline() {
    const idP1 = PERSONAGGI[sceltaP1].id;
    const idP2 = PERSONAGGI[sceltaP2].id;

    Rete.invia({
        t: 'avvia',
        p1: idP1,
        p2: idP2,
        w: canvas.width,
        h: canvas.height
    });

    avviaPartitaOnline(false, idP1, idP2, canvas.width, canvas.height);
}

/**
 * Avvia la partita in modalità online.
 * `ospite` decide chi simula: solo l'host.
 */
function avviaPartitaOnline(ospite, idP1, idP2, larghezza, altezza) {
    onlineStato.attivo = true;
    onlineStato.ospite = ospite;
    onlineStato.fotogramma = null;
    onlineStato.contatoreInvio = 0;
    onlineStato.fineMostrata = false;

    if (ospite) {
        // Stesse misure dell'host: le posizioni che arrivano sono pixel del
        // suo canvas, quindi il campo deve essere identico
        canvas.width = larghezza;
        canvas.height = altezza;
        ground = canvas.height - 40;
        adattaCanvasOspite();
    }

    avviaPartita(idP1, idP2);
    aggiornaBadgeOnline();
}

/**
 * Adatta solo la dimensione MOSTRATA del canvas alla finestra, senza toccare
 * le misure del campo: durante una partita online il campo non può cambiare.
 */
function adattaCanvasOspite() {
    if (!canvas.width || !canvas.height) {
        return;
    }

    const rapporto = canvas.width / canvas.height;
    let larghezza = window.innerWidth;
    let altezza = larghezza / rapporto;

    if (altezza > window.innerHeight) {
        altezza = window.innerHeight;
        larghezza = altezza * rapporto;
    }

    canvas.style.width = Math.floor(larghezza) + 'px';
    canvas.style.height = Math.floor(altezza) + 'px';
}

// ========================================
// Host: fotogrammi di stato (invio)
// ========================================

/**
 * Nome dello sprite attualmente disegnato dal lottatore
 */
function nomeSpriteDi(lottatore) {
    const nomi = ['idle', 'Run', 'Jump', 'Fall', 'Attack1', 'TakeHit', 'Death', 'ParataIdle'];

    for (const nome of nomi) {
        const dati = lottatore.sprites[nome];
        if (dati && lottatore.image === dati.image) {
            return nome;
        }
    }
    return 'idle';
}

/**
 * Stato di un lottatore ridotto ai soli campi che servono per disegnarlo
 */
function statoLottatore(lottatore) {
    return {
        x: Math.round(lottatore.position.x * 10) / 10,
        y: Math.round(lottatore.position.y * 10) / 10,
        vy: Math.round(lottatore.velocity.y * 100) / 100,
        f: lottatore.facing,
        vita: Math.round(lottatore.health * 10) / 10,
        stam: Math.round(lottatore.stamina * 10) / 10,
        ult: Math.round(lottatore.ultimate * 10) / 10,
        sp: nomeSpriteDi(lottatore),
        fc: lottatore.framesCurrent,
        at: lottatore.isAttacking ? 1 : 0,
        car: lottatore.attaccoCaricato ? 1 : 0,
        ultAtt: lottatore.attaccoUltimate ? 1 : 0,
        par: lottatore.isParata ? 1 : 0,
        fp: lottatore.framesParata,
        stun: lottatore.isStunned ? lottatore.stunTimer : 0,
        morto: lottatore.isDead ? 1 : 0,
        carica: lottatore.isCaricando ? lottatore.framesCarica : 0,
        vel: Math.round(lottatore.moltiplicatoreVelocita * 100) / 100,
        ani: Math.round(lottatore.moltiplicatoreAnimazione * 100) / 100,
        stati: CAMPI_STATI.map(campo => lottatore[campo] || 0)
    };
}

/**
 * Posizioni dei proiettili delle ultimate
 */
function statoProiettili() {
    return proiettili.map(p => [
        Math.round(p.x), Math.round(p.y), p.raggio, p.colore || '#ff8a3d'
    ]);
}

/**
 * L'host manda il fotogramma ogni due frame: 30 pacchetti al secondo bastano
 * per un picchiaduro e la banda resta bassa.
 */
function inviaFotogramma() {
    onlineStato.contatoreInvio++;

    if (onlineStato.contatoreInvio % 2 !== 0 || !Player || !Enemy) {
        return;
    }

    Rete.invia({
        t: 'fotogramma',
        p1: statoLottatore(Player),
        p2: statoLottatore(Enemy),
        pro: statoProiettili(),
        timer: timer,
        over: gameOver ? 1 : 0,
        // Esito dell'incontro secondo l'host (P1): all'ospite serve per i punti
        esitoP1: gameOver && typeof esitoPerP1 === 'function' ? esitoPerP1() : null,
        testo: hud.displayText.innerHTML,
        testoVisibile: hud.displayText.style.display !== 'none' ? 1 : 0,
        avviso: { testo: avvisoTesto, colore: avvisoColore, timer: avvisoTimer, grande: avvisoGrande ? 1 : 0 }
    });
}

// ========================================
// Ospite: disegno dello stato ricevuto
// ========================================

/**
 * Applica al lottatore lo stato ricevuto dall'host.
 * La posizione insegue il bersaglio: il movimento resta fluido anche se i
 * pacchetti arrivano metà dei frame.
 */
function applicaStatoLottatore(lottatore, stato) {
    lottatore.position.x += (stato.x - lottatore.position.x) * 0.5;
    lottatore.position.y += (stato.y - lottatore.position.y) * 0.5;
    lottatore.velocity.y = stato.vy;
    lottatore.facing = stato.f;
    lottatore.health = stato.vita;
    lottatore.stamina = stato.stam;
    lottatore.ultimate = stato.ult;
    lottatore.isAttacking = stato.at === 1;
    lottatore.attaccoCaricato = stato.car === 1;
    lottatore.attaccoUltimate = stato.ultAtt === 1;
    lottatore.isParata = stato.par === 1;
    lottatore.framesParata = stato.fp;
    lottatore.isStunned = stato.stun > 0;
    lottatore.stunTimer = stato.stun;
    lottatore.isDead = stato.morto === 1;
    lottatore.isCaricando = stato.carica > 0;
    lottatore.framesCarica = stato.carica;
    lottatore.moltiplicatoreVelocita = stato.vel;
    lottatore.moltiplicatoreAnimazione = stato.ani;

    CAMPI_STATI.forEach((campo, indice) => {
        lottatore[campo] = stato.stati[indice] || 0;
    });

    // Lo sprite si imposta a mano: cambiaSprite() ha le protezioni contro
    // l'interruzione di attacco e morte, che qui non servono (lo stato è già
    // quello deciso dall'host).
    const dati = lottatore.sprites[stato.sp];
    if (dati && dati.image) {
        lottatore.image = dati.image;
        lottatore.framesMax = dati.framesMax;
        lottatore.framesHold = dati.framesHold || lottatore.framesHoldBase;
    }
    lottatore.framesCurrent = Math.max(0, Math.min(lottatore.framesMax - 1, stato.fc));
}

/**
 * Un frame della partita vista dall'ospite: nessuna simulazione, solo disegno
 * dello stato ricevuto.
 */
function aggiornaOspite() {
    const stato = onlineStato.fotogramma;

    if (!stato || !Player || !Enemy) {
        return;
    }

    c.fillStyle = 'black';
    c.fillRect(0, 0, canvas.width, canvas.height);

    // Proiettili: si ridisegnano dalle posizioni dell'host
    proiettili.length = 0;
    for (const p of stato.pro) {
        proiettili.push({ x: p[0], y: p[1], raggio: p[2], colore: p[3] });
    }

    applicaStatoLottatore(Player, stato.p1);
    applicaStatoLottatore(Enemy, stato.p2);

    background.update();
    Player.draw();
    Enemy.draw();

    disegnaCarica(Player);
    disegnaCarica(Enemy);
    disegnaProiettili();
    disegnaStati(Player);
    disegnaStati(Enemy);

    // HUD e timer arrivano dall'host: sono gli unici valori veri
    hud.playerHealth.style.width = percentualeBarra(Player.health, Player.statistiche.vita) + '%';
    hud.enemyHealth.style.width = percentualeBarra(Enemy.health, Enemy.statistiche.vita) + '%';
    hud.playerStamina.style.width = percentualeBarra(Player.stamina, Player.statistiche.stamina) + '%';
    hud.enemyStamina.style.width = percentualeBarra(Enemy.stamina, Enemy.statistiche.stamina) + '%';
    hud.playerUltimate.style.width = percentualeBarra(Player.ultimate, 100) + '%';
    hud.enemyUltimate.style.width = percentualeBarra(Enemy.ultimate, 100) + '%';

    if (hud.timer) {
        hud.timer.innerHTML = stato.timer;
    }

    // Avviso centrale: si ridisegna quello dell'host
    avvisoTesto = stato.avviso.testo;
    avvisoColore = stato.avviso.colore;
    avvisoTimer = stato.avviso.timer;
    avvisoGrande = !!(stato.avviso && stato.avviso.grande);
    disegnaAvviso();

    if (stato.over) {
        // Anche l'ospite fa la sua cerimonia: è solo disegno, quindi può andare
        // con i suoi tempi senza toccare il protocollo. Se la funzione non c'è
        // (versione vecchia) si comporta come prima.
        if (!onlineStato.fineMostrata && statoCorrente === STATI.PARTITA) {
            onlineStato.fineMostrata = true;

            // L'ospite è P2: l'esito dell'host va letto al contrario
            if (typeof chiudiPartitaPunti === 'function' && typeof esitoInvertito === 'function' && stato.esitoP1) {
                chiudiPartitaPunti(esitoInvertito(stato.esitoP1));
            }

            if (typeof avviaCerimoniaFine === 'function' && typeof cerimoniaFine !== 'undefined' && !cerimoniaFine) {
                gameOver = true;
                avviaCerimoniaFine('ko');
            } else {
                hud.displayText.style.display = 'flex';
                hud.displayText.innerHTML = stato.testo;
                apriMenu('finePartita', STATI.PAUSA);
            }
        }
    } else if (hud.displayText.style.display !== 'none') {
        hud.displayText.style.display = 'none';
        hud.displayText.innerHTML = '';
    }
}

// ========================================
// Ospite: invio delle azioni all'host
// ==========================================
// L'ospite non ha una simulazione: premiAzione() (js/Keybinds.js) manda qui
// l'azione, che l'host esegue sul giocatore 2. Il tasto fisico non viaggia:
// viaggia l'azione, così ogni giocatore tiene i propri keybinds.

// ========================================
// Host: applicazione delle azioni dell'ospite
// ==========================================
/**
 * L'host applica le azioni ricevute al giocatore 2 usando gli stessi comandi
 * condivisi del gioco (salta, iniziaParata, ...): nessuna seconda logica.
 */
function applicaAzioneRemota(giocatore, azione, premuto) {
    if (!onlineStato.attivo || onlineStato.ospite || !Enemy || gameOver) {
        return;
    }

    // L'ospite comanda sempre e solo il giocatore 2
    if (giocatore !== 'p2' || !azione) {
        return;
    }

    premiAzione('p2', azione, premuto === 1 || premuto === true);
}

// ========================================
// Collegamento dei pulsanti del pannello
// ==========================================
// Questo script è caricato a fine pagina: gli elementi del pannello esistono già.
(function collegaPulsantiOnline() {
    const entra = document.querySelector('#onlineEntra');
    const annulla = document.querySelector('#onlineAnnulla');
    const campo = document.querySelector('#onlineCodice');

    if (entra) {
        entra.addEventListener('click', entraStanzaOnline);
    }

    if (annulla) {
        annulla.addEventListener('click', () => {
            chiudiPannelloOnline();
            apriMenu('principale');
        });
    }

    // Invio conferma, Esc annulla. La pagina ignora la tastiera mentre il
    // pannello è aperto, quindi questi eventi arrivano solo al campo.
    if (campo) {
        campo.addEventListener('keydown', (evento) => {
            if (evento.key === 'Enter') {
                evento.preventDefault();
                entraStanzaOnline();
            } else if (evento.key === 'Escape') {
                evento.preventDefault();
                chiudiPannelloOnline();
                apriMenu('principale');
            }
        });
    }
})();
