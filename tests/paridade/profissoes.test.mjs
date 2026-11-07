// Profissões (cap. 4): catálogo, graduações, criação, avanço de nível e o Ofício (lógica pura, sem Vue).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { camposDoNivel } from '../../resources/js/app/sistemas/onepiece/construtor/nivel.ts';
import {
    camposDaCriacao,
    escolhasIniciais,
    periciasJaProficientes,
    problemasDaEtapa,
} from '../../resources/js/app/sistemas/onepiece/construtor/regras.ts';
import { FOCO_EXCLUI, GRADUACOES, PROFISSOES, SEM_PROFISSAO } from '../../resources/js/app/sistemas/onepiece/profissoes/dados.ts';
import {
    avancoDisponivel,
    camposDaGraduacao,
    camposDaNovaProfissao,
    camposDaProfissaoInicial,
    camposDaRemocaoDeProfissao,
    caracteristicasDasProfissoes,
    dadoDaGraduacao,
    expressaoDoOficio,
    nomeDoOficio,
    problemasDaNovaProfissao,
    problemasDaProfissao,
    profissoesPadrao,
    resolverModelos,
    temOficio,
    tracosDaProfissao,
} from '../../resources/js/app/sistemas/onepiece/profissoes/regras.ts';
import { PERICIAS, PERICIAS_ESCOLHIVEIS, calcular, usosMax } from '../../resources/js/app/sistemas/onepiece/regras.ts';

const catalogo = JSON.parse(readFileSync(new URL('../../app/Sistemas/OnePiece/dados/profissoes.json', import.meta.url), 'utf8'));

test('profissões: 20 no catálogo, ids únicos, perícias e ferramentas válidas, características e itens iniciais', () => {
    assert.equal(PROFISSOES.length, 20);
    assert.equal(new Set(PROFISSOES.map((p) => p.id)).size, 20);
    const ids = PERICIAS.map((p) => p.id);
    for (const p of PROFISSOES) {
        assert.ok(p.pericias.length >= 6 && p.pericias.every((x) => ids.includes(x) && x !== 'oficio'), `${p.id}: perícias`);
        assert.ok(p.ferramenta && p.itens.length >= 3 && p.testes.length >= 3 && p.tracos.length >= 2, p.id);
        for (const t of p.tracos) assert.ok(t.descricao.length > 60 && t.descricao.length <= 4000, `${p.id}/${t.id}: texto`);
    }
    assert.equal(SEM_PROFISSAO.tracos.length, 4);
    assert.equal(PERICIAS.length, 20);
    assert.equal(PERICIAS_ESCOLHIVEIS.length, 19);
});

test('profissões: o catálogo do PHP (profissoes.json) confere com os dados do TS', () => {
    assert.deepEqual(
        catalogo.profissoes,
        PROFISSOES.map((p) => ({ id: p.id, nome: p.nome, pericias: p.pericias, ferramenta: p.ferramenta, itens: p.itens })),
    );
});

test('aperfeiçoamento: CD, Bellys e dado pela graduação (d6→d8, d8→d10, d10→d12)', () => {
    assert.equal(resolverModelos('CD {cd:16}', 0), 'CD 16');
    assert.equal(resolverModelos('CD {cd:16}', 1), 'CD 15');
    assert.equal(resolverModelos('CD {cd:16}', 3), 'CD 13');
    assert.equal(resolverModelos('฿ {bellys:250000}', 1), '฿ 225.000');
    assert.equal(resolverModelos('฿ {bellys:250000}', 2), '฿ 200.000');
    assert.equal(resolverModelos('฿ {bellys:250000}', 3), '฿ 125.000');
    assert.deepEqual(
        [0, 1, 2, 3].map((g) => dadoDaGraduacao(6, g)),
        [6, 8, 10, 12],
    );
    assert.deepEqual(
        [0, 1, 2, 3].map((g) => dadoDaGraduacao(10, g)),
        [10, 10, 10, 12],
    );
    assert.deepEqual(
        [0, 1, 2, 3].map((g) => dadoDaGraduacao(8, g)),
        [8, 8, 10, 12],
    );
    assert.equal(GRADUACOES.length, 4);
    // todo modelo `{...}` dos textos é resolvido
    for (const p of PROFISSOES)
        for (const g of [0, 1, 2, 3])
            for (const t of tracosDaProfissao(p, g))
                assert.ok(!/\{(cd|bellys|dado):/.test(t.descricao + JSON.stringify(t.acoes ?? [])), `${p.id}/${t.id}/${g}`);
});

test('graduações: os benefícios se acumulam e o Médico rola dado maior', () => {
    const medico = PROFISSOES.find((p) => p.id === 'medico');
    const nomes = (g) => tracosDaProfissao(medico, g).map((t) => t.nome);
    assert.ok(!nomes(0).some((n) => n.startsWith('Graduação')));
    assert.deepEqual(
        nomes(3).filter((n) => n.startsWith('Graduação')),
        ['Graduação: Especialista (Médico)', 'Graduação: Mestre (Médico)', 'Graduação: Grão-Mestre (Médico)'],
    );
    const tratar = (g) => tracosDaProfissao(medico, g).find((t) => t.id === 'medico-tratar-ferimentos');
    assert.equal(tratar(0).acoes[0].rolagem, '1d6');
    assert.equal(tratar(1).acoes[0].rolagem, '1d8');
    assert.equal(tratar(3).acoes[0].rolagem, '1d12');
    assert.match(tratar(2).descricao, /d10/);
});

const base = (extra = {}) => ({ ...escolhasIniciais(), especies: ['humano'], variantes: ['comum'], falhas: ['orgulho'], ...extra });

test('assistente: a etapa Profissão exige a escolha e 2 perícias da lista (ou o Foco sem profissão)', () => {
    assert.ok(problemasDaEtapa(base(), 'profissao').length > 0);
    assert.ok(problemasDaProfissao({ id: 'medico', pericias: ['medicina'] }).length > 0);
    assert.ok(problemasDaProfissao({ id: 'medico', pericias: ['medicina', 'atletismo'] }).length > 0); // fora da lista
    assert.deepEqual(problemasDaProfissao({ id: 'medico', pericias: ['medicina', 'intuicao'] }), []);
    assert.deepEqual(problemasDaProfissao({ id: 'nenhuma', pericias: ['atletismo', 'persuasao'] }), []);
    for (const x of FOCO_EXCLUI) assert.ok(problemasDaProfissao({ id: 'nenhuma', pericias: [x, 'atletismo'] }).length > 0, x);
    assert.ok(problemasDaProfissao({ id: 'inventada', pericias: ['a', 'b'] }).length > 0);
});

test('assistente: a profissão dá as 2 perícias, o Ofício treinado, as ferramentas, as características e a lista de itens', () => {
    const e = base({ profissao: { id: 'medico', pericias: ['medicina', 'percepcao'] } });
    const { campos, avisos } = camposDaCriacao(e);
    assert.equal(campos.profissao, 'Médico');
    assert.equal(campos['pericias.medicina'], 1);
    assert.equal(campos['pericias.percepcao'], 1);
    assert.equal(campos['pericias.oficio'], 1);
    assert.deepEqual(campos.profissoes, { semProfissao: false, livroLido: false, lista: [{ id: 'medico', graduacao: 0, nivel: 1 }], usados: [] });
    assert.deepEqual(campos.ferramentas, [{ nome: 'Ferramentas de Médico', prof: 1, atributo: 'sab' }]);
    const c = campos.caracteristicas.filter((x) => x.builder === 'profissao');
    assert.ok(c.length >= 4 && c.every((x) => x.origem === 'Profissão: Médico'));
    assert.deepEqual(c.find((x) => x.nome === 'Tratar Ferimentos').usos, { atual: 2, max: 2, formula: '2*@nivel' });
    assert.ok(avisos.some((a) => a.includes('Itens iniciais de Médico') && a.includes('kit médico')));
    // refazer mantém as ferramentas manuais, a graduação e não duplica
    const de = {
        profissoes: { semProfissao: false, livroLido: false, lista: [{ id: 'medico', graduacao: 2, nivel: 1 }], usados: [] },
        ferramentas: [
            { nome: 'Bússola', prof: 1, atributo: 'sab' },
            { nome: 'Ferramentas de Médico', prof: 1, atributo: 'sab' },
        ],
    };
    const refeito = camposDaCriacao(e, de).campos;
    assert.equal(refeito.profissoes.lista[0].graduacao, 2);
    assert.deepEqual(
        refeito.ferramentas.map((f) => f.nome),
        ['Bússola', 'Ferramentas de Médico'],
    );
    assert.ok(refeito.caracteristicas.some((x) => x.nome === 'Graduação: Mestre (Médico)'));
});

test('assistente: sem profissão não há Ofício; o Foco dá 2 perícias e as 4 características', () => {
    const { campos } = camposDaCriacao(base({ profissao: { id: 'nenhuma', pericias: ['atletismo', 'persuasao'] } }));
    assert.equal(campos.profissao, 'Não ter profissão');
    assert.equal(campos['pericias.atletismo'], 1);
    assert.equal(campos['pericias.oficio'], 0);
    assert.equal(campos.profissoes.semProfissao, true);
    assert.deepEqual(
        campos.caracteristicas.filter((x) => x.builder === 'profissao').map((x) => x.nome),
        ['Ajudante Perfeito', 'Foco', 'Parceiro de Treino', 'Tempo Livre'],
    );
    assert.equal(temOficio({ profissoes: campos.profissoes }), false);
});

test('Ofício: perícia comum na ficha (base Sabedoria), escondida das escolhas livres, soma a proficiência e rola qualquer atributo', () => {
    assert.equal(PERICIAS.find((p) => p.id === 'oficio').atributo, 'sab');
    assert.ok(!PERICIAS_ESCOLHIVEIS.some((p) => p.id === 'oficio'));
    const e = base({ profissao: { id: 'medico', pericias: ['medicina', 'percepcao'] } });
    assert.ok(periciasJaProficientes(e).includes('medicina'));
    const { campos } = camposDaCriacao(e);
    const ficha = {
        nivel: 1,
        atributos: { for: 14, des: 10, con: 10, sab: 16, pre: 10, von: 10 },
        salvaguardas: [],
        pericias: { oficio: campos['pericias.oficio'] },
        ferramentas: [],
        inventario: [],
        caracteristicas: [],
        condicoes: [],
        pv: { atual: 10, max: 10, temp: 0 },
        pp: { atual: 0, porNivel: 4 },
        tecnicas: { atributo: 'von', lista: [] },
        ajustes: {},
    };
    assert.equal(calcular(ficha, {})['pericia.oficio'], 3 + 2); // SAB +3 e proficiência +2
    assert.equal(expressaoDoOficio('for'), '1d20+@mod.for+@prof');
    assert.equal(expressaoDoOficio('for', 'vantagem'), '2d20kh1+@mod.for+@prof');
    assert.equal(expressaoDoOficio('pre', 'desvantagem'), '2d20kl1+@mod.pre+@prof');
    assert.equal(nomeDoOficio({ profissoes: campos.profissoes }), 'Ofício (Médico)');
    assert.equal(
        nomeDoOficio({ profissoes: { ...campos.profissoes, lista: [...campos.profissoes.lista, { id: 'navegador', graduacao: 0, nivel: 5 }] } }),
        'Ofício',
    );
});

test('usos por fórmula: os Dados Curativos do Médico crescem 2 por nível e a Subida de nível ajusta', () => {
    const { campos } = camposDaCriacao(base({ profissao: { id: 'medico', pericias: ['medicina', 'percepcao'] } }));
    const tratar = campos.caracteristicas.find((x) => x.nome === 'Tratar Ferimentos');
    assert.equal(usosMax(tratar, 2, 10), 20);
    assert.equal(usosMax({ ...tratar, usos: { ...tratar.usos, formula: '1+floor(@nivel/2)' } }, 2, 10), 6);
    const f = {
        nivel: 1,
        atributos: { for: 10, des: 10, con: 10, sab: 10, pre: 10, von: 10 },
        salvaguardas: [],
        pericias: {},
        caracteristicas: campos.caracteristicas,
        tecnicas: { lista: [] },
        pv: { atual: 10, max: 10, temp: 0 },
        pp: { atual: 0, porNivel: 4 },
        dadosVida: { tipo: 'd8', restantes: 1 },
        habilidadesBasicas: [],
        estiloId: 'atirador',
        estiloCaminho: 'sniper',
        atributoPrimario: 'des',
        profissoes: campos.profissoes,
    };
    tratar.usos.atual = 1; // 1 dado gasto
    const novos = camposDoNivel(f, { pvGanho: 5 }).caracteristicas.find((x) => x.nome === 'Tratar Ferimentos');
    assert.equal(novos.usos.max, 4);
    assert.equal(novos.usos.atual, 3); // o dado gasto continua gasto
});

const ficha = (nivel, extra = {}) => ({
    nivel,
    atributos: { for: 10, des: 10, con: 10, sab: 10, pre: 10, von: 10 },
    pericias: { medicina: 1, intuicao: 1, oficio: 1 },
    caracteristicas: [],
    ferramentas: [],
    profissoes: { semProfissao: false, livroLido: false, lista: [{ id: 'medico', graduacao: 0, nivel: 1 }], usados: [] },
    ...extra,
});

test('avanço: 5º, 10º, 15º e 20º nível; nova profissão exige o Livro; Avanço Planejado sobe uma graduação', () => {
    assert.equal(avancoDisponivel(ficha(4)), null);
    assert.equal(avancoDisponivel(ficha(5)), 5);
    assert.equal(avancoDisponivel(ficha(12, { profissoes: { ...ficha(12).profissoes, usados: [5] } })), 10);
    assert.equal(avancoDisponivel(ficha(5, { profissoes: { ...ficha(5).profissoes, usados: [5] } })), null);
    assert.ok(problemasDaNovaProfissao(ficha(5), 'navegador').some((m) => m.includes('Livro')));
    const liberado = ficha(5, { profissoes: { ...ficha(5).profissoes, livroLido: true } });
    assert.deepEqual(problemasDaNovaProfissao(liberado, 'navegador'), []);
    assert.ok(problemasDaNovaProfissao(liberado, 'medico').some((m) => m.includes('já tem')));
    assert.ok(problemasDaNovaProfissao(ficha(4, { profissoes: { ...liberado.profissoes } }), 'navegador').some((m) => m.includes('avanço')));
    const campos = camposDaNovaProfissao(liberado, 'navegador', { de: 'intuicao', para: 'sobrevivencia' });
    assert.deepEqual(
        campos.profissoes.lista.map((p) => p.id),
        ['medico', 'navegador'],
    );
    assert.deepEqual(campos.profissoes.usados, [5]);
    assert.equal(campos.profissoes.livroLido, false);
    assert.equal(campos['pericias.intuicao'], 0);
    assert.equal(campos['pericias.sobrevivencia'], 1);
    assert.equal(campos['pericias.medicina'], undefined); // nova profissão não dá as 2 perícias
    assert.ok(campos.ferramentas.some((f) => f.nome === 'Ferramentas de Navegador'));
    assert.ok(campos.caracteristicas.some((c) => c.origem === 'Profissão: Navegador'));
    // Avanço Planejado
    const g = camposDaGraduacao(ficha(5), 0, true);
    assert.equal(g.profissoes.lista[0].graduacao, 1);
    assert.deepEqual(g.profissoes.usados, [5]);
    assert.ok(g.caracteristicas.some((c) => c.nome === 'Graduação: Especialista (Médico)'));
    assert.deepEqual(camposDaGraduacao(ficha(4), 0, true), {}); // sem avanço livre
    // Grande Feito (mestre): não gasta o avanço
    const feito = camposDaGraduacao(ficha(2), 0, false);
    assert.equal(feito.profissoes.lista[0].graduacao, 1);
    assert.deepEqual(feito.profissoes.usados, []);
    // não passa do Grão-Mestre
    assert.deepEqual(
        camposDaGraduacao(ficha(2, { profissoes: { ...ficha(2).profissoes, lista: [{ id: 'medico', graduacao: 3, nivel: 1 }] } }), 0, false),
        {},
    );
    // remover
    const rem = camposDaRemocaoDeProfissao(ficha(2), 0);
    assert.equal(rem['pericias.oficio'], 0);
    assert.deepEqual(rem.profissoes.lista, []);
});

test('profissões: o Ofício existe só com profissão e profissoesPadrao é vazio', () => {
    assert.equal(temOficio({}), false);
    assert.deepEqual(profissoesPadrao(), { semProfissao: false, livroLido: false, lista: [], usados: [] });
    assert.ok(caracteristicasDasProfissoes({ ...profissoesPadrao(), semProfissao: true }, 1).length === 4);
    const inicial = camposDaProfissaoInicial({ id: 'musico', pericias: ['atuacao', 'persuasao'] });
    assert.equal(inicial.oficio, 1);
});
