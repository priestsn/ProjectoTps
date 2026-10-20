// tools/swarm/insegui_colpo.js — l'ultimo segnale aperto: un colpo registrato
// dal gioco che non toglie vita. Qui si cerca apposta, in VS LOCALE, con
// l'avversario fermo: per ogni fendente si registra tutto quello che serve a
// capire se è un difetto o un esito voluto (parata, blocco perfetto, danno 0).
const { apriNavigatore } = require('./navigatore.js');
const { avviaServerDiProva, fermaServerDiProva } = require('./serverProva.js');

function attendi(ms) { return new Promise((r) => setTimeout(r, ms)); }

const STATO = `(function(){
    var io = (typeof Player !== 'undefined') ? Player : null;
    var ne = (typeof Enemy !== 'undefined') ? Enemy : null;
    if (!io || !ne) return null;
    return {
        attacco: !!io.isAttacking,
        haColpito: !!io.attaccoHaColpito,
        frameAttacco: io.framesAttacco,
        vitaMia: Math.round(io.health),
        vitaNemico: Math.round(ne.health),
        nemicoParata: !!ne.isParata,
        nemicoDanno: !!ne.isTakingDmg,
        nemicoStun: !!ne.isStunned,
        distanza: Math.round(Math.abs(io.position.x - ne.position.x))
    };
})()`;

async function main() {
    const server = await avviaServerDiProva(8345);
    const nav = await apriNavigatore({ porta: 9445, url: server.url, attesaCaricamentoMs: 4000 });

    const sospetti = [];
    let fendenti = 0;
    let conDanno = 0;

    try {
        await nav.valuta("apriSelezione(MODALITA.LOCALE); sceltaP1 = 0; sceltaP2 = 2; confermaScelta(1); confermaScelta(2); 'avviata'");
        await attendi(1500);

        for (let giro = 0; giro < 40; giro++) {
            // avvicino
            for (let passo = 0; passo < 8; passo++) {
                const prima = await nav.valuta(STATO);
                if (!prima || prima.distanza < 110) break;
                await nav.premiTasto('d', 100);
            }

            const prima = await nav.valuta(STATO);
            if (!prima || prima.distanza > 140) continue;

            const vitaPrima = prima.vitaNemico;
            const colpitoPrima = prima.haColpito;
            await nav.premiTasto('h', 60);

            // Il fendente è partito davvero? Il flag dell'impatto resta acceso
            // dall'attacco precedente, quindi si guarda anche isAttacking.
            await attendi(80);
            const dopoPressione = await nav.valuta(STATO);
            const partito = !!dopoPressione && dopoPressione.attacco;

            // seguo il fendente fino a fine animazione
            let haColpito = false;
            let parataVista = false;
            let dannoVisto = false;
            for (let campione = 0; campione < 12; campione++) {
                await attendi(60);
                const ora = await nav.valuta(STATO);
                if (!ora) break;
                if (ora.haColpito && !colpitoPrima) haColpito = true;
                if (ora.nemicoParata) parataVista = true;
                if (ora.nemicoDanno) dannoVisto = true;
            }

            if (!partito) {
                // pressione rifiutata (recupero): non è un fendente, si salta
                continue;
            }

            const dopo = await nav.valuta(STATO);
            if (!dopo) break;

            fendenti++;
            if (dopo.vitaNemico < vitaPrima) {
                conDanno++;
            } else if (haColpito) {
                sospetti.push({
                    giro: giro,
                    distanza: prima.distanza,
                    vitaPrima: vitaPrima,
                    vitaDopo: dopo.vitaNemico,
                    parataVista: parataVista,
                    dannoVisto: dannoVisto,
                    nemicoStun: dopo.nemicoStun
                });
            }

            // se l'avversario è morto, si ricomincia
            if (dopo.vitaNemico <= 0 || dopo.vitaMia <= 0 || giro % 12 === 11) {
                await nav.valuta('avviaSelezioneCPU("normale"); sceltaP1 = 0; sceltaP2 = 2; confermaScelta(1); confermaScelta(2); "riavviata"');
                await attendi(1200);
            }
        }

        console.log('fendenti tentati:', fendenti, '| con danno:', conDanno, '| sospetti:', sospetti.length);
        if (sospetti.length) {
            console.log('\nFendenti con impatto registrato e vita invariata:');
            for (const s of sospetti.slice(0, 10)) console.log('  ', JSON.stringify(s));
            const conParata = sospetti.filter((s) => s.parataVista || s.dannoVisto).length;
            console.log('\ndi cui con parata o danno subito dall\'avversario (esito voluto):', conParata);
        }
    } finally {
        nav.chiudi();
        fermaServerDiProva(server);
    }
}

main().catch((e) => { console.error('FALLITO:', e.message); process.exit(1); });
