// tools/swarm/corridore.js
// L'orchestratore: N bot, ognuno con il suo Chrome, che giocano davvero.
// Raccoglie due tipi di prova:
//   - anomalie delle sonde (codice puro: eccezioni, blocchi, azioni perse...)
//   - giudizi di Jev sulle immagini (l'unica cosa che il codice non sa leggere)
// Tutto finisce in un JSONL; il raggruppamento lo fa rapporto.js.

const fs = require('fs');
const path = require('path');

const { apriNavigatore } = require('./navigatore.js');
const { prossimaAzione, casualeConSeme } = require('./politica.js');
const { giudica, eDifetto } = require('./giudice.js');

const SORGENTE_SONDA = fs.readFileSync(path.join(__dirname, 'sonda.js'), 'utf8');

function attendi(ms) {
    return new Promise((risolvi) => setTimeout(risolvi, ms));
}

/** Testo di contesto per il giudice: lo stato in parole, non un JSON illeggibile. */
function contestoInParole(campione) {
    if (!campione) return 'Stato non disponibile.';
    const p1 = campione.p1 || {};
    const p2 = campione.p2 || {};
    return 'Partita in corso, timer ' + campione.timer + '. ' +
        'Giocatore 1 (' + (p1.personaggio || '?') + ') a x ' + p1.x + ', vita ' + p1.vita + '. ' +
        'Avversario (' + (p2.personaggio || '?') + ') a x ' + p2.x + ', vita ' + p2.vita + '. ' +
        (campione.gameOver ? 'La partita è finita. ' : '');
}

/**
 * Fa giocare un bot per il tempo assegnato.
 * opzioni: {numero, url, portaCdp, minuti, partite, seme, usaGiudice, ogniGiudizioSec,
 *           cartella, scriviEvento}
 */
async function corriUnBot(opzioni) {
    const scelte = Object.assign({
        numero: 1,
        portaCdp: 9500,
        minuti: 5,
        partite: 3,
        seme: 1,
        usaGiudice: false,
        ogniGiudizioSec: 12,
        cartella: process.cwd(),
        scriviEvento: function () {}
    }, opzioni || {});

    const avvio = Date.now();
    const limiteMs = scelte.minuti * 60 * 1000;
    let giudiziFatti = 0;
    let partitaCorrente = 0;
    let nav = null;

    function secondo() { return Math.round((Date.now() - avvio) / 100); }

    try {
        nav = await apriNavigatore({ porta: scelte.portaCdp, url: scelte.url, attesaCaricamentoMs: 4000 });
        await nav.valuta(SORGENTE_SONDA);

        // Verdellinesi diversi a ogni bot: coprire tutti gli sprite e le
        // hitbox costa niente e senza questo ogni corsa prova sempre la coppia
        // predefinita (il primo e il secondo della lista).
        const scelti = await nav.valuta(
            "(function(){var liberi=[];for(var i=0;i<VERDELLINESI.length;i++){" +
            "if(lottatorePosseduto(VERDELLINESI[i].id))liberi.push(i);}return JSON.stringify(liberi);})()"
        );
        const liberi = JSON.parse(scelti || '[]');
        // L'ordine conta: apriSelezione rimette i cursori a zero, quindi gli
        // indici si scrivono DOPO averla aperta e PRIMA di confermare.
        const indicePrimo = liberi.length ? liberi[scelte.numero % liberi.length] : 0;
        const indiceSecondo = liberi.length ? liberi[(scelte.numero + 3) % liberi.length] : 1;

        // prima partita
        await nav.valuta("avviaSelezioneCPU('normale'); sceltaP1 = " + indicePrimo + '; sceltaP2 = ' +
            indiceSecondo + "; confermaScelta(1); confermaScelta(2); 'avviata'");
        await attendi(1500);
        partitaCorrente = 1;

        // si annota la coppia in campo: serve a sapere cosa ha coperto la corsa
        try {
            const coppia = await nav.valuta(
                'JSON.stringify({p1: Player.personaggio.id, p2: Enemy.personaggio.id})'
            );
            scelte.scriviEvento({
                tipo: 'nota', bot: scelte.numero, partita: partitaCorrente, firma: 'partita-iniziata',
                gravita: 'nessuna', messaggio: 'in campo ' + coppia, contesto: null, decimi: secondo()
            });
        } catch (errore) { /* niente */ }

        const dado = casualeConSeme(scelte.seme);
        let ultimoGiudizio = 0;
        let ultimoAttacco = 0;

        // --- metriche per la godibilità: si contano durante la partita e si
        // aggregano nel rapporto (durata, colpi scambiati, ultimate, esiti) ---
        let metriche = null;

        function azzeraMetriche(campioneIniziale) {
            metriche = {
                avvio: Date.now(),
                colpiSubitiP1: 0,
                colpiSubitiP2: 0,
                ultimateP1: 0,
                ultimateP2: 0,
                vitaP1Prec: campioneIniziale && campioneIniziale.p1 ? campioneIniziale.p1.vita : null,
                vitaP2Prec: campioneIniziale && campioneIniziale.p2 ? campioneIniziale.p2.vita : null,
                ultimaUltP1: campioneIniziale && campioneIniziale.p1 ? campioneIniziale.p1.ultimate : 0,
                ultimaUltP2: campioneIniziale && campioneIniziale.p2 ? campioneIniziale.p2.ultimate : 0,
                verdellinesi: [
                    campioneIniziale && campioneIniziale.p1 ? campioneIniziale.p1.personaggio : null,
                    campioneIniziale && campioneIniziale.p2 ? campioneIniziale.p2.personaggio : null
                ]
            };
        }

        while (Date.now() - avvio < limiteMs && partitaCorrente <= scelte.partite) {
            // 1. stato attuale
            let campione = null;
            try {
                campione = await nav.valuta('_swarm.campiona()');
            } catch (errore) {
                await attendi(200);
                continue;
            }

            if (!campione) { await attendi(200); continue; }

            // 1b. metriche: si accumulano a ogni campione
            if (!metriche) azzeraMetriche(campione);
            if (campione.p1 && campione.p2) {
                if (metriche.vitaP1Prec !== null && campione.p1.vita < metriche.vitaP1Prec) {
                    metriche.colpiSubitiP1 += 1;
                }
                if (metriche.vitaP2Prec !== null && campione.p2.vita < metriche.vitaP2Prec) {
                    metriche.colpiSubitiP2 += 1;
                }
                if (campione.p1.ultimate + 20 < metriche.ultimaUltP1) metriche.ultimateP1 += 1;
                if (campione.p2.ultimate + 20 < metriche.ultimaUltP2) metriche.ultimateP2 += 1;
                metriche.vitaP1Prec = campione.p1.vita;
                metriche.vitaP2Prec = campione.p2.vita;
                metriche.ultimaUltP1 = campione.p1.ultimate;
                metriche.ultimaUltP2 = campione.p2.ultimate;
            }

            // 2. la partita è finita? se ne apre un'altra
            if (campione.gameOver || campione.stato !== 'partita') {
                if (metriche) {
                    const vita = (campione.p1 && campione.p2)
                        ? [campione.p1.vita, campione.p2.vita] : [null, null];
                    scelte.scriviEvento({
                        tipo: 'metriche', bot: scelte.numero, partita: partitaCorrente,
                        verdellinesi: metriche.verdellinesi,
                        durataSec: Math.round((Date.now() - metriche.avvio) / 1000),
                        vitaFinale: vita,
                        esito: (vita[0] === null || vita[1] === null) ? 'sconosciuto'
                            : (vita[0] > vita[1] ? 'p1' : (vita[1] > vita[0] ? 'p2' : 'pari')),
                        colpiP1: metriche.colpiSubitiP2,
                        colpiP2: metriche.colpiSubitiP1,
                        ultimateP1: metriche.ultimateP1,
                        ultimateP2: metriche.ultimateP2,
                        finitaPerTempo: !campione.gameOver,
                        decimi: secondo()
                    });
                    metriche = null;
                }

                await attendi(1200);
                if (partitaCorrente >= scelte.partite) break;
                partitaCorrente += 1;
                await nav.valuta('avviaSelezioneCPU("normale"); sceltaP1 = ' +
                    (liberi.length ? liberi[partitaCorrente % liberi.length] : 0) + '; sceltaP2 = ' +
                    (liberi.length ? liberi[(partitaCorrente + 2) % liberi.length] : 1) +
                    '; confermaScelta(1); confermaScelta(2); "avviata"');
                await attendi(1500);
                continue;
            }

            // 3. decisione e tasto (10 Hz: un bot umano non preme 60 volte al secondo)
            const azione = prossimaAzione(campione, dado);
            const adesso = Date.now();
            const puoAttaccare = azione === 'attacco' && adesso - ultimoAttacco > 420;

            if (azione && !campione.p1.stun && (azione !== 'attacco' || puoAttaccare)) {
                const vitaNemicoPrima = campione.p2 ? campione.p2.vita : null;

                // La segnalazione viene PRIMA della pressione: così la sonda
                // legge lo stato VERO del momento (il campione può avere 250 ms)
                // e sa se il gioco poteva accettare il comando.
                try {
                    await nav.valuta('_swarm.segnalaAzione("' + azione + '",' +
                        (typeof vitaNemicoPrima === 'number' ? vitaNemicoPrima : 'null') + ')');
                } catch (errore) { /* pagina in transizione */ }

                await nav.premiTasto(azione === 'attacco' ? 'h' :
                    azione === 'parata' ? 'j' :
                        azione === 'ultimate' ? 'g' :
                            azione === 'salto' ? 'w' :
                                azione === 'sinistra' ? 'a' : 'd',
                    azione === 'parata' ? 160 : 70);

                if (azione === 'attacco') ultimoAttacco = adesso;

                // 4. esito dell'azione dopo 450 ms (reazione + danno)
                await attendi(450);
                try {
                    const esito = await nav.valuta('_swarm.esitoAzione()');
                    if (esito) {
                        scelte.scriviEvento({
                            tipo: 'anomalia', bot: scelte.numero, partita: partitaCorrente,
                            firma: esito.firma, gravita: esito.gravita, messaggio: esito.messaggio,
                            contesto: esito.contesto, decimi: secondo()
                        });
                    }
                } catch (errore) { /* la pagina può essere in transizione */ }
            }

            // 6. anomalie accumulate dalle sonde
            try {
                const anomalie = await nav.valuta('_swarm.prelevaAnomalie()');
                if (Array.isArray(anomalie)) {
                    for (const anomalia of anomalie) {
                        scelte.scriviEvento({
                            tipo: 'anomalia', bot: scelte.numero, partita: partitaCorrente,
                            firma: anomalia.firma, gravita: anomalia.gravita, messaggio: anomalia.messaggio,
                            contesto: anomalia.contesto, decimi: secondo()
                        });
                    }
                }
            } catch (errore) { /* niente */ }

            // 7. giudice sulle immagini
            if (scelte.usaGiudice && Date.now() - ultimoGiudizio > scelte.ogniGiudizioSec * 1000) {
                ultimoGiudizio = Date.now();
                try {
                    // Scala 1: a 0,6 i numeri del timer diventano una poltiglia
                    // di pixel e Jev li segnala come "testo illeggibile" — un
                    // difetto che non esiste (verificato: a 1x si legge "98")
                    const immagine = await nav.screenshotPagina(1);
                    if (immagine) {
                        const verdetto = await giudica(immagine, contestoInParole(campione));
                        giudiziFatti += 1;
                        if (verdetto) {
                            const nomeImmagine = 'schermo-' + scelte.numero + '-' + giudiziFatti + '.png';
                            if (eDifetto(verdetto)) {
                                fs.mkdirSync(scelte.cartella, { recursive: true });
                                fs.writeFileSync(path.join(scelte.cartella, nomeImmagine), Buffer.from(immagine, 'base64'));
                            }
                            scelte.scriviEvento({
                                tipo: 'giudizio', bot: scelte.numero, partita: partitaCorrente,
                                difetto: verdetto.difetto, categoria: verdetto.categoria,
                                gravita: verdetto.gravita, secondo: verdetto.secondo,
                                siCapisce: verdetto.siCapisce, affollamento: verdetto.affollamento,
                                costoStimato: verdetto.costoStimato,
                                immagine: eDifetto(verdetto) ? nomeImmagine : null,
                                contesto: campione, decimi: secondo()
                            });
                        }
                    }
                } catch (errore) {
                    scelte.scriviEvento({
                        tipo: 'anomalia', bot: scelte.numero, partita: partitaCorrente,
                        firma: 'giudice-errore', gravita: 'fastidiosa',
                        messaggio: 'Il giudice ha risposto con un errore: ' + errore.message,
                        contesto: null, decimi: secondo()
                    });
                }
            }

            await attendi(60);
        }

        return { giudizi: giudiziFatti, partite: partitaCorrente };
    } finally {
        if (nav) nav.chiudi();
    }
}

/**
 * Fa giocare lo sciame intero.
 * opzioni: {bot, url, minuti, partite, basePorta, usaGiudice, ogniGiudizioSec, cartella, scriviEvento}
 */
async function corriSciame(opzioni) {
    const scelte = Object.assign({
        bot: 3, portaCdpBase: 9500, minuti: 5, partite: 3,
        usaGiudice: false, ogniGiudizioSec: 12, cartella: process.cwd(), scriviEvento: function () {}
    }, opzioni || {});

    const lavori = [];
    for (let numero = 1; numero <= scelte.bot; numero++) {
        lavori.push(
            corriUnBot({
                numero: numero,
                url: scelte.url,
                portaCdp: scelte.portaCdpBase + numero,
                minuti: scelte.minuti,
                partite: scelte.partite,
                seme: numero * 1013,
                usaGiudice: scelte.usaGiudice,
                ogniGiudizioSec: scelte.ogniGiudizioSec,
                cartella: scelte.cartella,
                scriviEvento: scelte.scriviEvento
            }).catch((errore) => {
                scelte.scriviEvento({
                    tipo: 'anomalia', bot: numero, partita: 0, firma: 'bot-non-partito',
                    gravita: 'fastidiosa', messaggio: 'Il bot non è partito: ' + errore.message,
                    contesto: null, decimi: 0
                });
                return { giudizi: 0, partite: 0 };
            })
        );
    }

    return Promise.all(lavori);
}

// ========================================
// Giro delle schermate
// ==========================================
// Le sonde sul combattimento non vedono i difetti di navigazione: schermate
// senza uscita, pulsanti che non portano da nessuna parte, Escape che non
// riporta al menu. Sono proprio i bug che sono già capitati (disegnaAccount che
// faceva return prima del pulsante INDIETRO), quindi lo sciame li controlla a
// parte, con un giro scriptato e delle asserzioni secche.

const SCHERMATE = [
    { nome: 'negozio', funzione: 'apriNegozio', stato: 'negozio', attesa: 2500 },
    { nome: 'account', funzione: 'apriAccount', stato: 'account', attesa: 2000 },
    { nome: 'classifica', funzione: 'apriClassifica', stato: 'classifica', attesa: 2500 },
    { nome: 'amici', funzione: 'apriAmici', stato: 'amici', attesa: 2000 },
    { nome: 'coda ranked', funzione: 'apriCodaRanked', stato: 'coda', attesa: 3000 }
];

/**
 * Apre ogni schermata informativa, controlla che si apra e che Escape riporti
 * al menu. Ogni fallimento è un difetto vero: nessuna euristica.
 */
/**
 * Crea un account di prova e lo mette nel browser del bot.
 * Serve per il giro "con account": da ospite il negozio, gli amici e la coda
 * non si aprono (rimandano al login), quindi metà del gioco resterebbe scoperta.
 */
async function accediConAccountNouvo(nav, url, numero) {
    const casuale = Math.random().toString(36).slice(2, 7);
    const nick = 'Swarm' + numero + casuale;
    const password = 'password' + casuale;

    const risposta = await fetch(url + 'api/iscrizione', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nick: nick, password: password })
    });
    const dati = await risposta.json();
    // la rotta risponde {token, giocatore}: i test la incartano in {dati}, l'API no
    const token = (dati && dati.token) || (dati && dati.dati && dati.dati.token);
    if (!token) throw new Error('iscrizione senza token: ' + JSON.stringify(dati).slice(0, 200));

    await nav.valuta("localStorage.setItem('uvsf7-token'," + JSON.stringify(token) + ")");
    await nav.valuta('location.reload()');
    await attendi(4000);
    const dentro = await nav.valuta('(typeof statoAccount !== "undefined" && statoAccount) ? !!statoAccount.dentro : false');
    return { nick: nick, dentro: dentro };
}

async function corriGiro(opzioni) {
    const scelte = Object.assign({
        numero: 1, portaCdp: 9600, url: '', ripetizioni: 1, account: false,
        cartella: process.cwd(), scriviEvento: function () {}
    }, opzioni || {});

    const avvio = Date.now();
    let nav = null;

    function secondo() { return Math.round((Date.now() - avvio) / 100); }

    try {
        nav = await apriNavigatore({ porta: scelte.portaCdp, url: scelte.url, attesaCaricamentoMs: 4000 });
        await nav.valuta(SORGENTE_SONDA);
        await attendi(800);

        if (scelte.account) {
            try {
                const accesso = await accediConAccountNouvo(nav, scelte.url, scelte.numero);
                await nav.valuta(SORGENTE_SONDA);   // il ricaricamento l'aveva persa
                scelte.scriviEvento({
                    tipo: 'nota', bot: scelte.numero, partita: 0, firma: 'account-di-prova',
                    gravita: 'nessuna',
                    messaggio: 'account ' + accesso.nick + ' creato, dentro: ' + accesso.dentro,
                    contesto: null, decimi: secondo()
                });
            } catch (errore) {
                scelte.scriviEvento({
                    tipo: 'anomalia', bot: scelte.numero, partita: 0, firma: 'iscrizione-fallita',
                    gravita: 'grave', messaggio: 'Iscrizione non riuscita: ' + errore.message,
                    contesto: null, decimi: secondo()
                });
            }
        }

        for (let giro = 1; giro <= scelte.ripetizioni; giro++) {
            for (const schermata of SCHERMATE) {
                const esiste = await nav.valuta('typeof ' + schermata.funzione + ' === "function"');
                if (!esiste) {
                    scelte.scriviEvento({
                        tipo: 'anomalia', bot: scelte.numero, partita: 0, firma: 'funzione-assente',
                        gravita: 'grave',
                        messaggio: 'La funzione ' + schermata.funzione + '() non esiste nel client',
                        contesto: null, decimi: secondo()
                    });
                    continue;
                }

                await nav.valuta(schermata.funzione + '()');
                await attendi(schermata.attesa);
                const stato = await nav.valuta('statoCorrente');

                if (stato !== schermata.stato) {
                    // Un ospite che chiede il negozio finisce sulla schermata
                    // account: è voluto, ma DEVE dire perché ("Per usare il
                    // negozio serve un account..."). Il difetto non è la
                    // deviazione, è la deviazione muta.
                    let spiegazione = '';
                    if (stato === 'account') {
                        spiegazione = await nav.valuta(
                            "(function(){var e=document.querySelector('#accountStato');return e?(e.innerText||'').trim():'';})()"
                        );
                    }

                    if (stato === 'account' && spiegazione && String(spiegazione).length > 10) {
                        // comportamento voluto e spiegato: si annota solo, non è un difetto
                        scelte.scriviEvento({
                            tipo: 'nota', bot: scelte.numero, partita: 0, firma: 'accesso-richiesto',
                            gravita: 'nessuna',
                            messaggio: 'La schermata ' + schermata.nome + ' rimanda all\'account: "' + spiegazione + '"',
                            contesto: null, decimi: secondo()
                        });
                    } else if (stato === 'account') {
                        scelte.scriviEvento({
                            tipo: 'anomalia', bot: scelte.numero, partita: 0, firma: 'accesso-senza-spiegazione',
                            gravita: 'grave',
                            messaggio: 'La schermata ' + schermata.nome + ' rimanda all\'account senza dire perché',
                            contesto: null, decimi: secondo()
                        });
                    } else {
                        scelte.scriviEvento({
                            tipo: 'anomalia', bot: scelte.numero, partita: 0, firma: 'schermata-non-aperta',
                            gravita: 'grave',
                            messaggio: 'Chiamata ' + schermata.funzione + '() ma lo stato è "' + stato +
                                '" invece di "' + schermata.stato + '"',
                            contesto: await accanto(nav), decimi: secondo()
                        });
                    }
                }

                // il pulsante di uscita esiste ed è raggiungibile?
                const uscita = await nav.valuta(
                    "(function(){var testi=[];document.querySelectorAll('#areaGioco button, #areaGioco a')" +
                    ".forEach(function(e){var t=(e.innerText||'').toUpperCase();" +
                    "if(t.indexOf('TORNA')!==-1||t.indexOf('INDIETRO')!==-1||t.indexOf('MENU')!==-1)testi.push(t.slice(0,20));});" +
                    "return testi;})()"
                );
                if (!Array.isArray(uscita) || !uscita.length) {
                    scelte.scriviEvento({
                        tipo: 'anomalia', bot: scelte.numero, partita: 0, firma: 'schermo-senza-uscita',
                        gravita: 'grave',
                        messaggio: 'Schermata ' + schermata.nome + ' senza pulsante di ritorno visibile',
                        contesto: accanto(nav), decimi: secondo()
                    });
                }

                // Escape deve riportare al menu
                await nav.premiTasto('Escape', 60);
                await attendi(700);
                const dopUscta = await nav.valuta('statoCorrente');
                if (dopUscta !== 'menu') {
                    scelte.scriviEvento({
                        tipo: 'anomalia', bot: scelte.numero, partita: 0, firma: 'escape-non-funziona',
                        gravita: 'grave',
                        messaggio: 'Escape dalla schermata ' + schermata.nome +
                            ' lascia lo stato su "' + dopUscta + '" invece di tornare al menu',
                        contesto: accanto(nav), decimi: secondo()
                    });
                    // rimetto il client in uno stato utile per il giro successivo
                    await nav.valuta('apriMenu("principale")');
                    await attendi(500);
                }
            }
        }

        // anomalie raccolte dalla sonda durante il giro (eccezioni, valori...)
        const anomalie = await nav.valuta('_swarm.prelevaAnomalie()');
        for (const anomalia of (anomalie || [])) {
            scelte.scriviEvento({
                tipo: 'anomalia', bot: scelte.numero, partita: 0, firma: anomalia.firma,
                gravita: anomalia.gravita, messaggio: anomalia.messaggio,
                contesto: anomalia.contesto, decimi: secondo()
            });
        }

        return { giudizi: 0, partite: 0 };
    } catch (errore) {
        scelte.scriviEvento({
            tipo: 'anomalia', bot: scelte.numero, partita: 0, firma: 'giro-interrotto',
            gravita: 'fastidiosa', messaggio: 'Il giro si è interrotto: ' + errore.message,
            contesto: null, decimi: secondo()
        });
        return { giudizi: 0, partite: 0 };
    } finally {
        if (nav) nav.chiudi();
    }
}

/** Contesto minimo per un difetto di navigazione (non c'è una partita in corso). */
async function accanto(nav) {
    try {
        return await nav.valuta('_swarm.campiona()');
    } catch (errore) {
        return null;
    }
}

// ========================================
// Partita online fra due bot
// ==========================================
// Due account nuovi (ELO 1000 entrambi, quindi la finestra della coda li
// abbina subito), tutti e due in coda ranked: la stanza la crea il client, il
// codice lo scambia il server, la partita parte da sola. Da lì in poi i bot
// giocano come nell'allenamento, ma con in più il controllo di DESYNC: ogni
// secondo si confrontano le due viste. Se A vede B a x=500 e B si vede a x=520,
// uno dei due sta vedendo un'altra partita.

/**
 * Fa giocare due bot nella stessa stanza online e confronta le rispettive viste.
 */
async function corriOnline(opzioni) {
    const scelte = Object.assign({
        url: '', minuti: 4, portaCdpBase: 9700, cartella: process.cwd(),
        scriviEvento: function () {}, giocatori: 2
    }, opzioni || {});

    const avvio = Date.now();
    const limiteMs = scelte.minuti * 60 * 1000;
    const viste = {};
    const divergenze = {};

    function secondo() { return Math.round((Date.now() - avvio) / 100); }

    async function unBot(numero) {
        let nav = null;
        try {
            nav = await apriNavigatore({ porta: scelte.portaCdpBase + numero, url: scelte.url, attesaCaricamentoMs: 4000 });
            const accesso = await accediConAccountNouvo(nav, scelte.url, numero);
            await nav.valuta(SORGENTE_SONDA);

            scelte.scriviEvento({
                tipo: 'nota', bot: numero, partita: 0, firma: 'account-di-prova',
                gravita: 'nessuna', messaggio: 'account ' + accesso.nick + ' in coda', contesto: null, decimi: secondo()
            });

            await nav.valuta('apriCodaRanked(); "ok"');
            await attendi(500);
            await nav.valuta('cercaPartitaRanked(); "ok"');

            // Aspetto l'abbinamento. Dopo la coda si passa dalla SELEZIONE, non
            // direttamente in partita: ognuno conferma il proprio lato (l'host è
            // P1, l'ospite è P2) e solo allora l'host avvia la stanza.
            const scadenza = Date.now() + 60000;
            let inPartita = false;
            let confermato = false;

            while (Date.now() < scadenza) {
                const stato = await nav.valuta('statoCorrente');

                if (stato === 'selezione' && !confermato) {
                    const ospite = await nav.valuta(
                        '(typeof onlineStato !== "undefined" && onlineStato) ? !!onlineStato.ospite : false');
                    await nav.valuta('confermaScelta(' + (ospite ? 2 : 1) + '); "confermata"');
                    confermato = true;
                    scelte.scriviEvento({
                        tipo: 'nota', bot: numero, partita: 0, firma: 'scelta-confermata',
                        gravita: 'nessuna',
                        messaggio: 'abbinato, confermata la scelta come ' + (ospite ? 'P2 (ospite)' : 'P1 (padrone)'),
                        contesto: null, decimi: secondo()
                    });
                }

                if (stato === 'partita') { inPartita = true; break; }
                await attendi(600);
            }

            if (!inPartita) {
                scelte.scriviEvento({
                    tipo: 'anomalia', bot: numero, partita: 0, firma: 'abbinamento-mancato',
                    gravita: 'grave',
                    messaggio: 'Dopo 40 s in coda ranked la partita non è partita (stato "' +
                        (await nav.valuta('statoCorrente')) + '")',
                    contesto: null, decimi: secondo()
                });
                return { giudizi: 0, partite: 0 };
            }

            const dado = casualeConSeme(numero * 977);
            let ultimoAttacco = 0;

            while (Date.now() - avvio < limiteMs) {
                let campione = null;
                try { campione = await nav.valuta('_swarm.campiona()'); } catch (errore) { await attendi(200); continue; }
                if (!campione) { await attendi(200); continue; }

                if (campione.stato !== 'partita' || campione.gameOver) break;

                // la mia vista, per il confronto con l'altro bot
                viste[numero] = { quando: Date.now(), p1: campione.p1, p2: campione.p2, timer: campione.timer };

                // azioni come in allenamento
                const azione = prossimaAzione(campione, dado);
                const adesso = Date.now();
                if (azione && !campione.p1.stun && (azione !== 'attacco' || adesso - ultimoAttacco > 420)) {
                    const vitaPrima = campione.p2 ? campione.p2.vita : null;
                    try {
                        await nav.valuta('_swarm.segnalaAzione("' + azione + '",' +
                            (typeof vitaPrima === 'number' ? vitaPrima : 'null') + ')');
                    } catch (errore) { /* niente */ }

                    await nav.premiTasto(azione === 'attacco' ? 'h' :
                        azione === 'parata' ? 'j' :
                            azione === 'ultimate' ? 'g' :
                                azione === 'salto' ? 'w' :
                                    azione === 'sinistra' ? 'a' : 'd',
                        azione === 'parata' ? 160 : 70);

                    if (azione === 'attacco') ultimoAttacco = adesso;

                    // In online le sonde azione/colpo NON valgono: l'ospite non
                    // simula, manda i comandi e disegna lo stato ricevuto, quindi
                    // "il comando non ha reagito" e "il colpo non ha fatto danno"
                    // misurano l'architettura, non un difetto. Qui conta il
                    // confronto fra le due viste (desync).
                    await attendi(450);
                    await nav.valuta('_swarm.esitoAzione()');
                }

                try {
                    const anomalie = await nav.valuta('_swarm.prelevaAnomalie()');
                    for (const anomalia of (anomalie || [])) {
                        scelte.scriviEvento({
                            tipo: 'anomalia', bot: numero, partita: 1, firma: anomalia.firma,
                            gravita: anomalia.gravita, messaggio: anomalia.messaggio,
                            contesto: anomalia.contesto, decimi: secondo()
                        });
                    }
                } catch (errore) { /* niente */ }

                await attendi(60);
            }

            // --- fine partita: la prova della "uscita libera" ---
            // Regola voluta dall'autore: rivincita e cambio verdellinese
            // richiedono l'accordo dei due, mentre USCIRE è libero. Qui il bot 1
            // propone la rivincita e il bot 2 esce: devono tornare al menu
            // entrambi, e non deve ripartire niente.
            try {
                await attendi(2500);   // lascia finire la cerimonia
                const fine = await nav.valuta(
                    'JSON.stringify({stato: statoCorrente, gameOver: (typeof gameOver !== "undefined") ? !!gameOver : null,' +
                    'attivo: (typeof onlineStato !== "undefined" && onlineStato) ? !!onlineStato.attivo : null})'
                );
                const info = JSON.parse(fine || '{}');

                if (info.attivo) {
                    const miaScelta = (numero === 1) ? 'rivincita' : 'esci';
                    await nav.valuta('proponiSceltaFine("' + miaScelta + '"); "proposta"');
                    scelte.scriviEvento({
                        tipo: 'nota', bot: numero, partita: 1, firma: 'scelta-fine',
                        gravita: 'nessuna',
                        messaggio: 'a fine partita ho scelto "' + miaScelta + '"', contesto: null, decimi: secondo()
                    });

                    // entrambi devono finire al menu entro 8 s
                    const scadenzaFine = Date.now() + 8000;
                    let alMenu = false;
                    while (Date.now() < scadenzaFine) {
                        const adesso = await nav.valuta('statoCorrente');
                        if (adesso === 'menu') { alMenu = true; break; }
                        await attendi(400);
                    }

                    if (!alMenu) {
                        scelte.scriviEvento({
                            tipo: 'anomalia', bot: numero, partita: 1, firma: 'uscita-non-libera',
                            gravita: 'grave',
                            messaggio: 'Uno ha scelto la rivincita e l\'altro è uscito, ma dopo 8 s lo stato è "' +
                                (await nav.valuta('statoCorrente')) + '" invece di menu',
                            contesto: null, decimi: secondo()
                        });
                    }
                }
            } catch (errore) {
                scelte.scriviEvento({
                    tipo: 'anomalia', bot: numero, partita: 1, firma: 'fine-partita-non-gestita',
                    gravita: 'fastidiosa',
                    messaggio: 'La prova di fine partita si è interrotta: ' + errore.message,
                    contesto: null, decimi: secondo()
                });
            }

            return { giudizi: 0, partite: 1 };
        } finally {
            if (nav) nav.chiudi();
        }
    }

    // controllo di desync: ogni secondo confronto le due viste
    const controllo = setInterval(function () {
        const a = viste[1];
        const b = viste[2];
        if (!a || !b) return;

        // Prima si accerta che sia la STESSA partita: stesso timer (entro 2 s) e
        // stessi verdellinesi incrociati. Senza questo controllo si confrontano
        // due partite diverse e ogni differenza sembra un desync.
        if (typeof a.timer !== 'number' || typeof b.timer !== 'number' ||
            Math.abs(a.timer - b.timer) > 2) return;
        if (!a.p1 || !a.p2 || !b.p1 || !b.p2) return;
        if (a.p1.personaggio && b.p2.personaggio && a.p1.personaggio !== b.p2.personaggio) return;
        if (a.p2.personaggio && b.p1.personaggio && a.p2.personaggio !== b.p1.personaggio) return;

        // Le due viste hanno la STESSA semantica: P1 è sempre il lottatore del
        // padrone e P2 quello dell'ospite (l'ospite disegna lo stato ricevuto),
        // quindi si confronta P1 con P1 e P2 con P2. Confrontare P1 con P2
        // produceva un desync su ogni lettura.
        const coppie = [
            ['x di P1', a.p1.x, b.p1.x, 3],
            ['vita di P1', a.p1.vita, b.p1.vita, 1],
            ['x di P2', a.p2.x, b.p2.x, 3],
            ['vita di P2', a.p2.vita, b.p2.vita, 1]
        ];

        for (const [cosa, primo, secondoValore, tolleranza] of coppie) {
            if (typeof primo !== 'number' || typeof secondoValore !== 'number') continue;
            if (Math.abs(primo - secondoValore) <= tolleranza) { divergenze[cosa] = 0; continue; }

            divergenze[cosa] = (divergenze[cosa] || 0) + 1;
            // tre letture di fila oltre tolleranza: non è la latenza, è una vista diversa
            if (divergenze[cosa] === 3) {
                scelte.scriviEvento({
                    tipo: 'anomalia', bot: 0, partita: 1, firma: 'desync-online',
                    gravita: 'grave',
                    messaggio: 'Le due viste non coincidono su ' + cosa + ': ' + primo + ' contro ' + secondoValore,
                    contesto: { a: a, b: b }, decimi: secondo()
                });
                divergenze[cosa] = 0;
            }
        }
    }, 1000);

    try {
        const esiti = [];
        for (let numero = 1; numero <= scelte.giocatori; numero++) {
            esiti.push(unBot(numero));
        }
        return await Promise.all(esiti);
    } finally {
        clearInterval(controllo);
    }
}

module.exports = { corriUnBot, corriSciame, corriGiro, corriOnline, contestoInParole };
