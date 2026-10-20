// tools/prova_swarm_giudice.js — il giudice, senza spendere chiamate.
// Si prova la forma della richiesta e le regole di scarto, non la rete.

const fs = require('fs');
const os = require('os');
const path = require('path');

const percorso = path.join(__dirname, 'swarm', 'giudice.js');
const { DOMANDE, CATEGORIE, eDifetto } = require(percorso);

const risultati = [];
function verifica(nome, condizione, dettaglio) {
    risultati.push(!!condizione);
    console.log((condizione ? 'OK   ' : 'NO   ') + nome + (dettaglio ? '  [' + dettaglio + ']' : ''));
}

// --- forma delle domande ---
verifica('tre domande: difetto, categoria, gravità',
    Object.keys(DOMANDE).length === 3 && !!DOMANDE.difetto_visibile && !!DOMANDE.categoria && !!DOMANDE.gravita);

verifica('difetto_visibile è un noul con criteria vero/falso',
    DOMANDE.difetto_visibile.type === 'noul' &&
    typeof DOMANDE.difetto_visibile.criteria === 'object' &&
    !!DOMANDE.difetto_visibile.criteria.true && !!DOMANDE.difetto_visibile.criteria.false);

verifica('categoria è una choice con criteria oggetto',
    DOMANDE.categoria.type === 'choice' && typeof DOMANDE.categoria.criteria === 'object' &&
    Array.isArray(DOMANDE.categoria.criteria) === false);

verifica('gravita è uno score con lista ordinata',
    DOMANDE.gravita.type === 'score' && Array.isArray(DOMANDE.gravita.criteria) &&
    DOMANDE.gravita.criteria.length === 5);

verifica('le categorie della choice coincidono con CATEGORIE condivise con il rapporto',
    JSON.stringify(Object.keys(DOMANDE.categoria.criteria)) === JSON.stringify(CATEGORIE));

verifica('il testo di taratura dice che le barre colorate sono normali',
    DOMANDE.difetto_visibile.instructions.indexOf('NORMALI') !== -1);

// --- regola del difetto ---
verifica('difetto sotto soglia non è un difetto', eDifetto({ difetto: 0.4, categoria: 'hud' }) === false);
verifica('difetto sopra soglia è un difetto', eDifetto({ difetto: 0.6, categoria: 'sprite' }) === true);
verifica('categoria "nessuno" non è un difetto', eDifetto({ difetto: 0.9, categoria: 'nessuno' }) === false);
verifica('giudizio nullo non è un difetto', eDifetto(null) === false);

// --- scarto delle immagini troppo grosse, senza rete ---
const { giudica } = require(percorso);
(async function () {
    const troppoGrande = Buffer.alloc(3000).toString('base64');
    const risultato = await giudica(troppoGrande, 'prova', { massimoByte: 1000 });
    verifica('immagine oltre il limite viene scartata senza chiamare Jev', risultato === null);

    const vuota = await giudica('', 'prova');
    verifica('immagine vuota non produce una chiamata', vuota === null);

    // --- chiave mancante: errore parlante, non un crash muto ---
    const fileVuoto = path.join(os.tmpdir(), 'uvsf7-env-vuoto-' + Date.now() + '.txt');
    fs.writeFileSync(fileVuoto, '', 'utf8');
    const vecchioEnv = process.env.JEV_ENV;
    process.env.JEV_ENV = fileVuoto;
    delete require.cache[require.resolve(percorso)];
    const giudiceNuovo = require(percorso);
    let erroreParlante = false;
    try {
        giudiceNuovo.chiaveJev();
    } catch (errore) {
        erroreParlante = errore.message.indexOf('TYPESAFE_API_KEY') !== -1;
    }
    verifica('senza chiave l\'errore dice che manca TYPESAFE_API_KEY', erroreParlante);
    if (vecchioEnv === undefined) delete process.env.JEV_ENV; else process.env.JEV_ENV = vecchioEnv;
    fs.rmSync(fileVuoto, { force: true });

    const passate = risultati.filter(Boolean).length;
    console.log('\n' + passate + '/' + risultati.length + ' verifiche passate');
    process.exit(passate === risultati.length ? 0 : 1);
})();
