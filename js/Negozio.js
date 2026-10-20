// ========================================
// Negozio dei lottatori
// ==========================================
// Il catalogo lo decide il server (dati/negozio.json): il browser non inventa
// prezzi né decide cosa è posseduto. Qui si disegna e si manda l'acquisto.

// Catalogo di riserva, identico a dati/negozio.json. Serve perché il gioco
// deve funzionare anche SENZA server (GitHub Pages, app aperta da file, server
// spento): senza questa copia il client non saprebbe quali lottatori sono
// gratuiti e li considererebbe bloccati TUTTI, invece dei tre da sbloccare.
// Appena il server risponde, il catalogo vero prende il suo posto.
const CATALOGO_PREDEFINITO = [
    { personaggio: 'OusmaneDiouf', prezzo: 0, ottenutoAllInizio: true },
    { personaggio: 'KwameMensah', prezzo: 0, ottenutoAllInizio: true },
    { personaggio: 'ChidiOkonkwo', prezzo: 0, ottenutoAllInizio: true },
    { personaggio: 'AmaraDiallo', prezzo: 0, ottenutoAllInizio: true },
    { personaggio: 'TarisaiMoyo', prezzo: 0, ottenutoAllInizio: true },
    { personaggio: 'ZuriNkosi', prezzo: 0, ottenutoAllInizio: true },
    { personaggio: 'BakariTraore', prezzo: 2500, ottenutoAllInizio: false },
    { personaggio: 'SekouCamara', prezzo: 3500, ottenutoAllInizio: false },
    { personaggio: 'AyoAdebayo', prezzo: 4000, ottenutoAllInizio: false }
];

// Catalogo attivo: parte dalla copia di riserva, il server può aggiornarlo.
let CATALOGO_NEGOZIO = CATALOGO_PREDEFINITO.map((voce) => Object.assign({}, voce));

// ========================================
// Negoziante
// ==========================================
// Una frase per visita: si sceglie quando si apre il negozio e resta quella
// finché non si esce (niente timer che cambia il testo sotto gli occhi).
// Lo sprite invece parla per un attimo e poi torna in attesa.

let fraseNegozianteCorrente = null;
let timerParlaNegoziante = null;

/** Fa muovere la bocca del negoziante per un attimo, poi lo lascia in attesa. */
function avviaParlaNegoziante() {
    chiudiNegoziante();

    const figura = document.querySelector('#negozianteFigura');
    if (!figura) return;

    figura.classList.add('sta-parlando');
    timerParlaNegoziante = setTimeout(() => {
        figura.classList.remove('sta-parlando');
        timerParlaNegoziante = null;
    }, 3200);
}

/** Ferma l'animazione del negoziante: si chiama uscendo dal negozio. */
function chiudiNegoziante() {
    if (timerParlaNegoziante) {
        clearTimeout(timerParlaNegoziante);
        timerParlaNegoziante = null;
    }

    const figura = document.querySelector('#negozianteFigura');
    if (figura) figura.classList.remove('sta-parlando');
}

/** Sceglie la frase della visita e la ricorda (non si ripete due volte di fila). */
function scegliFraseDellaVisita() {
    if (typeof fraseDiversaDa !== 'function') return '';
    fraseNegozianteCorrente = fraseDiversaDa(fraseNegozianteCorrente);
    return fraseNegozianteCorrente;
}

/** Crea un elemento con classe e testo. */
function negozioCrea(tag, classe, testo) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (testo !== undefined && testo !== null) elemento.textContent = testo;
    return elemento;
}

/** Il personaggio del gioco che corrisponde a un id del catalogo. */
function lottatoreDelCatalogo(id) {
    return VERDELLINESI.find((p) => p.id === id) || null;
}

/** Apre il negozio: senza account non si compra niente. */
async function apriNegozio() {
    if (!statoAccount.dentro) {
        apriAccount();
        messaggioAccount('Per usare il negozio serve un account: accedi o crealo qui sopra.', 'errore');
        return;
    }

    cambiaStato(STATI.NEGOZIO);

    // La frase si sceglie UNA volta per visita, prima di disegnare: il
    // negozio viene ridisegnato dopo il caricamento e dopo ogni acquisto, e
    // senza questo la frase cambierebbe sotto gli occhi del giocatore.
    scegliFraseDellaVisita();

    disegnaNegozio('Caricamento del negozio…');
    await caricaNegozio();
}

/**
 * Chiede il catalogo al server senza disegnare niente e senza far fallire
 * nulla: se il server non risponde resta la copia di riserva.
 * Restituisce true se il catalogo è stato aggiornato davvero.
 */
async function caricaCatalogo() {
    try {
        const dati = await api.chiama('/api/negozio');
        if (dati && Array.isArray(dati.voci) && dati.voci.length > 0) {
            CATALOGO_NEGOZIO = dati.voci;
        }
        if (dati && typeof dati.punti === 'number') {
            statoAccount.punti = dati.punti;
        }
        return true;
    } catch (errore) {
        // offline, senza account o server spento: vale la copia di riserva
        return false;
    }
}

/** Chiede il catalogo al server e ridisegna la schermata. */
async function caricaNegozio() {
    const caricato = await caricaCatalogo();
    if (!caricato) {
        disegnaNegozio('Catalogo non raggiungibile: si usano i prezzi predefiniti.', 'errore');
        return;
    }
    disegnaNegozio('');
}

/** Disegna la schermata del negozio. */
function disegnaNegozio(messaggio, tipo) {
    const contenitore = document.querySelector('#negozio');
    if (!contenitore) return;

    contenitore.innerHTML = '';

    contenitore.appendChild(negozioCrea('div', 'negozio-titolo', 'NEGOZIO DEI VERDELLINESI'));
    contenitore.appendChild(negozioCrea('div', 'negozio-punti', 'Punti disponibili: ' + statoAccount.punti));

    // Banco del negoziante: figura a sinistra, fumetto a destra.
    // È decorazione: se lo sprite non carica resta il riquadro col fumetto.
    const banco = negozioCrea('div', 'negozio-banco');

    const figura = negozioCrea('div', 'negozio-negoziante');
    figura.id = 'negozianteFigura';
    figura.setAttribute('role', 'img');
    figura.setAttribute('aria-label', 'Il negoziante della bottega');

    const fumetto = negozioCrea('div', 'negozio-fumetto', fraseNegozianteCorrente || '');
    fumetto.id = 'negozianteFumetto';

    banco.append(figura, fumetto);
    contenitore.appendChild(banco);

    avviaParlaNegoziante();

    const griglia = negozioCrea('div', 'negozio-griglia');

    for (const voce of CATALOGO_NEGOZIO) {
        const lottatore = lottatoreDelCatalogo(voce.personaggio);
        const scheda = negozioCrea('div', 'negozio-scheda' + (voce.ottenuto ? ' gia-tuo' : ''));

        scheda.appendChild(negozioCrea('div', 'negozio-nome', lottatore ? lottatore.nome : voce.personaggio));

        if (lottatore && lottatore.ultimate && lottatore.ultimate.nome) {
            scheda.appendChild(negozioCrea('div', 'negozio-ultimate', 'Ultimate: ' + lottatore.ultimate.nome));
        }

        if (voce.ottenuto) {
            scheda.appendChild(negozioCrea('div', 'negozio-stato', 'Già tuo'));
        } else {
            scheda.appendChild(negozioCrea('div', 'negozio-prezzo', voce.prezzo + ' punti'));
            const compra = negozioCrea('button', 'negozio-bottone', 'ACQUISTA');
            const abbastanza = statoAccount.punti >= voce.prezzo;
            if (!abbastanza) {
                compra.classList.add('disabilitato');
                compra.title = 'Ti servono ancora ' + (voce.prezzo - statoAccount.punti) + ' punti';
            }
            compra.addEventListener('click', () => acquistaLottatore(voce.personaggio));
            scheda.appendChild(compra);
        }

        griglia.appendChild(scheda);
    }

    contenitore.appendChild(griglia);

    const riga = negozioCrea('div', 'negozio-stato-riga' + (tipo ? ' ' + tipo : ''), messaggio || '');
    riga.id = 'negozioMessaggio';
    contenitore.appendChild(riga);

    const indietro = negozioCrea('button', 'negozio-bottone secondario', 'INDIETRO');
    indietro.addEventListener('click', () => {
        chiudiNegoziante();
        apriMenu('principale');
    });
    contenitore.appendChild(indietro);
}

/** Manda l'acquisto al server e aggiorna la schermata. */
async function acquistaLottatore(idLottatore) {
    const riga = document.querySelector('#negozioMessaggio');
    if (riga) {
        riga.textContent = 'Acquisto in corso…';
        riga.className = 'negozio-stato-riga attesa';
    }

    try {
        const esito = await api.chiama('/api/negozio/acquisto', { corpo: { personaggio: idLottatore } });
        statoAccount.punti = esito.punti;
        statoAccount.lottatori = esito.personaggi;

        const lottatore = lottatoreDelCatalogo(idLottatore);
        const nome = lottatore ? lottatore.nome : idLottatore;
        await caricaNegozio();

        const nuovaRiga = document.querySelector('#negozioMessaggio');
        if (nuovaRiga) {
            nuovaRiga.textContent = 'Acquistato: ' + nome + '. Ora è selezionabile in partita.';
            nuovaRiga.className = 'negozio-stato-riga ok';
        }
    } catch (errore) {
        const nuovaRiga = document.querySelector('#negozioMessaggio');
        if (nuovaRiga) {
            nuovaRiga.textContent = errore.message;
            nuovaRiga.className = 'negozio-stato-riga errore';
        }
    }
}

// Doppia modalità: nel browser è uno script classico, nei test Node il catalogo
// di riserva si può controllare con require.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CATALOGO_PREDEFINITO: CATALOGO_PREDEFINITO };
}
