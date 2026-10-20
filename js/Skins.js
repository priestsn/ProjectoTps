// ========================================
// Skin dei verdellinesi
// ==========================================
// Una skin è un colore: gli stessi otto fogli di sprite del verdellinese,
// portati su una palette diversa (vedi tools/crea_skin.py). Per il gioco è
// solo una cartella differente, quindi cambia una riga nella configurazione
// dello sprite e niente altro: statistiche, mosse e ultimate restano identici.
//
// Dove sta cosa:
//   assets/Personaggi/<Nome>/        -> verdellinese base (gratis)
//   assets/Skins/<Nome>-<skin>/      -> variante ricolorata
//
// Cosa è posseduto lo dice il server (profilo `skins`, es. "OusmaneDiouf:raro").
// Cosa si indossa è una scelta locale del giocatore: non serve al server e
// cambiarla non deve fare un giro di rete.

// Le skin esistenti. Al momento una sola, ma la forma è già da elenco: quando
// arriveranno le skin complesse basta aggiungere una voce e i prezzi.
const SKINS = {
    raro: {
        id: 'raro',
        nome: 'Raro',
        prezzo: 1000,
        descrizione: 'Ricolorazione completa del verdellinese'
    }
};

// Il nome del colore di ogni skin, così il negozio dice qualcosa di più di
// "Raro". Deve combaciare con le palette di tools/crea_skin.py.
const NOMI_COLORE_SKIN = {
    OusmaneDiouf: 'Oro',
    KwameMensah: 'Ghiaccio',
    ChidiOkonkwo: 'Cremisi',
    AmaraDiallo: 'Smeraldo',
    TarisaiMoyo: 'Ametista',
    ZuriNkosi: 'Azzurro',
    BakariTraore: 'Ambra',
    SekouCamara: 'Fucsia',
    AyoAdebayo: 'Turchese'
};

const CHIAVE_SKIN_INDOSSATE = 'uvsf7-skins';
const CHIAVE_SKIN_POSSEDUTE = 'uvsf7-skins-possedute';

/** "OusmaneDiouf" + "raro" -> "OusmaneDiouf:raro" */
function chiaveSkin(idPersonaggio, skin) {
    return idPersonaggio + ':' + skin;
}

/** Nome leggibile: "Oro" per OusmaneDiouf, il nome della skin come ripiego. */
function nomeColoreSkin(idPersonaggio, skin) {
    return NOMI_COLORE_SKIN[idPersonaggio] || (SKINS[skin] ? SKINS[skin].nome : skin);
}

/** Cartella degli sprite di una skin (con la barra finale, come `sprite.cartella`). */
function cartellaSkin(idPersonaggio, skin) {
    if (!SKINS[skin]) return null;
    return './assets/Skins/' + idPersonaggio + '-' + skin + '/';
}

// ========================================
// Memoria locale (localStorage, se c'è)
// ========================================

function leggiJsonLocale(chiave, ripiego) {
    try {
        if (typeof localStorage === 'undefined') return ripiego;
        const testo = localStorage.getItem(chiave);
        if (!testo) return ripiego;
        const valore = JSON.parse(testo);
        return (valore && typeof valore === 'object') ? valore : ripiego;
    } catch (errore) {
        return ripiego;
    }
}

function scriviJsonLocale(chiave, valore) {
    try {
        if (typeof localStorage === 'undefined') return false;
        localStorage.setItem(chiave, JSON.stringify(valore));
        return true;
    } catch (errore) {
        return false;
    }
}

/** Skin possedute: quelle del profilo (server) più quelle comprate su questo dispositivo. */
function skinsPossedute() {
    const elenco = [];

    const dalProfilo = (typeof statoAccount !== 'undefined' && statoAccount && statoAccount.skins)
        ? statoAccount.skins : [];
    for (const chiave of dalProfilo) {
        if (elenco.indexOf(chiave) === -1) elenco.push(chiave);
    }

    const locali = leggiJsonLocale(CHIAVE_SKIN_POSSEDUTE, []);
    for (const chiave of locali) {
        if (elenco.indexOf(chiave) === -1) elenco.push(chiave);
    }

    return elenco;
}

/** Il giocatore possiede questa skin? */
function possiedeSkin(idPersonaggio, skin) {
    return skinsPossedute().indexOf(chiaveSkin(idPersonaggio, skin)) !== -1;
}

/** Segna una skin come posseduta su questo dispositivo. */
function aggiungiSkinLocale(idPersonaggio, skin) {
    const chiave = chiaveSkin(idPersonaggio, skin);
    const elenco = leggiJsonLocale(CHIAVE_SKIN_POSSEDUTE, []);
    if (elenco.indexOf(chiave) === -1) {
        elenco.push(chiave);
        scriviJsonLocale(CHIAVE_SKIN_POSSEDUTE, elenco);
    }
    return elenco;
}

/** Skin indossata per un verdellinese, oppure null per l'aspetto base. */
function skinIndossata(idPersonaggio) {
    const indossate = leggiJsonLocale(CHIAVE_SKIN_INDOSSATE, {});
    const skin = indossate[idPersonaggio];
    if (!skin || !SKINS[skin]) return null;
    if (!possiedeSkin(idPersonaggio, skin)) return null;
    return skin;
}

/**
 * Indossa una skin (o torna all'aspetto base passando null).
 * Restituisce la skin attiva dopo il cambio.
 */
function indossaSkin(idPersonaggio, skin) {
    const indossate = leggiJsonLocale(CHIAVE_SKIN_INDOSSATE, {});

    if (!skin) {
        delete indossate[idPersonaggio];
        scriviJsonLocale(CHIAVE_SKIN_INDOSSATE, indossate);
        return null;
    }

    if (!SKINS[skin] || !possiedeSkin(idPersonaggio, skin)) {
        return skinIndossata(idPersonaggio);
    }

    indossate[idPersonaggio] = skin;
    scriviJsonLocale(CHIAVE_SKIN_INDOSSATE, indossate);
    return skin;
}

// ========================================
// Verso il gioco
// ========================================

/**
 * Il verdellinese con la skin indossata: copia dei dati con un'altra cartella
 * di sprite. Se non c'è nessuna skin indossata restituisce il dato originale,
 * senza copiarlo (nessuna allocazione inutile a ogni partita).
 */
function personaggioConSkin(idPersonaggio) {
    if (typeof VERDELLINESI === 'undefined') return null;

    const base = VERDELLINESI.find((p) => p.id === idPersonaggio);
    if (!base) return null;

    const skin = skinIndossata(idPersonaggio);
    const cartella = skin ? cartellaSkin(idPersonaggio, skin) : null;
    if (!cartella) return base;

    const copia = Object.assign({}, base);
    copia.sprite = Object.assign({}, base.sprite, { cartella: cartella });
    copia.skin = skin;
    return copia;
}

// Doppia modalità: nel browser è uno script classico, nei test si carica con require.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SKINS: SKINS,
        NOMI_COLORE_SKIN: NOMI_COLORE_SKIN,
        chiaveSkin: chiaveSkin,
        nomeColoreSkin: nomeColoreSkin,
        cartellaSkin: cartellaSkin,
        skinsPossedute: skinsPossedute,
        possiedeSkin: possiedeSkin,
        aggiungiSkinLocale: aggiungiSkinLocale,
        skinIndossata: skinIndossata,
        indossaSkin: indossaSkin,
        personaggioConSkin: personaggioConSkin
    };
}
