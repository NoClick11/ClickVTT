// Assistente de criação do One Piece: das escolhas saem os campos da ficha (lógica pura, sem Vue).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ESPECIES } from '../../resources/js/app/sistemas/onepiece/construtor/dados/especies.ts';
import {
    atributosFinais,
    camposDaCriacao,
    categoriaDeTamanho,
    custoDaCompra,
    escolhasIniciais,
    fisicoDe,
    problemasDaEtapa,
    pvInicial,
    todosOsTracos,
} from '../../resources/js/app/sistemas/onepiece/construtor/regras.ts';
import { armaCabe, calcular } from '../../resources/js/app/sistemas/onepiece/regras.ts';

const base = { for: 15, des: 14, con: 13, sab: 12, pre: 10, von: 8 };
const feito = (extra = {}) => ({
    ...escolhasIniciais(),
    estilo: { nome: 'Espadachim', dado: 'd12' },
    atributos: { metodo: 'padrao', base },
    ajuste: { tipo: 'dois', atributos: ['for', 'des'] },
    ...extra,
});
const fichaDe = (campos) => ({
    nivel: 1,
    atributos: Object.fromEntries(['for', 'des', 'con', 'sab', 'pre', 'von'].map((a) => [a, campos[`atributos.${a}`]])),
    salvaguardas: campos.salvaguardas,
    pericias: Object.fromEntries(
        Object.entries(campos)
            .filter(([k]) => k.startsWith('pericias.'))
            .map(([k, v]) => [k.slice(9), v]),
    ),
    ferramentas: [],
    inventario: [],
    caracteristicas: campos.caracteristicas,
    condicoes: [],
    pv: { atual: campos['pv.atual'], max: campos['pv.max'], temp: 0 },
    pp: { atual: campos['pp.atual'], porNivel: 4 },
    tecnicas: { atributo: 'von', lista: [] },
    ajustes: {},
});

test('PV do nível 1: dado máximo do estilo + CON + PV base (d12 + 14 sem CON = 26)', () => {
    const e = feito({
        especies: ['povo-do-mar'],
        variantes: ['sireno'],
        atributos: { metodo: 'padrao', base: { ...base, con: 10 } },
        ajuste: { tipo: 'dois', atributos: ['for', 'des'] },
    });
    assert.equal(pvInicial(e), 26);
    assert.equal(pvInicial(feito({ especies: ['lunariano'], variantes: [null] })), 12 + 1 + 16);
});

test('ajuste de atributo: +1 em dois diferentes ou +2 em um', () => {
    const e = feito({ especies: ['humano'], variantes: ['comum'] });
    assert.deepEqual(atributosFinais(e), { ...base, for: 16, des: 15 });
    assert.equal(atributosFinais({ ...e, ajuste: { tipo: 'um', atributos: ['von'] } }).von, 10);
});

test('lunariano: Heat dá 1d10 em ataques e técnicas, usos = nível, resistência a fogo', () => {
    const e = feito({ especies: ['lunariano'], variantes: [null] });
    assert.deepEqual(problemasDaEtapa(e, 'escolhas'), []);
    const { campos } = camposDaCriacao(e);
    const heat = campos.caracteristicas.find((c) => c.nome === 'Heat');
    assert.equal(heat.tipo, 'ativa');
    assert.equal(heat.ativa, false);
    assert.deepEqual(heat.usos, { atual: 1, max: 1, porNivel: true });
    assert.deepEqual(
        heat.efeitos.map((x) => x.alvo),
        ['dano.tecnica', 'dano.arma'],
    );
    assert.deepEqual(campos.resistencias, ['Fogo']);
    assert.equal(campos.deslocamento, '9 m · nado 3 m');
    assert.equal(campos.tamanho, 'Médio');
    assert.equal(campos['pp.atual'], 4);
});

test('mink ágil: deslocamento 12 m e escalada 9 m (prevalece o maior); exige variante', () => {
    const sem = feito({ especies: ['mink'], variantes: [null] });
    assert.ok(problemasDaEtapa(sem, 'escolhas').some((p) => p.includes('variante')));
    const { campos } = camposDaCriacao(feito({ especies: ['mink'], variantes: ['agil'] }));
    assert.equal(campos['movimento.normal'], 12);
    assert.equal(campos['movimento.escalada'], 9);
    assert.equal(campos['movimento.nado'], 4.5);
    assert.ok(campos.caracteristicas.some((c) => c.nome === 'Ancestralidade'));
});

test('humano: Adaptação pede 3 perícias (sem Haki) e Aspectos Humanos pede 1 falha', () => {
    let e = feito({ especies: ['humano'], variantes: ['comum'] });
    assert.ok(problemasDaEtapa(e, 'escolhas').length >= 2);
    e = { ...e, pericias: { adaptacao: ['atletismo', 'acrobacia', 'percepcao'], 'aptidao-natural': ['furtividade'] }, falhas: ['orgulho'] };
    assert.deepEqual(problemasDaEtapa(e, 'escolhas'), []);
    const { campos } = camposDaCriacao(e);
    assert.equal(campos['pericias.atletismo'], 1);
    assert.equal(campos['pericias.furtividade'], 2); // Aptidão Natural: dobra a proficiência
    const orgulho = campos.caracteristicas.find((c) => c.nome.includes('Orgulho'));
    assert.equal(orgulho.efeitos[0].alvo, 'teste.pre');
    assert.deepEqual(
        orgulho.efeitos
            .slice(1)
            .map((x) => x.alvo)
            .sort(),
        ['pericia.atuacao', 'pericia.enganacao', 'pericia.intimidacao', 'pericia.persuasao', 'pericia.provocacao'],
    ); // vale também para as perícias de Presença
    const proibida = { ...e, pericias: { ...e.pericias, adaptacao: ['haki', 'atletismo', 'acrobacia'] } };
    assert.ok(problemasDaEtapa(proibida, 'escolhas').some((p) => p.includes('não permitida')));
});

test('humano: regra opcional pede 1 perícia e não tem dificuldade; kuja pede 2 falhas', () => {
    const opc = feito({
        especies: ['humano'],
        variantes: ['comum'],
        adaptacaoOpcional: true,
        pericias: { adaptacao: ['atletismo'], 'aptidao-natural': ['furtividade'] },
    });
    assert.deepEqual(problemasDaEtapa(opc, 'escolhas'), []);
    assert.ok(!camposDaCriacao(opc).campos.caracteristicas.some((c) => c.nome.startsWith('Aspectos')));
    const kuja = feito({
        especies: ['humano'],
        variantes: ['kuja'],
        pericias: { adaptacao: ['atletismo', 'acrobacia', 'percepcao'] },
        falhas: ['gula'],
    });
    assert.ok(problemasDaEtapa(kuja, 'escolhas').some((p) => p.includes('2 falhas')));
    const completo = { ...kuja, falhas: ['gula', 'ira'] };
    assert.deepEqual(problemasDaEtapa(completo, 'escolhas'), []);
    assert.ok(camposDaCriacao(completo).campos.caracteristicas.some((c) => c.nome === 'Cobra Companheira'));
});

test('gigante: Força Colossal dá proficiência e dobra o bônus em salvaguarda e teste de FOR', () => {
    const e = feito({ especies: ['gigante'], variantes: [null] });
    const { campos } = camposDaCriacao(e);
    assert.deepEqual(campos.salvaguardas, ['for']);
    assert.equal(campos.tamanho, 'Enorme');
    const r = calcular({ ...fichaDe(campos), nivel: 5 }, {}); // prof +3, FOR 16 (+3)
    assert.equal(r['salv.for'], 3 + 3 + 3); // mod + proficiência + 1× extra = 2× proficiência
    assert.equal(r['teste.for'], 3 + 6); // teste: sem proficiência base, 2× prof
});

test('povo do mar: Força Superior soma proficiência e metade (para baixo)', () => {
    const e = feito({ especies: ['povo-do-mar'], variantes: ['sireno'] });
    const { campos } = camposDaCriacao(e);
    const r = calcular({ ...fichaDe(campos), nivel: 5 }, {});
    assert.equal(r['salv.for'], 3 + 3 + 1); // mod + prof + metade da prof (1)
    assert.equal(r['teste.for'], 3 + 3 + 1);
    assert.equal(campos['movimento.nado'], 18);
});

test('celestial: Herança Cultural pede 2 perícias ou 1 + Haki da Observação Inato', () => {
    const e = feito({ especies: ['celestial'], variantes: ['skypean'], pericias: { 'heranca-cultural': ['atletismo', 'percepcao'] } });
    assert.deepEqual(problemasDaEtapa(e, 'escolhas'), []);
    const troca = { ...e, trocas: { 'heranca-cultural': true }, pericias: { 'heranca-cultural': ['atletismo'] } };
    assert.deepEqual(problemasDaEtapa(troca, 'escolhas'), []);
    assert.ok(camposDaCriacao(troca).campos.caracteristicas.some((c) => c.nome === 'Haki da Observação Inato'));
    const persuasao = camposDaCriacao(e).campos.caracteristicas.find((c) => c.nome === 'Diplomata Celestial');
    assert.deepEqual(persuasao.efeitos, [{ alvo: 'pericia.persuasao', modo: 'soma', valor: 5 }]);
});

test('anão: tamanho Miúdo, Piscar com 3 usos e -10 em Intuição', () => {
    const { campos } = camposDaCriacao(feito({ especies: ['anao'], variantes: [null] }));
    assert.equal(campos.tamanho, 'Miúdo');
    assert.equal(campos.caracteristicas.find((c) => c.nome === 'Piscar').usos.max, 3);
    const fadas = campos.caracteristicas.find((c) => c.nome === 'Andar das Fadas');
    assert.deepEqual(fadas.efeitos, [{ alvo: 'pericia.furtividade', modo: 'vantagem' }]);
    assert.equal(fadas.tipo, 'ativa');
    assert.ok(campos.caracteristicas.some((c) => c.nome === 'Estômago Pequeno'));
    assert.deepEqual(campos.caracteristicas.find((c) => c.nome === 'Ingenuidade Anormal').efeitos, [
        { alvo: 'pericia.intuicao', modo: 'soma', valor: -10 },
    ]);
});

test('mestiço: PV pela média, preconceito maior, maior deslocamento e tamanho pela escala', () => {
    const e = feito({
        modo: 'mestico',
        especies: ['lunariano', 'mink'],
        variantes: [null, 'meao'],
        beneficiosMestico: ['manipulacao-do-fogo', 'estamina-animal'],
        dificuldadeMestico: 0,
        doisMundos: 'ancestralidade',
    });
    const f = fisicoDe(e);
    assert.equal(f.nome, 'Lunariano × Mink');
    assert.equal(f.pv, 14); // (16 + 12) / 2
    assert.equal(f.preconceito, 'Medíocre');
    assert.equal(f.movimento.normal, 18);
    assert.equal(f.movimento.nado, 4.5);
    assert.equal(f.tamanhoCm, 155); // média dos menores: (180 + 130) / 2
    assert.equal(f.categoria, 'Médio');
    assert.deepEqual(problemasDaEtapa(e, 'escolhas'), []);
});

test('mestiço: benefício restrito exige dificuldade adicional e só 1 da lista', () => {
    const base2 = {
        modo: 'mestico',
        especies: ['lunariano', 'mink'],
        variantes: [null, 'agil'],
        dificuldadeMestico: 0,
        doisMundos: 'ancestralidade',
    };
    const heat = feito({ ...base2, beneficiosMestico: ['heat', 'corpo-leve'] });
    assert.ok(problemasDaEtapa(heat, 'escolhas').some((p) => p.includes('dificuldade adicional')));
    assert.deepEqual(problemasDaEtapa({ ...heat, dificuldadeExtra: 1 }, 'escolhas'), []);
    const dois = feito({ ...base2, variantes: [null, null], beneficiosMestico: ['heat', 'electro'], dificuldadeExtra: 1 });
    assert.ok(problemasDaEtapa({ ...dois, variantes: [null, 'agil'] }, 'escolhas').some((p) => p.includes('Só é possível escolher um')));
});

test('mestiço entre variantes da mesma espécie: só os benefícios das variantes', () => {
    const e = feito({
        modo: 'mestico',
        especies: ['humano', 'humano'],
        variantes: ['bracos-longos', 'pernas-longas'],
        falhas: ['gula'],
        pericias: { adaptacao: [] },
        dificuldadeMestico: 0,
    });
    const nomes = todosOsTracos(e).map((t) => t.traco.nome);
    assert.ok(nomes.includes('Braços Especiais') && nomes.includes('Pernas Especiais'));
    assert.ok(!nomes.includes('Adaptação'));
    assert.ok(problemasDaEtapa({ ...e, variantes: ['kuja', 'kuja'] }, 'escolhas').some((p) => p.includes('diferentes')));
});

test('variação rara substitui um benefício e não vale para mestiço', () => {
    const e = feito({ especies: ['lunariano'], variantes: [null], variacaoRara: 'sangue-ancestral', beneficioSubstituido: 'heat' });
    const nomes = camposDaCriacao(e).campos.caracteristicas.map((c) => c.nome);
    assert.ok(!nomes.includes('Heat') && nomes.includes('Poder Maligno') && nomes.includes('Manipulação do Fogo'));
    assert.deepEqual(problemasDaEtapa(e, 'variacao'), []);
    assert.ok(problemasDaEtapa({ ...e, beneficioSubstituido: null }, 'variacao').length);
    assert.ok(problemasDaEtapa({ ...e, modo: 'mestico' }, 'variacao').length);
    const cient = camposDaCriacao(
        feito({ especies: ['lunariano'], variantes: [null], variacaoRara: 'experimento-cientifico', beneficioSubstituido: 'heat' }),
    );
    assert.equal(cient.campos.caracteristicas.find((c) => c.nome === 'Corpo Engenhado').efeitos.length, 3);
});

test('refazer a criação troca só as características do assistente, não as manuais', () => {
    const manual = { nome: 'Minha', origem: '—', tipo: 'passiva' };
    const antigo = { nome: 'Velha', origem: 'x', tipo: 'passiva', builder: 'especie' };
    const { campos } = camposDaCriacao(feito({ especies: ['gigante'], variantes: [null] }), { caracteristicas: [manual, antigo] });
    assert.ok(campos.caracteristicas.some((c) => c.nome === 'Minha'));
    assert.ok(!campos.caracteristicas.some((c) => c.nome === 'Velha'));
});

test('atributos: compra de pontos, valores padrão e rolagem', () => {
    assert.equal(custoDaCompra({ for: 15, des: 15, con: 15, sab: 8, pre: 8, von: 8 }), 27);
    const e = feito();
    assert.deepEqual(problemasDaEtapa(e, 'atributos'), []);
    assert.ok(problemasDaEtapa({ ...e, atributos: { metodo: 'padrao', base: { ...base, for: 8 } } }, 'atributos').length);
    assert.ok(
        problemasDaEtapa(
            { ...e, atributos: { metodo: 'compra', base: { for: 15, des: 15, con: 15, sab: 15, pre: 8, von: 8 } } },
            'atributos',
        )[0].includes('27'),
    );
    assert.ok(problemasDaEtapa({ ...e, atributos: { metodo: 'rolagem', base } }, 'atributos')[0].includes('Role'));
    assert.deepEqual(problemasDaEtapa({ ...e, atributos: { metodo: 'rolagem', base }, rolados: [8, 10, 12, 13, 14, 15] }, 'atributos'), []);
    assert.ok(problemasDaEtapa({ ...e, atributos: { metodo: 'rolagem', base }, rolados: [18, 10, 12, 13, 14, 15] }, 'atributos').length);
});

test('categoria de tamanho pela escala do livro', () => {
    assert.deepEqual([10, 29, 30, 149, 150, 299, 300, 999, 1000, 2999, 3000].map(categoriaDeTamanho), [
        'Miúdo',
        'Miúdo',
        'Pequeno',
        'Pequeno',
        'Médio',
        'Médio',
        'Grande',
        'Grande',
        'Enorme',
        'Enorme',
        'Imenso',
    ]);
    // anão (10 cm) × gigante (1300 cm): média dos menores = 655 cm → Grande
    assert.equal(fisicoDe(feito({ modo: 'mestico', especies: ['anao', 'gigante'], variantes: [null, null] })).categoria, 'Grande');
});

test('todas as espécies têm dados completos', () => {
    assert.equal(ESPECIES.length, 7);
    for (const e of ESPECIES) {
        assert.ok(e.pv > 0 && e.nome && e.dificuldade && (e.beneficios.length || e.variantes?.length), e.id);
        assert.ok(e.movimento.normal > 0, e.id);
    }
});

test('Heat/Electro: um uso por rodada no grupo, forma alternativa de 5 usos e ficha de combate', () => {
    const { campos } = camposDaCriacao(feito({ especies: ['lunariano'], variantes: [null] }));
    const heat = campos.caracteristicas.find((c) => c.nome === 'Heat');
    assert.equal(heat.grupoRodada, 'ofensivo');
    assert.deepEqual(heat.alternativo, { atual: 5, max: 5 });
    const fogo = campos.caracteristicas.find((c) => c.nome === 'Manipulação do Fogo');
    assert.ok(fogo.etiquetas.includes('Resistência a fogo'));
    // a esfera de fogo vira técnica pronta (ataque à distância, 1d4 de fogo), marcada como do assistente
    const esfera = campos['tecnicas.lista'].find((t) => t.nome === 'Esfera de Fogo');
    assert.deepEqual([esfera.rolagem, esfera.tipoDano, esfera.custo, esfera.builder], ['1d4', 'fogo', 0, 'especie']);
});

test('refazer a criação preserva técnicas manuais e troca as do assistente', () => {
    const manual = { nome: 'Minha', origem: '', custo: 1, alcance: '', efeito: '', rolagem: '', descricao: '' };
    const velha = { ...manual, nome: 'Velha', builder: 'especie' };
    const { campos } = camposDaCriacao(feito({ especies: ['lunariano'], variantes: [null] }), { tecnicas: [manual, velha] });
    const nomes = campos['tecnicas.lista'].map((t) => t.nome);
    assert.ok(nomes.includes('Minha') && nomes.includes('Esfera de Fogo') && !nomes.includes('Velha'));
});

test('anão: Armas Reduzidas põe o dano à distância em 50% e Hóspede Feérico tem o botão de hospedar', () => {
    const { campos } = camposDaCriacao(feito({ especies: ['anao'], variantes: [null] }));
    const reduzidas = campos.caracteristicas.find((c) => c.nome === 'Armas Reduzidas');
    assert.deepEqual(reduzidas.efeitos, [{ alvo: 'dano.distancia.pct', modo: 'base', valor: 50 }]);
    const mista = camposDaCriacao(
        feito({
            modo: 'mestico',
            especies: ['anao', 'gigante'],
            variantes: [null, null],
            beneficiosMestico: ['hospede-feerico', 'corpo-assustador'],
            dificuldadeMestico: 0,
            dificuldadeExtra: 1,
            doisMundos: 'cultural',
        }),
    );
    const hospede = mista.campos.caracteristicas.find((c) => c.nome === 'Hóspede Feérico');
    assert.equal(hospede.acoes[0].tipo, 'hospedar');
});

test('Braços e Pernas Longos: alcance de 3 m; Sulong: deslocamento dobrado e voo', () => {
    const bracos = camposDaCriacao(
        feito({
            especies: ['humano'],
            variantes: ['bracos-longos'],
            pericias: { adaptacao: ['atletismo', 'acrobacia', 'percepcao'] },
            falhas: ['gula'],
        }),
    ).campos;
    assert.equal(calcular({ ...fichaDe(bracos), movimento: { normal: 9, nado: 0, escalada: 0, voo: 0 } }, {})['alcance.corpo'], 30);
    const mink = camposDaCriacao(feito({ especies: ['mink'], variantes: ['meao'] })).campos;
    const sulong = mink.caracteristicas.find((c) => c.nome === 'Forma Sulong');
    const ficha = { ...fichaDe(mink), movimento: { normal: 18, nado: 4.5, escalada: 0, voo: 0 }, caracteristicas: [{ ...sulong, ativa: true }] };
    const r = calcular(ficha, {});
    assert.equal(r['movimento.normal'], 360); // 18 m dobrado (36 m)
    assert.equal(r['movimento.voo'], 180); // voo = metade do deslocamento dobrado
});

test('Instintos Animalescos (Mink) tem a salvaguarda de Vontade CD 15 com Atordoado 1d4 até o dano', () => {
    const { campos } = camposDaCriacao(feito({ especies: ['mink'], variantes: ['robusto'] }));
    const a = campos.caracteristicas.find((c) => c.nome === 'Instintos Animalescos').acoes[0];
    assert.deepEqual([a.condicao, a.atributo, a.cd, a.turnos, a.aoDano, a.alvo], ['atordoado', 'von', 15, '1d4', true, 'proprio']);
});

test('Kuja: Cobra Companheira pede o companheiro e tem Restringir (Força CD 16) no alvo', () => {
    const e = feito({
        especies: ['humano'],
        variantes: ['kuja'],
        pericias: { adaptacao: ['atletismo', 'acrobacia', 'percepcao'] },
        falhas: ['gula', 'ira'],
    });
    const tracos = todosOsTracos(e);
    assert.equal(tracos.find((t) => t.traco.id === 'cobra-companheira').traco.companheiro, 'cobra-belica');
    const cobra = camposDaCriacao(e).campos.caracteristicas.find((c) => c.nome === 'Cobra Companheira');
    assert.deepEqual(
        cobra.acoes.map((a) => [a.condicao, a.cd, a.alvo]),
        [
            ['incapacitado', 16, 'mirado'],
            ['agarrado', 16, 'mirado'],
        ],
    );
});

test('variações raras: Mente Solar imune a efeitos mentais e Poder Maligno com dado extra', () => {
    const mente = camposDaCriacao(
        feito({ especies: ['lunariano'], variantes: [null], variacaoRara: 'bucaneiro', beneficioSubstituido: 'heat' }),
    ).campos;
    assert.ok(['Enfeitiçado', 'Amedrontado'].every((c) => mente.imunidades.includes(c)));
    const poder = camposDaCriacao(
        feito({ especies: ['lunariano'], variantes: [null], variacaoRara: 'sangue-ancestral', beneficioSubstituido: 'heat' }),
    ).campos.caracteristicas.find((c) => c.nome === 'Poder Maligno');
    assert.equal(poder.grupoRodada, 'ofensivo');
    assert.equal(poder.acoes[0].tipo, 'dadoExtra');
    assert.equal(poder.tipo, 'passiva');
});

test('gigante só usa arma de gigante e os demais não usam a dele', () => {
    assert.equal(armaCabe({ tamanho: 'gigante' }, 'Enorme'), true);
    assert.equal(armaCabe({}, 'Enorme'), false);
    assert.equal(armaCabe({ tamanho: 'gigante' }, 'Médio'), false);
    assert.equal(armaCabe({ tamanho: 'padrao' }, 'Médio'), true);
    const arma = { nome: 'Espada', peso: 1, equipavel: true, dados: { arma: { dano: '1d8', atributo: 'for', proficiente: true } } };
    const ficha = {
        ...fichaDe(camposDaCriacao(feito({ especies: ['gigante'], variantes: [null] })).campos),
        tamanho: 'Enorme',
        inventario: [{ secao: 'E', itens: [{ item_id: 1, qtd: 1, equipado: true, sintonizado: false }] }],
    };
    assert.ok(!('arma.1.ataque' in calcular(ficha, { 1: arma }))); // arma comum não serve a um gigante
    assert.ok('arma.1.ataque' in calcular(ficha, { 1: { ...arma, dados: { arma: { ...arma.dados.arma, tamanho: 'gigante' } } } }));
});
