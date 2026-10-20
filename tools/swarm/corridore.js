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

        // prima partita
        await nav.valuta("avviaSelezioneCPU('normale'); confermaScelta(1); confermaScelta(2); 'avviata'");
        await attendi(1500);
        partitaCorrente = 1;

        const dado = casualeConSeme(scelte.seme);
        let ultimoGiudizio = 0;
        let ultimoAttacco = 0;

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

            // 2. la partita è finita? se ne apre un'altra
            if (campione.gameOver || campione.stato !== 'partita') {
                await attendi(1200);
                if (partitaCorrente >= scelte.partite) break;
                partitaCorrente += 1;
                await nav.valuta('avviaSelezioneCPU("normale"); confermaScelta(1); confermaScelta(2); "avviata"');
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
                    const immagine = await nav.screenshotPagina(0.6);
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

module.exports = { corriUnBot, corriSciame, corriGiro, contestoInParole };
