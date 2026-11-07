// Individualidades (cap. 5.5, regra opcional): catálogo, espaços, Defeitos de mesmo nível/variáveis e as características geradas.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { INDIVIDUALIDADES, NIVEIS_DE_INDIVIDUALIDADE } from '../../resources/js/app/sistemas/onepiece/individualidades/dados.ts';
import {
    camposDasIndividualidades,
    caracteristicasDasIndividualidades,
    individualidadesPadrao,
    problemasDasIndividualidades,
    saldoDeDefeitos,
} from '../../resources/js/app/sistemas/onepiece/individualidades/regras.ts';
import { resumoDosPT } from '../../resources/js/app/sistemas/onepiece/treinamentos/regras.ts';

const json = (n) => JSON.parse(readFileSync(new URL(n, import.meta.url), 'utf8'));
const catalogo = json('../../app/Sistemas/OnePiece/dados/individualidades.json');
const casos = json('./individualidades-casos.json');

test('individualidades: o catálogo em JSON (servidor) é igual ao do TS', () => {
    assert.deepEqual(catalogo.niveis, NIVEIS_DE_INDIVIDUALIDADE);
    assert.deepEqual(
        catalogo.itens,
        INDIVIDUALIDADES.map((x) => ({ id: x.id, tipo: x.tipo, nivel: x.nivel, aprovacaoDoMestre: !!x.aprovacaoDoMestre, escolha: x.escolha ? { opcoes: x.escolha.opcoes?.map((o) => o.id) ?? null } : null })),
    );
    assert.equal(catalogo.espacosIniciais, 5);
});

test('individualidades: 20/8/7 singularidades e 20/8/7 defeitos, ids únicos, 1/3/4 espaços', () => {
    const conta = (tipo, nivel) => INDIVIDUALIDADES.filter((x) => x.tipo === tipo && x.nivel === nivel).length;
    assert.deepEqual(['suave', 'media', 'forte'].map((n) => conta('singularidade', n)), [20, 8, 7]);
    assert.deepEqual(['suave', 'media', 'forte'].map((n) => conta('defeito', n)), [20, 8, 7]);
    assert.deepEqual(NIVEIS_DE_INDIVIDUALIDADE.map((n) => n.espacos), [1, 3, 4]);
    const ids = INDIVIDUALIDADES.map((x) => `${x.tipo}:${x.id}`);
    assert.equal(new Set(ids).size, ids.length);
});

for (const c of casos) {
    test(`individualidades: regras — ${c.nome}`, () => {
        const p = problemasDasIndividualidades(c.ficha);
        if (c.contem === null) assert.deepEqual(p, []);
        else assert.ok(p.some((x) => x.includes(c.contem)), JSON.stringify(p));
    });
}

test('individualidades: opcional — vazio não gera nada e o saldo mostra o Defeito que falta', () => {
    assert.deepEqual(caracteristicasDasIndividualidades({ individualidades: individualidadesPadrao(), nivel: 1 }), []);
    const s = saldoDeDefeitos({ ...individualidadesPadrao(), singularidades: [{ id: 'ator' }, { id: 'bom-senso' }] });
    assert.deepEqual(s, { suave: 1, media: 1, forte: 0 });
});

test('individualidades: características geradas (usos, efeitos, escolha no nome) e refeitas sem perder usos gastos', () => {
    const ind = { ...individualidadesPadrao(), singularidades: [{ id: 'ambiente-familiar', escolha: 'selva' }, { id: 'estudioso', escolha: 'historia' }, { id: 'corpo-fechado' }], defeitos: [{ id: 'churriado' }, { id: 'paranoico' }, { id: 'mudo' }] };
    const cs = caracteristicasDasIndividualidades({ individualidades: ind, nivel: 5 });
    const por = (n) => cs.find((c) => c.nome === n);
    assert.equal(por('Ambiente Familiar (selva)').usos.max, 3);
    assert.equal(por('Corpo Fechado').usos.max, 3); // Bônus de Proficiência do 5º nível
    assert.deepEqual(por('Estudioso (História)').efeitos, [{ alvo: 'pericia.historia', modo: 'soma', valor: '@prof' }]);
    assert.ok(por('Churriado').efeitos.some((e) => e.alvo === 'salv.for' && e.modo === 'desvantagem'));
    assert.equal(por('Churriado').origem, 'Defeito Suave');
    assert.equal(por('Ambiente Familiar (selva)').builder, 'individualidade');
    const f = { nivel: 5, caracteristicas: [{ nome: 'Minha', origem: 'x', tipo: 'passiva' }, { ...por('Ambiente Familiar (selva)'), usos: { atual: 1, max: 3 } }], individualidades: ind };
    const campos = camposDasIndividualidades(f, ind);
    assert.ok(campos.caracteristicas.some((c) => c.nome === 'Minha'));
    assert.equal(campos.caracteristicas.find((c) => c.nome === 'Ambiente Familiar (selva)').usos.atual, 1);
});

test('individualidades: Disciplinado dá 1 PT a cada nível par (além dos PT do nível)', () => {
    const base = { nivel: 6, atributos: { sab: 10 }, treinamento: { extras: 0, codigo: '', aprendidos: [], pedidos: [] }, caracteristicas: [] };
    const sem = resumoDosPT(base).ganhos;
    const com = resumoDosPT({ ...base, caracteristicas: [{ nome: 'Disciplinado', origem: 'Singularidade Suave', tipo: 'passiva', builder: 'individualidade' }] }).ganhos;
    assert.equal(com - sem, 3);
    const nv20 = resumoDosPT({ ...base, nivel: 20, caracteristicas: [{ nome: 'Disciplinado', origem: 'x', tipo: 'passiva', builder: 'individualidade' }] }).ganhos;
    assert.equal(nv20 - resumoDosPT({ ...base, nivel: 20 }).ganhos, 10);
    // um traço manual com o mesmo nome (sem builder) não conta
    assert.equal(resumoDosPT({ ...base, caracteristicas: [{ nome: 'Disciplinado', origem: 'x', tipo: 'passiva' }] }).ganhos, sem);
});

test('individualidades: Ambição do Rei e Haki da Observação Inato só pelo mestre e já acertam o Haki', async () => {
    const { paDeHakiDasIndividualidades } = await import('../../resources/js/app/sistemas/onepiece/individualidades/regras.ts');
    for (const id of ['ambicao-do-rei', 'haki-observacao-inato']) assert.equal(INDIVIDUALIDADES.find((x) => x.id === id).aprovacaoDoMestre, true);
    const base = { nivel: 3, caracteristicas: [], individualidades: individualidadesPadrao() };
    // ao conceder: Rei revelado/Haki liberado; Observação como Haki principal
    const rei = camposDasIndividualidades(base, { ...individualidadesPadrao(), singularidades: [{ id: 'ambicao-do-rei' }], defeitos: [{ id: 'mudo' }] });
    assert.equal(rei['haki.rei'], true);
    assert.equal(rei['haki.liberado'], true);
    assert.equal(rei['haki.principal'], undefined);
    const inato = camposDasIndividualidades(base, { ...individualidadesPadrao(), singularidades: [{ id: 'haki-observacao-inato' }], defeitos: [{ id: 'paranoico' }] });
    assert.equal(inato['haki.principal'], 'observacao');
    assert.deepEqual(inato.caracteristicas.map((c) => c.nome).filter((n) => n.includes('inato')), ['Perceber Emoções (inato, fora de batalha)', 'Perceber Presença (inato, fora de batalha)', 'Perceber Desafio (inato, fora de batalha)']);
    // já concedida: salvar outra coisa depois não força o Haki de novo
    const ja = { ...base, individualidades: { ...individualidadesPadrao(), singularidades: [{ id: 'haki-observacao-inato' }], defeitos: [{ id: 'paranoico' }] } };
    assert.equal(camposDasIndividualidades(ja, ja.individualidades)['haki.principal'], undefined);
    // 5 PA ao despertar o Haki (8º nível ou liberado pelo mestre)
    const f = (nivel, liberado) => ({ nivel, haki: { liberado }, individualidades: ja.individualidades });
    assert.equal(paDeHakiDasIndividualidades(f(3, false)), 0);
    assert.equal(paDeHakiDasIndividualidades(f(3, true)), 5);
    assert.equal(paDeHakiDasIndividualidades(f(8, false)), 5);
    assert.equal(paDeHakiDasIndividualidades({ nivel: 8, haki: { liberado: false }, individualidades: individualidadesPadrao() }), 0);
});

test('individualidades: Pau-para-Toda-Obra — segunda profissão inicial sem perícias nem ferramentas', async () => {
    const p = await import('../../resources/js/app/sistemas/onepiece/profissoes/regras.ts');
    const { PROFISSOES } = await import('../../resources/js/app/sistemas/onepiece/profissoes/dados.ts');
    const [a, b] = [PROFISSOES[0], PROFISSOES[1]];
    const ficha = (pau, lista) => ({ nivel: 1, caracteristicas: [], ferramentas: [], pericias: {}, individualidades: { singularidades: pau ? [{ id: 'pau-para-toda-obra' }] : [] }, profissoes: { semProfissao: false, livroLido: false, usados: [], lista } });
    const um = [{ id: a.id, graduacao: 0, nivel: 1 }];
    assert.ok(p.problemasDaSegundaProfissao(ficha(false, um), b.id).some((x) => x.includes('Pau-para-Toda-Obra')));
    assert.deepEqual(p.problemasDaSegundaProfissao(ficha(true, um), b.id), []);
    assert.ok(p.problemasDaSegundaProfissao(ficha(true, um), a.id).some((x) => x.includes('já tem')));
    const campos = p.camposDaSegundaProfissao(ficha(true, um), b.id);
    assert.deepEqual(campos.profissoes.lista[1], { id: b.id, graduacao: 0, nivel: 1, secundaria: true });
    assert.ok(campos.caracteristicas.some((c) => c.builder === 'profissao' && c.origem === `Profissão: ${b.nome}`));
    assert.ok(!campos.ferramentas.some((f) => f.nome === b.ferramenta)); // sem a ferramenta da segunda
    assert.ok(p.problemasDaSegundaProfissao({ ...ficha(true, [...um, { id: b.id, graduacao: 0, nivel: 1, secundaria: true }]) }, PROFISSOES[2].id).some((x) => x.includes('já foi escolhida')));
});
