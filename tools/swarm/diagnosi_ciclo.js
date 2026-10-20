// tools/swarm/diagnosi_ciclo.js — perché il ciclo non parte in headless?
const { apriNavigatore } = require('./navigatore.js');
const { avviaServerDiProva, fermaServerDiProva } = require('./serverProva.js');

function attendi(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
    const server = await avviaServerDiProva(8300);
    const nav = await apriNavigatore({ porta: 9410, url: server.url, attesaCaricamentoMs: 5000 });

    try {
        const letture = {
            visibilita: await nav.valuta('document.visibilityState'),
            state: await nav.valuta('typeof statoCorrente !== "undefined" ? statoCorrente : "assente"'),
            frame: await nav.valuta('typeof frameGioco !== "undefined" ? frameGioco : "assente"'),
            raf: await nav.valuta('typeof requestAnimationFrame'),
            lastKey: await nav.valuta('typeof lastKey !== "undefined" ? String(lastKey) : "assente"'),
            attesaPronto: await nav.valuta('typeof avviaGiocoQuandoPronto'),
            immaginiCaricate: await nav.valuta(
                "(function(){try{var n=0,t=0;for(var k in immagini){t++;if(immagini[k]&&immagini[k].complete)n++;}return n+'/'+t;}catch(e){return 'errore: '+e.message;}})()"
            ),
            errore: await nav.valuta('window._ultimoErrore || null')
        };
        console.log(JSON.stringify(letture, null, 2));

        // la rAF gira?
        const provaRaf = await nav.valuta(
            "new Promise(function(r){var n=0;function passo(){n++;if(n<20){requestAnimationFrame(passo);}else{r(n);}}requestAnimationFrame(passo);setTimeout(function(){r(n);},1500);})"
        );
        console.log('frame di rAF in ~1,5 s:', provaRaf);

        const titolo = await nav.valuta('document.title');
        console.log('titolo:', titolo);

        // cosa dice la console?
        const console2 = await nav.valuta('JSON.stringify(window._erroriConsole || [])');
        console.log('errori in pagina:', console2);
    } finally {
        nav.chiudi();
        fermaServerDiProva(server);
    }
}

main().catch((e) => { console.error('FALLITO:', e.message); process.exit(1); });
