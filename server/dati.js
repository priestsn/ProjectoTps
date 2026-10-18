// ========================================
// Persistenza su file JSON (senza database)
// ==========================================
// Il progetto non usa dipendenze esterne, quindi lo stato del gioco online vive
// in file JSON dentro dati/runtime/. La scrittura è atomica: si scrive un file
// temporaneo nella stessa cartella e poi si rinomina. Un rename sullo stesso
// filesystem è atomico, quindi non può esistere un file mezzo scritto: o c'è
// la versione vecchia, o c'è quella nuova.

const fs = require('fs');
const path = require('path');

/** Legge un file JSON. Se manca o è corrotto torna il valore predefinito. */
function leggi(percorso, predefinito) {
    try {
        return JSON.parse(fs.readFileSync(percorso, 'utf8'));
    } catch (errore) {
        return predefinito;
    }
}

/** Scrive un file JSON in modo atomico. Restituisce true se ce l'ha fatta. */
function scrivi(percorso, dati) {
    try {
        fs.mkdirSync(path.dirname(percorso), { recursive: true });
        const temporaneo = percorso + '.tmp';
        fs.writeFileSync(temporaneo, JSON.stringify(dati, null, 2), 'utf8');
        fs.renameSync(temporaneo, percorso);
        return true;
    } catch (errore) {
        console.error('scrittura fallita su ' + percorso + ': ' + errore.message);
        return false;
    }
}

/** Aggiunge una riga in coda a un file di registro (una riga = un JSON). */
function accoda(percorso, riga) {
    try {
        fs.mkdirSync(path.dirname(percorso), { recursive: true });
        fs.appendFileSync(percorso, JSON.stringify(riga) + '\n', 'utf8');
        return true;
    } catch (errore) {
        console.error('accodamento fallito su ' + percorso + ': ' + errore.message);
        return false;
    }
}

/** Legge un registro riga per riga, scartando le righe illeggibili. */
function leggiRegistro(percorso) {
    try {
        return fs.readFileSync(percorso, 'utf8')
            .split('\n')
            .filter((riga) => riga.trim() !== '')
            .map((riga) => {
                try { return JSON.parse(riga); } catch (errore) { return null; }
            })
            .filter((valore) => valore !== null);
    } catch (errore) {
        return [];
    }
}

/** Un magazzino legato a una cartella: legge e scrive file per nome. */
class Magazzino {
    constructor(cartella) {
        this.cartella = cartella;
        fs.mkdirSync(cartella, { recursive: true });
    }

    percorso(nomeFile) {
        return path.join(this.cartella, nomeFile);
    }

    leggi(nomeFile, predefinito) {
        return leggi(this.percorso(nomeFile), predefinito);
    }

    scrivi(nomeFile, dati) {
        return scrivi(this.percorso(nomeFile), dati);
    }

    accoda(nomeFile, riga) {
        return accoda(this.percorso(nomeFile), riga);
    }

    leggiRegistro(nomeFile) {
        return leggiRegistro(this.percorso(nomeFile));
    }
}

module.exports = { leggi, scrivi, accoda, leggiRegistro, Magazzino };
