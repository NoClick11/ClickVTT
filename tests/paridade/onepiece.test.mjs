// Paridade das regras de One Piece: o TS tem de bater com os mesmos casos que o PHP (tests/Unit/Nucleo/OnePieceRegrasTest.php).
// Rodar: npm run test:regras (Node executa o .ts direto, por isso regras.ts é puro, sem Vue).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ALVOS_DE_EFEITO } from '../../resources/js/app/sistemas/onepiece/alvos.ts';
import { CONDICOES } from '../../resources/js/app/sistemas/onepiece/condicoes.ts';
import {
    ATRIBUTOS,
    calcular,
    camposDoDadoDeVida,
    camposDoDescanso,
    camposDoGastoDePP,
    PERICIAS,
} from '../../resources/js/app/sistemas/onepiece/regras.ts';

const ler = (nome) => JSON.parse(readFileSync(new URL(`./${nome}`, import.meta.url), 'utf8'));
const casos = ler('onepiece.json');

for (const caso of casos) {
    test(caso.nome, () => {
        const r = calcular(caso.ficha, {});
        for (const [chave, valor] of Object.entries(caso.esperado)) {
            assert.ok(chave in r, `falta ${chave}`);
            assert.ok(Math.abs(r[chave] - valor) < 0.0001, `${chave}: esperado ${valor}, veio ${r[chave]}`);
        }
    });
}

const ficha = casos[1].ficha; // nível 5, 5 PP por nível (máximo 25)

test('atributos e perícias do One Piece', () => {
    assert.deepEqual(
        ATRIBUTOS.map((a) => a.id),
        ['for', 'des', 'con', 'sab', 'pre', 'von'],
    );
    assert.equal(PERICIAS.length, 19);
    assert.equal(PERICIAS.find((p) => p.id === 'haki').atributo, 'von');
    assert.equal(PERICIAS.find((p) => p.id === 'provocacao').atributo, 'pre');
});

test('gastar PP numa técnica desconta; sem PP suficiente não usa', () => {
    const f = { ...ficha, pp: { atual: 10, porNivel: 5 } };
    assert.deepEqual(camposDoGastoDePP(f, 4), { 'pp.atual': 6 });
    assert.deepEqual(camposDoGastoDePP(f, 10), { 'pp.atual': 0 });
    assert.equal(camposDoGastoDePP(f, 11), null);
});

test('descanso longo restaura PV e PP até o máximo efetivo; o curto não', () => {
    const f = { ...ficha, pv: { atual: 5, max: 40, temp: 0 }, pp: { atual: 3, porNivel: 5 }, exaustao: 2, dadosVida: { restantes: 1, tipo: 'd8' } };
    const longo = camposDoDescanso(f, 'longo', 40, 25);
    assert.equal(longo['pv.atual'], 40);
    assert.equal(longo['pp.atual'], 25);
    assert.equal(longo.exaustao, 1);
    assert.equal(longo['dadosVida.restantes'], 3);
    assert.ok(!('morte.sucessos' in longo) && !('magias.espacos' in longo));
    assert.ok(!('pp.atual' in camposDoDescanso(f, 'curto', 40, 25)));
});

test('dado de vida continua curando', () => {
    const f = { pv: { atual: 10, max: 30, temp: 0 }, dadosVida: { restantes: 3, tipo: 'd8' } };
    assert.deepEqual(camposDoDadoDeVida(f, 7, 30), { 'dadosVida.restantes': 2, 'pv.atual': 17 });
});

test('condições e alvos de efeito conferem com o servidor', () => {
    assert.deepEqual(CONDICOES, ler('condicoes-onepiece.json'));
    assert.deepEqual(ALVOS_DE_EFEITO.map((a) => a.id).sort(), ler('alvos-onepiece.json'));
    assert.equal(new Set(ALVOS_DE_EFEITO.map((a) => a.id)).size, ALVOS_DE_EFEITO.length, 'ids repetidos');
    assert.ok(ALVOS_DE_EFEITO.some((a) => a.id === 'pp.max'));
});
