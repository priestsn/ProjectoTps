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
   Environment=REPORT_DIR=/var/lib/uvsf7/reports
   Environment=REPORT_CHIAVE=cambia-questa-chiave
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

## Indirizzo pubblico fisso con HTTPS (Caddy + dominio)

L'indirizzo pubblico **non va scritto nel repository**: si imposta solo qui sul
server. Scegli un nome (dominio tuo, sottodominio DuckDNS o `<nome>.<ip>.nip.io`),
Caddy prende il certificato Let's Encrypt da solo e il WebSocket passa insieme
all'HTTP. Il server Node ascolta solo su localhost.

```bash
# 1. Caddy dal repository ufficiale
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' -o /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install -y caddy

# 2. Caddyfile
cat > /etc/caddy/Caddyfile <<'FINE'
# sostituisci <tuo-dominio> col nome pubblico che hai scelto
<tuo-dominio> {
    encode zstd gzip
    reverse_proxy 127.0.0.1:8090
}
FINE

# 3. firewall per HTTPS
ufw allow 80/tcp
ufw allow 443/tcp
```

Nel servizio `uvsf7`, `PORTA=8090` e `HOST=127.0.0.1`: la porta 80 e la 443
sono di Caddy, che si occupa anche del rinnovo del certificato.

Per usare **DuckDNS** invece di nip.io basta cambiare la prima riga del
`Caddyfile` con il proprio dominio (per esempio `uvsf7.duckdns.org`), tenere
aggiornato l'IP con il token DuckDNS e ricaricare:

```bash
curl "https://www.duckdns.org/update?domains=uvsf7&token=<TOKEN>&ip="
systemctl reload caddy
```

## Vecchio metodo: Cloudflare Quick Tunnel (non più attivo)

L'accesso in chiaro sulla porta 80 (`http://<ip-del-server>`) funziona, ma molte reti
scolastiche o aziendali bloccano HTTP su IP nudo. Con `cloudflared` il gioco
esce su un indirizzo HTTPS senza aprire porte e senza dominio:

```
apt install -y ./cloudflared.deb        # pacchetto da github.com/cloudflare/cloudflared
cloudflared tunnel --url http://127.0.0.1:80
```

L'indirizzo compare nel log (`https://<nome-casuale>.trycloudflare.com`). Sul
server è configurato come servizio:

```
systemctl status uvsf7-tunnel
grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' /var/log/uvsf7-tunnel.log | tail -1
```

Da sapere:

- il nome è casuale e **cambia a ogni riavvio del servizio** (crash, reboot,
  `systemctl restart`): per una prova va bene, per un indirizzo fisso serve un
  dominio con un tunnel nominato;
- il tunnel inoltra anche il WebSocket, quindi VS ONLINE funziona identico;
- chi ha il link può giocare: non c'è autenticazione;
- `systemctl stop uvsf7-tunnel` chiude l'accesso pubblico, la porta 80 resta
  raggiungibile via IP.

## Limiti noti

- La pausa (Esc) durante una partita online ferma solo il browser in cui viene
  premuta: l'altro continua a giocare e l'host resta l'unico che simula.
- Se l'host chiude la pagina la partita finisce per entrambi; se la chiude
  l'ospite, l'host torna al menu.
- Non c'è riconnessione automatica: si ricrea la stanza.

## Report bug salvati sul server

Il pannello `REPORT BUG` del gioco invia i report con `POST /report`. Il server li
accoda in un file Markdown per giorno dentro `REPORT_DIR` (default
`/var/lib/uvsf7/reports`):

```
/var/lib/uvsf7/reports/report-2026-10-17.md
```

Ogni blocco contiene il report formattato, data ISO, IP del client e user agent.
Non serve scaricare nulla dal browser e non c'è autenticazione per inviare
(chi gioca deve poter segnalare), ma c'è un limite di 20 report ogni 10 minuti
per IP e il corpo massimo è 32 KB.

Per **leggere** i report serve la chiave impostata in `REPORT_CHIAVE`:

```
curl "http://<server>/reports?chiave=<CHIAVE>"
curl "http://<server>/reports/file?chiave=<CHIAVE>&nome=report-2026-10-17.md"
```

Senza `REPORT_CHIAVE` gli endpoint di lettura rispondono 403 (i report si leggono
comunque via SSH dal file). Se il server è irraggiungibile, il gioco tiene il
report in `localStorage` e lo reinvia alla riapertura del pannello.
