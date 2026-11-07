// Akuma no Mi (cap. 6): Aspecto Inato, MPs Especiais, usuário, Traços e Points da Zoan, Despertar (lógica pura).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as dados from '../../resources/js/app/sistemas/onepiece/akuma/dados.ts';
import {
    akumaPadrao,
    camposDaAkuma,
    caracteristicasDaAkuma,
    despertarAtendido,
    manifestacoesCriaveis,
    mpEspecialLiberada,
    problemasDaAkuma,
    tecnicasDosPoints,
} from '../../resources/js/app/sistemas/onepiece/akuma/regras.ts';
import * as zoan from '../../resources/js/app/sistemas/onepiece/akuma/zoan.ts';

const json = (nome) => JSON.parse(readFileSync(new URL(nome, import.meta.url), 'utf8'));
const catalogo = json('../../app/Sistemas/OnePiece/dados/akuma.json');
const casos = json('./akuma-problemas.json');
const A = (extra) => ({ ...akumaPadrao(), ...extra });
const F = (nivel, akuma) => ({
    nivel,
    akuma,
    atributos: { for: 10, des: 10, con: 10, sab: 10, pre: 10, von: 10 },
    caracteristicas: [],
    treinamento: { aprendidos: [] },
});

test('akuma: o catálogo em JSON (servidor) tem os mesmos ids e limites do TS', () => {
    assert.deepEqual(
        catalogo.mpEspeciais,
        dados.MP_ESPECIAIS.map((m) => ({ id: m.id, restricao: m.restricao })),
    );
    assert.deepEqual(
        catalogo.comuns,
        zoan.TRACOS_COMUNS.map((x) => x.id),
    );
    assert.deepEqual(
        catalogo.especificos,
        zoan.todosOsEspecificos().map((x) => x.id),
    );
    assert.deepEqual(
        catalogo.ancestrais,
        zoan.TRACOS_ANCESTRAIS.map((x) => x.id),
    );
    assert.deepEqual(
        catalogo.modelos,
        zoan.MODELOS_DE_POINT.map((m) => ({ id: m.id, grau: m.tecnica?.grau ?? null })),
    );
    assert.deepEqual(catalogo.repetiveis, zoan.TRACOS_REPETIVEIS);
    assert.deepEqual(
        catalogo.despertares,
        dados.TIPOS_DE_DESPERTAR.map((x) => x.id),
    );
    assert.deepEqual(catalogo.propriedades, dados.PROPRIEDADES);
});

test('akuma: catálogo — 25 traços comuns, 3+3+4+8 específicos, 6 ancestrais, 9 MPs Especiais, 13 modelos de Point', () => {
    assert.equal(zoan.TRACOS_COMUNS.length, 24);
    assert.deepEqual(
        zoan.TRACOS_ESPECIFICOS.map((g) => g.tracos.length),
        [3, 3, 4, 8],
    );
    assert.equal(zoan.TRACOS_ANCESTRAIS.length, 6);
    assert.equal(dados.MP_ESPECIAIS.length, 9);
    assert.equal(zoan.MODELOS_DE_POINT.length, 13);
    const ids = [...zoan.TRACOS_COMUNS, ...zoan.todosOsEspecificos(), ...zoan.TRACOS_ANCESTRAIS].map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(
        zoan.CRIACAO_DE_POINTS.map((p) => [p.nivel, p.tracos, p.tecnica]),
        [
            [1, 0, 2],
            [3, 4, 4],
            [6, 6, 6],
            [9, 8, 8],
            [12, 10, 10],
        ],
    );
    assert.equal(zoan.FISICO_ANIMALESCO.length, 20);
    assert.equal(zoan.FISICO_ANIMALESCO[19], 420);
});

for (const c of casos) {
    test(`akuma: regras — ${c.nome}`, () => {
        const p = problemasDaAkuma(c.ficha);
        if (c.contem === null) assert.deepEqual(p, []);
        else
            assert.ok(
                p.some((x) => x.includes(c.contem)),
                JSON.stringify(p),
            );
    });
}

test('akuma: Aspecto Inato por tipo de fruto (e a troca por uma MP adicional)', () => {
    const nomes = (a) => caracteristicasDaAkuma(F(1, A(a))).map((c) => c.nome);
    assert.ok(nomes({ tipo: 'logia' }).includes('Corpo Elemental'));
    assert.ok(nomes({ tipo: 'paramecia' }).includes('Uso Alternativo'));
    assert.ok(nomes({ tipo: 'zoan', zoan: 'comum' }).includes('Vigor Animalesco'));
    assert.ok(nomes({ tipo: 'zoan', zoan: 'mitica', aspecto: 'uso-alternativo' }).includes('Uso Alternativo'));
    assert.ok(!nomes({ tipo: 'paramecia', aspecto: 'mp' }).includes('Uso Alternativo'));
    // Intangibilidade: reação com usos por nível até o 5º; passiva do 6º em diante.
    const c = caracteristicasDaAkuma(F(3, A({ tipo: 'logia' }))).find((x) => x.nome.startsWith('Intangibilidade'));
    assert.equal(c.usos.max, 3);
    assert.equal(c.nivelMax, 5);
});

test('akuma: MPs — quantas por tipo de usuário e as Especiais descontam', () => {
    assert.equal(dados.manifestacoesDoFruto('paramecia', '', 'simples', false), 1);
    assert.equal(dados.manifestacoesDoFruto('logia', '', 'avancado', false), 2);
    assert.equal(dados.manifestacoesDoFruto('logia', '', 'avancado', true), 3);
    assert.equal(dados.manifestacoesDoFruto('zoan', 'comum', 'simples', false), 0);
    assert.equal(dados.manifestacoesDoFruto('zoan', 'mitica', 'simples', true), 2);
    assert.equal(manifestacoesCriaveis(A({ tipo: 'logia', usuario: 'avancado', mpEspeciais: ['orbes'] })), 1);
    assert.equal(manifestacoesCriaveis(A({ tipo: 'zoan', zoan: 'comum', aspecto: 'mp' })), 1);
    assert.ok(mpEspecialLiberada('arauto-do-desastre', A({ tipo: 'logia' })));
    assert.ok(!mpEspecialLiberada('arauto-do-desastre', A({ tipo: 'paramecia' })));
});

test('akuma: usuário simples/avançado e estágio desperto geram as características do livro', () => {
    const nomes = (a, nivel = 1) => caracteristicasDaAkuma(F(nivel, A(a))).map((c) => c.nome);
    assert.ok(nomes({ tipo: 'paramecia', usuario: 'simples' }).includes('Técnica Preparada'));
    assert.ok(nomes({ tipo: 'paramecia', usuario: 'avancado' }).includes('Usuário Avançado'));
    assert.ok(nomes({ tipo: 'paramecia', despertada: true }, 16).includes('Recuperação Forçada'));
    const d = nomes({ tipo: 'logia', usuario: 'avancado', despertada: true, despertar: 'transmutador' }, 16);
    for (const n of [
        'Aperfeiçoamento',
        'Liberação Cansativa',
        'Novo Patamar',
        'Explosão de Poder',
        'Ímpeto Desperto',
        'Área Afetada',
        'Técnicas Abrangentes',
    ])
        assert.ok(d.includes(n), n);
    assert.ok(!nomes({ tipo: 'logia', despertada: false }).includes('Liberação Cansativa'));
    const tp = caracteristicasDaAkuma(F(5, A({ tipo: 'paramecia' }))).find((c) => c.nome === 'Técnica Preparada');
    assert.equal(tp.usos.max, 3); // Bônus de Proficiência do 5º nível
});

test('akuma: despertar exige o atributo da categoria/propriedade (qualquer propriedade do fruto serve)', () => {
    const a = A({ categoria: 'a', propriedades: ['extracorporal'] });
    assert.deepEqual(despertarAtendido(a, { von: 19 }).atributos, ['von', 'pre']);
    assert.equal(despertarAtendido(a, { von: 19 }).ok, true);
    assert.equal(despertarAtendido(a, { von: 18, pre: 18 }).ok, false);
    const duas = despertarAtendido(A({ categoria: 's', propriedades: ['criacao', 'manipulacao'] }), { des: 20 });
    assert.ok(duas.ok);
    assert.equal(despertarAtendido(A({ categoria: '' }), {}), null);
});

test('akuma: traços da Zoan, Points especiais e técnicas liberadas pelo nível', () => {
    const z = A({
        tipo: 'zoan',
        zoan: 'comum',
        predador: true,
        tracos: { comuns: ['voo'], especificos: ['bote', 'corpo-resistente', 'corpo-resistente'], ancestrais: [] },
        points: [
            { ponto: 1, modelo: 'heavy-point' },
            { ponto: 2, modelo: 'brain-point' },
            { ponto: 3, modelo: 'arm-point' },
        ],
    });
    const nomes = caracteristicasDaAkuma(F(6, z)).map((c) => c.nome);
    for (const n of [
        'Predador',
        'Voo',
        'Bote',
        'Corpo Resistente (×2)',
        'Físico Animalesco (Heavy Point)',
        'Força Animal (Arm Point): 1d8',
        'Formas da Zoan',
    ])
        assert.ok(nomes.includes(n), n);
    // Arm Point (1º grau) vem no 6º nível (3º Point); o Brain Point é 4º grau (nível 9).
    assert.deepEqual(
        tecnicasDosPoints(F(6, z)).map((t) => t.nome),
        ['Arm Point: Heavy Gong'],
    );
    assert.deepEqual(
        tecnicasDosPoints(F(9, z)).map((t) => t.nome),
        ['Brain Point: Scope', 'Arm Point: Heavy Gong'],
    );
    assert.equal(tecnicasDosPoints(F(1, z)).length, 0);
    const pts = tecnicasDosPoints(F(9, z)).find((t) => t.nome === 'Arm Point: Heavy Gong');
    assert.equal(pts.builder, 'akuma');
    assert.equal(pts.custo, 2);
});

test('akuma: camposDaAkuma refaz características e técnicas, mantendo as manuais e os usos gastos', () => {
    const base = {
        ...F(3, A({ tipo: 'paramecia' })),
        caracteristicas: [{ nome: 'Minha', origem: 'x', tipo: 'passiva' }],
        akuma: A({ tipo: 'paramecia', lista: [{ nome: 'Manual', origem: '', custo: 1, alcance: '', efeito: '', descricao: '', rolagem: '' }] }),
    };
    const campos = camposDaAkuma(base, { usuario: 'avancado' });
    assert.ok(campos.caracteristicas.some((c) => c.nome === 'Minha'));
    assert.ok(campos.caracteristicas.some((c) => c.nome === 'Uso Alternativo' && c.builder === 'akuma'));
    assert.equal(campos['akuma.usuario'], 'avancado');
    assert.ok(campos['akuma.lista'].some((t) => t.nome === 'Manual'));
    const gasto = { ...base, caracteristicas: [{ ...campos.caracteristicas.find((c) => c.nome === 'Uso Alternativo'), usos: { atual: 0, max: 1 } }] };
    assert.equal(camposDaAkuma(gasto).caracteristicas.find((c) => c.nome === 'Uso Alternativo').usos.atual, 0);
});

// --- automação: Heavy Point, Arm Point, Corpo Aprimorado e Auge Físico -----------------------------------------------------
import { avaliar } from '../../resources/js/app/nucleo/efeitos/formula.ts';
import { calcular } from '../../resources/js/app/sistemas/onepiece/regras.ts';

const fichaCalc = (nivel, caracteristicas, extra = {}) => ({
    nivel,
    atributos: { for: 10, des: 10, con: 10, sab: 10, pre: 10, von: 10 },
    salvaguardas: [],
    pericias: {},
    ferramentas: [],
    inventario: [],
    caracteristicas,
    condicoes: [],
    pv: { atual: 10, max: 10, temp: 0 },
    pp: { atual: 0, porNivel: 4 },
    tecnicas: { atributo: 'von', lista: [] },
    ajustes: {},
    ...extra,
});

test('akuma: a fórmula do Físico Animalesco reproduz a tabela dos 20 níveis', () => {
    zoan.FISICO_ANIMALESCO.forEach((pv, i) => assert.equal(avaliar(zoan.FORMULA_FISICO_ANIMALESCO, { nivel: i + 1 }), pv, `nível ${i + 1}`));
});

test('akuma: Heavy Point substitui o PV máximo pela tabela (outras fontes continuam somando)', () => {
    const z = (nivel) => A({ tipo: 'zoan', zoan: 'comum', points: [{ ponto: 1, modelo: 'heavy-point' }] });
    for (const nivel of [1, 5, 12, 20]) {
        const cs = caracteristicasDaAkuma(F(nivel, z(nivel)));
        assert.equal(calcular(fichaCalc(nivel, cs), {})['pv.max'], zoan.FISICO_ANIMALESCO[nivel - 1], `nível ${nivel}`);
    }
    // Criatura Robusta (Traço Ancestral, +20) soma por cima da tabela
    const cs = caracteristicasDaAkuma(
        F(
            6,
            A({
                tipo: 'zoan',
                zoan: 'ancestral',
                tracos: { comuns: [], especificos: [], ancestrais: ['criatura-robusta'] },
                points: [{ ponto: 1, modelo: 'heavy-point' }],
            }),
        ),
    );
    assert.equal(calcular(fichaCalc(6, cs), {})['pv.max'], 142 + 20);
});

test('akuma: Arm Point tem o dado de dano desarmado certo em cada faixa de nível (só a do nível vem na ficha)', () => {
    for (const [nivel, dado] of [
        [1, '1d6'],
        [5, '1d6'],
        [6, '1d8'],
        [11, '1d10'],
        [16, '1d12'],
    ]) {
        const cs = caracteristicasDaAkuma(F(nivel, A({ tipo: 'zoan', zoan: 'comum', points: [{ ponto: 1, modelo: 'arm-point' }] }))).filter((c) =>
            c.nome.startsWith('Força Animal'),
        );
        assert.deepEqual(
            cs.map((c) => [c.acoes[0].rolagem, c.acoes[0].passo]),
            [[`${dado}+@dano.desarmado`, 'desarmado']],
            `nível ${nivel}`,
        );
    }
});

test('akuma: Corpo Aprimorado soma +10 PP e +50 PV só com o interruptor ligado', () => {
    const cs = caracteristicasDaAkuma(F(16, A({ tipo: 'logia', despertada: true, despertar: 'aprimorador' })));
    const corpo = cs.find((c) => c.nome === 'Corpo Aprimorado');
    assert.equal(corpo.tipo, 'ativa');
    const antes = calcular(fichaCalc(16, cs), {});
    const depois = calcular(
        fichaCalc(
            16,
            cs.map((c) => (c === corpo ? { ...c, ativa: true } : c)),
        ),
        {},
    );
    assert.equal(depois['pv.max'] - antes['pv.max'], 50);
    assert.equal(depois['pp.max'] - antes['pp.max'], 10);
});

test('akuma: Auge Físico leva For/Des/Con a 30 só em testes, salvaguardas e perícias (não em ataque nem CR)', () => {
    const cs = caracteristicasDaAkuma(F(16, A({ tipo: 'zoan', zoan: 'comum', despertada: true })));
    const auge = cs.find((c) => c.nome === 'Auge Físico');
    assert.equal(auge.tipo, 'ativa');
    const f = (ativo) =>
        fichaCalc(
            16,
            cs.map((c) => (c === auge ? { ...c, ativa: ativo } : c)),
            { atributos: { for: 14, des: 12, con: 10, sab: 10, pre: 10, von: 10 } },
        );
    const off = calcular(f(false), {});
    const on = calcular(f(true), {});
    assert.equal(on['salv.for'] - off['salv.for'], 10 - 2); // mod 14 = +2 → +10
    assert.equal(on['salv.des'] - off['salv.des'], 10 - 1);
    assert.equal(on['teste.con'] - off['teste.con'], 10);
    assert.equal(on['pericia.atletismo'] - off['pericia.atletismo'], 8); // Atletismo é de Força
    assert.equal(on['pericia.percepcao'], off['pericia.percepcao']); // outro atributo
    assert.equal(on.ca, off.ca);
    assert.equal(on['ataque.desarmado'], off['ataque.desarmado']);
    const bestial = caracteristicasDaAkuma(F(16, A({ tipo: 'zoan', zoan: 'comum', despertada: true }))).find((c) => c.nome === 'Força Bestial');
    assert.equal(bestial.acoes[0].rolagem, '3d6+@dano.desarmado');
});
