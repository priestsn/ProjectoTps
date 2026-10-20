// tools/swarm/rapporto.js
// Dal JSONL degli eventi al rapporto leggibile. Puro: nessun accesso al disco,
// nessuna IA. Il raggruppamento è deterministico e si può provare con eventi
// finti (tools/prova_swarm_rapporto.js).

const ORDINE_GRAVITA = { bloccante: 4, grave: 3, fastidiosa: 2, cosmetica: 1, nessuna: 0 };

function nomeGravita(indice) {
    return ['nessuna', 'cosmetica', 'fastidiosa', 'grave', 'bloccante'][indice] || 'fastidiosa';
}

function pesoGravita(valore) {
    if (typeof valore === 'number') return valore;
    return ORDINE_GRAVITA[String(valore)] || 0;
}

/** Contesto in una riga: serve a riprodurre il difetto. */
function rigaContesto(contesto) {
    if (!contesto) return 'contesto non registrato';
    const p1 = contesto.p1 || {};
    const p2 = contesto.p2 || {};
    return 'timer ' + (contesto.timer === null || contesto.timer === undefined ? '?' : contesto.timer) +
        ' · P1 ' + (p1.personaggio || '?') + ' x ' + p1.x + ' vita ' + p1.vita +
        ' · P2 ' + (p2.personaggio || '?') + ' x ' + p2.x + ' vita ' + p2.vita;
}

/**
 * Raggruppa gli eventi per firma (anomalie) e per categoria (giudizi).
 * Ritorna {anomalie: [...], giudizi: [...], totaleGiudizi, costo}
 */
function raggruppa(eventi) {
    const anomalie = new Map();
    const giudizi = new Map();
    const note = new Map();
    let totaleGiudizi = 0;
    let costo = 0;

    for (const evento of eventi || []) {
        if (!evento) continue;

        if (evento.tipo === 'anomalia') {
            const chiave = evento.firma || 'senza-firma';
            if (!anomalie.has(chiave)) {
                anomalie.set(chiave, {
                    firma: chiave,
                    gravita: pesoGravita(evento.gravita),
                    messaggi: new Set(),
                    occorrenze: 0,
                    bot: new Set(),
                    primoEsempio: null
                });
            }
            const voce = anomalie.get(chiave);
            voce.occorrenze += 1;
            voce.bot.add(evento.bot);
            if (evento.messaggio) voce.messaggi.add(evento.messaggio);
            voce.gravita = Math.max(voce.gravita, pesoGravita(evento.gravita));
            if (!voce.primoEsempio) voce.primoEsempio = evento;
            continue;
        }

        if (evento.tipo === 'nota') {
            const chiave = evento.firma || 'nota';
            if (!note.has(chiave)) note.set(chiave, { firma: chiave, esempio: evento.messaggio, occorrenze: 0 });
            note.get(chiave).occorrenze += 1;
            continue;
        }

        if (evento.tipo === 'giudizio') {
            totaleGiudizi += 1;
            costo += evento.costoStimato || 0;
            if (!(evento.difetto >= 0.5) || evento.categoria === 'nessuno') continue;

            const chiave = evento.categoria + '|' + pesoGravita(evento.gravita);
            if (!giudizi.has(chiave)) {
                giudizi.set(chiave, {
                    categoria: evento.categoria,
                    gravita: pesoGravita(evento.gravita),
                    occorrenze: 0,
                    bot: new Set(),
                    primoEsempio: null
                });
            }
            const voce = giudizi.get(chiave);
            voce.occorrenze += 1;
            voce.bot.add(evento.bot);
            if (!voce.primoEsempio) voce.primoEsempio = evento;
        }
    }

    return {
        note: Array.from(note.values()),
        anomalie: Array.from(anomalie.values()).sort((a, b) =>
            b.gravita - a.gravita || b.occorrenze - a.occorrenze),
        giudizi: Array.from(giudizi.values()).sort((a, b) =>
            b.gravita - a.gravita || b.occorrenze - a.occorrenze),
        totaleGiudizi: totaleGiudizi,
        costo: costo
    };
}

/**
 * Costruisce il Markdown del rapporto.
 * opzioni: {bot, minuti, partite, build, dataLeggibile, immagineEsiste(nome) -> bool}
 */
function costruisciRapporto(eventi, opzioni) {
    const scelte = Object.assign({
        bot: 0, minuti: 0, partite: 0, build: '?',
        dataLeggibile: new Date().toLocaleString('it-IT'),
        immagineEsiste: function () { return true; },
        revisione: null      // {firma: {verdetto, compatibile, confidenza}}
    }, opzioni || {});

    // Il parere del revisore separa i difetti veri dal rumore. Senza revisione
    // restano tutti fra i difetti: meglio sembrare rumorosi che nascondere
    // qualcosa alla cieca.
    function verdettoDi(firma) {
        if (!scelte.revisione || !scelte.revisione[firma]) return null;
        return scelte.revisione[firma];
    }

    const gruppi = raggruppa(eventi);
    const righe = [];

    const modo = scelte.modo || 'sciame';
    const cosaHaFatto = (modo === 'giro')
        ? 'giro delle schermate'
        : (scelte.minuti + ' minuti, ' + scelte.partite + ' partite');

    righe.push('# ' + (modo === 'giro' ? 'Giro schermate ' : 'Swarm ') + scelte.dataLeggibile +
        ' — ' + scelte.bot + ' bot, ' + cosaHaFatto);
    righe.push('');
    righe.push('- Bot: ' + scelte.bot + ' | ' + cosaHaFatto);
    righe.push('- Chiamate a Jev: ' + gruppi.totaleGiudizi + ' (costo stimato $' +
        gruppi.costo.toFixed(4) + ')');
    righe.push('- Versione giocata: build ' + scelte.build);
    righe.push('');

    const godibilita = valutaGodibilita(eventi);
    const testoGodibilita = sezioneGodibilita(godibilita);
    if (testoGodibilita) {
        righe.push(testoGodibilita);
    }

    if (!gruppi.anomalie.length && !gruppi.giudizi.length) {
        righe.push('## Nessun difetto rilevato');
        righe.push('');
        righe.push(modo === 'giro'
            ? 'Ogni schermata si è aperta, ha un pulsante di ritorno e Escape riporta al menu.'
            : 'Le sonde non hanno segnalato anomalie e il giudice non ha visto difetti grafici. ' +
              'Vale per le ' + scelte.partite + ' partite giocate: non è una garanzia sul resto del gioco.');
        righe.push('');

        if (gruppi.note && gruppi.note.length) {
            righe.push('## Note');
            righe.push('');
            for (const nota of gruppi.note) {
                righe.push('- **' + nota.firma + '** (' + nota.occorrenze + '×): ' + nota.esempio);
            }
        }

        return righe.join('\n') + '\n';
    }

    if (gruppi.anomalie.length) {
        const confermati = [];
        const archiviati = [];

        for (const voce of gruppi.anomalie) {
            const verdetto = verdettoDi(voce.firma);
            if (verdetto && verdetto.verdetto === 'rumore') archiviati.push(voce);
            else confermati.push(voce);
        }

        if (scelte.revisione) {
            righe.push('## Dopo la revisione: ' + confermati.length + ' difetti da guardare, ' +
                archiviati.length + ' archiviati come rumore');
            righe.push('');
        }

        if (confermati.length) {
            righe.push('## Difetti delle sonde (' + confermati.length + ' firme)');
            righe.push('');
            let indice = 1;
            for (const voce of confermati) {
                const verdetto = verdettoDi(voce.firma);
                righe.push('### ' + (indice++) + '. ' + voce.firma + ' — ' + voce.occorrenze +
                    ' volte su ' + voce.bot.size + ' bot — ' + nomeGravita(voce.gravita));
                for (const messaggio of Array.from(voce.messaggi).slice(0, 3)) {
                    righe.push('- ' + messaggio);
                }
                if (voce.primoEsempio) {
                    righe.push('- Contesto: ' + rigaContesto(voce.primoEsempio.contesto) +
                        ' (bot ' + voce.primoEsempio.bot + ', partita ' + voce.primoEsempio.partita + ')');
                }
                if (verdetto) {
                    righe.push('- Revisione: **' + verdetto.verdetto + '** (confidenza ' +
                        (verdetto.confidenza + 1) + '/5, spiegabile dalle regole: ' +
                        (verdetto.compatibile >= 0.5 ? 'sì' : 'no') + ')');
                }
                righe.push('');
            }
        }

        if (archiviati.length) {
            righe.push('## Archiviati come rumore (' + archiviati.length + ' firme)');
            righe.push('');
            for (const voce of archiviati) {
                const verdetto = verdettoDi(voce.firma);
                righe.push('- **' + voce.firma + '** — ' + voce.occorrenze + ' volte · ' +
                    (verdetto ? 'confidenza ' + (verdetto.confidenza + 1) + '/5' : 'nessun verdetto'));
            }
            righe.push('');
        }
    }

    if (gruppi.giudizi.length) {
        righe.push('## Difetti visti da Jev (' + gruppi.giudizi.length + ' gruppi)');
        righe.push('');
        let indice = 1;
        for (const voce of gruppi.giudizi) {
            righe.push('### ' + (indice++) + '. ' + voce.categoria + ' — gravità ' + voce.gravita +
                ' — ' + voce.occorrenze + ' segnalazioni');
            if (voce.primoEsempio) {
                righe.push('- Immagine: ' + (voce.primoEsempio.immagine
                    ? (scelte.immagineEsiste(voce.primoEsempio.immagine)
                        ? voce.primoEsempio.immagine
                        : voce.primoEsempio.immagine + ' (immagine mancante)')
                    : 'non salvata'));
                righe.push('- Contesto: ' + rigaContesto(voce.primoEsempio.contesto) +
                    ' (bot ' + voce.primoEsempio.bot + ', partita ' + voce.primoEsempio.partita + ')');
            }
            righe.push('');
        }
    }

    if (gruppi.note && gruppi.note.length) {
        righe.push('## Note (comportamenti voluti, registrati per memoria)');
        righe.push('');
        for (const nota of gruppi.note) {
            righe.push('- **' + nota.firma + '** (' + nota.occorrenze + '×): ' + nota.esempio);
        }
        righe.push('');
    }

    righe.push('---');
    righe.push('');
    righe.push('Le sonde sono oggettive (eccezioni, ritmo del ciclo, azioni perse, valori fuori ' +
        'scala). I giudizi di Jev sulle immagini sono indicativi: vanno guardati prima di aprire un ' +
        'bug, perché l\'interfaccia di questo gioco è molto colorata e somiglia a un guasto.');

    return righe.join('\n') + '\n';
}


// ========================================
// Godibilità: le partite raccontano il gioco
// ==========================================
// Le sonde dicono se qualcosa è rotto. Queste misure dicono se il gioco è
// godibile: quanto durano le partite, quanti colpi si scambiano al minuto, se
// gli scontri sono equilibrati, se si vedono verdellinesi diversi, quante
// ultimate entrano in gioco. Sono numeri, non opinioni: un giudice che dice
// "non è divertente" non serve a nessuno.

const SOGLIE_GODIBILITA = {
    durataCortaSec: 25,        // sotto: le partite finiscono troppo in fretta
    durataLungaSec: 52,        // sopra: quasi tutte decise dal tempo
    colpiMinLenti: 5,
    colpiMinFrenetici: 45,
    sbilanciamento: 0.68,      // oltre questa quota di vittorie da un lato
    varietaMinima: 4           // verdellinesi diversi su almeno 10 partite
};

function mediana(numeri) {
    const ordinati = numeri.slice().sort((a, b) => a - b);
    if (!ordinati.length) return 0;
    const mezzo = Math.floor(ordinati.length / 2);
    return ordinati.length % 2 ? ordinati[mezzo] : (ordinati[mezzo - 1] + ordinati[mezzo]) / 2;
}

/**
 * Riassume le partite: durata, ritmo dei colpi, equilibrio, varietà.
 * Ritorna {partite, durataMedia, durataMediana, colpiAlMinuto, ...} e una lista
 * di osservazioni scritte in italiano.
 */
function valutaGodibilita(eventi) {
    const partite = (eventi || []).filter((evento) => evento && evento.tipo === 'metriche');
    const giudizi = (eventi || []).filter((evento) => evento && evento.tipo === 'giudizio');
    if (!partite.length) {
        return { partite: 0, osservazioni: [], verdellinesi: [], riassunto: 'nessuna partita misurata' };
    }

    const durate = partite.map((p) => p.durataSec || 0).filter((d) => d > 0);
    const colpi = partite.map((p) => (p.colpiP1 || 0) + (p.colpiP2 || 0));
    const totaliColpi = colpi.reduce((s, c) => s + c, 0);
    const totaliSecondi = durate.reduce((s, d) => s + d, 0);
    const finale = partite.map((p) => p.vitaFinale || [null, null]);

    const esiti = { p1: 0, p2: 0, pari: 0, sconosciuto: 0 };
    for (const p of partite) esiti[p.esito || 'sconosciuto'] = (esiti[p.esito || 'sconosciuto'] || 0) + 1;

    const decise = esiti.p1 + esiti.p2;
    const quotaPiuAlta = decise ? Math.max(esiti.p1, esiti.p2) / decise : 0.5;

    const pareggi = partite.filter((p) => p.esito === 'pari').length;
    const perTempo = partite.filter((p) => p.finitaPerTempo).length;
    const ultimate = partite.reduce((s, p) => s + (p.ultimateP1 || 0) + (p.ultimateP2 || 0), 0);

    const verdellinesi = [];
    for (const p of partite) {
        for (const nome of (p.verdellinesi || [])) {
            if (nome && verdellinesi.indexOf(nome) === -1) verdellinesi.push(nome);
        }
    }

    const durataMedia = durate.length ? totaliSecondi / durate.length : 0;
    const colpiAlMinuto = totaliSecondi ? (totaliColpi / totaliSecondi) * 60 : 0;

    // leggibilità: quanto spesso, guardando una schermata, si capisce chi
    // attacca — misurata da Jev su campioni sparsi, non su tutte le partite
    const conGiudizio = giudizi.filter((g) => typeof g.siCapisce === 'number' && g.siCapisce > 0);
    const leggibili = conGiudizio.filter((g) => g.siCapisce >= 0.5).length;
    const affollamenti = giudizi.filter((g) => typeof g.affollamento === 'number').map((g) => g.affollamento);
    const affollamentoMedio = affollamenti.length
        ? affollamenti.reduce((s, a) => s + a, 0) / affollamenti.length : null;

    const osservazioni = [];

    if (conGiudizio.length >= 5) {
        const quota = leggibili / conGiudizio.length;
        if (quota < 0.6) {
            osservazioni.push('Schermate difficili da leggere: in ' + Math.round((1 - quota) * 100) +
                '% dei campioni non si capisce chi sta attaccando');
        }
        if (affollamentoMedio !== null && affollamentoMedio >= 3.4) {
            osservazioni.push('Schermo troppo denso (affollamento ' + affollamentoMedio.toFixed(1) +
                ' su 4): effetti e interfaccia si sovrappongono alla lettura del combattimento');
        }
        if (affollamentoMedio !== null && affollamentoMedio <= 1.2) {
            osservazioni.push('Schermo troppo vuoto (affollamento ' + affollamentoMedio.toFixed(1) +
                ' su 4): la scena non comunica energia');
        }
    }
    if (durataMedia && durataMedia < SOGLIE_GODIBILITA.durataCortaSec) {
        osservazioni.push('Partite corte (media ' + Math.round(durataMedia) + ' s): il combattimento non fa in tempo a scaldarsi');
    }
    if (durataMedia > SOGLIE_GODIBILITA.durataLungaSec) {
        osservazioni.push('Partite lunghe (media ' + Math.round(durataMedia) + ' s), ' + perTempo + ' su ' +
            partite.length + ' decise dal tempo invece che dal K.O.');
    }
    if (colpiAlMinuto && colpiAlMinuto < SOGLIE_GODIBILITA.colpiMinLenti) {
        osservazioni.push('Pochi colpi al minuto (' + Math.round(colpiAlMinuto) + '): si sta più fermi che a combattere');
    }
    if (colpiAlMinuto > SOGLIE_GODIBILITA.colpiMinFrenetici) {
        osservazioni.push('Molti colpi al minuto (' + Math.round(colpiAlMinuto) + '): ritmo frenetico, difficile leggere la partita');
    }
    if (decise >= 6 && quotaPiuAlta > SOGLIE_GODIBILITA.sbilanciamento) {
        osservazioni.push('Scontri sbilanciati: ' + Math.round(quotaPiuAlta * 100) + '% delle partite decise dallo stesso lato');
    }
    if (partite.length >= 10 && verdellinesi.length < SOGLIE_GODIBILITA.varietaMinima) {
        osservazioni.push('Poca varietà: solo ' + verdellinesi.length + ' verdellinesi diversi su ' + partite.length + ' partite');
    }
    if (pareggi > partite.length * 0.4) {
        osservazioni.push('Molti pareggi (' + pareggi + ' su ' + partite.length + '): fine partita che non conclude');
    }

    return {
        partite: partite.length,
        durataMedia: Math.round(durataMedia * 10) / 10,
        durataMediana: Math.round(mediana(durate) * 10) / 10,
        colpiAlMinuto: Math.round(colpiAlMinuto * 10) / 10,
        colpiTotali: totaliColpi,
        esiti: esiti,
        quotaVittorie: Math.round(quotaPiuAlta * 100),
        decisePerTempo: perTempo,
        ultimateTotali: ultimate,
        verdellinesi: verdellinesi,
        leggibilita: conGiudizio.length ? Math.round((leggibili / conGiudizio.length) * 100) : null,
        campioniLetti: conGiudizio.length,
        affollamentoMedio: affollamentoMedio === null ? null : Math.round(affollamentoMedio * 10) / 10,
        osservazioni: osservazioni,
        riassunto: osservazioni.length ? osservazioni.join('; ') : 'nessun segnale negativo dai numeri'
    };
}

/**
 * Testo Markdown della sezione godibilità.
 */
function sezioneGodibilita(valutazione) {
    if (!valutazione.partite) return '';

    const righe = [];
    righe.push('## Godibilità (misurata su ' + valutazione.partite + ' partite)');
    righe.push('');
    righe.push('- Durata: media **' + valutazione.durataMedia + ' s**, mediana ' + valutazione.durataMediana + ' s');
    righe.push('- Colpi scambiati: **' + valutazione.colpiAlMinuto + ' al minuto** (' + valutazione.colpiTotali +
        ' totali)');
    righe.push('- Esiti: ' + valutazione.esiti.p1 + ' a sinistra, ' + valutazione.esiti.p2 + ' a destra, ' +
        valutazione.esiti.pari + ' pari · ' + valutazione.decisePerTempo + ' finite per tempo');
    righe.push('- Ultimate usate: ' + valutazione.ultimateTotali +
        ' · verdellinesi diversi: ' + valutazione.verdellinesi.length);
    if (valutazione.leggibilita !== null) {
        righe.push('- Leggibilità (Jev su ' + valutazione.campioniLetti + ' campioni): **' +
            valutazione.leggibilita + '%** delle schermate si capiscono · affollamento medio ' +
            valutazione.affollamentoMedio + '/4');
    }
    righe.push('');

    if (valutazione.osservazioni.length) {
        righe.push('**Cosa non torna:**');
        for (const osservazione of valutazione.osservazioni) righe.push('- ' + osservazione);
    } else {
        righe.push('**Nessun segnale negativo dai numeri.**');
    }
    righe.push('');
    return righe.join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        costruisciRapporto, raggruppa, rigaContesto, nomeGravita, pesoGravita,
        valutaGodibilita, sezioneGodibilita, SOGLIE_GODIBILITA
    };
}
