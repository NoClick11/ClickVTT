// Criador de Técnicas (cap. 6/10): catálogo, custo em PP (exemplos do livro) e limites de grau por nível (lógica pura).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as dados from '../../resources/js/app/sistemas/onepiece/criador/dados.ts';
import {
    custoDaTecnica,
    dadoDoDano,
    escolhasPadrao,
    espacosPorNivel,
    problemasDaTecnica,
    tecnicaDoCriador,
} from '../../resources/js/app/sistemas/onepiece/criador/regras.ts';

const json = (nome) => JSON.parse(readFileSync(new URL(nome, import.meta.url), 'utf8'));
const catalogo = json('../../app/Sistemas/OnePiece/dados/criador.json');
const custos = json('./criador-custos.json');
const problemas = json('./criador-problemas.json');

test('criador: o catálogo em JSON (servidor) é igual ao do TS', () => {
    assert.deepEqual(catalogo.graus, dados.GRAUS);
    assert.deepEqual(catalogo.efeitos, JSON.parse(JSON.stringify(dados.EFEITOS)));
    assert.deepEqual(catalogo.condicoes, dados.CONDICOES_DE_TECNICA);
    assert.deepEqual(catalogo.auxiliar, dados.AUXILIAR);
    assert.deepEqual(catalogo.pontosVirtuais, dados.PONTOS_VIRTUAIS);
    assert.deepEqual(catalogo.custoTipoDeDano, dados.CUSTO_TIPO_DE_DANO);
});

test('criador: graus 1–7 nos níveis 1/3/6/9/12/16/20 com PP = 2×grau', () => {
    assert.deepEqual(dados.GRAUS.map((g) => g.nivel), [1, 3, 6, 9, 12, 16, 20]);
    for (const g of dados.GRAUS) {
        assert.equal(g.pp, 2 * g.grau);
        assert.equal(g.dados, 2 * g.grau);
    }
    assert.equal(new Set(dados.EFEITOS.map((e) => e.id)).size, dados.EFEITOS.length);
    assert.equal(dados.CONDICOES_DE_TECNICA.length, 22);
});

for (const c of custos) {
    test(`criador: custo — ${c.nome}`, () => {
        assert.equal(custoDaTecnica(c.escolhas).total, c.total);
    });
}

for (const c of problemas) {
    test(`criador: limites — ${c.nome}`, () => {
        const p = problemasDaTecnica(c.escolhas, c.ctx);
        if (c.contem === null) {
            assert.deepEqual(p, []);
        } else {
            assert.ok(p.some((x) => x.includes(c.contem)), JSON.stringify(p));
        }
    });
}

test('criador: tipos de usuário (6.11) — espaços por nível', () => {
    const s = espacosPorNivel({ nivel: 12, usuario: 'simples', despertado: false });
    assert.deepEqual(Object.keys(s.combate).map(Number), [1, 2, 3]);
    assert.equal(s.auxiliares, 1);
    assert.equal(s.manifestacoes, 1);
    const a = espacosPorNivel({ nivel: 20, usuario: 'avancado', despertado: true });
    assert.deepEqual(Object.keys(a.combate).map(Number), [1, 2, 3, 4, 5, 6, 7]);
    assert.equal(a.auxiliares, 3);
    assert.equal(a.auxiliaresDespertas, 2);
    assert.equal(a.manifestacoes, 3);
});

test('criador: regras de redução, prolongada, forma e tipo de dano opcional', () => {
    const base = { ...escolhasPadrao('combate', 3), dados: 3, alcance: 9 };
    // Forma Alternativa custa metade do grau a mais (grau 3 → +1); em 1º grau, 0.
    assert.equal(custoDaTecnica({ ...base, forma: 'alternativa' }).total, 4);
    assert.equal(custoDaTecnica({ ...escolhasPadrao('combate', 1), dados: 1, forma: 'alternativa' }).total, 1);
    // Custo mínimo 1 PP mesmo com redução.
    assert.equal(custoDaTecnica({ ...escolhasPadrao('combate', 1), dados: 1, efeitos: [{ id: 'requisito-limitador', params: { reducao: 5 } }] }).total, 1);
    // Concentração Crucial: −2 no 1º minuto e −1 nos seguintes.
    assert.equal(custoDaTecnica({ ...escolhasPadrao('auxiliar'), efeitos: [{ id: 'cr', params: { bonus: 3 } }, { id: 'concentracao', params: { minutos: 3 } }] }).reducao, 4);
    // Duração prolongada: minuto extra = metade do custo (mín. 1).
    const aumentarCr = custoDaTecnica({ ...escolhasPadrao('auxiliar'), efeitos: [{ id: 'cr', params: { bonus: 1 }, prolongada: true, minutos: 2 }] });
    assert.equal(aumentarCr.total, 1 + 3 + 1);
    // Tipo de dano (regra opcional): fogo +1; verdadeiro mín. 3.
    assert.equal(custoDaTecnica({ ...base, tipoDano: 'Fogo' }, { regraDoTipoDeDano: true }).total, 4);
    assert.equal(custoDaTecnica({ ...base, tipoDano: 'Verdadeiro' }, { regraDoTipoDeDano: true }).total, 6);
    assert.equal(custoDaTecnica({ ...base, tipoDano: 'Verdadeiro' }).total, 3);
});

test('criador: dado do dano e conversão para a técnica da ficha', () => {
    assert.equal(dadoDoDano({ alvo: 'unico', modoDoDano: 'ataque', intensificado: false, efeitos: [] }), 10);
    assert.equal(dadoDoDano({ alvo: 'unico', modoDoDano: 'salvaguarda_metade', intensificado: false, efeitos: [] }), 8);
    assert.equal(dadoDoDano({ alvo: 'area', modoDoDano: 'salvaguarda_metade', intensificado: false, efeitos: [] }), 6);
    assert.equal(dadoDoDano({ alvo: 'area', modoDoDano: 'salvaguarda_metade', intensificado: true, efeitos: [] }), 8);
    const t = tecnicaDoCriador('Medusa', { ...escolhasPadrao('combate', 5), dados: 2, alcance: 33, tipoDano: 'Veneno', efeitos: [{ id: 'condicao', condicoes: ['paralisado'] }] });
    assert.equal(t.custo, 10);
    assert.equal(t.rolagem, '2d10');
    assert.equal(t.tipoDano, 'Veneno');
    assert.equal(t.builder, 'criador');
    assert.equal(t.acao, 'poderosa');
});
