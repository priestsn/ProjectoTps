// ========================================
// Report bug
// ==========================================
// Pannello richiamabile con R in qualsiasi momento. I report sono salvati
// in localStorage (sopravvivono al ricaricamento) e possono essere esportati
// come Markdown da incollare in bugs.md.
//
// Il pannello mette in pausa il game loop e il timer: il contesto allegato
// corrisponde all'istante in cui è stato aperto.

const CHIAVE_REPORT_BUG = 'uvsf7-report-bug';

/**
 * Legge i report salvati, ignorando dati corrotti
 */
function leggiReport() {
    try {
        const dati = JSON.parse(localStorage.getItem(CHIAVE_REPORT_BUG));
        return Array.isArray(dati) ? dati : [];
    } catch (errore) {
        return [];
    }
}

/**
 * Salva l'elenco dei report in localStorage
 */
function scriviReport(report) {
    localStorage.setItem(CHIAVE_REPORT_BUG, JSON.stringify(report));
}

/**
 * Riepilogo compatto di un lottatore, utile per riprodurre il bug
 */
function riassuntoLottatore(lottatore) {
    return {
        personaggio: lottatore.personaggio ? lottatore.personaggio.id : null,
        x: Math.round(lottatore.position.x),
        y: Math.round(lottatore.position.y),
        vita: Math.round(lottatore.health),
        stamina: Math.round(lottatore.stamina),
        ultimate: Math.round(lottatore.ultimate),
        attacco: lottatore.isAttacking,
        parata: lottatore.isParata,
        stun: lottatore.isStunned,
        frame: lottatore.framesCurrent + '/' + (lottatore.framesMax - 1)
    };
}

/**
 * Fotografia dello stato di gioco al momento del report
 */
function contestoReport() {
    const contesto = {
        stato: statoCorrente,
        modalita: modalitaPartita,
        difficolta: modalitaPartita === MODALITA.CPU ? difficoltaCPU : null
    };

    try {
        if (typeof timer !== 'undefined') contesto.timer = timer;
        if (typeof lastKey !== 'undefined') contesto.ultimoTastoP1 = lastKey || null;
        if (typeof hitboxVisibili !== 'undefined') contesto.hitboxVisibili = hitboxVisibili;
        if (typeof Player !== 'undefined' && Player) contesto.p1 = riassuntoLottatore(Player);
        if (typeof Enemy !== 'undefined' && Enemy) contesto.p2 = riassuntoLottatore(Enemy);
    } catch (errore) {
        contesto.erroreContesto = String(errore);
    }

    return contesto;
}

/**
 * Formatta un report in Markdown
 */
function formattaReport(report) {
    const c = report.contesto || {};
    const righe = [];

    righe.push('## Report ' + report.dataLeggibile);
    righe.push('');
    righe.push('- Stato: ' + (c.stato || 'sconosciuto'));
    righe.push('- Modalità: ' + (c.modalita || 'sconosciuta') +
        (c.difficolta ? ' (' + c.difficolta + ')' : ''));

    if (typeof c.timer !== 'undefined') {
        righe.push('- Timer: ' + c.timer);
    }
    if (c.ultimoTastoP1) {
        righe.push('- Ultimo tasto P1: ' + c.ultimoTastoP1);
    }
    if (c.hitboxVisibili) {
        righe.push('- Hitbox visibili: sì');
    }

    if (c.p1) {
        righe.push('- P1: ' + descriviLottatore(c.p1));
    }
    if (c.p2) {
        righe.push('- P2: ' + descriviLottatore(c.p2));
    }
    if (c.erroreContesto) {
        righe.push('- Errore nel contesto: ' + c.erroreContesto);
    }

    righe.push('');
    righe.push('**Descrizione:**');
    righe.push(report.testo);

    return righe.join('\n');
}

/**
 * Riga leggibile per un lottatore
 */
function descriviLottatore(l) {
    return (l.personaggio || '?') +
        ' | x ' + l.x + ' y ' + l.y +
        ' | vita ' + l.vita +
        ' | stamina ' + l.stamina +
        ' | ult ' + l.ultimate + '%' +
        ' | attacco ' + (l.attacco ? 'sì' : 'no') +
        ' | parata ' + (l.parata ? 'sì' : 'no') +
        ' | stun ' + (l.stun ? 'sì' : 'no') +
        ' | frame ' + l.frame;
}

/**
 * Mostra un messaggio nello stato del pannello
 */
function mostraStatoReport(testo, colore) {
    const stato = document.querySelector('#reportStato');
    stato.textContent = testo;
    stato.style.color = colore || '#9adf9a';
}

/**
 * Apre il pannello e mette in pausa il gioco
 */
function apriReport() {
    reportAperto = true;
    document.querySelector('#reportBug').classList.add('aperto');

    const reports = leggiReport();
    mostraStatoReport('Report salvati: ' + reports.length, '#9adf9a');

    const testo = document.querySelector('#reportTesto');
    testo.focus();
}

/**
 * Chiude il pannello e riprende il gioco
 */
function chiudiReport() {
    reportAperto = false;
    document.querySelector('#reportBug').classList.remove('aperto');
    document.querySelector('#reportTesto').blur();
}

/**
 * Salva il report corrente con il contesto di gioco
 */
function salvaReportCorrente() {
    const area = document.querySelector('#reportTesto');
    const testo = area.value.trim();

    if (!testo) {
        mostraStatoReport('Scrivi prima una descrizione del problema.', '#ff8a8a');
        area.focus();
        return;
    }

    const adesso = new Date();
    const report = {
        data: adesso.toISOString(),
        dataLeggibile: adesso.toLocaleString('it-IT'),
        testo: testo,
        contesto: contestoReport()
    };

    const reports = leggiReport();
    reports.push(report);
    scriviReport(reports);

    area.value = '';
    mostraStatoReport('Report salvato. Totale: ' + reports.length, '#9adf9a');
    area.focus();
}

/**
 * Testo Markdown con tutti i report salvati
 */
function markdownReport(reports) {
    return '# Report bug — ' + new Date().toLocaleDateString('it-IT') + '\n\n' +
        reports.map(formattaReport).join('\n\n---\n\n') + '\n';
}

/**
 * Scarica tutti i report come file Markdown
 */
function esportaReport() {
    const reports = leggiReport();

    if (!reports.length) {
        mostraStatoReport('Nessun report da esportare.', '#ff8a8a');
        return;
    }

    const adesso = new Date();
    const nome = 'report-bug-' +
        adesso.getFullYear() + '-' +
        String(adesso.getMonth() + 1).padStart(2, '0') + '-' +
        String(adesso.getDate()).padStart(2, '0') + '_' +
        String(adesso.getHours()).padStart(2, '0') +
        String(adesso.getMinutes()).padStart(2, '0') + '.md';

    const blob = new Blob([markdownReport(reports)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nome;
    link.click();
    URL.revokeObjectURL(url);

    mostraStatoReport('Esportati ' + reports.length + ' report in ' + nome, '#9adf9a');
}

/**
 * Copia tutti i report negli appunti
 */
async function copiaReport() {
    const reports = leggiReport();

    if (!reports.length) {
        mostraStatoReport('Nessun report da copiare.', '#ff8a8a');
        return;
    }

    try {
        await navigator.clipboard.writeText(markdownReport(reports));
        mostraStatoReport('Report copiati negli appunti.', '#9adf9a');
    } catch (errore) {
        mostraStatoReport('Copia non disponibile: usa ESPORTA MD.', '#ff8a8a');
    }
}

// ========================================
// Collegamento di pulsanti e tastiera
// ==========================================
document.querySelector('#reportSalva').addEventListener('click', salvaReportCorrente);
document.querySelector('#reportEsporta').addEventListener('click', esportaReport);
document.querySelector('#reportCopia').addEventListener('click', copiaReport);
document.querySelector('#reportChiudi').addEventListener('click', chiudiReport);

// Pulsante nell'angolo del menu di pausa
document.querySelector('#pausaReport').addEventListener('click', apriReport);

window.addEventListener('keydown', (evento) => {
    // Esc chiude il pannello e riporta al menu di pausa
    if (reportAperto && evento.key === 'Escape') {
        evento.stopImmediatePropagation();
        evento.preventDefault();
        chiudiReport();
    }
});
