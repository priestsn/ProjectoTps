// tools/swarm/diagnosi_colpo.js — il colpo registrato che non fa danno è vero?
// Scenario controllato in VS LOCALE: avvicino P1 a P2, attacco, e leggo ogni
// 50 ms cosa dice il gioco. Niente CPU che risponde: qui si misura e basta.
const { apriNavigatore } = require('./navigatore.js');
const { avviaServerDiProva, fermaServerDiProva } = require('./serverProva.js');

function attendi(ms) { return new Promise((r) => setTimeout(r, ms)); }

const LETTURA = `(function(){
    return {
        attacco: !!Player.isAttacking,
        haColpito: !!Player.attaccoHaColpito,
        frameAttacco: Player.framesAttacco,
        passoImpatto: Player.passoImpatto,
        p2vita: Math.round(Enemy.health),
        p2parata: !!Enemy.isParata,
        p2danno: !!Enemy.isTakingDmg,
        p2stun: !!Enemy.isStunned,
        p1x: Math.round(Player.position.x),
        p2x: Math.round(Enemy.position.x)
    };
})()`;

async function main() {
    const server = await avviaServerDiProva(8322);
    const nav = await apriNavigatore({ porta: 9422, url: server.url, attesaCaricamentoMs: 4000 });

    try {
        // VS LOCALE: P2 non si muove da solo
        await nav.valuta("apriSelezione(MODALITA.LOCALE); confermaScelta(1); confermaScelta(2); 'avviata'");
        await attendi(1500);
        console.log('stato:', await nav.valuta('statoCorrente'));

        // avvicino P1 a P2 tenendo premuto destra
        for (let giro = 0; giro < 20; giro++) {
            const distanza = await nav.valuta('Math.abs(Player.position.x - Enemy.position.x)');
            if (distanza < 110) break;
            await nav.premiTasto('d', 120);
        }
        console.log('distanza:', await nav.valuta('Math.round(Math.abs(Player.position.x - Enemy.position.x))'));

        // attacco e lettura serrata
        await nav.premiTasto('h', 60);
        const righe = [];
        for (let giro = 0; giro < 16; giro++) {
            righe.push(await nav.valuta(LETTURA));
            await attendi(50);
        }

        console.log('');
        console.log('t(ms) attacco haColpito frame/passo p2vita parata danno stun');
        righe.forEach((voce, indice) => {
            console.log(
                String(indice * 50).padStart(5) + '  ' +
                (voce.attacco ? 'si' : 'no').padStart(7) + ' ' +
                (voce.haColpito ? 'SI' : 'no').padStart(9) + '  ' +
                (voce.frameAttacco + '/' + voce.passoImpatto).padStart(7) + '   ' +
                String(voce.p2vita).padStart(5) + (voce.p2parata ? '  PARATA' : '') +
                (voce.p2danno ? '  DANNO' : '') + (voce.p2stun ? '  STUN' : '')
            );
        });

        const primoHa = righe.findIndex((voce) => voce.haColpito);
        const vitaPrima = righe[0].p2vita;
        const vitaDopo = righe[righe.length - 1].p2vita;
        console.log('');
        console.log('ha colpito al campione:', primoHa, '| vita', vitaPrima, '->', vitaDopo);
    } finally {
        nav.chiudi();
        fermaServerDiProva(server);
    }
}

main().catch((e) => { console.error('FALLITO:', e.message); process.exit(1); });
