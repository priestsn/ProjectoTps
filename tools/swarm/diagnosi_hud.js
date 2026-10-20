// tools/swarm/diagnosi_hud.js — le bande nere/blu in alto sono un difetto vero
// o un elemento dell'interfaccia? Elenca gli elementi in cima all'area di gioco
// con posizione e stile, così si risponde con i numeri invece che a occhio.
const { apriNavigatore } = require('./navigatore.js');
const { avviaServerDiProva, fermaServerDiProva } = require('./serverProva.js');

function attendi(ms) { return new Promise((r) => setTimeout(r, ms)); }

const SONDA = `
(function () {
    var area = document.querySelector('#areaGioco');
    if (!area) return 'area di gioco assente';
    var r = area.getBoundingClientRect();
    var elenco = [];
    area.querySelectorAll('*').forEach(function (el) {
        var b = el.getBoundingClientRect();
        if (b.width < 8 || b.height < 3) return;
        if (b.top - r.top > r.height * 0.25) return;   // solo la fascia alta
        var s = getComputedStyle(el);
        elenco.push({
            sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).split(' ').join('.') : ''),
            x: Math.round(b.left - r.left), y: Math.round(b.top - r.top),
            w: Math.round(b.width), h: Math.round(b.height),
            sfondo: s.backgroundColor, bordo: s.borderColor,
            immagine: s.backgroundImage === 'none' ? null : s.backgroundImage.slice(0, 60),
            ombra: s.boxShadow === 'none' ? null : s.boxShadow.slice(0, 60),
            z: s.zIndex, posizione: s.position
        });
    });
    return elenco;
})()
`;

async function main() {
    const server = await avviaServerDiProva(8321);
    const nav = await apriNavigatore({ porta: 9421, url: server.url, attesaCaricamentoMs: 4000 });

    try {
        await nav.valuta("avviaSelezioneCPU('normale'); confermaScelta(1); confermaScelta(2); 'avviata'");
        await attendi(2000);

        const dimensioni = await nav.valuta(
            "(function(){var a=document.querySelector('#areaGioco').getBoundingClientRect();" +
            "var c=document.querySelector('canvas').getBoundingClientRect();" +
            "return JSON.stringify({area:[Math.round(a.width),Math.round(a.height)],canvas:[Math.round(c.width),Math.round(c.height)],dpr:window.devicePixelRatio});})()"
        );
        console.log('dimensioni:', dimensioni);

        const elenco = await nav.valuta(SONDA);
        console.log('elementi nella fascia alta:', Array.isArray(elenco) ? elenco.length : elenco);
        if (Array.isArray(elenco)) {
            for (const voce of elenco) {
                console.log(JSON.stringify(voce));
            }
        }
    } finally {
        nav.chiudi();
        fermaServerDiProva(server);
    }
}

main().catch((e) => { console.error('FALLITO:', e.message); process.exit(1); });
