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
        immagineEsiste: function () { return true; }
    }, opzioni || {});

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
        righe.push('## Difetti delle sonde (' + gruppi.anomalie.length + ' firme)');
        righe.push('');
        let indice = 1;
        for (const voce of gruppi.anomalie) {
            righe.push('### ' + (indice++) + '. ' + voce.firma + ' — ' + voce.occorrenze +
                ' volte su ' + voce.bot.size + ' bot — ' + nomeGravita(voce.gravita));
            for (const messaggio of Array.from(voce.messaggi).slice(0, 3)) {
                righe.push('- ' + messaggio);
            }
            if (voce.primoEsempio) {
                righe.push('- Contesto: ' + rigaContesto(voce.primoEsempio.contesto) +
                    ' (bot ' + voce.primoEsempio.bot + ', partita ' + voce.primoEsempio.partita + ')');
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { costruisciRapporto, raggruppa, rigaContesto, nomeGravita, pesoGravita };
}
