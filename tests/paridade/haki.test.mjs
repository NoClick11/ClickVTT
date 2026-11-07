// Haki (cap. 7): PA, gasto, estágio e compras. Os mesmos casos de `haki.json` rodam no PHP (`HakiTest`).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { TALENTOS_HAKI, formasDoTalento, LIMITES_ESTAGIO } from '../../resources/js/app/sistemas/onepiece/haki/dados.ts';
import {
    abaDoHakiVisivel,
    caracteristicasDoHaki,
    comprar,
    devolver,
    hakiPadrao,
    podeComprar,
    podeDevolver,
    problemasDoHaki,
    refazerCaracteristicasDoHaki,
    resumoDosPA,
} from '../../resources/js/app/sistemas/onepiece/haki/regras.ts';
import { analisar } from '../../resources/js/app/sistemas/onepiece/regras.ts';

const casos = JSON.parse(readFileSync(new URL('./haki.json', import.meta.url), 'utf8'));
const catalogo = JSON.parse(readFileSync(new URL('../../app/Sistemas/OnePiece/dados/haki.json', import.meta.url), 'utf8'));

for (const caso of casos) {
    test(`haki: ${caso.nome}`, () => {
        const r = resumoDosPA(caso.haki, caso.nivel);
        assert.equal(r.ganhosGerais, caso.esperado.ganhosGerais, 'ganhos');
        assert.equal(r.gastoGeral, caso.esperado.gastoGeral, 'gasto geral');
        assert.equal(r.disponiveis, caso.esperado.disponiveis, 'disponíveis');
        assert.equal(r.estagio, caso.esperado.estagio, 'estágio');
        assert.equal(problemasDoHaki(caso.haki, caso.nivel).length > 0, caso.esperado.invalido, problemasDoHaki(caso.haki, caso.nivel).join(' | '));
    });
}

test('haki: o catálogo do PHP (haki.json) confere com os dados do TS', () => {
    assert.deepEqual(catalogo.limitesEstagio, LIMITES_ESTAGIO);
    assert.deepEqual(
        catalogo.talentos,
        TALENTOS_HAKI.map((t) => ({ id: t.id, nome: t.nome, tipo: t.tipo, estagio: t.estagio, custo: t.custo, requisitos: t.requisitos, formas: formasDoTalento(t) })),
    );
});

test('haki: 40 talentos (11 Armamento, 20 Observação, 9 Rei), ids únicos e pré-requisitos existentes e acima na árvore', () => {
    assert.equal(TALENTOS_HAKI.length, 40);
    assert.equal(TALENTOS_HAKI.filter((t) => t.tipo === 'armamento').length, 11);
    assert.equal(TALENTOS_HAKI.filter((t) => t.tipo === 'observacao').length, 20);
    assert.equal(TALENTOS_HAKI.filter((t) => t.tipo === 'rei').length, 9);
    assert.equal(new Set(TALENTOS_HAKI.map((t) => t.id)).size, 40);
    for (const t of TALENTOS_HAKI) {
        for (const r of t.requisitos) {
            const req = TALENTOS_HAKI.find((x) => x.id === r);
            assert.ok(req, `${t.id} -> ${r}`);
            assert.equal(req.tipo, t.tipo);
            assert.ok(req.pos.y < t.pos.y, `${r} deve ficar acima de ${t.id} na árvore`);
            assert.ok(req.estagio <= t.estagio);
        }
    }
});

test('haki: comprar exige PA, estágio, requisitos e o Haki do Rei; devolver respeita as dependências', () => {
    let h = { ...hakiPadrao(), extras: 40 };
    assert.equal(podeComprar(h, 7, 'ataque-infuso').ok, false); // não despertou
    assert.equal(podeComprar(h, 8, 'ataque-infuso').ok, true);
    assert.equal(podeComprar(h, 8, 'endurecimento-ofensivo').ok, false); // falta o requisito
    assert.equal(podeComprar(h, 8, 'autoridade-do-rei').ok, false); // sem Haki do Rei
    h = comprar(h, 'ataque-infuso');
    assert.equal(podeComprar(h, 8, 'endurecimento-ofensivo').ok, false); // ainda Inexperiente
    assert.match(podeComprar(h, 8, 'endurecimento-ofensivo').motivo, /Estágio/);
    for (const id of ['endurecimento-defensivo', 'antecipacao', 'antevisao', 'previsao']) h = comprar(h, id);
    assert.equal(podeComprar(h, 8, 'endurecimento-ofensivo').ok, true); // 22 PA: Treinado
    assert.equal(podeComprar(h, 8, 'ataque-infuso').forma, 2); // Dominada
    h = comprar(h, 'endurecimento-ofensivo');
    assert.equal(podeDevolver(h, 'ataque-infuso').ok, false); // endurecimento-ofensivo depende dele
    assert.equal(podeDevolver(h, 'endurecimento-ofensivo').ok, true);
    assert.equal(devolver(h, 'endurecimento-ofensivo').talentos.some((t) => t.id === 'endurecimento-ofensivo'), false);
    // sem saldo
    const pobre = { ...hakiPadrao(), talentos: [] };
    assert.match(podeComprar(pobre, 8, 'ataque-infuso').motivo ?? 'ok', /ok|Faltam PA/);
    const semPA = podeComprar({ ...pobre, extras: -5 }, 8, 'ataque-infuso');
    assert.equal(semPA.ok, false);
});

test('haki: o talento Rei vem de graça com o Haki do Rei e dá Vontade +2; o Rei não é comprado', () => {
    const h = { ...hakiPadrao(), rei: true };
    assert.equal(podeComprar(h, 10, 'rei').ok, false);
    const c = caracteristicasDoHaki(h, 10);
    assert.equal(c.length, 1);
    assert.equal(c[0].builder, 'haki');
    assert.deepEqual(c[0].efeitos, [{ alvo: 'atributos.von', modo: 'soma', valor: 2 }]);
    assert.equal(podeComprar({ ...h, extras: 10 }, 10, 'autoridade-do-rei').ok, false); // estágio Inexperiente não basta
});

test('haki: as características dos talentos seguem a forma comprada e mantêm os usos gastos', () => {
    let h = { ...hakiPadrao(), extras: 200 };
    for (const id of ['ataque-infuso', 'endurecimento-defensivo', 'antecipacao', 'antevisao', 'previsao']) h = comprar(h, id);
    const antevisao = (formas) => caracteristicasDoHaki({ ...h, talentos: h.talentos.map((t) => (t.id === 'antevisao' ? { ...t, formas } : t)) }, 8).find((c) => c.nome.startsWith('Antevisão'));
    assert.equal(antevisao(1).efeitos[0].valor, 1);
    assert.equal(antevisao(2).efeitos[0].valor, 2);
    assert.equal(antevisao(3).efeitos[0].valor, 3);
    assert.match(antevisao(2).descricao, /Forma Dominada/);
    // refazer mantém as características manuais e os usos gastos
    h = comprar(h, 'endurecimento-ofensivo');
    h = comprar(h, 'emissao-defensiva');
    const atuais = [{ nome: 'Minha', origem: 'x', tipo: 'passiva' }, ...caracteristicasDoHaki(h, 8)];
    const emissao = atuais.find((c) => c.nome === 'Emissão Defensiva');
    emissao.usos.atual = 0;
    const depois = refazerCaracteristicasDoHaki(atuais, comprar(h, 'emissao-defensiva'), 8); // vira Dominada ☆
    assert.ok(depois.some((c) => c.nome === 'Minha'));
    const nova = depois.find((c) => c.nome.startsWith('Emissão Defensiva'));
    assert.equal(nova.usos.atual, 0);
    assert.equal(nova.descanso, 'curto'); // Dominada também volta no descanso curto
});

test('haki: a aba aparece ao jogador no 8º nível ou quando o mestre libera; o mestre a vê sempre', () => {
    assert.equal(abaDoHakiVisivel(hakiPadrao(), 7, false), false);
    assert.equal(abaDoHakiVisivel(hakiPadrao(), 8, false), true);
    assert.equal(abaDoHakiVisivel({ ...hakiPadrao(), liberado: true }, 3, false), true);
    assert.equal(abaDoHakiVisivel(hakiPadrao(), 1, true), true);
});

test('haki: o estágio Treinado dá proficiência na perícia Haki; Pontos de Escudo aparecem como máximo derivado', () => {
    const base = {
        nivel: 20,
        atributos: { for: 10, des: 10, con: 10, sab: 10, pre: 10, von: 14 },
        salvaguardas: [],
        pericias: {},
        ferramentas: [],
        inventario: [],
        caracteristicas: [],
        condicoes: [],
        pv: { atual: 10, max: 10, temp: 0 },
        pp: { atual: 0, porNivel: 4 },
        tecnicas: { atributo: 'von', lista: [] },
        ajustes: {},
    };
    let h = { ...hakiPadrao(), extras: 200 };
    const semTreino = analisar({ ...base, haki: h }).valores['pericia.haki'];
    for (const id of ['ataque-infuso', 'endurecimento-defensivo', 'antecipacao', 'antevisao', 'previsao']) h = comprar(h, id);
    const f = { ...base, haki: h, caracteristicas: caracteristicasDoHaki(h, 20) };
    const treinado = analisar(f).valores;
    assert.equal(treinado['pericia.haki'], semTreino + 6); // proficiência de +6 no 20º nível
    assert.equal(treinado['escudo.max'], 20); // Endurecimento Defensivo (forma base)
});
