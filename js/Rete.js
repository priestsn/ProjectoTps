// ========================================
// Rete
// ==========================================
// Unico punto di contatto con il server delle stanze (server/server.js).
// Il gioco parla solo JSON: qui si gestiscono apertura, chiusura e
// reconnection-free (se cade, si torna al menu e si ricrea la stanza).
//
// Messaggi usati dal gioco (vedi server/server.js):
//   client -> server: crea, entra, scelta, avvia, tasto, fotogramma, esci
//   server -> client: creata, entrato, errore, avversario, avversarioUscito

const Rete = {
    ws: null,
    collegato: false,

    // Funzioni impostate da js/Online.js
    onMessaggio: null,
    onChiusura: null,

    /**
     * Indirizzo del server: lo stesso da cui è stata scaricata la pagina
     */
    indirizzo() {
        const protocollo = location.protocol === 'https:' ? 'wss:' : 'ws:';
        return protocollo + '//' + location.host + '/ws';
    },

    /**
     * Apre il collegamento. `esito(true)` quando è pronto, `esito(false)`
     * se il server non risponde (pagina aperta da file, server spento).
     */
    collega(esito) {
        if (this.ws && this.collegato) {
            esito(true);
            return;
        }

        this.chiudi();

        let socket;
        try {
            socket = new WebSocket(this.indirizzo());
        } catch (errore) {
            esito(false);
            return;
        }

        let risposto = false;
        this.ws = socket;

        socket.onopen = () => {
            this.collegato = true;
            risposto = true;
            esito(true);
        };

        socket.onerror = () => {
            if (!risposto) {
                risposto = true;
                this.collegato = false;
                esito(false);
            }
        };

        socket.onclose = () => {
            this.collegato = false;
            if (!risposto) {
                risposto = true;
                esito(false);
            }
            if (this.onChiusura) {
                this.onChiusura();
            }
        };

        socket.onmessage = (evento) => {
            let dati;
            try {
                dati = JSON.parse(evento.data);
            } catch (errore) {
                return;
            }
            if (this.onMessaggio) {
                this.onMessaggio(dati);
            }
        };
    },

    /**
     * Invia un messaggio al server. Se il collegamento non c'è, non fa nulla:
     * il gioco non deve rompersi per un pacchetto perso.
     */
    invia(messaggio) {
        if (this.ws && this.collegato) {
            try {
                this.ws.send(JSON.stringify(messaggio));
            } catch (errore) {
                // socket già chiuso: la chiusura arriva da onclose
            }
        }
    },

    /**
     * Chiude il collegamento senza far scattare onChiusura
     */
    chiudi() {
        if (this.ws) {
            const socket = this.ws;
            this.ws = null;
            this.collegato = false;
            socket.onopen = null;
            socket.onerror = null;
            socket.onmessage = null;
            socket.onclose = null;
            try {
                socket.close();
            } catch (errore) {
                // già chiuso
            }
        }
    }
};
