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
    e = { ...e, pericias: { adaptacao: ['atletismo', 'acrobacia', 'percepcao'], 'aptidao-natural': ['acrobacia'] }, falhas: ['orgulho'] };
    assert.deepEqual(problemasDaEtapa(e, 'escolhas'), []);
    const { campos } = camposDaCriacao(e);
    assert.equal(campos['pericias.atletismo'], 1);
    assert.equal(campos['pericias.acrobacia'], 2); // Aptidão Natural: dobra a proficiência de uma perícia que já tinha
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
        pericias: { adaptacao: ['atletismo'], 'aptidao-natural': ['atletismo'] },
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

// --- estilo de luta: Atirador -----------------------------------------------------------------------------------------
const atirador = (caminho, extra = {}) =>
    feito({
        estilo: {
            id: 'atirador',
            nome: 'Atirador',
            dado: 'd8',
            caminho,
            armaFavorita: 'Mosquete',
            hbInata: 'mira-treinada',
            pericias: ['acrobacia', 'percepcao', 'sorte'],
        },
        especies: ['humano'],
        variantes: [null],
        // os Bellys iniciais do Atirador (5d10 × 1000) são rolados no servidor: nos testes já vêm rolados
        dinheiro: { estilo: 'atirador', dados: [5, 5, 5, 5, 5], total: 25, bellys: 25000, expressao: '5d10', multiplicador: 1000 },
        ...extra,
    });

test('Atirador: o estilo exige caminho, arma favorita, Habilidade Básica Inata e 3 perícias', () => {
    assert.deepEqual(problemasDaEtapa(atirador('sniper'), 'estilo'), []);
    assert.ok(problemasDaEtapa(atirador(null), 'estilo').some((m) => m.includes('caminho')));
    assert.ok(problemasDaEtapa(atirador('sniper', { estilo: { ...atirador('sniper').estilo, hbInata: 'robusto' } }), 'estilo').length > 0);
    assert.ok(problemasDaEtapa(atirador('sniper', { estilo: { ...atirador('sniper').estilo, pericias: ['acrobacia'] } }), 'estilo').length > 0);
});

test('Atirador: PV d8, salvaguardas DES e SAB, 3 perícias, atributo primário e Habilidade Básica Inata', () => {
    const e = atirador('sniper');
    assert.equal(pvInicial(e), 8 + 1 + 0 + (fisicoDe(e)?.pv ?? 0));
    const { campos } = camposDaCriacao(e);
    assert.equal(campos['dadosVida.tipo'], 'd8');
    assert.equal(campos.atributoPrimario, 'des');
    assert.equal(campos['tecnicas.atributo'], 'des'); // CD e ataque das técnicas pelo atributo principal
    assert.ok(['des', 'sab'].every((s) => campos.salvaguardas.includes(s)));
    for (const p of ['acrobacia', 'percepcao', 'sorte']) assert.ok(campos[`pericias.${p}`] >= 1);
    assert.deepEqual(campos.habilidadesBasicas, [{ id: 'mira-treinada', nivel: 1, opcao: 'inata' }]);
    assert.ok(campos.proficienciasArmas.includes('Armas de Fogo'));
});

test('Atirador: no 1º nível só vêm as características do nível; as outras entram ao subir (o outro caminho só no 11º)', () => {
    const nomes = (c) => c.caracteristicas.map((x) => x.nome);
    const { campos } = camposDaCriacao(atirador('sniper'));
    assert.ok(nomes(campos).includes('Corrida Contínua'));
    for (const n of ['Gun-Fu', 'Guarda Astuta: Sentido de Perigo', 'Guarda Astuta: Rompante Defensivo', 'Atirador de Elite'])
        assert.ok(!nomes(campos).includes(n), `${n} não vem no 1º nível`);
    assert.ok(campos.caracteristicas.every((c) => (c.nivelMin ?? 1) <= 1));
    const no = (nivel) => nomes(camposDaCriacao(atirador('sniper'), { nivel }).campos);
    assert.ok(no(2).includes('Guarda Astuta: Rompante Defensivo'));
    assert.ok(!no(5).includes('Guarda Astuta: Sentido de Perigo'));
    assert.ok(no(6).includes('Guarda Astuta: Sentido de Perigo'));
    assert.ok(!no(10).includes('Gun-Fu'));
    assert.ok(no(11).includes('Gun-Fu')); // Rei Atirador
    assert.ok(
        camposDaCriacao(atirador('sniper')).campos.caracteristicas.every(
            (c) => c.builder === 'estilo' || c.builder === 'especie' || c.builder === 'variacao' || !c.builder,
        ),
    );
});

test('Atirador: as técnicas entram pelo nível (1º: técnica de combate e auxiliar; o outro caminho só no 11º)', () => {
    const tecnicas = (nivel, caminho = 'sniper') => camposDaCriacao(atirador(caminho), { nivel })['campos']['tecnicas.lista'].map((t) => t.nome);
    assert.deepEqual(tecnicas(1), ['Tiro de Advertência', 'Saída Forçada']);
    assert.ok(tecnicas(3).includes('Tiro Certeiro'));
    assert.ok(!tecnicas(6).includes('Death Blossom'));
    assert.ok(tecnicas(11).includes('Death Blossom')); // Rei Atirador: tudo que não escolheu
    assert.deepEqual(tecnicas(1, 'duelista'), ['Death Blossom', 'Último Recurso']);
});

test('Atirador: Corpo Treinado soma 1 PV por nível e Corrida Contínua dá 15 m de deslocamento', () => {
    const duelista = camposDaCriacao(atirador('duelista')).campos;
    const f = { ...fichaDe(duelista), nivel: 5 };
    assert.equal(calcular(f, {})['pv.max'], duelista['pv.max'] + 5);
    const sniper = camposDaCriacao(atirador('sniper')).campos;
    assert.equal(calcular(fichaDe(sniper), {})['movimento.normal'], 150);
});

// --- Habilidades Básicas e subir de nível ------------------------------------------------------------------------------
import { aumentosDoAprimoramento, HABILIDADES_BASICAS, OPCOES_APRIMORAMENTO } from '../../resources/js/app/sistemas/onepiece/construtor/dados/habilidades-basicas.ts';
import { ptCulturais } from '../../resources/js/app/sistemas/onepiece/treinamentos/regras.ts';
import { extrasDeDano, montarDanoDaTecnica } from '../../resources/js/app/sistemas/onepiece/tecnicaBonus.ts';
import { camposDoNivel, pendenciasDoNivel, problemasDoNivel, pvPelaMedia } from '../../resources/js/app/sistemas/onepiece/construtor/nivel.ts';
import { caracteristicasDasHB, dadoDeVidaFinal } from '../../resources/js/app/sistemas/onepiece/construtor/regras.ts';

const comHB = (hb, hbOpcoes = {}, extra = {}) => atirador('sniper', { hb, hbOpcoes, ...extra });
const fichaCompleta = (e, nivel = 1) => {
    const { campos } = camposDaCriacao(e, { nivel });
    return {
        ...fichaDe(campos),
        nivel,
        atributoPrimario: campos.atributoPrimario,
        estiloId: campos.estiloId,
        estiloCaminho: campos.estiloCaminho,
        habilidadesBasicas: campos.habilidadesBasicas,
        dadosVida: { tipo: campos['dadosVida.tipo'], restantes: nivel },
        tecnicas: { atributo: 'des', lista: campos['tecnicas.lista'] },
        pp: { atual: campos['pp.atual'], porNivel: 4 },
    };
};

test('Habilidades Básicas: as 20 existem, com id único e características marcadas', () => {
    assert.equal(HABILIDADES_BASICAS.length, 20);
    assert.equal(new Set(HABILIDADES_BASICAS.map((h) => h.id)).size, 20);
    for (const h of HABILIDADES_BASICAS) {
        const tracos = h.tracos({ primario: 'des', opcoes: h.escolha === 'prodigio' ? ['corpo'] : h.escolha === 'quebrador' ? ['forca-arma'] : h.escolha === 'aprimoramento' ? ['ava:for'] : [] });
        assert.ok(tracos.length > 0 && tracos.every((t) => t.hb === h.id), h.id);
    }
});

test('assistente: o passo da HB exige uma HB diferente da Inata e a escolha do Prodígio/Quebrador', () => {
    assert.ok(problemasDaEtapa(comHB(null), 'habilidades').length > 0);
    assert.ok(problemasDaEtapa(comHB('mira-treinada'), 'habilidades').some((m) => m.includes('Inata')));
    assert.ok(problemasDaEtapa(comHB('prodigio-do-combate'), 'habilidades').length > 0);
    assert.deepEqual(problemasDaEtapa(comHB('prodigio-do-combate', { 'prodigio-do-combate': ['distancia'] }), 'habilidades'), []);
    assert.deepEqual(problemasDaEtapa(comHB('robusto'), 'habilidades'), []);
});

test('Robusto soma 3 PV por nível; Mira Treinada sobe o dado à distância; Crítico Marcial muda a margem', () => {
    const { campos } = camposDaCriacao(comHB('robusto'));
    const f = { ...fichaDe(campos), nivel: 4 };
    assert.equal(calcular(f, {})['pv.max'], campos['pv.max'] + 12);
    assert.equal(calcular(f, {})['passo.distancia'], 1); // Mira Treinada (Inata)
    const prod = camposDaCriacao(comHB('prodigio-do-combate', { 'prodigio-do-combate': ['distancia'] })).campos;
    assert.equal(calcular(fichaDe(prod), {})['margem.distancia'], 19);
    assert.equal(calcular(fichaDe(prod), {})['margem.corpo'], 20);
});

test('Defesa Aprimorada (Corpo de Guerreiro): CR 10 + atributo primário + CON limitada a ½ nível (+1 no 1º)', () => {
    const e = comHB('corpo-de-guerreiro');
    const { campos } = camposDaCriacao(e);
    const f = fichaDe(campos);
    const des = f.atributos.des;
    const con = f.atributos.con;
    const mod = (v) => Math.floor((v - 10) / 2);
    assert.equal(calcular(f, {}).ca, Math.max(10 + mod(des), 10 + Math.max(1, mod(des)) + Math.min(mod(con), 1)));
});

test('Dificuldade Inefável: CD +½ proficiência, +2 no 6º e +3 no 9º', () => {
    const { campos } = camposDaCriacao(comHB('dificuldade-inefavel'));
    const base = calcular({ ...fichaDe(campos), caracteristicas: [] }, {}).cd;
    const cd = (nivel) => calcular({ ...fichaDe(campos), nivel }, {}).cd - calcular({ ...fichaDe(campos), nivel, caracteristicas: [] }, {}).cd;
    assert.equal(cd(1), 1);
    assert.equal(cd(6), 3);
    assert.equal(cd(9), 2 + 3);
    assert.ok(base > 0);
});

test('Vitalidade Exuberante: o dado sobe um passo e, no d12, vira +1 PV por nível', () => {
    assert.equal(dadoDeVidaFinal('d8', [{ id: 'quebrador-de-regras', nivel: 1, opcao: 'vitalidade' }], 1), 'd10');
    assert.equal(
        dadoDeVidaFinal(
            'd8',
            [
                { id: 'quebrador-de-regras', nivel: 1, opcao: 'vitalidade' },
                { id: 'quebrador-de-regras', nivel: 6, opcao: 'vitalidade' },
            ],
            5,
        ),
        'd10',
    );
    assert.equal(
        dadoDeVidaFinal(
            'd8',
            [
                { id: 'quebrador-de-regras', nivel: 1, opcao: 'vitalidade' },
                { id: 'quebrador-de-regras', nivel: 6, opcao: 'vitalidade' },
            ],
            6,
        ),
        'd12',
    );
    const c = caracteristicasDasHB([{ id: 'quebrador-de-regras', nivel: 1, opcao: 'vitalidade' }], 'des', 1, 'd12');
    assert.equal(c[0].efeitos[0].alvo, 'pv.max');
    const e = comHB('quebrador-de-regras', { 'quebrador-de-regras': ['vitalidade'] });
    assert.equal(camposDaCriacao(e).campos['dadosVida.tipo'], 'd10');
    assert.equal(pvInicial(e), 10 + 1 + (fisicoDe(e)?.pv ?? 0));
});

test('subir de nível: o 2º nível exige HB (sem repetir), dá PP, técnicas e 1 dado de vida', () => {
    const f = fichaCompleta(comHB('robusto'), 2 - 1);
    assert.ok(problemasDoNivel(f, { pvGanho: 6 }).some((m) => m.includes('Habilidade Básica')));
    assert.ok(problemasDoNivel(f, { hb: { id: 'robusto' }, pvGanho: 6 }).some((m) => m.includes('repete')));
    assert.ok(problemasDoNivel(f, { hb: { id: 'mira-treinada' }, pvGanho: 6 }).some((m) => m.includes('repete'))); // a Inata também conta
    const esc = { hb: { id: 'sortudo' }, pvGanho: pvPelaMedia('d8', 1) };
    assert.deepEqual(problemasDoNivel(f, esc), []);
    const campos = camposDoNivel(f, esc);
    assert.equal(campos.nivel, 2);
    assert.equal(campos['pp.atual'], f.pp.atual + 4);
    assert.equal(campos['pv.max'], f.pv.max + 6);
    assert.ok(campos.caracteristicas.some((c) => c.hb === 'sortudo'));
    assert.equal(campos.habilidadesBasicas.length, 3);
    // os traços do estilo do 2º nível entram agora (e não duplicam ao subir de novo)
    assert.ok(!f.caracteristicas.some((c) => c.nome === 'Guarda Astuta: Rompante Defensivo'));
    assert.equal(campos.caracteristicas.filter((c) => c.nome === 'Guarda Astuta: Rompante Defensivo').length, 1);
});

test('subir de nível: o 3º nível traz a 2ª técnica de combate e o 4º dá AVA (+2 ou +1/+1, teto 20) ou troca por HB', () => {
    let f = fichaCompleta(comHB('robusto'), 3);
    f.habilidadesBasicas.push({ id: 'sortudo', nivel: 2 });
    f = { ...f, nivel: 3 };
    const para3 = fichaCompleta(comHB('robusto'), 2);
    const campos3 = camposDoNivel(
        { ...para3, habilidadesBasicas: [...para3.habilidadesBasicas, { id: 'sortudo', nivel: 2 }] },
        { hb: { id: 'mente-e-corpo' }, pvGanho: 6 },
    );
    assert.ok(campos3['tecnicas.lista'].some((t) => t.nome === 'Tiro Certeiro'));

    assert.ok(problemasDoNivel(f, { pvGanho: 6 }).some((m) => m.includes('AVA')));
    assert.deepEqual(problemasDoNivel(f, { ava: { tipo: 'dois', atributos: ['des'] }, pvGanho: 6 }), []);
    assert.deepEqual(problemasDoNivel(f, { ava: { tipo: 'um', atributos: ['des', 'con'] }, pvGanho: 6 }), []);
    assert.ok(
        problemasDoNivel({ ...f, atributos: { ...f.atributos, des: 19 } }, { ava: { tipo: 'dois', atributos: ['des'] }, pvGanho: 6 }).some((m) =>
            m.includes('20'),
        ),
    );
    assert.deepEqual(problemasDoNivel(f, { trocarAva: true, hb: { id: 'reflexo-afiado' }, pvGanho: 6 }), []);
    assert.equal(camposDoNivel(f, { ava: { tipo: 'dois', atributos: ['des'] }, pvGanho: 6 })['atributos.des'], f.atributos.des + 2);
});

test('as etiquetas, os rótulos e as rolagens do catálogo cabem nos limites do servidor', () => {
    const { campos } = camposDaCriacao(comHB('prodigio-do-combate', { 'prodigio-do-combate': ['corpo'] }), { nivel: 20 });
    for (const c of campos.caracteristicas) {
        for (const t of c.etiquetas ?? []) assert.ok(t.length <= 80, `${c.nome}: etiqueta longa`);
        for (const a of c.acoes ?? []) assert.ok(a.rotulo.length <= 60 && (a.rolagem ?? '').length <= 60, `${c.nome}: ação`);
    }
});

// --- Maestrias e Aprimoramento Inato ----------------------------------------------------------------------------------
import { MAESTRIAS, problemasDaMaestria } from '../../resources/js/app/sistemas/onepiece/construtor/dados/maestrias.ts';
import { atributosComAprimoramentoInato } from '../../resources/js/app/sistemas/onepiece/construtor/regras.ts';

test('Maestrias: as 20 existem com 3 traços cada e ids únicos', () => {
    assert.equal(MAESTRIAS.length, 20);
    for (const m of MAESTRIAS) {
        assert.equal(m.tracos.length, 3, m.nome);
        assert.equal(new Set(m.tracos.map((t) => t.id)).size, 3, m.nome);
    }
    assert.equal(new Set(MAESTRIAS.map((m) => m.id)).size, 20);
});

test('Maestria: exige o atributo mínimo (um dos dois) e confirma o requisito adicional', () => {
    const bar = MAESTRIAS.find((m) => m.id === 'barbaro');
    assert.ok(problemasDaMaestria(bar, { for: 15, des: 10, con: 10, sab: 10, pre: 10, von: 10 }, false).length > 0);
    assert.deepEqual(problemasDaMaestria(bar, { for: 16, des: 10, con: 10, sab: 10, pre: 10, von: 10 }, false), []);
    const rei = MAESTRIAS.find((m) => m.id === 'rei-do-inferno');
    const atr = { for: 10, des: 10, con: 10, sab: 10, pre: 10, von: 15 };
    assert.equal(problemasDaMaestria(rei, atr, false).length, 1); // falta confirmar o Haki do Rei
    assert.deepEqual(problemasDaMaestria(rei, atr, true), []);
});

const ficha9 = () => {
    const f = fichaCompleta(comHB('robusto'), 8);
    return { ...f, nivel: 8, atributos: { ...f.atributos, for: 16, des: 18 }, maestria: '', tracosDeMaestria: [] };
};

test('subir de nível: no 9º, 13º e 17º escolhe-se um Traço de Maestria; só uma Maestria; sem repetir traço', () => {
    const f = ficha9();
    assert.ok(problemasDoNivel(f, { pvGanho: 6 }).some((m) => m.includes('Maestria')));
    assert.deepEqual(problemasDoNivel(f, { maestria: { id: 'barbaro', traco: 'furia' }, pvGanho: 6 }), []);
    assert.ok(problemasDoNivel(f, { maestria: { id: 'ambicao-suprema', traco: 'voz-soberana' }, pvGanho: 6 }).length > 0); // Haki do Rei não confirmado e PRE/VON baixos
    const c1 = camposDoNivel(f, { maestria: { id: 'barbaro', traco: 'furia' }, pvGanho: 6 });
    assert.equal(c1.maestria, 'barbaro');
    assert.deepEqual(c1.tracosDeMaestria, [{ id: 'furia', nivel: 9 }]);
    assert.ok(c1.caracteristicas.some((c) => c.nome === 'Fúria' && c.builder === 'maestria'));
    // 13º: mesma Maestria, outro traço
    const f13 = { ...f, nivel: 12, maestria: 'barbaro', tracosDeMaestria: [{ id: 'furia', nivel: 9 }] };
    assert.ok(problemasDoNivel(f13, { maestria: { id: 'barbaro', traco: 'furia' }, pvGanho: 6 }).some((m) => m.includes('já foi')));
    assert.ok(problemasDoNivel(f13, { maestria: { id: 'sumo', traco: 'oni-muso' }, pvGanho: 6 }).some((m) => m.includes('uma Maestria')));
    assert.deepEqual(problemasDoNivel(f13, { maestria: { id: 'barbaro', traco: 'ira' }, pvGanho: 6 }), []);
    // nos outros níveis não há Traço de Maestria
    assert.ok(problemasDoNivel({ ...f, nivel: 9 }, { maestria: { id: 'barbaro', traco: 'furia' }, pvGanho: 6 }).some((m) => m.includes('não dá')));
});

test('Maestria Imaculado: Energia Impetuosa soma PP e a Técnica Noryoku Hunter entra na lista', () => {
    const f = { ...ficha9(), atributos: { ...ficha9().atributos, con: 16 } };
    const c = camposDoNivel(f, { maestria: { id: 'imaculado', traco: 'estrategias-do-imaculado' }, pvGanho: 6 });
    assert.ok(c['tecnicas.lista'].some((t) => t.nome === 'Noryoku Hunter' && t.builder === 'maestria'));
    assert.ok(c.caracteristicas.find((c) => c.nome === 'Estratégias do Imaculado').efeitos.some((e) => e.alvo === 'pp.max'));
});

test('Aprimoramento Inato: +1 direto no atributo, nunca acima de 20 por ele', () => {
    const inato = [{ id: 'quebrador-de-regras', nivel: 1, opcao: 'inato-des' }];
    assert.equal(atributosComAprimoramentoInato({ for: 10, des: 14, con: 10, sab: 10, pre: 10, von: 10 }, inato).des, 15);
    assert.equal(atributosComAprimoramentoInato({ for: 10, des: 20, con: 10, sab: 10, pre: 10, von: 10 }, inato).des, 20);
    assert.equal(atributosComAprimoramentoInato({ for: 10, des: 21, con: 10, sab: 10, pre: 10, von: 10 }, inato).des, 21); // já passava: não reduz
    const e = comHB('quebrador-de-regras', { 'quebrador-de-regras': ['inato-des'] });
    const des = camposDaCriacao(e).campos['atributos.des'];
    assert.equal(des, atributosFinais(e).des + 1);
    // sem efeito duplicado nas características
    const q = camposDaCriacao(e).campos.caracteristicas.find((c) => c.nome.includes('Aprimoramento Inato'));
    assert.equal(q.efeitos, undefined);
});

test('subir de nível: o Aprimoramento Inato no 6º nível respeita o teto de 20', () => {
    let f = fichaCompleta(comHB('quebrador-de-regras', { 'quebrador-de-regras': ['vitalidade'] }), 5);
    f = { ...f, nivel: 5, atributos: { ...f.atributos, con: 20 } };
    const c = camposDoNivel(f, { hb: { id: 'quebrador-de-regras', opcao: 'inato-con' }, pvGanho: 6 });
    assert.equal(c['atributos.con'], undefined); // já estava em 20: nada muda
    const g = camposDoNivel({ ...f, atributos: { ...f.atributos, con: 19 } }, { hb: { id: 'quebrador-de-regras', opcao: 'inato-con' }, pvGanho: 6 });
    assert.equal(g['atributos.con'], 20);
});

test('Aptidão Natural: só vale em perícia já proficiente, inclusive as do estilo escolhido depois', () => {
    const humano = { especies: ['humano'], variantes: ['comum'], falhas: ['orgulho'] };
    const adaptacao = ['atletismo', 'acrobacia', 'percepcao'];
    // a etapa Escolhas não cobra a Aptidão (ela é feita na etapa do estilo)
    const base = feito({ ...humano, pericias: { adaptacao } });
    assert.deepEqual(problemasDaEtapa(base, 'escolhas'), []);
    // sem escolher: o estilo pede
    assert.ok(problemasDaEtapa(base, 'estilo').some((m) => m.includes('Aptidão Natural')));
    // perícia sem proficiência: recusada
    const ruim = feito({ ...humano, pericias: { adaptacao, 'aptidao-natural': ['furtividade'] } });
    assert.ok(problemasDaEtapa(ruim, 'estilo').some((m) => m.includes('já tem proficiência')));
    assert.equal(camposDaCriacao(ruim).campos['pericias.furtividade'], 0);
    // perícia que vem do estilo (escolhido depois): aceita e dobra
    const doEstilo = atirador('sniper', { ...humano, pericias: { adaptacao, 'aptidao-natural': ['sorte'] } });
    assert.deepEqual(problemasDaEtapa(doEstilo, 'estilo'), []);
    assert.equal(camposDaCriacao(doEstilo).campos['pericias.sorte'], 2);
    // trocar a perícia do estilo invalida a Aptidão
    const trocou = atirador('sniper', {
        ...humano,
        pericias: { adaptacao, 'aptidao-natural': ['sorte'] },
        estilo: { ...doEstilo.estilo, pericias: ['acrobacia', 'percepcao', 'furtividade'] },
    });
    assert.ok(problemasDaEtapa(trocou, 'resumo').some((m) => m.includes('já tem proficiência')));
});

test('atributo primário: estilo com dois possíveis exige a escolha; com um só, é fixo', async () => {
    const { ESTILOS, ATIRADOR } = await import('../../resources/js/app/sistemas/onepiece/construtor/dados/estilos.ts');
    const duplo = { ...ATIRADOR, id: 'teste-duplo', atributosPrimarios: ['for', 'des'] };
    ESTILOS.push(duplo);
    try {
        const base = atirador('sniper');
        const e = { ...base, estilo: { ...base.estilo, id: 'teste-duplo', primario: null }, dinheiro: { ...base.dinheiro, estilo: 'teste-duplo' } };
        assert.ok(problemasDaEtapa(e, 'estilo').some((m) => m.includes('atributo primário')));
        const com = { ...e, estilo: { ...e.estilo, primario: 'for' } };
        assert.deepEqual(problemasDaEtapa(com, 'estilo'), []);
        assert.equal(camposDaCriacao(com).campos.atributoPrimario, 'for');
        assert.ok(problemasDaEtapa({ ...e, estilo: { ...e.estilo, primario: 'sab' } }, 'estilo').length > 0); // fora das opções
    } finally {
        ESTILOS.pop();
    }
    // Atirador: só Destreza, sem pergunta
    assert.equal(camposDaCriacao(atirador('sniper')).campos.atributoPrimario, 'des');
});

// --- Antecedentes -------------------------------------------------------------------------------------------------------
import { ANTECEDENTES, antecedentePorId, comAumentoDeAntecedente } from '../../resources/js/app/sistemas/onepiece/construtor/dados/antecedentes.ts';
import { ETAPAS, periciasJaProficientes, problemasDoAntecedente } from '../../resources/js/app/sistemas/onepiece/construtor/regras.ts';
import { ATRIBUTOS as LISTA_ATRIBUTOS, PERICIAS as LISTA_PERICIAS } from '../../resources/js/app/sistemas/onepiece/regras.ts';

const comAnt = (antecedente, extra = {}) =>
    feito({
        especies: ['humano'],
        variantes: ['comum'],
        antecedente: { id: '', pericia: '', atributo: null, personalizado: false, caracteristicaDe: null, ...antecedente },
        ...extra,
    });

test('antecedentes: os 20 existem com ids únicos, perícias e atributos válidos e uma característica especial', () => {
    assert.equal(ANTECEDENTES.length, 20);
    assert.equal(new Set(ANTECEDENTES.map((a) => a.id)).size, 20);
    const pericias = LISTA_PERICIAS.map((p) => p.id);
    const atributos = LISTA_ATRIBUTOS.map((a) => a.id);
    for (const a of ANTECEDENTES) {
        assert.ok(a.pericias.length >= 4 && a.pericias.every((p) => pericias.includes(p)), `${a.id}: perícias`);
        assert.ok(a.atributos.length >= 1 && a.atributos.every((x) => atributos.includes(x)), `${a.id}: atributos`);
        assert.ok(a.caracteristica.nome && a.caracteristica.descricao.length > 40, a.id);
    }
    assert.ok(ETAPAS.map((e) => e.id).indexOf('antecedente') < ETAPAS.map((e) => e.id).indexOf('estilo'));
});

test('antecedente: a etapa exige o antecedente, uma perícia da lista e o atributo; personalizar libera qualquer perícia', () => {
    assert.ok(problemasDaEtapa(comAnt({}), 'antecedente').length > 0);
    assert.deepEqual(problemasDaEtapa(comAnt({ id: 'marinheiro', pericia: 'medicina', atributo: 'for' }), 'antecedente'), []);
    assert.ok(problemasDoAntecedente(comAnt({ id: 'marinheiro', pericia: 'sorte', atributo: 'for' })).length > 0); // fora da lista
    assert.deepEqual(problemasDoAntecedente(comAnt({ id: 'marinheiro', pericia: 'sorte', atributo: 'for', personalizado: true })), []);
    assert.ok(problemasDoAntecedente(comAnt({ id: 'marinheiro', pericia: 'medicina', atributo: null })).length > 0);
    assert.ok(
        problemasDoAntecedente(
            comAnt({ id: 'marinheiro', pericia: 'medicina', atributo: 'for', personalizado: true, caracteristicaDe: 'inexistente' }),
        ).length > 0,
    );
    // o resumo também confere
    assert.ok(problemasDaEtapa(comAnt({}), 'resumo').some((m) => m.includes('antecedente')));
});

test('antecedente: +2 no atributo escolhido, sem passar de 20 e sem reduzir quem já passou', () => {
    assert.equal(comAumentoDeAntecedente(14), 16);
    assert.equal(comAumentoDeAntecedente(19), 20);
    assert.equal(comAumentoDeAntecedente(20), 20);
    assert.equal(comAumentoDeAntecedente(22), 22);
    const sem = atributosFinais(comAnt({}));
    const com = atributosFinais(comAnt({ id: 'tenryuubito', pericia: 'historia', atributo: 'con' }));
    assert.equal(com.con, sem.con + 2);
    assert.equal(com.for, sem.for);
    // a CON mais alta entra no PV do nível 1
    assert.ok(pvInicial(comAnt({ id: 'tenryuubito', pericia: 'historia', atributo: 'con' })) >= pvInicial(comAnt({})));
});

test('antecedente: camposDaCriacao grava o nome, a proficiência, o atributo e a característica especial', () => {
    const e = comAnt({ id: 'amnesia', pericia: 'percepcao', atributo: 'sab' });
    const { campos } = camposDaCriacao(e);
    assert.equal(campos.antecedente, 'Amnésia');
    assert.equal(campos['pericias.percepcao'], 1);
    assert.equal(campos['atributos.sab'], atributosFinais(e).sab);
    const c = campos.caracteristicas.find((x) => x.builder === 'antecedente');
    assert.equal(c.nome, 'Ecos do Passado');
    assert.equal(c.origem, 'Antecedente: Amnésia');
    assert.deepEqual(c.usos, { atual: 1, max: 1 });
    assert.equal(c.descanso, 'longo');
    assert.equal(c.acoes[0].rolagem, '1d20+@pericia.sorte');
    // quem já é especialista não é rebaixado
    const aptidao = comAnt(
        { id: 'amnesia', pericia: 'percepcao', atributo: 'sab' },
        { pericias: { adaptacao: ['percepcao', 'atletismo', 'acrobacia'], 'aptidao-natural': ['percepcao'] }, falhas: ['orgulho'] },
    );
    assert.equal(camposDaCriacao(aptidao).campos['pericias.percepcao'], 2);
});

test('antecedente personalizado: a característica especial vem de outro antecedente', () => {
    const e = comAnt({ id: 'amnesia', pericia: 'sorte', atributo: 'von', personalizado: true, caracteristicaDe: 'mercador' });
    const c = camposDaCriacao(e).campos.caracteristicas.find((x) => x.builder === 'antecedente');
    assert.equal(c.nome, 'Bom Negócio');
    assert.equal(c.origem, 'Antecedente: Amnésia');
    // sem personalizar, a troca é ignorada
    const sem = comAnt({ id: 'amnesia', pericia: 'percepcao', atributo: 'sab', personalizado: false, caracteristicaDe: 'mercador' });
    assert.equal(camposDaCriacao(sem).campos.caracteristicas.find((x) => x.builder === 'antecedente').nome, 'Ecos do Passado');
});

test('antecedente: a perícia dele conta para a Aptidão Natural e refazer a criação mantém Haki, Treinamentos e Maestria', () => {
    const humano = { especies: ['humano'], variantes: ['comum'], falhas: ['orgulho'] };
    const e = comAnt(
        { id: 'artista', pericia: 'atuacao', atributo: 'pre' },
        { ...humano, pericias: { adaptacao: ['atletismo', 'acrobacia', 'percepcao'], 'aptidao-natural': ['atuacao'] } },
    );
    assert.ok(periciasJaProficientes(e).includes('atuacao'));
    assert.deepEqual(problemasDaEtapa(e, 'estilo'), []);
    assert.equal(camposDaCriacao(e).campos['pericias.atuacao'], 2);
    const trocou = { ...e, antecedente: { ...e.antecedente, pericia: 'persuasao' } };
    assert.ok(problemasDaEtapa(trocou, 'resumo').some((m) => m.includes('já tem proficiência')));
    // refazer: as características de outros assistentes ficam, a do antecedente é substituída (sem duplicar)
    const mantidas = [
        { nome: 'Do Haki', origem: 'Haki', tipo: 'passiva', builder: 'haki' },
        { nome: 'Do Treino', origem: 'Treinamento', tipo: 'passiva', builder: 'treinamento' },
        { nome: 'Da Maestria', origem: 'Maestria', tipo: 'passiva', builder: 'maestria' },
        { nome: 'Antiga do antecedente', origem: 'Antecedente: X', tipo: 'passiva', builder: 'antecedente' },
    ];
    const nomes = camposDaCriacao(e, { caracteristicas: mantidas }).campos.caracteristicas.map((c) => c.nome);
    for (const n of ['Do Haki', 'Do Treino', 'Da Maestria', 'Rock Star']) assert.ok(nomes.includes(n), n);
    assert.equal(nomes.includes('Antiga do antecedente'), false);
    assert.equal(nomes.filter((n) => n === 'Rock Star').length, 1);
});

test('antecedente: uma criação salva sem o campo cai no padrão e pede a nova etapa', () => {
    const antiga = { ...escolhasIniciais(), ...{ especies: ['humano'], variantes: ['comum'] } };
    delete antiga.antecedente;
    const e = { ...escolhasIniciais(), ...antiga }; // como o assistente retoma: padrão primeiro, salvo por cima
    assert.equal(e.antecedente.id, '');
    assert.ok(problemasDaEtapa(e, 'antecedente').length > 0);
    assert.equal(antecedentePorId(''), undefined);
});

// --- equipamento inicial do estilo -------------------------------------------------------------------------------------------
import { readFileSync as lerArquivo } from 'node:fs';
import { ESTILOS } from '../../resources/js/app/sistemas/onepiece/construtor/dados/estilos.ts';
import { dinheiroRoladoDoEstilo, itensDoEstilo } from '../../resources/js/app/sistemas/onepiece/construtor/regras.ts';
import { itemDoCatalogo } from '../../resources/js/app/sistemas/onepiece/itens/index.ts';

test('estilos: o JSON do servidor (equipamento inicial) confere com os dados do TS e os itens existem no catálogo', () => {
    const json = JSON.parse(lerArquivo(new URL('../../app/Sistemas/OnePiece/dados/estilos.json', import.meta.url), 'utf8'));
    assert.deepEqual(
        json.estilos,
        ESTILOS.map((e) => ({ id: e.id, nome: e.nome, equipamentoInicial: e.equipamentoInicial ?? null })),
    );
    for (const e of ESTILOS) {
        const eq = e.equipamentoInicial;
        if (!eq) continue;
        for (const i of [...Object.values(eq.porArma ?? {}).flat(), ...eq.itens])
            assert.ok(itemDoCatalogo(i.catalogo), `${e.id}: ${i.catalogo} não existe no catálogo`);
        for (const arma of Object.keys(eq.porArma ?? {})) assert.ok(e.armasFavoritas.includes(arma), `${e.id}: ${arma} não é arma favorita`);
    }
});

test('Atirador: o equipamento depende da arma favorita e os Bellys são rolados (5d10 × 1000), obrigatórios para avançar o estilo', () => {
    const est = ESTILOS.find((x) => x.id === 'atirador');
    assert.deepEqual(itensDoEstilo(est, 'Pistola'), [
        { catalogo: 'pistola', qtd: 2 },
        { catalogo: 'municao-esferica', qtd: 80 },
    ]);
    assert.deepEqual(itensDoEstilo(est, 'Mosquete'), [
        { catalogo: 'mosquete', qtd: 1 },
        { catalogo: 'municao-esferica', qtd: 80 },
    ]);
    assert.deepEqual(itensDoEstilo(est, null), [{ catalogo: 'municao-esferica', qtd: 80 }]);
    assert.deepEqual(dinheiroRoladoDoEstilo(est), { dados: '5d10', multiplicador: 1000 });
    assert.equal(dinheiroRoladoDoEstilo({}), null);
    const e = atirador('sniper', { dinheiro: null });
    assert.ok(
        problemasDaEtapa(e, 'estilo').some((m) => m.includes('Bellys')),
        'sem rolar, o estilo não avança',
    );
    e.dinheiro = { estilo: 'atirador', dados: [3, 4, 5, 6, 7], total: 25, bellys: 25000, expressao: '5d10', multiplicador: 1000 };
    assert.deepEqual(problemasDaEtapa(e, 'estilo'), []);
    e.dinheiro = { ...e.dinheiro, estilo: 'outro' }; // o rolado era de outro estilo
    assert.ok(problemasDaEtapa(e, 'estilo').some((m) => m.includes('Bellys')));
});

// --- estilo de luta: Aventureiro --------------------------------------------------------------------------------------
const aventureiro = (extra = {}) =>
    feito({
        estilo: {
            id: 'aventureiro',
            nome: 'Aventureiro',
            dado: 'd10',
            caminho: null,
            armaFavorita: 'Chicote',
            hbInata: 'defesa-ofensiva',
            pericias: ['acrobacia', 'percepcao', 'sorte'],
        },
        especies: ['humano'],
        variantes: [null],
        dinheiro: { estilo: 'aventureiro', dados: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5], total: 50, bellys: 50000, expressao: '10d10', multiplicador: 1000 },
        ...extra,
    });

test('Aventureiro: sem caminho, d10, salvaguardas DES e CON, DES primário e técnicas por nível', () => {
    const e = aventureiro();
    assert.deepEqual(problemasDaEtapa(e, 'estilo'), []);
    const { campos } = camposDaCriacao(e);
    assert.equal(campos['dadosVida.tipo'], 'd10');
    assert.equal(campos.atributoPrimario, 'des');
    assert.ok(['des', 'con'].every((s) => campos.salvaguardas.includes(s)));
    const tecnicas = (nivel) => camposDaCriacao(aventureiro(), { nivel }).campos['tecnicas.lista'].map((t) => t.nome);
    assert.deepEqual(tecnicas(1), ['Whiplash', 'Fire Lash']);
    assert.equal(tecnicas(20).length, 10);
    assert.ok(tecnicas(3).includes('Power Pistol'));
});

test('Aventureiro: Dados de Aventura (½ nível, nível no 10º) e PP máx +4+prof', () => {
    const t = ESTILOS.find((x) => x.id === 'aventureiro').tracos.find((x) => x.id === 'dados-de-aventura');
    const dados = (n) => camposDaCriacao(aventureiro(), { nivel: n }).campos.caracteristicas.find((c) => c.nome.includes('Dados de Aventura'));
    assert.equal(dados(5).usos.max, 2);
    assert.equal(dados(9).usos.max, 4);
    assert.equal(dados(10).usos.max, 10);
    assert.equal(dados(20).usos.max, 20);
    assert.ok(t.usos.formula);
});

// --- estilo de luta: Brutamontes --------------------------------------------------------------------------------------
const brutamontes = (extra = {}) =>
    feito({
        estilo: {
            id: 'brutamontes',
            nome: 'Brutamontes',
            dado: 'd12',
            caminho: null,
            armaFavorita: 'Kanabo',
            hbInata: 'corpo-de-guerreiro',
            pericias: ['atletismo', 'intimidacao'],
        },
        especies: ['humano'],
        variantes: [null],
        dinheiro: { estilo: 'brutamontes', dados: [5, 5, 5, 5, 5, 5], total: 30, bellys: 30000, expressao: '6d10', multiplicador: 1000 },
        ...extra,
    });

test('Brutamontes: d12, FOR primária, salvaguardas FOR e CON, 2 perícias só da lista e as 5 armas favoritas', () => {
    const e = brutamontes();
    assert.deepEqual(problemasDaEtapa(e, 'estilo'), []);
    const fora = brutamontes({ estilo: { ...e.estilo, pericias: ['atletismo', 'acrobacia'] } });
    assert.ok(problemasDaEtapa(fora, 'estilo').some((m) => m.includes('permitidas')));
    assert.ok(problemasDaEtapa(brutamontes({ estilo: { ...e.estilo, armaFavorita: 'Corporal' } }), 'estilo').length === 0);
    const { campos } = camposDaCriacao(e);
    assert.equal(campos['dadosVida.tipo'], 'd12');
    assert.equal(campos.atributoPrimario, 'for');
    assert.equal(campos['tecnicas.atributo'], 'for');
    assert.ok(['for', 'con'].every((s) => campos.salvaguardas.includes(s)));
});

test('Brutamontes: 10 Técnicas por nível, Corpo de Criatura +60 PV e Invencibilidade com resistência total', () => {
    const tecnicas = (n) => camposDaCriacao(brutamontes(), { nivel: n }).campos['tecnicas.lista'].map((t) => t.nome);
    assert.deepEqual(tecnicas(1), ['Nari Kabura', 'Shinsoku Hakujaku']);
    assert.equal(tecnicas(20).length, 11); // inclui a Kongo Kabura (Nari Kabura aprimorada no 6º nível)
    const car = (n) => camposDaCriacao(brutamontes(), { nivel: n }).campos.caracteristicas;
    assert.ok(!car(5).some((c) => c.nome === 'Corpo de Criatura'));
    assert.ok(car(6).some((c) => c.nome === 'Corpo de Criatura'));
    assert.ok(car(19).some((c) => c.nome === 'Invencibilidade'));
    // reações defensivas automáticas: Corpo de Criatura (zera o dano) e Yamantaka (reserva 10d8, +2d8 por PP até 20d8)
    assert.deepEqual(car(6).find((c) => c.nome === 'Corpo de Criatura').reacao, { gatilho: 'ataque_declarado', alcance: 'si', reducao: { zerar: true } });
    const yama = camposDaCriacao(brutamontes(), { nivel: 6 }).campos['tecnicas.lista'].find((t) => t.nome === 'Yamantaka');
    assert.deepEqual(yama.reacao.reducao, { reserva: '10d8', mais: '2d8', maximo: 20 });
    const res = (n) => camposDaCriacao(brutamontes(), { nivel: n }).campos.resistencias;
    assert.deepEqual(res(18), []);
    assert.ok(res(19).includes('Verdadeiro') && res(19).includes('Contundente'));
});

// --- estilo de luta: Black Leg ----------------------------------------------------------------------------------------
const blackLeg = (primario = 'for', extra = {}) =>
    feito({
        estilo: {
            id: 'black-leg',
            nome: 'Black Leg',
            dado: 'd12',
            primario,
            caminho: null,
            armaFavorita: 'Corporal',
            hbInata: 'perito-em-tecnicas',
            pericias: ['atletismo', 'acrobacia'],
        },
        especies: ['humano'],
        variantes: [null],
        dinheiro: { estilo: 'black-leg', dados: Array(15).fill(5), total: 75, bellys: 165000, fixo: 90000, expressao: '15d10', multiplicador: 1000 },
        ...extra,
    });

test('Black Leg: d12, FOR ou DES como primário, salvaguardas FOR e DES e perícias só da lista', () => {
    const e = blackLeg('des');
    assert.deepEqual(problemasDaEtapa(e, 'estilo'), []);
    assert.ok(problemasDaEtapa(blackLeg(null), 'estilo').some((m) => m.includes('atributo primário')));
    assert.ok(problemasDaEtapa(blackLeg('for', { estilo: { ...e.estilo, pericias: ['atletismo', 'intimidacao'] } }), 'estilo').some((m) => m.includes('permitidas')));
    const { campos } = camposDaCriacao(e);
    assert.equal(campos['dadosVida.tipo'], 'd12');
    assert.equal(campos.atributoPrimario, 'des');
    assert.equal(campos['tecnicas.atributo'], 'des');
    assert.ok(['for', 'des'].every((s) => campos.salvaguardas.includes(s)));
});

test('Black Leg: 10 Técnicas, deslocamento por nível (12/15/18 m) e Parry Shot é reação defensiva de uso único', () => {
    const tecnicas = (n) => camposDaCriacao(blackLeg(), { nivel: n }).campos['tecnicas.lista'];
    assert.deepEqual(tecnicas(1).map((t) => t.nome), ['Kick Shot', 'Anti-Manner Kick Course']);
    assert.equal(tecnicas(20).length, 11); // inclui o Kick Strike (Kick Shot aprimorada no 6º nível)
    assert.deepEqual(tecnicas(6).find((t) => t.nome === 'Parry Shot').reacao.reducao, { reserva: '8d8', mais: '2d8', maximo: 20, unica: true });
    const andar = (n) => {
        const f = camposDaCriacao(blackLeg(), { nivel: n }).campos;
        return f.caracteristicas.filter((c) => c.nome.startsWith('Godspeed: Speed Walk')).map((c) => [c.nivelMin, c.nivelMax ?? null]);
    };
    assert.deepEqual(andar(3), [[3, 4]]);
    assert.ok(andar(12).some(([min]) => min === 12));
});

// --- estilo de luta: Herói --------------------------------------------------------------------------------------------
const heroi = (caminho = 'poder-oculto', armaFavorita = 'Corporal', extra = {}) =>
    feito({
        estilo: { id: 'heroi', nome: 'Herói', dado: 'd8', primario: 'for', caminho, armaFavorita, hbInata: 'perito-em-tecnicas', pericias: ['atletismo', 'sorte'] },
        especies: ['humano'],
        variantes: [null],
        dinheiro: { estilo: 'heroi', dados: Array(12).fill(5), total: 60, bellys: 60000, fixo: 0, expressao: '12d10', multiplicador: 1000 },
        ...extra,
    });

test('Herói: o caminho muda o dado de vida e as armas favoritas; perícias só da lista', () => {
    assert.deepEqual(problemasDaEtapa(heroi(), 'estilo'), []);
    assert.deepEqual(problemasDaEtapa(heroi('arma-lanca', 'Lança'), 'estilo'), []);
    assert.ok(problemasDaEtapa(heroi('arma-lanca', 'Corporal'), 'estilo').some((m) => m.includes('arma favorita'))); // Deus da Arma não luta no corporal
    assert.ok(problemasDaEtapa(heroi('poder-oculto', 'Arco'), 'estilo').length > 0);
    const dado = (c, a) => camposDaCriacao(heroi(c, a)).campos['dadosVida.tipo'];
    assert.equal(dado('poder-oculto', 'Corporal'), 'd12');
    assert.equal(dado('harem', 'Corporal'), 'd8');
    assert.equal(dado('arma-espada', 'Sabre'), 'd10');
    const e = heroi();
    assert.ok(problemasDaEtapa({ ...e, estilo: { ...e.estilo, pericias: ['atletismo', 'intimidacao'] } }, 'estilo').some((m) => m.includes('permitidas')));
    assert.equal(pvInicial(heroi('poder-oculto')), 12 + 1 + 0 + (fisicoDe(heroi())?.pv ?? 0));
});

test('Herói: sem Técnicas prontas, Dados Heroicos por nível e Ataque Extra por caminho', () => {
    const campos = (n, c = 'poder-oculto', a = 'Corporal') => camposDaCriacao(heroi(c, a), { nivel: n }).campos;
    assert.deepEqual(campos(20)['tecnicas.lista'], []);
    const dados = (n, c) => campos(n, c, c === 'harem' ? 'Corporal' : 'Corporal').caracteristicas.find((x) => x.nome === 'Dados Heroicos').usos.max;
    assert.deepEqual([1, 5, 10, 20].map((n) => dados(n, 'poder-oculto')), [1, 5, 15, 15]); // +5 no Despertar Heroico
    assert.deepEqual([1, 5, 10, 20].map((n) => dados(n, 'harem')), [1, 5, 10, 10]);
    const ataques = (n, c, a) => campos(n, c, a).caracteristicas.flatMap((x) => (x.efeitos ?? []).filter((e) => e.alvo === 'ataques.acao').map((e) => [x.nivelMin, x.nivelMax ?? null, e.valor]));
    assert.deepEqual(ataques(10, 'poder-oculto', 'Corporal'), [[10, null, 1]]);
    assert.ok(ataques(11, 'arma-espada', 'Sabre').some(([min, , v]) => min === 11 && v === 2)); // 3 ataques no 11º
    assert.ok(ataques(10, 'arma-arco', 'Arco').some(([min, , v]) => min === 10 && v === 3)); // 4 no 10º
    // Esforço Heroico: PT = 5 + 2 por nível par
    assert.ok(campos(1).caracteristicas.some((x) => x.nome.includes('Esforço Heroico')));
});

test('Herói: a Virada Heroica e o Escudo são reações defensivas que gastam Dados Heroicos', () => {
    const car = (n, c, a, nome) => camposDaCriacao(heroi(c, a), { nivel: n }).campos.caracteristicas.find((x) => x.nome.includes(nome));
    assert.deepEqual(car(5, 'poder-oculto', 'Corporal', 'Virada Heroica').reacao.reducao, { zerar: true, gasta: { de: 'Dados Heroicos', qtd: 5 }, pvAbaixoDaMetade: true });
    assert.deepEqual(car(5, 'arma-escudo', 'Escudo', 'Escudo (5º)').reacao.reducao, { reserva: '3d10', unica: true, gasta: { de: 'Dados Heroicos', qtd: 3 } });
    assert.equal(car(1, 'arma-lanca', 'Lança', 'Lança (1º)').efeitos[0].valor, 1); // +1 na CR
    assert.equal(car(11, 'arma-escudo', 'Escudo', 'Escudo (1º)').efeitos[0].valor, 3); // +3 na CR
});

// --- Habilidade Básica: Aprimoramento de Atributo (+2 em um atributo ou +1 em dois) --------------------------------------
test('Aprimoramento de Atributo: opções válidas, +2 ou +1/+1 e nunca acima de 20', () => {
    assert.equal(OPCOES_APRIMORAMENTO.length, 6 + 15);
    assert.deepEqual(aumentosDoAprimoramento('ava:for'), [{ atributo: 'for', valor: 2 }]);
    assert.deepEqual(aumentosDoAprimoramento('ava:des+von'), [
        { atributo: 'des', valor: 1 },
        { atributo: 'von', valor: 1 },
    ]);
    assert.equal(aumentosDoAprimoramento('ava:for+for'), null);
    assert.equal(aumentosDoAprimoramento('ava:xx'), null);
    assert.equal(aumentosDoAprimoramento(null), null);
    const base = { for: 10, des: 19, con: 10, sab: 10, pre: 10, von: 10 };
    assert.equal(atributosComAprimoramentoInato(base, [{ id: 'aprimoramento-de-atributo', nivel: 1, opcao: 'ava:for' }]).for, 12);
    const dois = atributosComAprimoramentoInato(base, [{ id: 'aprimoramento-de-atributo', nivel: 1, opcao: 'ava:des+von' }]);
    assert.deepEqual([dois.des, dois.von], [20, 11]);
    assert.equal(atributosComAprimoramentoInato({ ...base, des: 20 }, [{ id: 'x', nivel: 1, opcao: 'ava:des' }]).des, 20); // teto de 20
});

test('Herói: o Aprimoramento de Atributo inato exige a escolha e soma nos atributos da ficha', () => {
    const e = heroi('poder-oculto', 'Corporal', { estilo: { id: 'heroi', nome: 'Herói', dado: 'd8', primario: 'for', caminho: 'poder-oculto', armaFavorita: 'Corporal', hbInata: 'aprimoramento-de-atributo', pericias: ['atletismo', 'sorte'] } });
    assert.ok(problemasDaEtapa(e, 'estilo').some((m) => m.includes('Aprimoramento de Atributo')));
    const ok = heroi('poder-oculto', 'Corporal', { estilo: { ...e.estilo, hbInataOpcao: 'ava:for' } });
    assert.deepEqual(problemasDaEtapa(ok, 'estilo'), []);
    const sem = camposDaCriacao(heroi()).campos['atributos.for'];
    assert.equal(camposDaCriacao(ok).campos['atributos.for'], Math.min(20, sem + 2));
    assert.ok(camposDaCriacao(ok).campos.caracteristicas.some((c) => c.nome.startsWith('Aprimoramento de Atributo: +2 FOR')));
});

// --- estilo de luta: Usuário Ínsito -----------------------------------------------------------------------------------
const insito = (caminho = null, extra = {}) =>
    feito({
        estilo: { id: 'usuario-insito', nome: 'Usuário Ínsito', dado: 'd10', primario: 'von', caminho, armaFavorita: 'Corporal', hbInata: 'perito-em-tecnicas', pericias: ['atletismo', 'sobrenatural'] },
        especies: ['humano'],
        variantes: [null],
        dinheiro: { estilo: 'usuario-insito', dados: Array(12).fill(5), total: 60, bellys: 60000, fixo: 0, expressao: '12d10', multiplicador: 1000 },
        ...extra,
    });

test('Usuário Ínsito: d10, perícias da lista, sem Técnicas prontas, PP máx +1 por nível e Ataque Extra no 7º', () => {
    assert.deepEqual(problemasDaEtapa(insito(), 'estilo'), []);
    const e = insito();
    assert.ok(problemasDaEtapa({ ...e, estilo: { ...e.estilo, pericias: ['atletismo', 'persuasao'] } }, 'estilo').some((m) => m.includes('permitidas')));
    const c = (n) => camposDaCriacao(insito(), { nivel: n }).campos;
    assert.equal(c(1)['dadosVida.tipo'], 'd10');
    assert.deepEqual(c(20)['tecnicas.lista'], []);
    const pp = c(5).caracteristicas.find((x) => x.nome === 'Akuma no Chikara').efeitos[0];
    assert.deepEqual([pp.alvo, pp.valor], ['pp.max', '@nivel']);
    assert.ok(!c(6).caracteristicas.some((x) => x.nome === 'Ataque Extra'));
    assert.ok(c(7).caracteristicas.some((x) => x.nome === 'Ataque Extra'));
    // Escolha Diabólica: o traço só entra depois de escolhido ao subir de nível (2º) e a segunda escolha vem no 11º
    assert.ok(!camposDaCriacao(insito(null), { nivel: 5 }).campos.caracteristicas.some((x) => x.nome.includes('Defesa Infundida')));
});

test('Usuário Ínsito: PT da Akuma no Chikara (2 por nível par + categoria) e dano extra só de Logia ou Zoan Mítica', () => {
    const car = (n) => camposDaCriacao(insito(), { nivel: n }).campos.caracteristicas;
    const ficha = (n, akuma) => ({ nivel: n, caracteristicas: car(n), atributos: { sab: 10 }, akuma });
    assert.equal(ptCulturais(ficha(1, { categoria: 's' })), 3);
    assert.equal(ptCulturais(ficha(1, { categoria: 'a' })), 4);
    assert.equal(ptCulturais(ficha(1, { categoria: 'b' })), 6);
    assert.equal(ptCulturais(ficha(6, { categoria: 'c' })), 6 + 6); // 3 níveis pares
    const dado = (n, akuma) => extrasDeDano({ nivel: n, caracteristicas: car(n).map((x) => ({ ...x })), akuma }, 'tecnica', 3, 8).map((e) => e.expressao);
    assert.deepEqual(dado(3, { tipo: 'logia' }), ['1d4']);
    assert.deepEqual(dado(10, { tipo: 'logia' }), ['1d8']);
    assert.deepEqual(dado(3, { tipo: 'zoan', zoan: 'mitica' }), ['1d4']);
    assert.deepEqual(dado(3, { tipo: 'zoan', zoan: 'comum' }), []);
    assert.deepEqual(dado(3, { tipo: 'paramecia' }), []);
    // o dano do fruto soma na rolagem principal (sem tipo próprio)
    const f = { nivel: 3, caracteristicas: car(3), akuma: { tipo: 'logia' }, bonusTecnica: {} };
    assert.equal(montarDanoDaTecnica(f, { nome: 'T', origem: '', custo: 2, alcance: '', efeito: '', descricao: '', rolagem: '2d8' }, 1, '2d8').expressao, '2d8+1d4');
});

test('Usuário Ínsito: a Escolha Diabólica é feita ao subir de nível (2º e 11º), sem repetir, e o traço escolhido entra', () => {
    const base = { ...fichaCompleta(insito(null), 1), estiloEscolhas: [] };
    // 2º nível
    assert.ok(pendenciasDoNivel(base, 2).escolhaDeTraco);
    assert.ok(!pendenciasDoNivel(base, 3).escolhaDeTraco);
    assert.ok(pendenciasDoNivel({ ...base, nivel: 10, estiloEscolhas: ['defesa-infundida'] }, 11).escolhaDeTraco);
    const esc = (traco) => ({ hb: { id: 'robusto' }, tracoEscolhido: traco, pvGanho: 6 });
    assert.ok(problemasDoNivel(base, esc(null)).some((m) => m.includes('Escolha Diabólica')));
    assert.ok(problemasDoNivel(base, esc('inexistente')).length > 0);
    assert.ok(!problemasDoNivel(base, esc('defesa-infundida')).some((m) => m.includes('Escolha Diabólica')));
    const campos = camposDoNivel(base, esc('defesa-infundida'));
    assert.deepEqual(campos.estiloEscolhas, ['defesa-infundida']);
    assert.ok(campos.caracteristicas.some((c) => c.nome.includes('Defesa Infundida')));
    assert.ok(!campos.caracteristicas.some((c) => c.nome.includes('Objeto Infundido')));
    // 11º nível: não repete a que já tem
    const onze = { ...base, nivel: 10, estiloEscolhas: ['defesa-infundida'] };
    assert.ok(problemasDoNivel(onze, esc('defesa-infundida')).some((m) => m.includes('Escolha Diabólica')));
});
