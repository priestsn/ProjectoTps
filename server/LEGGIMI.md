# Server di gioco — installazione su VPS

Il server è un solo file Node, **senza dipendenze npm**: serve il gioco via HTTP e
tiene le stanze della modalità VS ONLINE via WebSocket.

```
server/server.js     server HTTP + WebSocket + stanze
server/package.json  metadati (nessuna dipendenza)
```

## Avvio in locale

```
node server/server.js            # porta 80
PORTA=8080 node server/server.js # porta diversa
```

Poi apri `http://localhost:8080`. Controllo rapido: `http://localhost:8080/stato`
restituisce JSON con stanze aperte e connessioni.

Aprire `index.html` con doppio clic **non** basta per il VS ONLINE: senza server
non esiste l'indirizzo WebSocket. VS LOCALE e VS CPU funzionano comunque.

## Installazione sulla VPS (Ubuntu 24.04, Aruba)

1. Node è già presente nei repository (testato con 18.19.1):

   ```
   node -v
   ```

   Se manca: `apt install -y nodejs`.

2. Copia il gioco in `/opt/uvsf7` (servono solo `index.html`, `index.js`, `css/`,
   `js/`, `server/` e gli asset usati: `assets/Background.png`,
   `assets/UVSF7-logo.png`, `assets/Personaggi/`).

3. Servizio systemd `/etc/systemd/system/uvsf7.service`:

   ```
   [Unit]
   Description=Ultra Verdello Street Fight 7
   After=network.target

   [Service]
   Type=simple
   WorkingDirectory=/opt/uvsf7
   ExecStart=/usr/bin/node /opt/uvsf7/server/server.js
   Restart=always
   RestartSec=3
   Environment=PORTA=80
   User=root

   [Install]
   WantedBy=multi-user.target
   ```

4. Attiva e avvia:

   ```
   systemctl daemon-reload
   systemctl enable --now uvsf7
   systemctl status uvsf7 --no-pager
   ```

5. Firewall (Aruba parte con solo SSH aperto):

   ```
   ufw allow 80/tcp
   ufw status
   ```

6. Verifica dall'esterno:

   ```
   curl http://<ip-pubblico>/stato
   ```

## Come funziona la rete

- L'**host** (chi crea la stanza) simula la partita nel browser e manda 30
  fotogrammi al secondo all'ospite: posizioni, vita, stamina, ultimate, sprite,
  proiettili, timer, risultato.
- L'**ospite** non simula nulla: disegna lo stato ricevuto e manda i propri tasti
  all'host, che li applica al giocatore 2 con gli stessi comandi della CPU.
- Il **server** fa solo da ponte dentro la stanza (crea, entra, inoltra) e non
  calcola il combattimento: con 1 GB di RAM regge molte stanze.

Il campo di gioco viene fissato all'inizio della partita (stesse misure del
canvas dell'host) e non cambia più: ridimensionare la finestra durante una
partita online non ha effetto.

## Limiti noti

- La pausa (Esc) durante una partita online ferma solo il browser in cui viene
  premuta: l'altro continua a giocare e l'host resta l'unico che simula.
- Se l'host chiude la pagina la partita finisce per entrambi; se la chiude
  l'ospite, l'host torna al menu.
- Non c'è riconnessione automatica: si ricrea la stanza.
