// Paridade das regras de D&D 5e: o TS tem de bater com os mesmos casos que o PHP (tests/Unit/Nucleo/Dnd5eRegrasTest.php).
// Rodar: npm run test:regras (Node executa o .ts direto, por isso regras.ts é puro, sem Vue).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ALVOS_DE_EFEITO, variaveisParaAlvo } from '../../resources/js/app/sistemas/dnd5e/alvos.ts';
import { CONDICOES } from '../../resources/js/app/sistemas/dnd5e/condicoes.ts';
import {
    alvoDaRolagem,
    analisar,
    armasAtivas,
    calcular,
    comItemEntregue,
    efeitosAtivos,
    modoDaRolagem,
} from '../../resources/js/app/sistemas/dnd5e/regras.ts';

const casos = JSON.parse(readFileSync(new URL('./dnd5e.json', import.meta.url), 'utf8'));

for (const caso of casos) {
    test(caso.nome, () => {
        const r = calcular(caso.ficha, caso.itens ?? {});
        if (!caso.parcial) assert.deepEqual(Object.keys(r).sort(), Object.keys(caso.esperado).sort(), 'chaves diferentes');
        if (caso.efeitosAtivos) assert.deepEqual(efeitosAtivos(caso.ficha, caso.itens ?? {}), caso.efeitosAtivos, 'efeitos ativos');
        for (const [chave, valor] of Object.entries(caso.esperado)) {
            assert.ok(chave in r, `falta ${chave}`);
            assert.ok(Math.abs(r[chave] - valor) < 0.0001, `${chave}: esperado ${valor}, veio ${r[chave]}`);
        }
    });
}

// --- só do TS (a tela): vantagem/desvantagem, origens e armas ---------------------------------------------------
const base = casos.find((c) => c.nome === 'arma: ataque e dano com proficiência e bônus mágico');

test('alvoDaRolagem mapeia o botão para o alvo do efeito', () => {
    assert.equal(alvoDaRolagem('mod.for'), 'teste.for');
    assert.equal(alvoDaRolagem('arma.7.ataque'), 'ataque.arma');
    assert.equal(alvoDaRolagem('arma.7.dano'), null);
    assert.equal(alvoDaRolagem('pericia.furtividade'), 'pericia.furtividade');
    assert.equal(alvoDaRolagem('iniciativa'), 'iniciativa');
});

test('vantagem e desvantagem dos itens chegam ao botão certo', () => {
    const ficha = structuredClone(base.ficha);
    ficha.inventario[0].itens.push({ item_id: 20, qtd: 1, equipado: true, sintonizado: false });
    const itens = structuredClone(base.itens);
    itens['20'] = {
        nome: 'Armadura Barulhenta',
        peso: 1,
        equipavel: true,
        requer_sintonia: false,
        dados: null,
        efeitos: [
            { alvo: 'pericia.furtividade', modo: 'desvantagem' },
            { alvo: 'teste.*', modo: 'vantagem' },
            { alvo: 'ataque.arma', modo: 'vantagem' },
        ],
    };

    const { efeitos } = analisar(ficha, itens);
    assert.equal(modoDaRolagem(efeitos, 'pericia.furtividade'), 'desvantagem');
    assert.equal(modoDaRolagem(efeitos, 'pericia.percepcao'), null);
    assert.equal(modoDaRolagem(efeitos, 'mod.sab'), 'vantagem');
    assert.equal(modoDaRolagem(efeitos, 'arma.7.ataque'), 'vantagem');
    assert.equal(modoDaRolagem(efeitos, 'arma.7.dano'), null);
});

test('origens dizem de onde vem cada bônus', () => {
    const ficha = structuredClone(base.ficha);
    ficha.ajustes.ca = 2;
    ficha.inventario[0].itens.push({ item_id: 30, qtd: 1, equipado: true, sintonizado: false });
    const itens = structuredClone(base.itens);
    itens['30'] = {
        nome: 'Placas',
        peso: 30,
        equipavel: true,
        requer_sintonia: false,
        dados: { armadura: { tipo: 'pesada', base: 16 } },
        efeitos: [],
    };

    const { valores, origens } = analisar(ficha, itens);
    assert.equal(valores.ca, 18);
    assert.deepEqual(origens.ca, [
        { fonte: 'Placas', modo: 'base', valor: 16 },
        { fonte: 'Ajuste manual', modo: 'soma', valor: 2 },
    ]);
});

test('armasAtivas lista só as armas que contam, com os bônus calculados', () => {
    const valores = calcular(base.ficha, base.itens);
    assert.deepEqual(armasAtivas(base.ficha, base.itens, valores), [
        { itemId: 7, nome: 'Espada Longa +1', dano: '1d8', tipoDano: null, ataque: 7, danoBonus: 4, margem: 20 },
    ]);

    const naoEquipada = structuredClone(base.ficha);
    naoEquipada.inventario[0].itens[0].equipado = false;
    assert.deepEqual(armasAtivas(naoEquipada, base.itens, calcular(naoEquipada, base.itens)), []);
});

test('catálogo de condições confere com a referência', () => {
    assert.deepEqual(CONDICOES, JSON.parse(readFileSync(new URL('./condicoes-dnd5e.json', import.meta.url), 'utf8')));
});

test('condições dão vantagem/desvantagem nos botões certos', () => {
    const ficha = structuredClone(base.ficha);
    ficha.inventario[0].itens[0].equipado = true;
    const modo = (condicoes, variavel) => modoDaRolagem(analisar({ ...ficha, condicoes }, base.itens).efeitos, variavel);

    // Envenenado: desvantagem em ataques e em testes de atributo/perícia/ferramenta/iniciativa; salvaguardas não.
    for (const v of ['arma.7.ataque', 'ataque', 'mod.for', 'pericia.furtividade', 'ferramenta.0', 'iniciativa'])
        assert.equal(modo(['envenenado'], v), 'desvantagem', v);
    for (const v of ['salv.for', 'arma.7.dano']) assert.equal(modo(['envenenado'], v), null, v);
    // Contido também atrapalha a salvaguarda de Destreza (e só ela).
    assert.equal(modo(['contido'], 'salv.des'), 'desvantagem');
    assert.equal(modo(['contido'], 'salv.for'), null);
    // Invisível dá vantagem nos ataques; junto com Envenenado as duas se anulam no ataque, mas não nos testes.
    assert.equal(modo(['invisivel'], 'arma.7.ataque'), 'vantagem');
    assert.equal(modo(['invisivel', 'envenenado'], 'arma.7.ataque'), null);
    assert.equal(modo(['invisivel', 'envenenado'], 'pericia.furtividade'), 'desvantagem');
    // Condições só informativas e ids desconhecidos não mudam nada.
    assert.equal(modo(['paralisado', 'agarrado', 'zumbificado'], 'arma.7.ataque'), null);
    assert.equal(modo([], 'arma.7.ataque'), null);
});

test('alvos de efeito do TS são os mesmos que o servidor aceita', () => {
    const esperado = JSON.parse(readFileSync(new URL('./alvos-dnd5e.json', import.meta.url), 'utf8'));
    assert.deepEqual(ALVOS_DE_EFEITO.map((a) => a.id).sort(), esperado);
    assert.equal(new Set(ALVOS_DE_EFEITO.map((a) => a.id)).size, ALVOS_DE_EFEITO.length, 'ids repetidos');
});

test('cada alvo tem modos coerentes: teste.* e ferramenta.* só de rolagem; atributos e CA só numéricos', () => {
    const modos = (id) => ALVOS_DE_EFEITO.find((a) => a.id === id).modos;
    assert.deepEqual(modos('teste.for'), ['vantagem', 'desvantagem']);
    assert.deepEqual(modos('ferramenta.*'), ['vantagem', 'desvantagem']);
    assert.deepEqual(modos('ca'), ['soma', 'base', 'min', 'max']);
    assert.deepEqual(modos('atributos.for'), ['soma', 'base', 'min', 'max']);
    assert.ok(modos('pericia.percepcao').includes('vantagem') && modos('pericia.percepcao').includes('soma'));
});

test('variáveis oferecidas existem de fato no cálculo e nos efeitos de cada alvo', () => {
    const caso = casos.find((c) => c.nome === 'arma: ataque e dano com proficiência e bônus mágico');
    const valores = calcular(caso.ficha, caso.itens);

    // fora dos atributos: todo `@id` oferecido existe nos valores calculados (as fórmulas veem a fase 2)
    for (const alvo of ['ca', 'pericia.percepcao', 'salv.for', 'ataque.arma', 'pv.max']) {
        const vars = variaveisParaAlvo(alvo);
        assert.ok(vars.length > 0);
        for (const v of vars) assert.ok(v.id in valores, `${alvo}: @${v.id} não existe no cálculo`);
    }
    assert.deepEqual(
        variaveisParaAlvo('ca').map((v) => v.id),
        ['mod.for', 'mod.des', 'mod.con', 'mod.int', 'mod.sab', 'mod.car', 'prof', 'nivel'],
    );

    // nos atributos só o nível existe: o efeito com @mod.* seria ignorado em silêncio, por isso nem é oferecido
    assert.deepEqual(
        variaveisParaAlvo('atributos.for').map((v) => v.id),
        ['nivel'],
    );
    assert.deepEqual(
        variaveisParaAlvo('atributos.*').map((v) => v.id),
        ['nivel'],
    );
    const ficha = structuredClone(caso.ficha);
    ficha.inventario[0].itens.push({ item_id: 40, qtd: 1, equipado: true, sintonizado: false });
    const item = (valor) => ({
        nome: 'Luvas',
        peso: 0,
        equipavel: true,
        requer_sintonia: false,
        dados: null,
        efeitos: [{ alvo: 'atributos.for', modo: 'soma', valor }],
    });
    assert.equal(calcular(ficha, { ...caso.itens, 40: item('@nivel') })['atributos.for'], 16 + 5); // @nivel funciona (nível 5)
    assert.equal(calcular(ficha, { ...caso.itens, 40: item('@mod.for') })['atributos.for'], 16); // @mod.* aqui seria ignorado
});

test('entregar item: novo entra desequipado em Equipamento; repetido ganha uma unidade', () => {
    const vazio = { inventario: [] };
    assert.deepEqual(comItemEntregue(vazio, 5), [{ secao: 'Equipamento', itens: [{ item_id: 5, qtd: 1, equipado: false, sintonizado: false }] }]);
    assert.deepEqual(vazio.inventario, [], 'não muda a ficha original');

    const ficha = {
        inventario: [
            { secao: 'Armas', itens: [{ item_id: 1, qtd: 1, equipado: true, sintonizado: false }] },
            { secao: 'Equipamento', itens: [{ item_id: 2, qtd: 3, equipado: false, sintonizado: false }] },
        ],
    };
    const novo = comItemEntregue(ficha, 9);
    assert.deepEqual(
        novo[1].itens.map((r) => r.item_id),
        [2, 9],
    ); // prefere a seção Equipamento
    assert.equal(novo[0].itens.length, 1);

    const repetido = comItemEntregue(ficha, 2);
    assert.equal(repetido[1].itens[0].qtd, 4);
    assert.equal(repetido[1].itens.length, 1);
    assert.equal(
        comItemEntregue({ inventario: [{ secao: 'X', itens: [{ item_id: 2, qtd: 100000, equipado: false, sintonizado: false }] }] }, 2)[0].itens[0]
            .qtd,
        100000,
    ); // teto

    // sem seção "Equipamento", vai para a primeira
    assert.deepEqual(
        comItemEntregue({ inventario: [{ secao: 'Mochila', itens: [] }] }, 7)[0].itens.map((r) => r.item_id),
        [7],
    );
    // ficha antiga sem inventário não quebra
    assert.equal(comItemEntregue({}, 7)[0].itens.length, 1);
});
