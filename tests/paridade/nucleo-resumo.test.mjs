// Etiquetas dos efeitos: sem formato mostram os ids; com o formato do sistema, nomes legíveis.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resumoEfeito } from '../../resources/js/app/nucleo/efeitos/resumo.ts';
import { formatoDeResumo } from '../../resources/js/app/sistemas/dnd5e/alvos.ts';

const e = (alvo, modo, valor) => ({ alvo, modo, ...(valor === undefined ? {} : { valor }) });

test('sem formato: ids e fórmula crua', () => {
    assert.equal(resumoEfeito(e('ca', 'soma', 1)), 'ca +1');
    assert.equal(resumoEfeito(e('ca', 'soma', -2)), 'ca −2');
    assert.equal(resumoEfeito(e('ca', 'soma', '@mod.con')), 'ca +@mod.con');
    assert.equal(resumoEfeito(e('ca', 'base', '10+@mod.des')), 'ca = 10+@mod.des');
    assert.equal(resumoEfeito(e('atributos.for', 'min', 21)), 'atributos.for ≥ 21');
    assert.equal(resumoEfeito(e('atributos.for', 'max', 8)), 'atributos.for ≤ 8');
    assert.equal(resumoEfeito(e('pericia.atletismo', 'vantagem')), 'Vantagem em pericia.atletismo');
    assert.equal(resumoEfeito(e('dano.arma', 'dados', '3d6')), 'dano.arma +3d6');
});

test('formato do D&D: alvo pelo nome e variáveis pela sigla', () => {
    const r = (x) => resumoEfeito(x, formatoDeResumo);
    assert.equal(r(e('ca', 'soma', 1)), 'Classe de Armadura +1');
    assert.equal(r(e('ca', 'soma', '@mod.con')), 'Classe de Armadura +mod. CON');
    assert.equal(r(e('ca', 'base', '10+@mod.des+@mod.con')), 'Classe de Armadura = 10+mod. DES+mod. CON');
    assert.equal(r(e('dano.arma', 'soma', 2)), 'Dano com armas (todas) +2');
    assert.equal(r(e('atributos.for', 'min', 21)), 'Atributo: Força ≥ 21');
    assert.equal(r(e('pericia.atletismo', 'vantagem')), 'Vantagem em Perícia: Atletismo');
    assert.equal(r(e('teste.sab', 'desvantagem')), 'Desvantagem em Teste de Sabedoria');
    assert.equal(r(e('dano.arma', 'dados', '3d6')), 'Dano com armas (todas) +3d6');
    assert.equal(r(e('iniciativa', 'soma', '@prof')), 'Iniciativa +proficiência');
    assert.equal(r(e('pv.max', 'soma', '@nivel*2')), 'Pontos de vida máximos +nível*2');
    assert.equal(r(e('desconhecido', 'soma', 1)), 'desconhecido +1', 'alvo que o sistema não conhece volta como id');
});
