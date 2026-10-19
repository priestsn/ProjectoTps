#!/usr/bin/env node
// ========================================
// Server di Ultra Verdello Street Fight 7
// ========================================
// Un solo processo Node, senza dipendenze npm (vedi regola in sviluppo.md):
// - serve i file del gioco (index.html, js/, css/, assets/) via HTTP
// - tiene le stanze della modalita' VS ONLINE via WebSocket
//
// Il combattimento non gira qui: l'host (chi crea la stanza) simula la partita
// nel proprio browser e manda i fotogrammi di stato all'ospite. Il server fa
// solo da ponte tra i due giocatori di ogni stanza.
//
// Avvio:  node server/server.js        (porta 80, oppure PORTA=8080)
// Stato:  GET /stato  -> JSON con stanze attive, connessioni e uptime

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { gestisciApi } = require('./api.js');

const PORTA = Number(process.env.PORTA || 80);
// Con un reverse proxy davanti (Caddy/nginx) il server resta su 127.0.0.1
const INDIRIZZO = process.env.HOST || '0.0.0.0';
const RADICE = path.resolve(__dirname, '..');
const GUID_WEBSOCKET = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// Cartelle che non devono essere servite (codice del server, git, agenti)
const CARTELLE_NASCOSTE = ['/server', '/.git', '/.github', '/bug_reports', '/node_modules', '/dati'];

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/plain; charset=utf-8'
};

// ========================================
// Stato delle stanze
// ========================================
// codice -> { padrone: Connessione, ospite: Connessione|null, creata: timestamp }
const stanze = new Map();
let connessioniTotali = 0;
const avvio = Date.now();

const LETTERE_CODICE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generaCodice() {
    for (let tentativo = 0; tentativo < 500; tentativo++) {
        let codice = '';
        for (let i = 0; i < 4; i++) {
            codice += LETTERE_CODICE[crypto.randomInt(0, LETTERE_CODICE.length)];
        }
        if (!stanze.has(codice)) {
            return codice;
        }
    }
    return null;
}

// ========================================
// Report bug inviati dal gioco
// ========================================
// I report arrivano con POST /report e finiscono in un file Markdown sul
// server, una riga per report: nessun download da parte dell'utente.
const CARTELLA_REPORT = process.env.REPORT_DIR || '/var/lib/uvsf7/reports';
const CHIAVE_REPORT = process.env.REPORT_CHIAVE || '';
const REPORT_MASSIMO_BYTE = 32768;
const REPORT_PER_IP = 20;
const REPORT_FINESTRA_MS = 10 * 60 * 1000;

const inviiReport = new Map(); // ip -> { quanti, dal }

try {
    fs.mkdirSync(CARTELLA_REPORT, { recursive: true });
} catch (errore) {
    console.error('Impossibile creare la cartella dei report:', errore.message);
}

/**
 * Nome del file del giorno, in UTC
 */
function nomeFileReport(adesso) {
    const data = adesso.toISOString().slice(0, 10);
    return 'report-' + data + '.md';
}

/**
 * Limite semplice per IP: evita che un client impazzito riempia il disco
 */
function invioConsentito(ip) {
    const adesso = Date.now();
    const stato = inviiReport.get(ip);

    if (!stato || adesso - stato.dal > REPORT_FINESTRA_MS) {
        inviiReport.set(ip, { quanti: 1, dal: adesso });
        return true;
    }

    if (stato.quanti >= REPORT_PER_IP) {
        return false;
    }

    stato.quanti++;
    return true;
}

function leggiCorpo(richiesta, limite, fatto) {
    const pezzi = [];
    let totale = 0;

    richiesta.on('data', (pezzo) => {
        totale += pezzo.length;
        if (totale > limite) {
            richiesta.destroy();
            fatto(new Error('Corpo troppo grande'), null);
            return;
        }
        pezzi.push(pezzo);
    });

    richiesta.on('end', () => fatto(null, Buffer.concat(pezzi).toString('utf8')));
    richiesta.on('error', (errore) => fatto(errore, null));
}

/**
 * POST /report — salva un report inviato dal gioco
 */
function riceviReport(richiesta, risposta) {
    const ip = richiesta.socket.remoteAddress || 'sconosciuto';

    if (!invioConsentito(ip)) {
        inviaErrore(risposta, 429, 'Troppi report: riprova piu\' tardi');
        return;
    }

    leggiCorpo(richiesta, REPORT_MASSIMO_BYTE, (errore, corpo) => {
        if (errore || !corpo) {
            inviaErrore(risposta, 400, 'Report non valido');
            return;
        }

        let dati;
        try {
            dati = JSON.parse(corpo);
        } catch (e) {
            inviaErrore(risposta, 400, 'Report non valido');
            return;
        }

        const testo = String(dati.testo || '').slice(0, 4000);
        const markdown = String(dati.markdown || '').slice(0, 20000);

        if (!testo.trim()) {
            inviaErrore(risposta, 400, 'Descrizione mancante');
            return;
        }

        const adesso = new Date();
        const file = path.join(CARTELLA_REPORT, nomeFileReport(adesso));

        const blocco = [
            '<!-- inviato il ' + adesso.toISOString() + ' da ' + ip +
                ' | ' + String(richiesta.headers['user-agent'] || '').slice(0, 200) + ' -->',
            markdown || ('## Report ' + adesso.toISOString() + '\n\n**Descrizione:**\n' + testo),
            '',
            '---',
            ''
        ].join('\n');

        fs.appendFile(file, blocco, 'utf8', (erroreScrittura) => {
            if (erroreScrittura) {
                console.error('Report non salvato:', erroreScrittura.message);
                inviaErrore(risposta, 500, 'Salvataggio non riuscito');
                return;
            }

            console.log('Report salvato in ' + file + ' da ' + ip);
            risposta.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
            risposta.end(JSON.stringify({ ok: true, file: path.basename(file) }));
        });
    });
}

/**
 * Chiave corretta per leggere i report: chi non ce l'ha non li vede
 */
function chiaveValida(richiesta) {
    if (!CHIAVE_REPORT) {
        return false;
    }
    const url = new URL(richiesta.url, 'http://localhost');
    return url.searchParams.get('chiave') === CHIAVE_REPORT;
}

/**
 * GET /reports?chiave=... — elenco dei file di report
 */
function elencoReport(richiesta, risposta) {
    if (!chiaveValida(richiesta)) {
        inviaErrore(risposta, 403, 'Chiave mancante o errata');
        return;
    }

    fs.readdir(CARTELLA_REPORT, (errore, files) => {
        if (errore) {
            inviaErrore(risposta, 500, 'Cartella dei report non leggibile');
            return;
        }

        const elenco = files
            .filter((nome) => /^report-\d{4}-\d{2}-\d{2}\.md$/.test(nome))
            .sort();

        risposta.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        risposta.end(JSON.stringify({ cartella: CARTELLA_REPORT, file: elenco }, null, 2));
    });
}

/**
 * GET /reports/file?nome=report-AAAA-MM-GG.md&chiave=... — contenuto di un file
 */
function inviaFileReport(richiesta, risposta) {
    if (!chiaveValida(richiesta)) {
        inviaErrore(risposta, 403, 'Chiave mancante o errata');
        return;
    }

    const url = new URL(richiesta.url, 'http://localhost');
    const nome = url.searchParams.get('nome') || '';

    if (!/^report-\d{4}-\d{2}-\d{2}\.md$/.test(nome)) {
        inviaErrore(risposta, 400, 'Nome file non valido');
        return;
    }

    fs.readFile(path.join(CARTELLA_REPORT, nome), 'utf8', (errore, contenuto) => {
        if (errore) {
            inviaErrore(risposta, 404, 'File non trovato');
            return;
        }
        risposta.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
        risposta.end(contenuto);
    });
}

// ========================================
// File statici
// ========================================
function inviaErrore(risposta, codiceHttp, testo) {
    risposta.writeHead(codiceHttp, { 'Content-Type': 'text/plain; charset=utf-8' });
    risposta.end(testo);
}

function gestisciRichiesta(richiesta, risposta) {
    let percorso = richiesta.url.split('?')[0];

    try {
        percorso = decodeURIComponent(percorso);
    } catch (e) {
        inviaErrore(risposta, 400, 'Richiesta non valida');
        return;
    }

    // API del gioco online: account, negozio, classifica, tornei. Parlano JSON
    // e stanno sulla stessa porta del WebSocket: un solo indirizzo, niente CORS.
    if (percorso.startsWith('/api/')) {
        gestisciApi(richiesta, risposta).catch(function (errore) {
            console.error('errore nelle API:', errore.message);
            if (!risposta.headersSent) {
                risposta.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            }
            risposta.end(JSON.stringify({ messaggio: 'Errore interno del server.' }));
        });
        return;
    }

    if (percorso === '/report' && richiesta.method === 'POST') {
        riceviReport(richiesta, risposta);
        return;
    }

    if (percorso === '/reports') {
        elencoReport(richiesta, risposta);
        return;
    }

    if (percorso === '/reports/file') {
        inviaFileReport(richiesta, risposta);
        return;
    }

    if (percorso === '/stato') {
        const elenco = [];
        for (const [codice, stanza] of stanze) {
            elenco.push({ codice: codice, ospite: stanza.ospite ? true : false, creata: stanza.creata });
        }
        risposta.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        risposta.end(JSON.stringify({
            gioco: 'Ultra Verdello Street Fight 7',
            versione: 'Fase 5 - VS ONLINE',
            uptimeSecondi: Math.round((Date.now() - avvio) / 1000),
            connessioniTotali: connessioniTotali,
            stanzeAperte: stanze.size,
            stanze: elenco
        }, null, 2));
        return;
    }

    if (percorso === '/') {
        percorso = '/index.html';
    }

    for (const cartella of CARTELLE_NASCOSTE) {
        if (percorso === cartella || percorso.startsWith(cartella + '/')) {
            inviaErrore(risposta, 404, 'Non trovato');
            return;
        }
    }

    const file = path.join(RADICE, path.normalize(percorso));

    // Nessuna richiesta puo' uscire dalla cartella del gioco
    if (!file.startsWith(RADICE)) {
        inviaErrore(risposta, 403, 'Accesso negato');
        return;
    }

    fs.stat(file, (errore, info) => {
        if (errore || !info.isFile()) {
            inviaErrore(risposta, 404, 'Non trovato');
            return;
        }

        risposta.writeHead(200, {
            'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
            'Content-Length': info.size,
            'Cache-Control': 'no-cache'
        });
        fs.createReadStream(file).pipe(risposta);
    });
}

// ========================================
// WebSocket minimo (RFC 6455, solo testo)
// ========================================
// Non serve una libreria: i messaggi sono JSON brevi e il protocollo usato
// e' solo quello dei frame di testo, piu' ping/pong e close.

function calcolaAccettazione(chiave) {
    return crypto.createHash('sha1').update(chiave + GUID_WEBSOCKET).digest('base64');
}

function creaFrameTesto(testo) {
    const dati = Buffer.from(testo, 'utf8');
    const lunghezza = dati.length;
    let intestazione;

    if (lunghezza < 126) {
        intestazione = Buffer.from([0x81, lunghezza]);
    } else if (lunghezza < 65536) {
        intestazione = Buffer.alloc(4);
        intestazione[0] = 0x81;
        intestazione[1] = 126;
        intestazione.writeUInt16BE(lunghezza, 2);
    } else {
        intestazione = Buffer.alloc(10);
        intestazione[0] = 0x81;
        intestazione[1] = 127;
        intestazione.writeBigUInt64BE(BigInt(lunghezza), 2);
    }

    return Buffer.concat([intestazione, dati]);
}

function creaFrameControllo(opcode, dati) {
    const corpo = dati || Buffer.alloc(0);
    return Buffer.concat([Buffer.from([0x80 | opcode, corpo.length]), corpo]);
}

/**
 * Legge un frame dal buffer. Restituisce null se i dati non bastano ancora,
 * altrimenti { opcode, payload, resto }.
 */
function leggiFrame(buffer) {
    if (buffer.length < 2) {
        return null;
    }

    const opcode = buffer[0] & 0x0f;
    const mascherato = (buffer[1] & 0x80) !== 0;
    let lunghezza = buffer[1] & 0x7f;
    let posizione = 2;

    if (lunghezza === 126) {
        if (buffer.length < posizione + 2) {
            return null;
        }
        lunghezza = buffer.readUInt16BE(posizione);
        posizione += 2;
    } else if (lunghezza === 127) {
        if (buffer.length < posizione + 8) {
            return null;
        }
        const grande = buffer.readBigUInt64BE(posizione);
        if (grande > BigInt(1024 * 1024)) {
            throw new Error('Frame troppo grande');
        }
        lunghezza = Number(grande);
        posizione += 8;
    }

    let maschera = null;
    if (mascherato) {
        if (buffer.length < posizione + 4) {
            return null;
        }
        maschera = buffer.subarray(posizione, posizione + 4);
        posizione += 4;
    }

    if (buffer.length < posizione + lunghezza) {
        return null;
    }

    const payload = Buffer.from(buffer.subarray(posizione, posizione + lunghezza));

    if (maschera) {
        for (let i = 0; i < payload.length; i++) {
            payload[i] ^= maschera[i % 4];
        }
    }

    return { opcode: opcode, payload: payload, resto: buffer.subarray(posizione + lunghezza) };
}

class Connessione {
    constructor(socket, indirizzo) {
        this.socket = socket;
        this.indirizzo = indirizzo;
        this.buffer = Buffer.alloc(0);
        this.chiusa = false;
        this.codiceStanza = null;
        this.ruolo = null; // 'padrone' | 'ospite'
        this.vivo = true;

        connessioniTotali++;

        socket.on('data', (pezzo) => this.ricevi(pezzo));
        socket.on('error', () => this.chiudi());
        socket.on('close', () => this.chiudi());
        socket.setNoDelay(true);
    }

    ricevi(pezzo) {
        this.buffer = Buffer.concat([this.buffer, pezzo]);

        while (true) {
            let frame;
            try {
                frame = leggiFrame(this.buffer);
            } catch (errore) {
                this.chiudi();
                return;
            }

            if (!frame) {
                return;
            }

            this.buffer = frame.resto;

            if (frame.opcode === 0x8) {
                this.chiudi();
                return;
            }
            if (frame.opcode === 0x9) {
                this.socket.write(creaFrameControllo(0xA, frame.payload));
                continue;
            }
            if (frame.opcode === 0x1 && frame.payload.length <= 65536) {
                this.messaggio(frame.payload.toString('utf8'));
            }
        }
    }

    messaggio(testo) {
        let dati;
        try {
            dati = JSON.parse(testo);
        } catch (errore) {
            return;
        }
        if (!dati || typeof dati.t !== 'string') {
            return;
        }
        gestisciMessaggio(this, dati);
    }

    invia(messaggio) {
        if (this.chiusa) {
            return;
        }
        try {
            this.socket.write(creaFrameTesto(JSON.stringify(messaggio)));
        } catch (errore) {
            this.chiudi();
        }
    }

    /**
     * L'altra connessione della stessa stanza (l'avversario)
     */
    avversario() {
        if (!this.codiceStanza) {
            return null;
        }
        const stanza = stanze.get(this.codiceStanza);
        if (!stanza) {
            return null;
        }
        return this.ruolo === 'padrone' ? stanza.ospite : stanza.padrone;
    }

    chiudi() {
        if (this.chiusa) {
            return;
        }
        this.chiusa = true;

        const altro = this.avversario();
        if (altro && !altro.chiusa) {
            altro.invia({ t: 'avversarioUscito' });
        }

        if (this.codiceStanza) {
            const stanza = stanze.get(this.codiceStanza);
            if (stanza) {
                if (stanza.padrone === this) {
                    stanze.delete(this.codiceStanza);
                } else {
                    stanza.ospite = null;
                }
            }
            this.codiceStanza = null;
        }

        try {
            this.socket.end();
        } catch (errore) {
            // socket gia' chiuso
        }
    }
}

// ========================================
// Messaggi del gioco
// ========================================
// Client -> server:  crea | entra | scelta | avvia | tasto | fotogramma | esci
// Server -> client:  creata | entrato | errore | avversario | avversarioUscito
// Il server inoltra al compagno di stanza tutto quello che non gestisce.

/**
 * Nome da mostrare all'altro giocatore: solo testo, massimo 24 caratteri.
 * Non è un dato di fiducia, serve solo a leggere con chi si gioca.
 */
function pulisciNome(nome) {
    const testo = String(nome || '').replace(/[\r\n\t]/g, ' ').trim().slice(0, 24);
    return testo || 'Giocatore';
}

function gestisciMessaggio(connessione, dati) {
    switch (dati.t) {
        case 'crea': {
            if (connessione.codiceStanza) {
                connessione.invia({ t: 'errore', msg: 'Sei gia\' in una stanza' });
                return;
            }
            if (stanze.size >= 200) {
                connessione.invia({ t: 'errore', msg: 'Troppe stanze aperte, riprova tra poco' });
                return;
            }
            const codice = generaCodice();
            if (!codice) {
                connessione.invia({ t: 'errore', msg: 'Impossibile creare la stanza' });
                return;
            }
            stanze.set(codice, {
                padrone: connessione,
                ospite: null,
                creata: Date.now(),
                // Nome leggibile del giocatore (account o ospite). Il client
                // vecchio non lo manda: in quel caso resta "Giocatore".
                nomePadrone: pulisciNome(dati.nome),
                nomeOspite: null
            });
            connessione.codiceStanza = codice;
            connessione.ruolo = 'padrone';
            connessione.invia({ t: 'creata', codice: codice });
            return;
        }

        case 'entra': {
            const codice = String(dati.codice || '').trim().toUpperCase();
            const stanza = stanze.get(codice);

            if (!stanza) {
                connessione.invia({ t: 'errore', msg: 'Stanza inesistente' });
                return;
            }
            if (stanza.ospite) {
                connessione.invia({ t: 'errore', msg: 'Stanza gia\' piena' });
                return;
            }
            if (stanza.padrone === connessione) {
                connessione.invia({ t: 'errore', msg: 'Sei gia\' in questa stanza' });
                return;
            }

            stanza.ospite = connessione;
            stanza.nomeOspite = pulisciNome(dati.nome);
            connessione.codiceStanza = codice;
            connessione.ruolo = 'ospite';

            // Ognuno dei due riceve il nome dell'altro: così la schermata
            // d'attesa e il cartello di fine partita sanno chi ha giocato.
            connessione.invia({ t: 'entrato', codice: codice, avversario: stanza.nomePadrone });
            stanza.padrone.invia({ t: 'avversario', stato: 'arrivato', nome: stanza.nomeOspite });
            return;
        }

        case 'esci': {
            connessione.chiudi();
            return;
        }

        default: {
            // scelta, avvia, tasto, fotogramma: vanno al compagno di stanza
            const altro = connessione.avversario();
            if (altro && !altro.chiusa) {
                altro.invia(dati);
            }
        }
    }
}

// ========================================
// Avvio del server
// ========================================
const server = http.createServer(gestisciRichiesta);

server.on('upgrade', (richiesta, socket) => {
    const chiave = richiesta.headers['sec-websocket-key'];

    if (!chiave || (richiesta.headers.upgrade || '').toLowerCase() !== 'websocket') {
        socket.destroy();
        return;
    }

    const accettazione = calcolaAccettazione(chiave);
    socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        'Sec-WebSocket-Accept: ' + accettazione + '\r\n\r\n'
    );

    new Connessione(socket, richiesta.socket.remoteAddress);
});

server.listen(PORTA, INDIRIZZO, () => {
    console.log('Server gioco avviato su ' + INDIRIZZO + ':' + PORTA);
    console.log('Cartella servita: ' + RADICE);
});

// Ping periodico: tiene vive le connessioni e libera le stanze abbandonate
setInterval(() => {
    for (const [codice, stanza] of stanze) {
        for (const connessione of [stanza.padrone, stanza.ospite]) {
            if (connessione && !connessione.chiusa) {
                try {
                    connessione.socket.write(creaFrameControllo(0x9, Buffer.alloc(0)));
                } catch (errore) {
                    connessione.chiudi();
                }
            }
        }
        // Una stanza senza padrone non ha senso: la si elimina
        if (!stanza.padrone || stanza.padrone.chiusa) {
            stanze.delete(codice);
        }
    }
}, 30000);

process.on('SIGTERM', () => {
    console.log('Arresto del server');
    server.close();
    process.exit(0);
});
