// Frutas prontas: entregar a Ito-Ito no Mi libera as Técnicas por nível e o nível seguinte traz as novas.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FRUTAS, TO_ITO_NO_MI, frutaPorId } from '../../resources/js/app/sistemas/onepiece/frutas/dados.ts';
import { camposDaFruta, camposDaFrutaNoNivel, tecnicasDaFruta } from '../../resources/js/app/sistemas/onepiece/frutas/regras.ts';
import { readFileSync } from 'node:fs';
import { calcular } from '../../resources/js/app/sistemas/onepiece/regras.ts';

const casos = JSON.parse(readFileSync(new URL('./onepiece.json', import.meta.url), 'utf8'));
import { akumaPadrao } from '../../resources/js/app/sistemas/onepiece/akuma/regras.ts';

const ficha = (nivel, extra = {}) => ({
    nivel,
    atributos: { for: 10, des: 14, con: 12, sab: 10, pre: 10, von: 10 },
    caracteristicas: [],
    treinamento: { extras: 0, codigo: '', aprendidos: [], pedidos: [] },
    akuma: akumaPadrao(),
    ...extra,
});

test('Ito-Ito no Mi: está no catálogo, é Paramecia Avançado e as Técnicas têm os custos do livro', () => {
    assert.equal(FRUTAS.length, 1);
    assert.equal(frutaPorId('ito-ito-no-mi'), TO_ITO_NO_MI);
    assert.deepEqual([TO_ITO_NO_MI.tipo, TO_ITO_NO_MI.usuario, TO_ITO_NO_MI.propriedades], ['paramecia', 'avancado', ['criacao', 'manipulacao']]);
    const custo = (nome) => TO_ITO_NO_MI.tecnicas.find((x) => x.tecnica.nome === nome).tecnica.custo;
    assert.deepEqual(
        ['Goshikito', 'Tamaito', 'Parasite', 'Overheat', 'Torikago', 'Break White', 'God Thread'].map(custo),
        [2, 6, 9, 12, 15, 18, 21],
    );
    assert.deepEqual(['Sora no Michi', 'Kumo no Sugaki', 'Black Knight', 'Off White', 'Ever White'].map(custo), [2, 5, 14, 16, 18]);
});

test('entregar a fruta: só as Técnicas do nível chegam, marcadas como da fruta, com o perfil da Akuma', () => {
    const nomes = (n) => tecnicasDaFruta(TO_ITO_NO_MI, n).map((t) => t.nome);
    assert.deepEqual(nomes(1), ['Goshikito', 'Sora no Michi']);
    assert.deepEqual(nomes(3), ['Goshikito', 'Sora no Michi', 'Tamaito']);
    assert.ok(nomes(6).includes('Goshikito (3º Grau)') && nomes(6).includes('Kumo no Sugaki') && !nomes(6).includes('Overheat'));
    assert.equal(nomes(20).length, TO_ITO_NO_MI.tecnicas.length);
    const campos = camposDaFruta(ficha(3), 'ito-ito-no-mi');
    assert.deepEqual(campos['akuma.lista'].map((t) => t.nome), ['Goshikito', 'Sora no Michi', 'Tamaito']);
    assert.ok(campos['akuma.lista'].every((t) => t.builder === 'fruta' && t.origem.startsWith('Ito-Ito no Mi')));
    assert.equal(campos['akuma.tipo'], 'paramecia');
    assert.equal(campos['akuma.usuario'], 'avancado');
    assert.deepEqual(campos['akuma.propriedades'], ['criacao', 'manipulacao']);
    assert.equal(campos['akuma.fruta'], 'ito-ito-no-mi');
    assert.ok(campos.caracteristicas.some((c) => c.nome === 'Fios Imperceptíveis' && c.builder === 'fruta'));
});

test('subir de nível libera o que faltava sem apagar o uso já gasto; tirar a fruta limpa tudo dela', () => {
    const dada = ficha(16);
    const c16 = camposDaFruta(dada, 'ito-ito-no-mi');
    const comFruta = ficha(16, { caracteristicas: c16.caracteristicas, akuma: { ...akumaPadrao(), tipo: 'paramecia', usuario: 'avancado', fruta: 'ito-ito-no-mi', lista: c16['akuma.lista'] } });
    // gasta 1 uso do Estágio Desperto e sobe para o 20º nível
    comFruta.caracteristicas = comFruta.caracteristicas.map((c) => (c.nome === 'Estágio Desperto' ? { ...c, usos: { ...c.usos, atual: 1 } } : c));
    const c20 = camposDaFrutaNoNivel({ ...comFruta, nivel: 20 }, 20, { caracteristicas: comFruta.caracteristicas, lista: comFruta.akuma.lista });
    assert.ok(c20['akuma.lista'].some((t) => t.nome === 'Parasite'));
    assert.equal(c20.caracteristicas.find((c) => c.nome === 'Estágio Desperto').usos.atual, 1);
    // sem fruta pronta não muda nada
    assert.deepEqual(camposDaFrutaNoNivel(ficha(20), 20, {}), {});
    // tirar a fruta
    const fora = camposDaFruta(comFruta, null);
    assert.ok(!fora['akuma.lista'].some((t) => t.builder === 'fruta'));
    assert.ok(!fora.caracteristicas.some((c) => c.builder === 'fruta'));
    assert.equal(fora['akuma.fruta'], '');
});

test('Fios Imperceptíveis: margem 19-20 e +6 m nas Linhas valem sozinhos; Tamaito e God Thread já trazem a margem 19', () => {
    const campos = camposDaFruta(ficha(1), 'ito-ito-no-mi');
    const com = { ...casos[0].ficha, caracteristicas: campos.caracteristicas };
    const v = calcular(com, {});
    assert.equal(v['margem.tecnica'], 19);
    assert.equal(v['alcance.linha'], 60);
    const sem = calcular({ ...com, caracteristicas: [] }, {});
    assert.equal(sem['margem.tecnica'], 20);
    assert.equal(sem['alcance.linha'], 0);
    const margem = (nome) => TO_ITO_NO_MI.tecnicas.find((x) => x.tecnica.nome === nome).tecnica.margemCritica;
    assert.equal(margem('Tamaito'), 19);
    assert.equal(margem('God Thread'), 19);
    assert.equal(margem('Overheat'), undefined);
    // a Costura Interna é uma reação que dá PV temporários
    const costura = campos.caracteristicas.find((c) => c.nome === 'Costura Interna de Emergência');
    assert.deepEqual(costura.reacao, { gatilho: 'ataque_declarado', alcance: 'si', pvTemporarios: '4d10' });
});

test('margens de crítico dos estilos usam o modo que baixa a margem (Lança 18/17, Transformação Diabólica 18)', async () => {
    const { HEROI, USUARIO_INSITO } = await import('../../resources/js/app/sistemas/onepiece/construtor/dados/estilos.ts');
    const { caracteristicaDe } = await import('../../resources/js/app/sistemas/onepiece/construtor/regras.ts');
    const base = casos[0].ficha;
    const margem = (estilo, id, nivel, chave) => {
        const c = caracteristicaDe({ traco: estilo.tracos.find((t) => t.id === id), origem: estilo.nome, builder: 'estilo' }, nivel);
        return calcular({ ...base, nivel, caracteristicas: [{ ...c, ativa: true }] }, {})[chave];
    };
    assert.equal(margem(HEROI, 'lanca-margem-18', 10, 'margem.corpo'), 18);
    assert.equal(margem(HEROI, 'lanca-margem-17', 15, 'margem.corpo'), 17);
    assert.equal(margem(USUARIO_INSITO, 'transformacao-diabolica', 14, 'margem.corpo'), 18);
    assert.equal(margem(USUARIO_INSITO, 'transformacao-diabolica', 14, 'margem.distancia'), 18);
    assert.equal(margem(USUARIO_INSITO, 'transformacao-diabolica', 14, 'margem.tecnica'), 18);
});
