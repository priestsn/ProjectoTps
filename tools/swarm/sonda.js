// tools/swarm/sonda.js
// Sorgente iniettato nella pagina dallo swarm (si legge con fs e si valuta con
// nav.valuta). NON tocca il gioco: legge e basta. Espone window._swarm con gli
// errori della pagina, i campioni di stato e le anomalie trovate dalle sonde
// oggettive.
(function () {
    if (window._swarm) return;

    const sw = {
        avviato: Date.now(),
        errori: [],
        anomalie: [],
        campioni: [],
        azioni: [],
        ultimoAttaccoVisto: 0,
        azioneInCorso: null,
        timerFermo: 0,
        ultimoCampione: null,
        ultimaFirma: {}
    };
    window._swarm = sw;

    // Una firma non si ripete più di una volta ogni 5 s: senza questo, un ciclo
    // bloccato scrive 600 righe uguali in un minuto.
    function annota(firma, messaggio, gravita, contesto) {
        const adesso = Date.now();
        if (sw.ultimaFirma[firma] && adesso - sw.ultimaFirma[firma] < 5000) return;
        sw.ultimaFirma[firma] = adesso;
        sw.anomalie.push({
            firma: firma,
            messaggio: messaggio,
            gravita: gravita || 'fastidiosa',
            contesto: contesto || null,
            quando: adesso
        });
    }

    window.addEventListener('error', function (evento) {
        annota('eccezione',
            'Eccezione: ' + evento.message + ' (' + (evento.filename || '?') + ':' + evento.lineno + ')',
            'grave');
    });

    window.addEventListener('unhandledrejection', function (evento) {
        annota('promessa-non-gestita', 'Promessa rifiutata: ' + String(evento.reason), 'grave');
    });

    function leggiLottatore(l) {
        if (!l || !l.position) return null;
        return {
            personaggio: l.personaggio && l.personaggio.id ? l.personaggio.id : null,
            x: Math.round(l.position.x),
            y: Math.round(l.position.y),
            vita: Math.round(l.health),
            // ogni verdellinese ha il suo massimo: Chidi 110, Ayo 85...
            // controllare "<= 100" produceva falsi difetti su metà del roster
            vitaMax: (l.statistiche && l.statistiche.vita) ? Math.round(l.statistiche.vita) : 100,
            stamina: Math.round(l.stamina),
            staminaMax: (l.statistiche && l.statistiche.stamina) ? Math.round(l.statistiche.stamina) : 100,
            ultimate: Math.round(l.ultimate),
            attacco: !!l.isAttacking,
            parata: !!l.isParata,
            stun: !!l.isStunned,
            danno: !!l.isTakingDmg,
            // la parata e il salto valgono solo da terra (scelta del gioco):
            // senza questo dato, ogni parata in aria sembra un comando perso
            inAria: (typeof ground !== 'undefined')
                ? (l.position.y + l.height < ground - 1)
                : false
        };
    }

    function dentroScala(valore, massimo) {
        return typeof valore === 'number' && valore >= 0 && valore <= (massimo || 100);
    }

    /** Un campione di stato: è il contesto che accompagna ogni anomalia. */
    sw.campiona = function () {
        const debug = window.uvsf7Debug ? window.uvsf7Debug() : null;
        const p1 = leggiLottatore(typeof Player !== 'undefined' ? Player : null);
        const p2 = leggiLottatore(typeof Enemy !== 'undefined' ? Enemy : null);
        const stato = typeof statoCorrente !== 'undefined' ? statoCorrente : null;
        const timerAttuale = typeof timer !== 'undefined' ? timer : null;
        const finita = typeof gameOver !== 'undefined' ? !!gameOver : null;

        const campione = {
            quando: Date.now(),
            frame: debug ? debug.frame : null,
            passi: debug ? debug.passiUltimoFotogramma : null,
            inCoda: debug ? debug.comandiInCoda : null,
            stato: stato,
            modalita: typeof modalitaPartita !== 'undefined' ? modalitaPartita : null,
            timer: timerAttuale,
            gameOver: finita,
            p1: p1,
            p2: p2,
            canvas: (function () {
                const c = document.querySelector('canvas');
                return c ? { larghezza: c.width, altezza: c.height } : null;
            })()
        };

        sw.campioni.push(campione);
        if (sw.campioni.length > 400) sw.campioni.shift();

        // --- sonda: ciclo bloccato o lento ---
        if (stato === 'partita' && sw.ultimoCampione && sw.ultimoCampione.stato === 'partita') {
            const precedente = sw.ultimoCampione;
            const trascorso = campione.quando - precedente.quando;
            const passiFatti = (campione.frame || 0) - (precedente.frame || 0);
            const atteso = (trascorso / 1000) * 60;

            // `frame` riparte da zero a ogni partita (avviaPartita fa
            // frameGioco = 0): senza questo controllo il salto all'indietro
            // diventa un "ritmo" negativo di migliaia di passi al secondo
            const nuovaPartita = passiFatti < 0 || (campione.frame || 0) < 90;

            if (!nuovaPartita && trascorso > 100) {
                if (passiFatti < 20 && atteso > 40) {
                    annota('ciclo-blocco',
                        'Il ciclo di gioco avanza di ' + passiFatti + ' passi in ' + Math.round(trascorso) + ' ms',
                        'grave', campione);
                } else if (passiFatti < atteso * 0.78) {
                    annota('ritmo-basso',
                        'Ritmo ' + Math.round(passiFatti / (trascorso / 1000)) + ' passi/s invece di 60',
                        'fastidiosa', campione);
                }
            }
        }

        // --- sonda: valori fuori scala ---
        if (p1 && (!dentroScala(p1.vita, p1.vitaMax) || !dentroScala(p1.stamina, p1.staminaMax) ||
            !dentroScala(p1.ultimate, 100))) {
            annota('valore-fuori-scala', 'P1 fuori scala: ' + JSON.stringify(p1), 'grave', campione);
        }
        if (p2 && (!dentroScala(p2.vita, p2.vitaMax) || !dentroScala(p2.stamina, p2.staminaMax) ||
            !dentroScala(p2.ultimate, 100))) {
            annota('valore-fuori-scala', 'P2 fuori scala: ' + JSON.stringify(p2), 'grave', campione);
        }

        // --- sonda: timer ---
        if (timerAttuale !== null && typeof timerAttuale === 'number' && timerAttuale < 0) {
            annota('timer-negativo', 'Timer negativo: ' + timerAttuale, 'grave', campione);
        }

        if (stato === 'partita' && !finita && timerAttuale !== null &&
            sw.ultimoCampione && sw.ultimoCampione.timer === timerAttuale) {
            sw.timerFermo = (sw.timerFermo || 0) + 1;
            if (sw.timerFermo === 24) {
                annota('timer-fermo', 'Il timer è fermo a ' + timerAttuale + ' da 6 secondi', 'grave', campione);
            }
        } else {
            sw.timerFermo = 0;
        }

        // --- sonda: schermate informative senza via d'uscita ---
        const conUscita = ['account', 'negozio', 'classifica', 'amici', 'coda'];
        if (conUscita.indexOf(stato) !== -1) {
            const testo = (document.body.innerText || '').toUpperCase();
            if (testo.indexOf('TORNA') === -1 && testo.indexOf('INDIETRO') === -1 && testo.indexOf('MENU') === -1) {
                annota('schermo-senza-uscita',
                    'Schermata ' + stato + ' senza pulsante di ritorno', 'grave', campione);
            }
        }

        // per la sonda "azione persa": il gioco blocca un nuovo attacco per
        // FINESTRA_RECUPERO passi (16 = ~270 ms) dopo il precedente, quindi una
        // pressione ignorata subito dopo un attacco NON è un difetto
        if (p1 && p1.attacco) sw.ultimoAttaccoVisto = campione.quando;

        sw.ultimoCampione = campione;
        aggiornaAzioneInCorso();
        return campione;
    };

    /**
     * Lo swarm segnala qui il tasto d'azione che ha appena premuto, così la
     * sonda può dire se il gioco ha reagito (sonda "azione persa").
     */
    /**
     * Registra l'azione che lo swarm sta per premere e dice se il gioco può
     * accettarla. Le regole vere stanno nel gioco: un attacco durante il
     * recupero (FINESTRA_RECUPERO = 16 passi) o una parata in aria/senza stamina
     * vengono rifiutati di proposito, quindi non sono difetti.
     * `vitaPrima` è la vita dell'avversario letta PRIMA della pressione.
     */
    sw.segnalaAzione = function (azione, vitaPrima) {
        const me = leggiLottatore(typeof Player !== 'undefined' ? Player : null);
        let ammessa = true;

        if (azione === 'attacco' && Date.now() - (sw.ultimoAttaccoVisto || 0) < 500) ammessa = false;
        if (azione === 'parata' && me && (me.inAria || me.stamina < 1)) ammessa = false;
        if (me && (me.stun || me.danno)) ammessa = false;

        sw.azioneInCorso = {
            azione: azione,
            quando: Date.now(),
            ammessa: ammessa,
            reazioneVista: false,
            vitaPrima: (typeof vitaPrima === 'number') ? vitaPrima : null
        };

        // Il campionamento normale è a 250 ms: una parata da 100 ms ci
        // passerebbe sotto il naso e sembrerebbe un comando perso. Mentre
        // un'azione è in corso si guarda ogni 30 ms, poi si smette.
        if (sw._sorveglianza) clearInterval(sw._sorveglianza);
        sw._sorveglianza = setInterval(function () {
            try { aggiornaAzioneInCorso(); } catch (errore) { /* niente */ }
        }, 30);
        setTimeout(function () {
            if (sw._sorveglianza) { clearInterval(sw._sorveglianza); sw._sorveglianza = null; }
        }, 900);

        return ammessa;
    };

    /**
     * Aggiorna l'azione in corso: la chiama il campionamento 4 volte al secondo,
     * così una finestra breve (l'attacco dura ~400 ms) non si perde.
     */
    function aggiornaAzioneInCorso() {
        const voce = sw.azioneInCorso;
        if (!voce) return;

        const me = leggiLottatore(typeof Player !== 'undefined' ? Player : null);
        const io = typeof Player !== 'undefined' ? Player : null;
        if (!me) return;

        if (voce.azione === 'attacco' && (me.attacco || (io && io.attaccoHaColpito))) voce.reazioneVista = true;
        if (voce.azione === 'parata' && me.parata) voce.reazioneVista = true;
        if (voce.azione === 'salto' && me.inAria) voce.reazioneVista = true;
        if (voce.azione === 'ultimate' && me.ultimate < 50) voce.reazioneVista = true;
        if (voce.azione === 'sinistra' || voce.azione === 'destra') voce.reazioneVista = true; // lo spostamento si misura dopo
    }
    sw.aggiornaAzioneInCorso = aggiornaAzioneInCorso;

    /**
     * Esito dell'azione, da chiamare ~450 ms dopo la pressione: torna una
     * anomalia o null. Distingue due difetti diversi:
     *   - azione-persa: il gioco poteva accettare il comando e non ha reagito
     *   - colpo-senza-danno: il colpo è stato registrato ma la vita non è scesa
     */
    sw.esitoAzione = function () {
        const voce = sw.azioneInCorso;
        sw.azioneInCorso = null;
        if (sw._sorveglianza) { clearInterval(sw._sorveglianza); sw._sorveglianza = null; }
        if (!voce || !voce.ammessa) return null;

        aggiornaAzioneInCorso();

        if (!voce.reazioneVista) {
            return {
                firma: 'azione-persa',
                messaggio: 'Comando "' + voce.azione + '" accettabile dal gioco, nessuna reazione entro 450 ms',
                gravita: 'fastidiosa',
                contesto: sw.ultimoCampione
            };
        }

        if (voce.azione !== 'attacco') return null;

        // --- colpo registrato che non fa danno ---
        const io = typeof Player !== 'undefined' ? Player : null;
        const nemico = leggiLottatore(typeof Enemy !== 'undefined' ? Enemy : null);
        if (!io || !nemico || !io.attaccoHaColpito) return null;
        if (voce.vitaPrima !== null && nemico.vita < voce.vitaPrima) return null;
        if (nemico.stun) return null;

        // la parata dura pochi passi: si guardano i campioni degli ultimi 600 ms
        const adesso = Date.now();
        const recenti = sw.campioni.filter(function (c) { return adesso - c.quando < 600; });
        if (recenti.some(function (c) { return c.p2 && (c.p2.parata || c.p2.danno); })) return null;

        return {
            firma: 'colpo-senza-danno',
            messaggio: 'Il gioco ha registrato il colpo ma la vita dell\'avversario non è scesa (' +
                voce.vitaPrima + ' -> ' + nemico.vita + ')',
            gravita: 'grave',
            contesto: sw.ultimoCampione
        };
    };

    /** Anomalie raccolte finora (lo swarm le svuota dopo averle lette). */
    sw.prelevaAnomalie = function () {
        const elenco = sw.anomalie.slice();
        sw.anomalie.length = 0;
        return elenco;
    };

    // Campionamento continuo, 4 volte al secondo: leggero e sufficiente.
    setInterval(function () {
        try { sw.campiona(); } catch (errore) { /* la sonda non deve rompere il gioco */ }
    }, 250);
})();
