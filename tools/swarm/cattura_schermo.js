// tools/swarm/cattura_schermo.js
// Cattura uno screenshot del gioco in partita e lo salva come PNG.
// Serve per due cose: provare il formato immagine di Jev su una schermata vera,
// e guardare con i propri occhi cosa ha visto il bot.
//
// Uso: node tools/swarm/cattura_schermo.js [file-di-uscita.png] [larghezzaMax]

const fs = require('fs');
const path = require('path');
const { apriNavigatore } = require('./navigatore.js');
const { avviaServerDiProva, fermaServerDiProva } = require('./serverProva.js');

function attendi(ms) { return new Promise((risolvi) => setTimeout(risolvi, ms)); }

async function main() {
    const uscita = process.argv[2] || path.join(__dirname, '..', '..', 'assets', 'Skins', '_contatti', 'schermo-prova.png');
    const larghezza = Number(process.argv[3] || 960);

    const server = await avviaServerDiProva(8320);
    const nav = await apriNavigatore({ porta: 9420, url: server.url, attesaCaricamentoMs: 4000 });

    try {
        await nav.valuta("avviaSelezioneCPU('normale'); confermaScelta(1); confermaScelta(2); 'avviata'");
        await attendi(2500);
        await nav.premiTasto('h', 60);
        await attendi(150);

        // pagina intera (canvas + HUD): il canvas da solo non ha le barre della vita
        const base64 = await nav.screenshotPagina(Number(process.env.SCALA || 1));
        if (!base64) throw new Error('cattura non riuscita');

        fs.mkdirSync(path.dirname(uscita), { recursive: true });
        fs.writeFileSync(uscita, Buffer.from(base64, 'base64'));
        console.log('salvato:', uscita, '|', Math.round(Buffer.from(base64, 'base64').length / 1024) + ' KB');
    } finally {
        nav.chiudi();
        fermaServerDiProva(server);
    }
}

main().catch((errore) => { console.error('FALLITO:', errore.message); process.exit(1); });
