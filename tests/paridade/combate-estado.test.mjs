// Regras puras do estado do combate usadas pela tela (o servidor é quem decide; ver CombateService).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    itemAtual,
    normalizar,
    ordemAoMover,
    podeAgirAgora,
    rodadaParaFicha,
    semIniciativaDe,
} from '../../resources/js/app/nucleo/combate/estado.ts';

const item = (id, personagem_id, iniciativa = null) => ({
    id,
    nome: id,
    cor: null,
    personagem_id,
    objeto_id: null,
    disposicao: 'jogadores',
    iniciativa,
    acoes: {},
    movimento: { usado: 0, bonus: 0 },
});
const combate = (fase, atual, itens) => ({ ativo: fase !== 'inativo', fase, rodada: 2, atual, itens });

test('normalizar completa o formato antigo do combate', () => {
    const c = normalizar({ ativo: true, rodada: 3, atual: 'a', itens: [{ id: 'a', nome: 'Velho', iniciativa: 10, cor: null, personagem_id: null }] });
    assert.equal(c.fase, 'em_curso');
    assert.equal(c.itens[0].disposicao, 'inimigo');
    assert.deepEqual(c.itens[0].movimento, { usado: 0, bonus: 0, base: null });
    assert.deepEqual(normalizar(null), { ativo: false, fase: 'inativo', rodada: 1, atual: null, itens: [], ativas: [] });
    assert.deepEqual(c.ativas, []); // combates salvos antes das Técnicas ativas continuam válidos
});

test('em combate só o personagem do turno age; o mestre sempre; fora do combate todos', () => {
    const c = combate('em_curso', 'a', [item('a', 1, 20), item('b', 2, 10)]);
    assert.equal(podeAgirAgora(c, 1, false), true);
    assert.equal(podeAgirAgora(c, 2, false), false);
    assert.equal(podeAgirAgora(c, null, false), false);
    assert.equal(podeAgirAgora(c, 2, true), true);
    assert.equal(podeAgirAgora(combate('iniciativa', null, c.itens), 2, false), true); // ainda não começou
    assert.equal(podeAgirAgora(combate('inativo', null, []), 2, false), true);
    assert.equal(itemAtual(c).id, 'a');
});

test('o jogador só recebe o aviso de iniciativa dos personagens dele que ainda não rolaram', () => {
    const c = combate('iniciativa', null, [item('a', 1), item('b', 2), item('c', 1, 14), item('d', null)]);
    assert.deepEqual(
        semIniciativaDe(c, [1]).map((i) => i.id),
        ['a'],
    );
    assert.deepEqual(
        semIniciativaDe(c, []).map((i) => i.id),
        [],
    );
    assert.deepEqual(semIniciativaDe({ ...c, fase: 'em_curso' }, [1]), []);
});

test('rodada para a ficha só existe com o combate em curso', () => {
    assert.equal(rodadaParaFicha(combate('em_curso', 'a', [])), 2);
    assert.equal(rodadaParaFicha(combate('iniciativa', null, [])), null);
});

test('mover na ordem troca com o vizinho e não faz nada nas pontas', () => {
    const c = combate('em_curso', 'a', [item('a', 1), item('b', 2), item('c', 3)]);
    assert.deepEqual(ordemAoMover(c, 'b', -1), ['b', 'a', 'c']);
    assert.deepEqual(ordemAoMover(c, 'b', 1), ['a', 'c', 'b']);
    assert.deepEqual(ordemAoMover(c, 'a', -1), ['a', 'b', 'c']);
    assert.deepEqual(ordemAoMover(c, 'c', 1), ['a', 'b', 'c']);
});

// --- sem fogo amigo ----------------------------------------------------------------------------------------------------------
import { equipeDe, mesmoLado } from '../../resources/js/app/nucleo/combate/equipes.ts';

test('equipes: fora do combate PC é dos jogadores e NPC dos inimigos; em combate vale a disposição', () => {
    const pcs = new Set([1, 2]);
    const temJogador = (id) => pcs.has(id);
    const semCombate = combate('inativo', null, []);
    assert.equal(equipeDe(semCombate, 1, true), 'jogadores');
    assert.equal(equipeDe(semCombate, 9, false), 'inimigos');
    assert.equal(mesmoLado(semCombate, 1, 2, temJogador), true); // jogador x jogador
    assert.equal(mesmoLado(semCombate, 8, 9, temJogador), true); // NPC x NPC
    assert.equal(mesmoLado(semCombate, 1, 9, temJogador), false); // jogador x NPC pode
    assert.equal(mesmoLado(semCombate, 1, 1, temJogador), false); // a si mesmo não conta como "outro"

    const c = combate('em_curso', 'a', [
        { ...item('a', 1, 20), disposicao: 'jogadores' },
        { ...item('b', 8, 10), disposicao: 'aliado' },
        { ...item('c', 9, 5), disposicao: 'inimigo' },
    ]);
    assert.equal(equipeDe(c, 8, false), 'jogadores'); // NPC aliado dos jogadores
    assert.equal(mesmoLado(c, 1, 8, temJogador), true);
    assert.equal(mesmoLado(c, 8, 9, temJogador), false);
    assert.equal(mesmoLado(c, 9, 9, temJogador), false);
});
