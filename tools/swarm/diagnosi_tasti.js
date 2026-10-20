// tools/swarm/diagnosi_tasti.js — i tasti CDP arrivano al gestore del gioco?
const { apriNavigatore } = require('./navigatore.js');
const { avviaServerDiProva, fermaServerDiProva } = require('./serverProva.js');

function attendi(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
    const server = await avviaServerDiProva(8300);
    const nav = await apriNavigatore({ porta: 9411, url: server.url, attesaCaricamentoMs: 4000 });

    try {
        await nav.valuta("avviaSelezioneCPU('normale'); confermaScelta(1); confermaScelta(2); 'avviata'");
        await attendi(1500);

        // contatore di eventi tastiera che arrivano alla pagina
        await nav.valuta(
            "window._tasti = []; window.addEventListener('keydown', function(e){ window._tasti.push(e.key); }, true); 'ok'"
        );

        const xIniziale = await nav.valuta('Math.round(Player.position.x)');
        const vitaIniziale = await nav.valuta('Math.round(Enemy.health)');

        // tieni premuto D per 600 ms (destra)
        await nav.valuta("window._tasti.length = 0; 'pulito'");
        await nav.invia('Input.dispatchKeyEvent', {
            type: 'keyDown', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68
        });
        await attendi(600);
        await nav.invia('Input.dispatchKeyEvent', {
            type: 'keyUp', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68
        });
        await attendi(100);
        const xDopo = await nav.valuta('Math.round(Player.position.x)');
        const tastiVisti = await nav.valuta('JSON.stringify(window._tasti)');

        console.log('tasti arrivati alla pagina:', tastiVisti);
        console.log('x prima:', xIniziale, '-> dopo aver tenuto D:', xDopo, '(spostato:', xDopo !== xIniziale, ')');

        // attacco: campiono il flag per 500 ms
        await nav.premiTasto('h', 60);
        const campioni = [];
        for (let i = 0; i < 10; i++) {
            campioni.push(await nav.valuta('Player.isAttacking ? 1 : 0'));
            await attendi(50);
        }
        console.log('Player.isAttacking campionato:', campioni.join(''));
        console.log('vita nemico prima/dopo:', vitaIniziale, await nav.valuta('Math.round(Enemy.health)'));

        // che dice il gestore? esiste premiAzione ed è globale?
        console.log('premiAzione:', await nav.valuta('typeof premiAzione'));
        console.log('azioneDaTasto("h"):', await nav.valuta('typeof azioneDaTasto === "function" ? String(azioneDaTasto("h")) : "assente"'));
    } finally {
        nav.chiudi();
        fermaServerDiProva(server);
    }
}

main().catch((e) => { console.error('FALLITO:', e.message); process.exit(1); });
