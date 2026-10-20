// tools/swarm/navigatore.js
// Client CDP minimale per pilotare un Chrome tutto suo. Niente dipendenze:
// Node 22 ha WebSocket e http globali, che bastano.
//
// Perché un Chrome per bot e non N schede nello stesso browser:
// requestAnimationFrame non gira in una scheda in secondo piano
// (document.visibilityState === 'hidden'), e Page.bringToFront ne rende
// visibile una sola per volta. Con le schede, i bot fermi sembrano un bug del
// gioco.

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// Tasti fisici: Input.dispatchKeyEvent vuole key, code e i codici virtuali,
// non basta il carattere. Sono quelli predefiniti di js/Keybinds.js per P1.
const TASTI = {
    a: { key: 'a', code: 'KeyA', vk: 65 },
    d: { key: 'd', code: 'KeyD', vk: 68 },
    w: { key: 'w', code: 'KeyW', vk: 87 },
    h: { key: 'h', code: 'KeyH', vk: 72 },
    j: { key: 'j', code: 'KeyJ', vk: 74 },
    g: { key: 'g', code: 'KeyG', vk: 71 },
    Escape: { key: 'Escape', code: 'Escape', vk: 27 },
    Enter: { key: 'Enter', code: 'Enter', vk: 13 }
};

function attendi(ms) {
    return new Promise((risolvi) => setTimeout(risolvi, ms));
}

/** GET su 127.0.0.1:<porta> e parse del JSON. */
function chiediJson(porta, percorso) {
    return new Promise((risolvi, rifiuta) => {
        const richiesta = http.get({ host: '127.0.0.1', port: porta, path: percorso, timeout: 4000 }, (risposta) => {
            let corpo = '';
            risposta.on('data', (pezzo) => { corpo += pezzo; });
            risposta.on('end', () => {
                try { risolvi(JSON.parse(corpo)); } catch (errore) { rifiuta(errore); }
            });
        });
        richiesta.on('error', rifiuta);
        richiesta.on('timeout', () => richiesta.destroy(new Error('timeout CDP')));
    });
}

/**
 * Apre un Chrome headless con profilo temporaneo e si collega alla sua scheda.
 * opzioni: {porta, url, larghezza, altezza, attesaCaricamentoMs}
 */
async function apriNavigatore(opzioni) {
    const scelte = Object.assign({
        porta: 9400,
        url: 'about:blank',
        larghezza: 1280,
        altezza: 800,
        attesaCaricamentoMs: 3500
    }, opzioni || {});

    if (!fs.existsSync(CHROME)) {
        throw new Error('Chrome non trovato in ' + CHROME + ' (imposta la variabile CHROME)');
    }

    const profilo = fs.mkdtempSync(path.join(os.tmpdir(), 'uvsf7-bot-'));
    const processo = spawn(CHROME, [
        '--headless=new',
        '--remote-debugging-port=' + scelte.porta,
        '--remote-allow-origins=*',
        '--user-data-dir=' + profilo,
        '--window-size=' + scelte.larghezza + ',' + scelte.altezza,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-sync',
        '--mute-audio',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-features=CalculateNativeWinOcclusion',
        'about:blank'
    ], { stdio: 'ignore' });

    let versione = null;
    for (let giro = 0; giro < 80 && !versione; giro++) {
        try { versione = await chiediJson(scelte.porta, '/json/version'); } catch (errore) { await attendi(200); }
    }
    if (!versione) {
        try { processo.kill(); } catch (errore) { /* niente */ }
        fs.rmSync(profilo, { recursive: true, force: true });
        throw new Error('Chrome non ha aperto il debugger sulla porta ' + scelte.porta);
    }

    const schede = await chiediJson(scelte.porta, '/json/list');
    const scheda = schede.find((voce) => voce.type === 'page');
    if (!scheda) throw new Error('nessuna scheda disponibile sulla porta ' + scelte.porta);

    const socket = new WebSocket(scheda.webSocketDebuggerUrl);
    await new Promise((risolvi, rifiuta) => {
        socket.onopen = risolvi;
        socket.onerror = () => rifiuta(new Error('WebSocket CDP rifiutato'));
    });

    let contatore = 0;
    const attese = new Map();

    socket.onmessage = (evento) => {
        let messaggio = null;
        try { messaggio = JSON.parse(evento.data); } catch (errore) { return; }
        if (messaggio.id && attese.has(messaggio.id)) {
            const risolvi = attese.get(messaggio.id);
            attese.delete(messaggio.id);
            risolvi(messaggio);
        }
    };

    /** Invia un comando CDP e aspetta la risposta con lo stesso id. */
    function invia(metodo, parametri) {
        const id = ++contatore;
        return new Promise((risolvi) => {
            attese.set(id, risolvi);
            socket.send(JSON.stringify({ id: id, method: metodo, params: parametri || {} }));
        });
    }

    /** Valuta un'espressione nella pagina e torna il valore. */
    async function valuta(espressione) {
        const risposta = await invia('Runtime.evaluate', {
            expression: espressione,
            returnByValue: true,
            awaitPromise: true,
            userGesture: true
        });
        if (risposta.result && risposta.result.exceptionDetails) {
            const dettaglio = risposta.result.exceptionDetails;
            throw new Error('eccezione nella pagina: ' + (dettaglio.text || '') + ' ' +
                ((dettaglio.exception && dettaglio.exception.description) || ''));
        }
        return risposta.result && risposta.result.result ? risposta.result.result.value : undefined;
    }

    /** Preme un tasto fisico e lo rilascia dopo durataMs. */
    async function premiTasto(tasto, durataMs) {
        const info = TASTI[tasto] || { key: tasto, code: tasto, vk: tasto.toUpperCase().charCodeAt(0) };
        await invia('Input.dispatchKeyEvent', {
            type: 'keyDown', key: info.key, code: info.code,
            windowsVirtualKeyCode: info.vk, nativeVirtualKeyCode: info.vk
        });
        await attendi(durataMs === undefined ? 80 : durataMs);
        await invia('Input.dispatchKeyEvent', {
            type: 'keyUp', key: info.key, code: info.code,
            windowsVirtualKeyCode: info.vk, nativeVirtualKeyCode: info.vk
        });
    }

    /** Preme più tasti insieme (es. destra + attacco). */
    async function premiTasti(tasti, durataMs) {
        const elenco = (tasti || []).map((tasto) => TASTI[tasto] || { key: tasto, code: tasto, vk: 0 });
        for (const info of elenco) {
            await invia('Input.dispatchKeyEvent', {
                type: 'keyDown', key: info.key, code: info.code,
                windowsVirtualKeyCode: info.vk, nativeVirtualKeyCode: info.vk
            });
        }
        await attendi(durataMs === undefined ? 80 : durataMs);
        for (const info of elenco) {
            await invia('Input.dispatchKeyEvent', {
                type: 'keyUp', key: info.key, code: info.code,
                windowsVirtualKeyCode: info.vk, nativeVirtualKeyCode: info.vk
            });
        }
    }

    /**
     * Gli elementi cliccabili che corrispondono a un selettore, con il loro
     * rettangolo e se il centro è davvero raggiungibile dal mouse.
     * `raggiungibile` è falso se qualcosa li copre (elementFromPoint restituisce
     * un altro nodo) o se stanno fuori dalla finestra: sono i casi in cui un
     * pulsante "esiste" ma il giocatore non lo può premere.
     */
    async function scatole(selettore) {
        const espressione = '(function(){' +
            'var elenco = Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(selettore) + '));' +
            'return JSON.stringify(elenco.map(function (el) {' +
            '  var r = el.getBoundingClientRect();' +
            '  var cx = r.left + r.width / 2, cy = r.top + r.height / 2;' +
            '  var sopra = null;' +
            '  try { sopra = document.elementFromPoint(cx, cy); } catch (e) {}' +
            '  return {' +
            '    testo: (el.innerText || el.textContent || "").trim().slice(0, 60),' +
            '    x: Math.round(cx), y: Math.round(cy),' +
            '    larghezza: Math.round(r.width), altezza: Math.round(r.height),' +
            '    disegnato: r.width > 2 && r.height > 2,' +
            '    dentroFinestra: r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth,' +
            '    raggiungibile: !!sopra && (sopra === el || el.contains(sopra)),' +
            '    copertoDa: (sopra && !(sopra === el || el.contains(sopra)))' +
            '      ? (sopra.tagName.toLowerCase() + (sopra.id ? "#" + sopra.id : "")) : null' +
            '  };' +
            '}));})()';
        const grezzo = await valuta(espressione);
        try { return JSON.parse(grezzo || '[]'); } catch (errore) { return []; }
    }

    /** Un clic vero del mouse in un punto (pressione + rilascio). */
    async function cliccaPunto(x, y) {
        const base = { x: Math.round(x), y: Math.round(y), button: 'left', buttons: 1, clickCount: 1 };
        await invia('Input.dispatchMouseEvent', Object.assign({ type: 'mouseMoved', buttons: 0 }, base));
        await invia('Input.dispatchMouseEvent', Object.assign({ type: 'mousePressed' }, base));
        await attendi(40);
        await invia('Input.dispatchMouseEvent', Object.assign({ type: 'mouseReleased' }, base));
    }

    /**
     * Clicca l'elemento il cui testo contiene `testo`.
     * Ritorna {esito: 'cliccato'|'assente'|'coperto'|'fuori', testo, copertoDa}.
     */
    async function cliccaTesto(selettore, testo) {
        const cercato = String(testo).toUpperCase();

        // nell'area di gioco stanno TUTTE le schermate insieme: quelle spente
        // hanno rettangolo 0x0 e vanno scartate, altrimenti si cerca di cliccare
        // il pulsante invisibile di un'altra schermata
        const elenco = (await scatole(selettore))
            .filter((voce) => voce.disegnato && voce.testo.toUpperCase().indexOf(cercato) !== -1);

        let trovato = elenco.find((voce) => voce.dentroFinestra && voce.raggiungibile) || elenco[0];

        if (!trovato) return { esito: 'assente', testo: null, copertoDa: null };

        // Se l'elemento esiste ma sta fuori dalla finestra, un giocatore
        // scorrerebbe: si prova a portarlo in vista e si ricontrolla. Solo se
        // resta irraggiungibile è un difetto.
        if (!trovato.dentroFinestra) {
            await valuta(
                '(function(){var elenco=Array.prototype.slice.call(document.querySelectorAll(' +
                JSON.stringify(selettore) + '));var cercato=' + JSON.stringify(cercato) + ';' +
                'for (var i = 0; i < elenco.length; i++) {' +
                '  var r = elenco[i].getBoundingClientRect();' +
                '  if (r.width <= 2 || r.height <= 2) continue;' +
                '  if ((elenco[i].innerText || "").toUpperCase().indexOf(cercato) === -1) continue;' +
                '  elenco[i].scrollIntoView({block: "center", behavior: "instant"}); return "scorso";' +
                '} return "niente";})()'
            );
            await attendi(250);
            const dopo = (await scatole(selettore))
                .filter((voce) => voce.disegnato && voce.testo.toUpperCase().indexOf(cercato) !== -1);
            const ricercato = dopo.find((voce) => voce.dentroFinestra && voce.raggiungibile) || dopo[0];
            if (ricercato) {
                trovato = ricercato;
                trovato.haScrollato = true;
            }
        }
        if (!trovato.dentroFinestra) return { esito: 'fuori', testo: trovato.testo, copertoDa: null };
        if (!trovato.raggiungibile) return { esito: 'coperto', testo: trovato.testo, copertoDa: trovato.copertoDa };

        await cliccaPunto(trovato.x, trovato.y);
        return { esito: 'cliccato', testo: trovato.testo, copertoDa: null, scrollato: !!trovato.haScrollato };
    }

    /**
     * PNG dell'INTERA PAGINA (canvas + HUD), in base64.
     * Serve per il giudice: la barra della vita e il timer sono elementi DOM,
     * non disegnati sul canvas, quindi una cattura del solo canvas li perde
     * (scoperto guardando il primo screenshot: "non c'è nessuna interfaccia").
     */
    async function screenshotPagina(scala) {
        const fattore = Number(scala || 1);
        const risposta = await invia('Page.captureScreenshot', {
            format: 'png',
            fromSurface: true,
            captureBeyondViewport: false,
            scale: fattore
        });
        return (risposta.result && risposta.result.data) || null;
    }

    /**
     * PNG del canvas ridotto a una larghezza massima, in base64.
     * Serve per Jev: uno screenshot intero è ~1,4 MB, ridotto a 640 px costa
     * un ventesimo di token e resta leggibile per giudicare l'aspetto.
     */
    async function screenshotRidotto(larghezzaMassima) {
        const larghezza = Number(larghezzaMassima || 640);
        const dati = await valuta(
            "(function(){var c=document.querySelector('canvas');if(!c)return null;" +
            'var k=Math.min(1,' + larghezza + '/c.width);' +
            'var t=document.createElement("canvas");t.width=Math.round(c.width*k);' +
            't.height=Math.round(c.height*k);var x=t.getContext("2d");' +
            'x.imageSmoothingEnabled=false;x.drawImage(c,0,0,t.width,t.height);' +
            "return t.toDataURL('image/png').split(',')[1];})()"
        );
        return dati || null;
    }

    /** PNG del canvas in base64, senza il prefisso data: */
    async function screenshotPng() {
        const dati = await valuta(
            "(function(){var c=document.querySelector('canvas');" +
            "return c ? c.toDataURL('image/png').split(',')[1] : null;})()"
        );
        return dati || null;
    }

    await invia('Page.enable');
    await invia('Runtime.enable');

    if (scelte.url && scelte.url !== 'about:blank') {
        await invia('Page.navigate', { url: scelte.url });
        await attendi(scelte.attesaCaricamentoMs);
    }

    /** Chiude socket, processo e cartella del profilo. */
    function chiudi() {
        try { socket.close(); } catch (errore) { /* niente */ }
        try { processo.kill(); } catch (errore) { /* niente */ }
        // il profilo si cancella dopo un attimo: su Windows Chrome tiene i file aperti
        setTimeout(() => {
            try { fs.rmSync(profilo, { recursive: true, force: true }); } catch (errore) { /* niente */ }
        }, 1500);
    }

    return {
        processo: processo,
        profilo: profilo,
        porta: scelte.porta,
        invia: invia,
        valuta: valuta,
        premiTasto: premiTasto,
        premiTasti: premiTasti,
        screenshotPng: screenshotPng,
        screenshotRidotto: screenshotRidotto,
        screenshotPagina: screenshotPagina,
        scatole: scatole,
        cliccaPunto: cliccaPunto,
        cliccaTesto: cliccaTesto,
        chiudi: chiudi
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { apriNavigatore, TASTI };
}
