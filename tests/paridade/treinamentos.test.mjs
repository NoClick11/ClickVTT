// Treinamentos (cap. 5.7): PT, pedidos e conclusão. Os mesmos casos de `treinamentos.json` rodam no PHP (`TreinamentosTest`).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { hakiPadrao } from '../../resources/js/app/sistemas/onepiece/haki/calculo.ts';
import { resumoDosPA } from '../../resources/js/app/sistemas/onepiece/haki/regras.ts';
import { CODIGOS_DE_HONRA, SITUACOES_DO_CODIGO, TREINAMENTOS } from '../../resources/js/app/sistemas/onepiece/treinamentos/dados.ts';
import {
    camposDaConclusao,
    camposDaRemocao,
    paDeHakiDosTreinamentos,
    problemasDoPedido,
    resumoDosPT,
    tecnicasDosTreinamentos,
    treinamentoPadrao,
} from '../../resources/js/app/sistemas/onepiece/treinamentos/regras.ts';

const casos = JSON.parse(readFileSync(new URL('./treinamentos.json', import.meta.url), 'utf8'));
const catalogo = JSON.parse(readFileSync(new URL('../../app/Sistemas/OnePiece/dados/treinamentos.json', import.meta.url), 'utf8'));

for (const c of casos.resumo) {
    test(`treinamentos: ${c.nome}`, () => {
        const r = resumoDosPT(c.ficha);
        for (const k of Object.keys(c.esperado)) assert.equal(r[k], c.esperado[k], k);
    });
}
for (const c of casos.pedidos) {
    test(`treinamentos, pedido: ${c.nome}`, () => {
        const m = problemasDoPedido(c.ficha, c.id, c.opcao ?? undefined);
        assert.equal(m.length > 0, c.invalido, m.join(' | '));
    });
}

test('treinamentos: o catálogo do PHP (treinamentos.json) confere com os dados do TS', () => {
    assert.deepEqual(catalogo.custoGenialidade, [1, 1, 2, 2, 2, 3, 3]);
    assert.deepEqual(
        catalogo.treinamentos,
        TREINAMENTOS.map((t) => ({
            id: t.id,
            nome: t.nome,
            categoria: t.categoria,
            dificuldade: t.dificuldade,
            especie: t.especie ?? null,
            dias: t.dias,
            pt: t.pt,
            tutor: t.tutor,
            atributos: t.atributos,
            minimo: t.minimo,
            requer: t.requer ?? null,
            repetivel: !!t.repetivel,
            escolha: t.escolha ? t.escolha.opcoes.map((o) => o.id) : null,
        })),
    );
});

test('treinamentos: 51 no catálogo, ids únicos, custos pela dificuldade e pré-requisitos existentes', () => {
    assert.equal(TREINAMENTOS.length, 51);
    assert.equal(new Set(TREINAMENTOS.map((t) => t.id)).size, 51);
    const esperado = { simples: [5, 1], intermediario: [10, 3], complexo: [15, 5] };
    for (const t of TREINAMENTOS) {
        const [dias, pt] = esperado[t.dificuldade];
        assert.equal(t.dias, dias, `${t.id}: dias`);
        assert.equal(t.pt, pt, `${t.id}: PT`);
        assert.ok(t.tracos.length >= 1, t.id);
        if (t.requer) assert.ok(TREINAMENTOS.some((x) => x.id === t.requer));
    }
    assert.equal(CODIGOS_DE_HONRA.length, 15);
    assert.deepEqual(
        SITUACOES_DO_CODIGO.map((s) => s.pt),
        [1, 1, 2, 2, 3],
    );
});

const fichaBase = (extra = {}) => ({
    nivel: 10,
    atributos: { for: 16, des: 10, con: 16, sab: 10, pre: 10, von: 10 },
    especie: 'Humano',
    salvaguardas: [],
    caracteristicas: [],
    tecnicas: { atributo: 'von', lista: [] },
    treinamento: treinamentoPadrao(),
    ...extra,
});

test('treinamentos: concluir move o pedido para aprendidos, gera as características e gasta os PT', () => {
    const f = fichaBase({ treinamento: { ...treinamentoPadrao(), pedidos: [{ id: 'bom-nadador', dias: 5 }] } });
    const campos = camposDaConclusao(f, 0);
    assert.deepEqual(campos['treinamento.pedidos'], []);
    assert.deepEqual(campos['treinamento.aprendidos'], [{ id: 'bom-nadador', nivel: 10 }]);
    const c = campos.caracteristicas.find((x) => x.nome === 'Bom Nadador');
    assert.equal(c.builder, 'treinamento');
    assert.deepEqual(c.efeitos, [{ alvo: 'movimento.nado', modo: 'min', valor: 150 }]);
    const depois = fichaBase({ treinamento: { ...treinamentoPadrao(), aprendidos: campos['treinamento.aprendidos'] } });
    assert.equal(resumoDosPT(depois).gasto, 1);
    // remover devolve os PT e as características
    const rem = camposDaRemocao(depois, 0);
    assert.equal(
        rem.caracteristicas.some((x) => x.builder === 'treinamento'),
        false,
    );
});

test('treinamentos: Autoaperfeiçoamento soma +1 sem passar de 20; Resiliência dá proficiência; Gigantes viram d12; técnicas entram', () => {
    const cons = (id, opcao, atr = {}) =>
        camposDaConclusao(
            fichaBase({
                atributos: { for: 16, des: 10, con: 16, sab: 10, pre: 10, von: 10, ...atr },
                treinamento: { ...treinamentoPadrao(), pedidos: [{ id, opcao, dias: 0 }] },
            }),
            0,
        );
    assert.equal(cons('autoaperfeicoamento', 'for')['atributos.for'], 17);
    assert.equal(cons('autoaperfeicoamento', 'for', { for: 20 })['atributos.for'], undefined);
    assert.deepEqual(cons('resiliencia', 'sab').salvaguardas, ['sab']);
    assert.equal(cons('resistencia-dos-gigantes')['dadosVida.tipo'], 'd12');
    const corredor = cons('corredor', 'longa').caracteristicas.find((x) => x.nome.startsWith('Corredor'));
    assert.deepEqual(corredor.efeitos, [{ alvo: 'movimento.normal', modo: 'min', valor: 150 }]);
    const tec = tecnicasDosTreinamentos([{ id: 'arqueiro-treinado' }, { id: 'lanceiro-treinado' }]);
    assert.deepEqual(
        tec.map((t) => t.nome),
        ['Chuva de Flechas', 'Perfuração Giratória'],
    );
    assert.ok(tec.every((t) => t.builder === 'treinamento' && t.rolagem));
});

test('treinamentos: Iniciada em Haki soma PA ao Haki (nível ao aprender, +2 por nível par depois, máx. 10)', () => {
    const f = (nivel, aprendido) => ({ nivel, treinamento: { ...treinamentoPadrao(), aprendidos: [{ id: 'iniciada-em-haki', nivel: aprendido }] } });
    assert.equal(paDeHakiDosTreinamentos(f(5, 5)), 5);
    assert.equal(paDeHakiDosTreinamentos(f(8, 5)), 5 + 2 + 2); // níveis 6 e 8
    assert.equal(paDeHakiDosTreinamentos(f(20, 5)), 10);
    assert.equal(paDeHakiDosTreinamentos({ nivel: 9, treinamento: treinamentoPadrao() }), 0);
    // entra no saldo do Haki
    assert.equal(resumoDosPA(hakiPadrao(), 8, paDeHakiDosTreinamentos(f(8, 5))).ganhosGerais, 5 + 9);
});
