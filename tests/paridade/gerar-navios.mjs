/**
 * Gera, a partir do TS, `app/Sistemas/OnePiece/dados/navios.json` (tabelas que o PHP lê) e `tests/paridade/navios-casos.json`
 * (navios variados com o resultado das regras, conferido pelo Node e pelo PHPUnit). Rode ao mudar `navios/dados.ts` ou `regras.ts`:
 *   node tests/paridade/gerar-navios.mjs
 */
import { writeFileSync } from 'node:fs';
import { CANHOES, COMODOS, DADOS_DOS_NAVIOS, MASTROS, MODELOS, MOTORES } from '../../resources/js/app/sistemas/onepiece/navios/dados.ts';
import * as R from '../../resources/js/app/sistemas/onepiece/navios/regras.ts';
const raiz = new URL('../../', import.meta.url).pathname;
if (process.argv[2] !== 'casos') writeFileSync(raiz + 'app/Sistemas/OnePiece/dados/navios.json', JSON.stringify(DADOS_DOS_NAVIOS, null, 1) + '\n');
// Casos de paridade: navios variados, com o que as regras devolvem
let i = 0;
const uid = () => 'p' + i++;
const navios = [];
for (const m of MODELOS) navios.push({ nome: m.id, navio: R.navioDoModelo(m.id, uid), pv: 99999 });
const base = () => R.navioDoModelo('grande', uid);
const v = (nome, f, pv = 500) => {
    const n = base();
    f(n);
    navios.push({ nome, navio: n, pv });
};
v('avariado', () => {}, 400);
v('muito-danificado', () => {}, 250);
v('irreparavel', () => {}, 20);
v(
    'irreparavel-kairoseki',
    (n) => {
        n.kairoseki = { tipo: 'kairoseki', pronto_dia: null };
    },
    20,
);
v('zerado', () => {}, 0);
v('em-obra', (n) => {
    n.madeira = { tipo: 'adam', pronto_dia: 30, antes: 'cerejeira' };
    n.fortificacao = { tipo: 'aco', pronto_dia: 9 };
    n.mastros[0].pronto_dia = 5;
    n.comodos.push({ uid: uid(), tipo: 'cozinha', pronto_dia: 4 });
});
v('comodos', (n) => {
    for (const t of ['cozinha', 'despensa', 'refeitorio', 'gerador', 'sala-maquinas', 'quarto-vigilancia', 'dormitorio', 'dormitorio'])
        n.comodos.push({ uid: uid(), tipo: t, pronto_dia: null });
    n.motores.push({ uid: uid(), tipo: 'vapor', pronto_dia: null }, { uid: uid(), tipo: 'turbina', pronto_dia: null });
});
v('sem-manutencao', (n) => {
    for (const t of ['cozinha', 'gerador', 'quarto-vigilancia']) n.comodos.push({ uid: uid(), tipo: t, pronto_dia: null });
    n.manutencao.em_dia = false;
});
v(
    'oficios',
    (n) => {
        n.oficios = { carpinteiro: true, timoneiro: true, timoneiroNaNavegacao: true };
        n.feito_por_carpinteiro = true;
        n.klabautermann = true;
    },
    250,
);
v(
    'carpinteiro',
    (n) => {
        n.oficios.carpinteiro = true;
    },
    300,
);
v('cheio', (n) => {
    for (let k = 0; k < 26; k++) n.comodos.push({ uid: uid(), tipo: 'dormitorio', pronto_dia: null });
    for (let k = 0; k < 10; k++) n.canhoes.push({ uid: uid(), tipo: 'comum', pronto_dia: null });
});
v('tripulado', (n) => {
    n.comodos.push({ uid: uid(), tipo: 'cozinha', pronto_dia: null });
    n.tripulacao = [
        { uid: 'a', nome: 'Capitã', personagem_id: 1, qtd: 1, funcoes: ['capitao', 'navegacao'] },
        { uid: 'b', nome: 'Cozinheiro', personagem_id: null, qtd: 1, funcoes: ['cozinheiro'] },
        { uid: 'c', nome: 'Marujos', personagem_id: null, qtd: 6, funcoes: ['navegacao', 'criado-de-bordo'] },
        { uid: 'd', nome: 'Vigias', personagem_id: null, qtd: 5, funcoes: ['sentinela'] },
        { uid: 'e', nome: 'Artilheiros', personagem_id: null, qtd: 5, funcoes: ['artilheiro'] },
        { uid: 'f', nome: 'Rapazes', personagem_id: null, qtd: 2, funcoes: ['rapaz-da-polvora'] },
        { uid: 'g', nome: 'Multidão', personagem_id: null, qtd: 60, funcoes: [] },
    ];
});
const colossal = R.navioDoModelo('colossal', uid);
colossal.comodos.push({ uid: uid(), tipo: 'sala-maquinas', pronto_dia: null });
navios.push({ nome: 'colossal-2-salas', navio: colossal, pv: 1000 });
const pequeno = R.navioDoModelo('pequeno', uid);
navios.push({ nome: 'pequeno-ferido', navio: pequeno, pv: 60 });
const obras = [];
for (const g of ['madeira', 'fortificacao', 'kairoseki', 'ancora', 'leme', 'mastros', 'motores', 'canhoes', 'comodos']) {
    const tipos =
        g === 'madeira'
            ? ['cedro', 'adam', 'x']
            : g === 'fortificacao'
              ? ['aco', 'aco-temperado']
              : g === 'kairoseki'
                ? ['kairoseki']
                : g === 'ancora'
                  ? ['normal', 'robusta']
                  : g === 'leme'
                    ? ['tora', 'circular']
                    : g === 'mastros'
                      ? MASTROS.map((x) => x.id)
                      : g === 'motores'
                        ? MOTORES.map((x) => x.id)
                        : g === 'canhoes'
                          ? CANHOES.map((x) => x.id)
                          : COMODOS.map((x) => x.id);
    for (const t of tipos) obras.push([g, t]);
}
const casos = navios.map(({ nome, navio, pv }) => ({
    nome,
    navio,
    pv,
    calculo: R.calcularNavio(navio, pv),
    efetivo: R.efetivoDoNavio(navio),
    dano: [0, 7, 40].map((d) => R.danoNoNavio(navio, d)),
    conserto: { carpinteiro: R.consertoDoNavio(navio, pv, 'carpinteiro'), estaleiro: R.consertoDoNavio(navio, pv, 'estaleiro') },
    obras: obras.map(([g, t]) => ({
        grupo: g,
        tipo: t,
        problema: R.problemaDaObra(navio, g, t),
        comprar: R.custoDaObra(navio, g, t, 'comprar'),
        construir: R.custoDaObra(navio, g, t, 'construir'),
    })),
}));
const tripulacoes = [
    [{ uid: 'a', nome: 'A', personagem_id: null, qtd: 1, funcoes: ['capitao', 'imediato'] }],
    [{ uid: 'a', nome: 'A', personagem_id: 3, qtd: 2, funcoes: [] }],
    [{ uid: 'a', nome: 'A', personagem_id: null, qtd: 1, funcoes: ['sentinela', 'monitor', 'navegacao', 'artilheiro'] }],
    [{ uid: 'a', nome: ' ', personagem_id: null, qtd: 1, funcoes: [] }],
    [{ uid: 'a', nome: 'A', personagem_id: null, qtd: 0, funcoes: [] }],
    [{ uid: 'a', nome: 'A', personagem_id: null, qtd: 1, funcoes: ['x'] }],
    [{ uid: 'a', nome: 'A', personagem_id: null, qtd: 1, funcoes: ['sentinela', 'sentinela'] }],
    [
        { uid: 'a', nome: 'A', personagem_id: null, qtd: 1, funcoes: ['capitao'] },
        { uid: 'b', nome: 'B', personagem_id: null, qtd: 1, funcoes: ['capitao'] },
    ],
    [
        { uid: 'a', nome: 'A', personagem_id: 1, qtd: 1, funcoes: ['capitao', 'navegacao', 'combatente'] },
        { uid: 'b', nome: 'B', personagem_id: null, qtd: 40, funcoes: ['criado-de-bordo'] },
    ],
].map((lista) => ({ lista, problema: R.problemaDaTripulacao(lista) }));
writeFileSync(raiz + 'tests/paridade/navios-casos.json', JSON.stringify({ casos, tripulacoes }) + '\n');
console.log(casos.length, 'casos');
