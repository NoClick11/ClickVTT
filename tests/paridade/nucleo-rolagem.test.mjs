// Apresentação das rolagens no chat (núcleo, sem sistema): a fórmula curta e o destaque do card.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dadosRolados, destaqueDado, destaqueDaRolagem, resumoFormula } from '../../resources/js/app/nucleo/rolagem.ts';

const dados = (expressao, faces, resultados, descartados = [], sinal = 1) => ({
    tipo: 'dados',
    expressao,
    faces,
    resultados,
    descartados,
    subtotal: 0,
    sinal,
});
const variavel = (nome, valor, sinal = 1) => ({ tipo: 'variavel', nome, valor, sinal });
const numero = (valor, sinal = 1) => ({ tipo: 'numero', valor, sinal });
const rolagem = (termos, extra = {}) => ({ expressao: '', rotulo: null, termos, total: 0, ...extra });

test('resumoFormula soma todo o bônus fixo numa conta só', () => {
    assert.equal(resumoFormula(rolagem([dados('1d20', 20, [12]), variavel('mod.for', 3), variavel('prof', 3), numero(1)])), '1d20 + 7');
    assert.equal(resumoFormula(rolagem([dados('2d8', 8, [3, 4]), variavel('arma.7.dano', 3)])), '2d8 + 3');
    assert.equal(resumoFormula(rolagem([dados('2d20kh1', 20, [4, 19], [0]), variavel('arma.7.ataque', 5)])), '2d20kh1 + 5');
});

test('resumoFormula: bônus negativo, zero e sem dados', () => {
    assert.equal(resumoFormula(rolagem([dados('1d20', 20, [10]), variavel('mod.for', -1)])), '1d20 − 1');
    assert.equal(resumoFormula(rolagem([dados('1d8', 8, [5]), variavel('x', 3), variavel('y', 3, -1)])), '1d8', 'bônus que se anulam somem');
    assert.equal(resumoFormula(rolagem([dados('1d6', 6, [2])])), '1d6');
    assert.equal(resumoFormula(rolagem([numero(5)])), '5');
    assert.equal(resumoFormula(rolagem([numero(5, -1)])), '-5');
});

test('resumoFormula com vários grupos de dados', () => {
    assert.equal(resumoFormula(rolagem([dados('1d8', 8, [4]), dados('1d6', 6, [2]), numero(2)])), '1d8 + 1d6 + 2');
    assert.equal(resumoFormula(rolagem([dados('1d8', 8, [4]), dados('1d4', 4, [2], [], -1)])), '1d8 − 1d4');
});

test('dadosRolados marca os descartados', () => {
    assert.deepEqual(dadosRolados(rolagem([dados('2d20kh1', 20, [4, 19], [0])])), [
        { faces: 20, valor: 4, descartado: true },
        { faces: 20, valor: 19, descartado: false },
    ]);
});

test('destaque do card: o marcado pelo sistema vence; senão, o 20 ou 1 natural de um d20 que valeu', () => {
    assert.equal(destaqueDaRolagem(rolagem([dados('1d20', 20, [20])])), 'critico');
    assert.equal(destaqueDaRolagem(rolagem([dados('1d20', 20, [1])])), 'falha');
    assert.equal(destaqueDaRolagem(rolagem([dados('1d20', 20, [14])])), null);
    assert.equal(destaqueDaRolagem(rolagem([dados('1d8', 8, [8])])), null, 'só d20 conta');
    assert.equal(destaqueDaRolagem(rolagem([dados('2d20kl1', 20, [20, 7], [0])])), null, 'o 20 foi descartado');
    // margem 19: o 19 já é crítico
    assert.equal(destaqueDaRolagem(rolagem([dados('1d20', 20, [19])], { sistema: { margem: 19 } })), 'critico');
    assert.equal(destaqueDaRolagem(rolagem([dados('1d20', 20, [18])], { sistema: { margem: 19 } })), null);
    // o que o sistema marcou prevalece
    assert.equal(destaqueDaRolagem(rolagem([dados('1d20', 20, [10])], { sistema: { destaque: 'critico' } })), 'critico');
    assert.equal(destaqueDado({ faces: 20, valor: 19, descartado: false }, 19), 'critico');
});
