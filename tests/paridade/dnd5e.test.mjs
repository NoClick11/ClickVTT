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
    camposDoDescanso,
    comBuffAlternado,
    comItemEntregue,
    dadosDeDano,
    efeitosAtivos,
    modoDaRolagem,
} from '../../resources/js/app/sistemas/dnd5e/regras.ts';

const casos = JSON.parse(readFileSync(new URL('./dnd5e.json', import.meta.url), 'utf8'));

for (const caso of casos) {
    test(caso.nome, () => {
        const r = calcular(caso.ficha, caso.itens ?? {});
        if (!caso.parcial) assert.deepEqual(Object.keys(r).sort(), Object.keys(caso.esperado).sort(), 'chaves diferentes');
        for (const [id, esperado] of Object.entries(caso.dadosDeDano ?? {}))
            assert.deepEqual(dadosDeDano(caso.ficha, caso.itens ?? {}, Number(id)), esperado, `dados do dano do item ${id}`);
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

test('buffs de característica chegam aos botões certos (só passiva e ativa ligada)', () => {
    const ficha = structuredClone(base.ficha);
    ficha.caracteristicas = [
        { nome: 'Fúria', origem: 'Bárbaro 1', tipo: 'ativa', ativa: true, efeitos: [{ alvo: 'pericia.atletismo', modo: 'vantagem' }] },
        { nome: 'Calma', origem: 'Monge 1', tipo: 'ativa', ativa: false, efeitos: [{ alvo: 'pericia.furtividade', modo: 'vantagem' }] },
        { nome: 'Sentidos Aguçados', origem: 'Elfo', tipo: 'passiva', efeitos: [{ alvo: 'pericia.percepcao', modo: 'vantagem' }] },
    ];
    const { efeitos } = analisar(ficha, base.itens);

    assert.equal(modoDaRolagem(efeitos, 'pericia.atletismo'), 'vantagem');
    assert.equal(modoDaRolagem(efeitos, 'pericia.furtividade'), null, 'ativa desligada não conta');
    assert.equal(modoDaRolagem(efeitos, 'pericia.percepcao'), 'vantagem', 'passiva sempre vale');
    assert.deepEqual([...new Set(efeitos.map((e) => e.fonte))], ['Fúria', 'Sentidos Aguçados']);

    // o bônus numérico mostra a característica como origem
    ficha.caracteristicas.push({ nome: 'Defesa', origem: 'Guerreiro 1', tipo: 'passiva', efeitos: [{ alvo: 'ca', modo: 'soma', valor: 1 }] });
    assert.deepEqual(analisar(ficha, base.itens).origens.ca, [{ fonte: 'Defesa', modo: 'soma', valor: 1 }]);
});

test('ligar um buff gasta um uso; sem uso não liga; desligar não devolve; passiva não tem interruptor', () => {
    const furia = {
        nome: 'Fúria',
        origem: 'Bárbaro 1',
        tipo: 'ativa',
        ativa: false,
        usos: { atual: 2, max: 3 },
        efeitos: [{ alvo: 'dano.arma', modo: 'soma', valor: 2 }],
    };

    const ligada = comBuffAlternado(furia);
    assert.equal(ligada.ativa, true);
    assert.deepEqual(ligada.usos, { atual: 1, max: 3 });
    assert.deepEqual(furia.usos, { atual: 2, max: 3 }, 'não muda o original');

    const desligada = comBuffAlternado(ligada);
    assert.equal(desligada.ativa, false);
    assert.deepEqual(desligada.usos, { atual: 1, max: 3 }, 'desligar não devolve o uso');

    assert.equal(comBuffAlternado({ ...furia, usos: { atual: 0, max: 3 } }), null, 'sem usos restantes não liga');
    assert.equal(comBuffAlternado({ ...furia, ativa: true, usos: { atual: 0, max: 3 } }).ativa, false, 'ligada sempre pode desligar');

    const semUsos = { nome: 'Escudo da Fé', origem: 'Clérigo', tipo: 'ativa', efeitos: [] };
    assert.equal(comBuffAlternado(semUsos).ativa, true, 'sem controle de usos liga de graça');
    assert.equal(comBuffAlternado({ ...semUsos, usos: { atual: 0, max: 0 } }).ativa, true, 'max 0 também é sem controle');
    assert.equal(comBuffAlternado({ nome: 'Alerta', origem: 'Talento', tipo: 'passiva' }), null);
});

const fichaDeDescanso = () => ({
    nivel: 5,
    pv: { atual: 10, max: 44, temp: 3 },
    dadosVida: { restantes: 1, tipo: 'd8' },
    exaustao: 2,
    morte: { sucessos: 2, falhas: 1 },
    magias: {
        atributo: 'sab',
        preparadas: { max: 0 },
        espacos: [
            { nivel: 1, usados: 3, total: 4 },
            { nivel: 2, usados: 1, total: 3 },
        ],
        lista: [],
    },
    caracteristicas: [
        { nome: 'Fúria', origem: 'Bárbaro 1', tipo: 'ativa', ativa: true, usos: { atual: 0, max: 3 }, efeitos: [] },
        { nome: 'Retomar o Fôlego', origem: 'Guerreiro 1', tipo: 'ativa', ativa: false, descanso: 'curto', usos: { atual: 0, max: 1 }, efeitos: [] },
        { nome: 'Defesa', origem: 'Guerreiro 1', tipo: 'passiva', efeitos: [] },
    ],
});

test('descanso longo: restaura tudo, usa o PV máximo EFETIVO e desliga os buffs', () => {
    const campos = camposDoDescanso(fichaDeDescanso(), 'longo', 49); // 44 base + 5 de um item
    assert.equal(campos['pv.atual'], 49);
    assert.equal(campos['dadosVida.restantes'], 3, 'metade do nível (2) a mais');
    assert.equal(campos.exaustao, 1);
    assert.equal(campos['morte.sucessos'], 0);
    assert.equal(campos['morte.falhas'], 0);
    assert.deepEqual(campos['magias.espacos'], [
        { nivel: 1, usados: 0, total: 4 },
        { nivel: 2, usados: 0, total: 3 },
    ]);
    const c = campos.caracteristicas;
    assert.deepEqual([c[0].ativa, c[0].usos.atual], [false, 3], 'Fúria: desligada e usos de volta');
    assert.equal(c[1].usos.atual, 1, 'as de descanso curto também voltam no longo');
    assert.equal('ativa' in c[2], false, 'passiva não ganha o campo ativa');
});

test('descanso longo: nunca passa do nível em dados de vida nem desce a exaustão de 0', () => {
    const f = fichaDeDescanso();
    f.dadosVida.restantes = 5;
    f.exaustao = 0;
    const campos = camposDoDescanso(f, 'longo');
    assert.equal(campos['dadosVida.restantes'], 5);
    assert.equal(campos.exaustao, 0);
    assert.equal(campos['pv.atual'], 44, 'sem pvMax informado usa o da ficha');
    f.nivel = 1;
    f.dadosVida.restantes = 0;
    assert.equal(camposDoDescanso(f, 'longo')['dadosVida.restantes'], 1, 'pelo menos 1 dado de vida');
});

test('descanso curto: só as de descanso curto voltam; os buffs desligam; PV e magias ficam', () => {
    const campos = camposDoDescanso(fichaDeDescanso(), 'curto');
    assert.deepEqual(Object.keys(campos), ['caracteristicas']);
    const c = campos.caracteristicas;
    assert.deepEqual([c[0].ativa, c[0].usos.atual], [false, 0], 'Fúria desliga mas o uso NÃO volta (é de descanso longo)');
    assert.equal(c[1].usos.atual, 1, 'Retomar o Fôlego volta');
});

test('descanso curto sem nada a mudar não devolve campos', () => {
    const f = fichaDeDescanso();
    f.caracteristicas = [{ nome: 'Defesa', origem: 'Guerreiro 1', tipo: 'passiva', efeitos: [] }];
    assert.deepEqual(camposDoDescanso(f, 'curto'), {});
    f.caracteristicas = undefined;
    assert.deepEqual(camposDoDescanso(f, 'curto'), {}, 'ficha antiga sem características');
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
    assert.deepEqual(modos('dano.arma'), ['soma', 'base', 'min', 'max', 'dados'], 'só o dano das armas aceita dados extras');
    assert.equal(ALVOS_DE_EFEITO.filter((a) => a.modos.includes('dados')).length, 1);
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
