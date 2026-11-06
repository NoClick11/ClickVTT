// Paridade do motor de efeitos: o TS tem de bater com os mesmos casos que o PHP (tests/Unit/Nucleo/EfeitosTest.php).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { aplicar, rolagem } from '../../resources/js/app/nucleo/efeitos/efeitos.ts';
import { avaliar, FormulaInvalida, sintaxeValida } from '../../resources/js/app/nucleo/efeitos/formula.ts';

const ler = (arquivo) => JSON.parse(readFileSync(new URL(arquivo, import.meta.url), 'utf8'));

test('formulas: casos de paridade', async (t) => {
    for (const caso of ler('./formula.json')) {
        await t.test(caso.nome, () => {
            if (caso.erro) return assert.throws(() => avaliar(caso.expr, caso.vars), FormulaInvalida);
            assert.equal(avaliar(caso.expr, caso.vars), caso.esperado);
        });
    }
});

test('efeitos: casos de paridade', async (t) => {
    for (const caso of ler('./efeitos.json')) {
        await t.test(caso.nome, () => {
            const r = aplicar(caso.alvo, caso.base, caso.efeitos, caso.variaveis);
            assert.equal(r.valor, caso.esperado.valor);
            assert.deepEqual(r.origens, caso.esperado.origens);
            assert.equal(rolagem(caso.alvo, caso.efeitos), caso.esperado.rolagem);
        });
    }
});

test('sintaxe valida aceita variaveis quaisquer', () => {
    assert.equal(sintaxeValida('14+min(@mod.des,2)'), true);
    assert.equal(sintaxeValida('@qualquer.coisa/2'), true);
    assert.equal(sintaxeValida('2d6'), false);
    assert.equal(sintaxeValida('1/0'), false);
    assert.equal(sintaxeValida('min('), false);
});
