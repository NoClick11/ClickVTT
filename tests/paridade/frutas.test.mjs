// Frutas prontas: entregar a Ito-Ito no Mi libera as Técnicas por nível e o nível seguinte traz as novas.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FRUTAS, TO_ITO_NO_MI, frutaPorId } from '../../resources/js/app/sistemas/onepiece/frutas/dados.ts';
import { camposDaFruta, camposDaFrutaNoNivel, tecnicasDaFruta } from '../../resources/js/app/sistemas/onepiece/frutas/regras.ts';
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
    const dada = ficha(3);
    const c3 = camposDaFruta(dada, 'ito-ito-no-mi');
    const comFruta = ficha(3, { caracteristicas: c3.caracteristicas, akuma: { ...akumaPadrao(), tipo: 'paramecia', usuario: 'avancado', fruta: 'ito-ito-no-mi', lista: c3['akuma.lista'] } });
    // gasta 1 uso do Estágio Desperto e sobe para o 6º nível
    comFruta.caracteristicas = comFruta.caracteristicas.map((c) => (c.nome === 'Estágio Desperto' ? { ...c, usos: { ...c.usos, atual: 1 } } : c));
    const c6 = camposDaFrutaNoNivel({ ...comFruta, nivel: 6 }, 6, { caracteristicas: comFruta.caracteristicas, lista: comFruta.akuma.lista });
    assert.ok(c6['akuma.lista'].some((t) => t.nome === 'Parasite'));
    assert.equal(c6.caracteristicas.find((c) => c.nome === 'Estágio Desperto').usos.atual, 1);
    // sem fruta pronta não muda nada
    assert.deepEqual(camposDaFrutaNoNivel(ficha(6), 6, {}), {});
    // tirar a fruta
    const fora = camposDaFruta(comFruta, null);
    assert.ok(!fora['akuma.lista'].some((t) => t.builder === 'fruta'));
    assert.ok(!fora.caracteristicas.some((c) => c.builder === 'fruta'));
    assert.equal(fora['akuma.fruta'], '');
});
