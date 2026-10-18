// ========================================
// Collegamento alle API del gioco
// ==========================================
// Una sola funzione per tutte le chiamate: mette il token, legge il JSON e
// trasforma ogni errore in un messaggio in italiano pronto da mostrare.
//
// Il token sta in localStorage: sopravvive alla chiusura della pagina, così non
// si deve rifare l'accesso a ogni partita.

const CHIAVE_TOKEN = 'uvsf7-token';

class Api {
    constructor() {
        this.token = null;
        try {
            this.token = localStorage.getItem(CHIAVE_TOKEN);
        } catch (errore) {
            // localStorage negato (navigazione privata): si resta senza sessione
            this.token = null;
        }
    }

    salvaToken(token) {
        this.token = token;
        try { localStorage.setItem(CHIAVE_TOKEN, token); } catch (errore) { /* niente */ }
    }

    dimenticaToken() {
        this.token = null;
        try { localStorage.removeItem(CHIAVE_TOKEN); } catch (errore) { /* niente */ }
    }

    /** True se c'è un token salvato (non dice se è ancora valido). */
    haToken() {
        return !!this.token;
    }

    /**
     * Chiama l'API e restituisce i dati, oppure lancia un Error con il
     * messaggio del server. Chi chiama mostra il messaggio all'utente.
     */
    async chiama(percorso, opzioni) {
        const scelte = opzioni || {};
        const intestazioni = { 'Content-Type': 'application/json' };
        if (this.token) {
            intestazioni.Authorization = 'Bearer ' + this.token;
        }

        let risposta;
        try {
            risposta = await fetch(percorso, {
                method: scelte.metodo || (scelte.corpo ? 'POST' : 'GET'),
                headers: intestazioni,
                body: scelte.corpo ? JSON.stringify(scelte.corpo) : undefined
            });
        } catch (errore) {
            throw new Error('Server non raggiungibile: serve la versione servita da Node, non il file aperto con doppio clic.');
        }

        let dati = null;
        try { dati = await risposta.json(); } catch (errore) { dati = null; }

        if (!risposta.ok) {
            if (risposta.status === 401) this.dimenticaToken();
            throw new Error((dati && dati.messaggio) || 'Il server ha risposto ' + risposta.status);
        }
        return dati;
    }
}

const api = new Api();
