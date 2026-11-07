// Economia de ações: a tela liga e desliga botões pelas mesmas regras do servidor (CombateService::gastar).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { avaliarAcao, avaliarAtaque, rotuloDaAcao, usos } from '../../resources/js/app/nucleo/combate/acoes.ts';
import { camposDaCriacao, escolhasIniciais } from '../../resources/js/app/sistemas/onepiece/construtor/regras.ts';

const CATEGORIAS = [
    { id: 'padrao', nome: 'Ação', porTurno: 1, porRodada: null, soNoTurno: true },
    { id: 'poderosa', nome: 'Ação poderosa', porTurno: 1, porRodada: null, soNoTurno: true, soTecnicas: true },
    { id: 'bonus', nome: 'Ação bônus', porTurno: 1, porRodada: null, soNoTurno: true },
    { id: 'livre', nome: 'Ação livre', porTurno: null, porRodada: null, soNoTurno: true },
    { id: 'reacao', nome: 'Reação', porTurno: null, porRodada: 1, soNoTurno: false },
];
const item = (id, personagem_id, acoes = {}) => ({
    id,
    nome: id,
    cor: null,
    personagem_id,
    objeto_id: null,
    disposicao: 'jogadores',
    iniciativa: 1,
    acoes,
    movimento: { usado: 0, bonus: 0 },
});
const combate = (atual, itens, fase = 'em_curso') => ({ ativo: true, fase, rodada: 1, atual, itens });
const avaliar = (c, p, cat, mestre = false, tecnica = false) => avaliarAcao(c, CATEGORIAS, p, cat, mestre, tecnica);

test('fora do combate em curso, para o mestre, sem categoria ou fora do encontro nada é bloqueado', () => {
    const c = combate('a', [item('a', 1), item('b', 2)]);
    assert.equal(avaliar(combate('a', c.itens, 'iniciativa'), 2, 'padrao').ok, true);
    assert.equal(avaliar({ ...c, ativo: false, fase: 'inativo' }, 2, 'padrao').ok, true);
    assert.equal(avaliar(c, 2, 'padrao', true).ok, true);
    assert.equal(avaliar(c, 2, undefined).ok, true);
    assert.equal(avaliar(c, 99, 'padrao').ok, true); // personagem fora do encontro
    assert.equal(avaliar(c, 2, 'inexistente').ok, true);
});

test('só quem está no turno usa as ações; limites por turno e a poderosa só em técnicas', () => {
    const c = combate('a', [item('a', 1, { padrao: 1, livre: 5 }), item('b', 2)]);
    assert.equal(avaliar(c, 2, 'padrao').ok, false); // não é o turno do 2
    assert.match(avaliar(c, 2, 'padrao').motivo, /turno/);
    assert.match(avaliar(c, 1, 'padrao').motivo, /já usou/);
    assert.equal(avaliar(c, 1, 'bonus').ok, true);
    assert.equal(avaliar(c, 1, 'livre').ok, true); // sem limite
    assert.match(avaliar(c, 1, 'poderosa', false, false).motivo, /só serve para técnicas/);
    assert.equal(avaliar(c, 1, 'poderosa', false, true).ok, true);
});

test('reação vale fora do turno, uma por rodada', () => {
    const c = combate('a', [item('a', 1), item('b', 2)]);
    assert.equal(avaliar(c, 2, 'reacao').ok, true);
    const usada = combate('a', [item('a', 1), item('b', 2, { reacao: 1 })]);
    assert.match(avaliar(usada, 2, 'reacao').motivo, /nesta rodada/);
    assert.equal(usos(usada, 2, 'reacao'), 1);
    assert.equal(usos(usada, 1, 'reacao'), 0);
});

test('rótulo da categoria', () => {
    assert.equal(rotuloDaAcao(CATEGORIAS, 'bonus'), 'Ação bônus');
    assert.equal(rotuloDaAcao(CATEGORIAS, undefined), '');
});

test('o assistente marca a categoria de ação de cada traço de combate', () => {
    const feito = (extra) => ({
        ...escolhasIniciais(),
        estilo: { nome: 'E', dado: 'd8' },
        atributos: { metodo: 'padrao', base: { for: 15, des: 14, con: 13, sab: 12, pre: 10, von: 8 } },
        ajuste: { tipo: 'dois', atributos: ['for', 'des'] },
        ...extra,
    });
    const lun = camposDaCriacao(feito({ especies: ['lunariano'], variantes: [null] })).campos;
    assert.equal(lun.caracteristicas.find((c) => c.nome === 'Heat').acao, 'bonus');
    assert.equal(lun['tecnicas.lista'].find((t) => t.nome === 'Esfera de Fogo').acao, 'padrao');
    const anao = camposDaCriacao(feito({ especies: ['anao'], variantes: [null] })).campos;
    assert.equal(anao.caracteristicas.find((c) => c.nome === 'Piscar').acao, 'livre');
    const mink = camposDaCriacao(feito({ especies: ['mink'], variantes: ['agil'] })).campos;
    assert.equal(mink.caracteristicas.find((c) => c.nome === 'Instintos Animalescos').acoes[0].acao, 'livre');
    assert.equal(mink.caracteristicas.find((c) => c.nome === 'Forma Sulong').acao, 'padrao');
});

test('ataques com arma: o 1º gasta a Ação, os seguintes valem até o limite (Ataque Extra) mais os extras do turno', () => {
    const atacar = (c, p, porAcao, mestre = false) => avaliarAtaque(c, CATEGORIAS, p, mestre, porAcao);
    // sem ataque feito: vale a Ação normal
    assert.deepEqual(atacar(combate('a', [item('a', 1), item('b', 2)]), 1, 2), { ok: true, feitos: 0, max: 2, extras: 0 });
    // 1 ataque feito de 2: o 2º sai sem outra Ação; com 2 de 2 acabou
    const um = combate('a', [item('a', 1, { padrao: 1, ataques: 1 })]);
    assert.equal(atacar(um, 1, 2).ok, true);
    const dois = combate('a', [item('a', 1, { padrao: 1, ataques: 2 })]);
    const fim = atacar(dois, 1, 2);
    assert.equal(fim.ok, false);
    assert.match(fim.motivo, /já fez seus 2 ataques/);
    // os extras do turno (Tempestade de Balas: +2) somam ao limite
    assert.deepEqual(atacar(combate('a', [item('a', 1, { padrao: 1, ataques: 2, extras: 2 })]), 1, 2), { ok: true, feitos: 2, max: 4, extras: 2 });
    // sem Ataque Extra (1 por Ação): o 2º é recusado
    assert.equal(atacar(um, 1, 1).ok, false);
    // a Ação gasta em outra coisa (sem ataques feitos) não vira ataque grátis
    assert.equal(atacar(combate('a', [item('a', 1, { padrao: 1 })]), 1, 2).ok, false);
    // não é o turno; o mestre nunca é limitado
    assert.equal(atacar(combate('b', [item('a', 1, { padrao: 1, ataques: 1 }), item('b', 2)]), 1, 2).ok, false);
    assert.equal(atacar(dois, 1, 2, true).ok, true);
});

test('sistema sem travas (One Piece): age e ataca livremente, em qualquer turno e sem limite de ataques', () => {
    const LIVRES = CATEGORIAS.map((c) => ({ ...c, porTurno: null, porRodada: null, soNoTurno: false, soTecnicas: undefined }));
    const c = combate('a', [item('a', 1, { padrao: 3, ataques: 9 }), item('b', 2, { padrao: 1, ataques: 1 })]);
    for (const cat of ['padrao', 'poderosa', 'bonus', 'livre', 'reacao']) {
        assert.equal(avaliarAcao(c, LIVRES, 2, cat, false, false).ok, true); // fora do turno, repetida, até a poderosa sem técnica
    }
    assert.equal(avaliarAtaque(c, LIVRES, 2, false, 1).ok, true); // não é o turno do 2 e já atacou além do limite
    assert.equal(avaliarAtaque(c, LIVRES, 1, false, 1).ok, true);
});
