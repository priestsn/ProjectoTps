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
    { chiave: 'OusmaneDiouf', personaggio: 'OusmaneDiouf', prezzo: 0, ottenutoAllInizio: true },
    { chiave: 'KwameMensah', personaggio: 'KwameMensah', prezzo: 0, ottenutoAllInizio: true },
    { chiave: 'ChidiOkonkwo', personaggio: 'ChidiOkonkwo', prezzo: 0, ottenutoAllInizio: true },
    { chiave: 'AmaraDiallo', personaggio: 'AmaraDiallo', prezzo: 0, ottenutoAllInizio: true },
    { chiave: 'TarisaiMoyo', personaggio: 'TarisaiMoyo', prezzo: 0, ottenutoAllInizio: true },
    { chiave: 'ZuriNkosi', personaggio: 'ZuriNkosi', prezzo: 0, ottenutoAllInizio: true },
    { chiave: 'BakariTraore', personaggio: 'BakariTraore', prezzo: 2500, ottenutoAllInizio: false },
    { chiave: 'SekouCamara', personaggio: 'SekouCamara', prezzo: 3500, ottenutoAllInizio: false },
    { chiave: 'AyoAdebayo', personaggio: 'AyoAdebayo', prezzo: 4000, ottenutoAllInizio: false },

    // Skin rare: una per verdellinese, tutte allo stesso prezzo.
    { chiave: 'OusmaneDiouf:raro', personaggio: 'OusmaneDiouf', skin: 'raro', nome: 'Raro Oro', prezzo: 1000, ottenutoAllInizio: false },
    { chiave: 'KwameMensah:raro', personaggio: 'KwameMensah', skin: 'raro', nome: 'Raro Ghiaccio', prezzo: 1000, ottenutoAllInizio: false },
    { chiave: 'ChidiOkonkwo:raro', personaggio: 'ChidiOkonkwo', skin: 'raro', nome: 'Raro Cremisi', prezzo: 1000, ottenutoAllInizio: false },
    { chiave: 'AmaraDiallo:raro', personaggio: 'AmaraDiallo', skin: 'raro', nome: 'Raro Smeraldo', prezzo: 1000, ottenutoAllInizio: false },
    { chiave: 'TarisaiMoyo:raro', personaggio: 'TarisaiMoyo', skin: 'raro', nome: 'Raro Ametista', prezzo: 1000, ottenutoAllInizio: false },
    { chiave: 'ZuriNkosi:raro', personaggio: 'ZuriNkosi', skin: 'raro', nome: 'Raro Azzurro', prezzo: 1000, ottenutoAllInizio: false },
    { chiave: 'BakariTraore:raro', personaggio: 'BakariTraore', skin: 'raro', nome: 'Raro Ambra', prezzo: 1000, ottenutoAllInizio: false },
    { chiave: 'SekouCamara:raro', personaggio: 'SekouCamara', skin: 'raro', nome: 'Raro Fucsia', prezzo: 1000, ottenutoAllInizio: false },
    { chiave: 'AyoAdebayo:raro', personaggio: 'AyoAdebayo', skin: 'raro', nome: 'Raro Turchese', prezzo: 1000, ottenutoAllInizio: false }
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

    // ---- verdellinesi in vendita: solo quelli che non hai ancora ----
    const inVendita = catalogoVerdellinesi();
    contenitore.appendChild(negozioCrea('div', 'negozio-sezione', 'VERDELLINESI IN VENDITA'));

    if (inVendita.length === 0) {
        contenitore.appendChild(negozioCrea('div', 'negozio-nota',
            'Hai già tutti i verdellinesi. Le skin rare sono qui sotto.'));
    } else {
        const griglia = negozioCrea('div', 'negozio-griglia');
        for (const voce of inVendita) {
            griglia.appendChild(schedaVerdellinese(voce));
        }
        contenitore.appendChild(griglia);
    }

    // ---- skin rare: si comprano e si indossano da qui ----
    const skins = catalogoSkins();
    if (skins.length > 0) {
        contenitore.appendChild(negozioCrea('div', 'negozio-sezione', 'SKIN RARE'));

        const grigliaSkins = negozioCrea('div', 'negozio-griglia');
        for (const voce of skins) {
            grigliaSkins.appendChild(schedaSkin(voce));
        }
        contenitore.appendChild(grigliaSkins);
    }

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

/** Chiave unica di una voce del catalogo ("OusmaneDiouf" o "OusmaneDiouf:raro"). */
function chiaveDiVoce(voce) {
    if (!voce) return '';
    if (voce.chiave) return voce.chiave;
    return voce.skin ? voce.personaggio + ':' + voce.skin : voce.personaggio;
}

/**
 * La voce è già del giocatore?
 * Il server manda `ottenuto`; senza server (catalogo di riserva) vale
 * `ottenutoAllInizio`, cioè i sei verdellinesi che si hanno creando l'account.
 */
function vocePosseduta(voce) {
    if (!voce) return false;
    if (typeof voce.ottenuto === 'boolean') return voce.ottenuto;
    return voce.ottenutoAllInizio === true;
}

/** I verdellinesi ancora da comprare: quelli già tuoi non si mostrano. */
function catalogoVerdellinesi() {
    return CATALOGO_NEGOZIO.filter((voce) => !voce.skin && !vocePosseduta(voce));
}

/** Le skin del catalogo. Restano visibili anche se possedute: servono a indossarle. */
function catalogoSkins() {
    return CATALOGO_NEGOZIO.filter((voce) => !!voce.skin);
}

/** Una skin è posseduta? Prima il server (profilo), poi la copia locale. */
function skinPosseduta(voce) {
    if (vocePosseduta(voce)) return true;
    return (typeof possiedeSkin === 'function')
        ? possiedeSkin(voce.personaggio, voce.skin)
        : false;
}

/** Nome mostrato di una skin: "Raro Oro". */
function nomeSkin(voce) {
    if (voce.nome) return voce.nome;
    const colore = (typeof nomeColoreSkin === 'function')
        ? nomeColoreSkin(voce.personaggio, voce.skin) : voce.skin;
    return 'Raro ' + colore;
}

/**
 * Anteprima animata: mostra il verdellinese vero, non un'icona.
 * Mostrare quello che si compra è il punto: prima c'erano solo nome e prezzo.
 */
function anteprimaVerdellinese(voce, misura) {
    const lottatore = lottatoreDelCatalogo(voce.personaggio);
    const anteprima = negozioCrea('div', 'negozio-anteprima');
    if (!lottatore) return anteprima;

    const lato = misura || 120;
    const cartella = voce.skin
        ? cartellaSkin(voce.personaggio, voce.skin)
        : lottatore.sprite.cartella;
    const fotogrammi = (lottatore.sprite.frames && lottatore.sprite.frames.idle) || 11;

    anteprima.style.width = lato + 'px';
    anteprima.style.height = lato + 'px';
    anteprima.style.backgroundImage = "url('" + cartella + "idle.png')";
    anteprima.style.backgroundSize = (fotogrammi * lato) + 'px ' + lato + 'px';
    anteprima.style.setProperty('--foglio', (fotogrammi * lato) + 'px');
    anteprima.style.animation = 'negozio-anteprima ' + (fotogrammi * 0.09).toFixed(2) +
        's steps(' + fotogrammi + ') infinite';
    anteprima.setAttribute('aria-label', 'Anteprima di ' + lottatore.nome);

    return anteprima;
}

/** Scheda di un verdellinese in vendita. */
function schedaVerdellinese(voce) {
    const lottatore = lottatoreDelCatalogo(voce.personaggio);
    const scheda = negozioCrea('div', 'negozio-scheda');

    scheda.appendChild(anteprimaVerdellinese(voce));
    scheda.appendChild(negozioCrea('div', 'negozio-nome', lottatore ? lottatore.nome : voce.personaggio));

    if (lottatore && lottatore.ultimate && lottatore.ultimate.nome) {
        scheda.appendChild(negozioCrea('div', 'negozio-ultimate', 'Ultimate: ' + lottatore.ultimate.nome));
    }

    scheda.appendChild(negozioCrea('div', 'negozio-prezzo', voce.prezzo + ' punti'));

    const compra = negozioCrea('button', 'negozio-bottone', 'ACQUISTA');
    if (statoAccount.punti < voce.prezzo) {
        compra.classList.add('disabilitato');
        compra.title = 'Ti servono ancora ' + (voce.prezzo - statoAccount.punti) + ' punti';
    }
    compra.addEventListener('click', () => acquistaVoce(chiaveDiVoce(voce)));
    scheda.appendChild(compra);

    return scheda;
}

/** Scheda di una skin: anteprima, prezzo se da comprare, altrimenti "indossa". */
function schedaSkin(voce) {
    const lottatore = lottatoreDelCatalogo(voce.personaggio);
    const scheda = negozioCrea('div', 'negozio-scheda skin');

    scheda.appendChild(anteprimaVerdellinese(voce));
    scheda.appendChild(negozioCrea('div', 'negozio-nome', nomeSkin(voce)));
    scheda.appendChild(negozioCrea('div', 'negozio-ultimate',
        'per ' + (lottatore ? lottatore.nome : voce.personaggio)));

    const posseduta = skinPosseduta(voce);
    const indossata = (typeof skinIndossata === 'function')
        ? skinIndossata(voce.personaggio) === voce.skin : false;

    if (!posseduta) {
        scheda.appendChild(negozioCrea('div', 'negozio-prezzo', voce.prezzo + ' punti'));
        const compra = negozioCrea('button', 'negozio-bottone', 'ACQUISTA');
        if (statoAccount.punti < voce.prezzo) {
            compra.classList.add('disabilitato');
            compra.title = 'Ti servono ancora ' + (voce.prezzo - statoAccount.punti) + ' punti';
        }
        compra.addEventListener('click', () => acquistaVoce(chiaveDiVoce(voce)));
        scheda.appendChild(compra);
        return scheda;
    }

    if (indossata) {
        scheda.classList.add('indossata');
        scheda.appendChild(negozioCrea('div', 'negozio-stato', 'Indossata'));
        const togli = negozioCrea('button', 'negozio-bottone secondario', 'TOGLI');
        togli.addEventListener('click', () => alternaSkin(voce.personaggio, voce.skin));
        scheda.appendChild(togli);
    } else {
        const indossa = negozioCrea('button', 'negozio-bottone', 'INDOSSA');
        indossa.addEventListener('click', () => alternaSkin(voce.personaggio, voce.skin));
        scheda.appendChild(indossa);
    }

    return scheda;
}

/**
 * Indossa o toglie una skin posseduta. La scelta è locale: non serve una
 * chiamata al server per cambiare colore a un verdellinese.
 */
function alternaSkin(idPersonaggio, skin) {
    if (typeof indossaSkin !== 'function') return;

    const attuale = (typeof skinIndossata === 'function') ? skinIndossata(idPersonaggio) : null;
    const resta = attuale === skin ? null : skin;

    indossaSkin(idPersonaggio, resta);

    disegnaNegozio(resta
        ? 'Skin indossata: la vedrai in partita.'
        : 'Skin tolta: torna l\'aspetto base.', 'ok');
}

/** Manda l'acquisto al server e aggiorna la schermata. */
async function acquistaVoce(chiave) {
    const riga = document.querySelector('#negozioMessaggio');
    if (riga) {
        riga.textContent = 'Acquisto in corso…';
        riga.className = 'negozio-stato-riga attesa';
    }

    try {
        const esito = await api.chiama('/api/negozio/acquisto', { corpo: { chiave: chiave } });
        statoAccount.punti = esito.punti;
        statoAccount.lottatori = esito.personaggi;
        statoAccount.skins = esito.skins || statoAccount.skins || [];

        const voce = CATALOGO_NEGOZIO.find((v) => chiaveDiVoce(v) === chiave);
        let messaggio = 'Acquistato. Ora è selezionabile in partita.';

        if (voce && voce.skin) {
            // La skin appena comprata si indossa subito: comprarla e non vederla
            // mai sarebbe una delusione garantita.
            if (typeof aggiungiSkinLocale === 'function') {
                aggiungiSkinLocale(voce.personaggio, voce.skin);
            }
            if (typeof indossaSkin === 'function') {
                indossaSkin(voce.personaggio, voce.skin);
            }
            messaggio = 'Acquistata: ' + nomeSkin(voce) + '. È già indossata.';
        }

        await caricaNegozio();

        const nuovaRiga = document.querySelector('#negozioMessaggio');
        if (nuovaRiga) {
            nuovaRiga.textContent = messaggio;
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

/** Vecchio nome dell'acquisto, tenuto per non rompere eventuali chiamate. */
function acquistaLottatore(idLottatore) {
    return acquistaVoce(idLottatore);
}

// Doppia modalità: nel browser è uno script classico, nei test Node il catalogo
// di riserva si può controllare con require.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CATALOGO_PREDEFINITO: CATALOGO_PREDEFINITO,
        chiaveDiVoce: chiaveDiVoce,
        catalogoVerdellinesi: catalogoVerdellinesi,
        vocePosseduta: vocePosseduta,
        catalogoSkins: catalogoSkins,
        nomeSkin: nomeSkin
    };
}
