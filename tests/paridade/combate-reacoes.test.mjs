// Janela de reação: textos e listas que a tela usa (o servidor resolve; ver Pipeline).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { comResumo, semOfertasDe, textoDoCusto, textoDoEfeito, viraOErro } from '../../resources/js/app/nucleo/combate/reacoes.ts';

const opcao = (defesa, cura = null, custo = {}) => ({ id: 't:0', rotulo: 'Proteger', descricao: '', custo, cura, defesa });
const resumo = (id, estado) => ({ id, estado, atacante: 'Orc', alvo: 'Aria', aguardando: [], resultado: null });

test('o bônus na defesa faz o ataque errar só quando vira o resultado (exemplo: 10 contra 9, +2 = 11)', () => {
    assert.equal(viraOErro(opcao(2), 10, 9), true); // 10 acertava a defesa 9; com 11 erra
    assert.equal(viraOErro(opcao(1), 10, 9), false); // 10 contra 10 ainda acerta
    assert.equal(viraOErro(opcao(5), 8, 9), false); // já errava
    assert.equal(viraOErro(opcao(0, '1d8'), 10, 9), false); // só cura
});

test('texto do custo e do efeito', () => {
    assert.equal(textoDoCusto({ pp: 2 }), '2 PP');
    assert.equal(textoDoCusto({ uso: 1 }), '1 uso');
    assert.equal(textoDoCusto({}), '');
    assert.equal(textoDoEfeito(opcao(3)), '+3 na defesa');
    assert.equal(textoDoEfeito(opcao(0, '1d8')), 'cura 1d8');
    assert.equal(textoDoEfeito(opcao(2, '4')), '+2 na defesa · cura 4');
});

test('as janelas abertas ficam na lista e as resolvidas saem', () => {
    let l = comResumo([], resumo(1, 'aguardando'));
    l = comResumo(l, resumo(2, 'aguardando'));
    assert.deepEqual(
        l.map((x) => x.id),
        [1, 2],
    );
    l = comResumo(l, { ...resumo(1, 'aguardando'), aguardando: ['Bruno'] });
    assert.deepEqual(
        l.map((x) => x.id),
        [2, 1],
    );
    assert.deepEqual(
        comResumo(l, resumo(2, 'resolvido')).map((x) => x.id),
        [1],
    );
});

test('tirar as ofertas de uma janela (ou só de um personagem)', () => {
    const o = (evento_id, personagem_id) => ({ evento_id, personagem_id });
    const lista = [o(1, 10), o(1, 11), o(2, 10)];
    assert.deepEqual(semOfertasDe(lista, 1), [o(2, 10)]);
    assert.deepEqual(semOfertasDe(lista, 1, 10), [o(1, 11), o(2, 10)]);
    assert.deepEqual(semOfertasDe(lista, 9), lista);
});
