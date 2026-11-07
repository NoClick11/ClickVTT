import assert from 'node:assert/strict';
import test from 'node:test';
import { areaMedida, desenhoDaArea, tokensNaArea } from '../../resources/js/app/nucleo/combate/area.ts';
import { areaDoAlcance } from '../../resources/js/app/sistemas/onepiece/area.ts';
import { ESTILOS } from '../../resources/js/app/sistemas/onepiece/construtor/dados/estilos.ts';

const T = (id, x, y) => ({ id, x, y, raio: 0 }); // 1 px = 1 m nestes testes
const O = { x: 0, y: 0 };

test('area: a forma e o tamanho saem do texto do alcance; "Arma" deixa o tamanho para o cursor', () => {
    assert.deepEqual(areaDoAlcance('Até 18 m, Cone'), { forma: 'cone', metros: 18 });
    assert.deepEqual(areaDoAlcance('Até 1,5 m, Esfera'), { forma: 'esfera', metros: 1.5 });
    assert.deepEqual(areaDoAlcance('Arma, Esfera'), { forma: 'esfera', metros: null });
    assert.deepEqual(areaDoAlcance('Arma, Linha'), { forma: 'linha', metros: null });
    assert.equal(areaDoAlcance('Pessoal'), null);
    assert.deepEqual(areaDoAlcance('Até 18 m, Cone', 6), { forma: 'cone', metros: 24 }); // alcance ampliado (Kokuto, habilidades)
});

test('area: esfera ao redor de quem usa; o cursor define o raio quando o alcance é da arma', () => {
    const m = areaMedida({ forma: 'esfera', metros: null }, O, { x: 6, y: 0 }, 1);
    assert.equal(m.metros, 6);
    assert.deepEqual(tokensNaArea(m, O, [T(1, 3, 3), T(2, 7, 0), T(3, 0, -5.9), T(9, 0, 0)], 1, 9), [1, 3]); // o 9 é quem usa
    const fixa = areaMedida({ forma: 'esfera', metros: 1.5 }, O, { x: 100, y: 0 }, 1);
    assert.equal(fixa.metros, 1.5);
});

test('area: cone abre para o cursor (largura = comprimento na ponta) e não pega quem está atrás', () => {
    const m = areaMedida({ forma: 'cone', metros: 18 }, O, { x: 5, y: 0 }, 1);
    assert.deepEqual(tokensNaArea(m, O, [T(1, 10, 0), T(2, 15, 7), T(3, 15, 8), T(4, -5, 0), T(5, 19, 0), T(6, 5, 6)], 1), [1, 2]);
});

test('area: linha tem 1,5 m de largura e o comprimento do alcance', () => {
    const m = areaMedida({ forma: 'linha', metros: 9 }, O, { x: 0, y: 3 }, 1);
    assert.deepEqual(tokensNaArea(m, O, [T(1, 0, 5), T(2, 0.7, 9), T(3, 1, 5), T(4, 0, 10), T(5, 0, -3)], 1), [1, 2]);
});

test('area: o token entra se qualquer parte dele toca a área (raio do token)', () => {
    const m = { forma: 'esfera', metros: 3, angulo: 0 };
    assert.deepEqual(
        tokensNaArea(
            m,
            O,
            [
                { id: 1, x: 4, y: 0, raio: 1 },
                { id: 2, x: 4.5, y: 0, raio: 1 },
            ],
            1,
        ),
        [1],
    );
});

test('Atirador: toda Técnica com Salvaguarda da área tem forma legível; as de ataque e as automáticas não precisam de área', () => {
    for (const t of ESTILOS[0].tecnicas.filter((x) => x.teste?.tipo === 'salvaguarda')) {
        assert.ok(areaDoAlcance(t.alcance), `${t.nome}: ${t.alcance}`);
        assert.ok(t.teste.atributo, t.nome);
    }
    const por = Object.fromEntries(ESTILOS[0].tecnicas.map((t) => [t.nome, t.teste]));
    assert.equal(por['Death Blossom'].desvantagem, true);
    assert.equal(por['Shooting Stars'].desvantagem, undefined);
    assert.equal(por['Saída Forçada'].aoPassar, 'nada');
    assert.equal(por['Tiro Certeiro'].tipo, 'automatico');
});

test('area: o desenho é a forma alargada pelo raio de um token (a borda toca onde o token começa a ser atingido)', () => {
    // 1 px = 1 m; token de raio 0,75: a esfera de 1,5 m desenha 2,25 m e cobre os quadrados vizinhos por inteiro
    const esfera = desenhoDaArea({ forma: 'esfera', metros: 1.5, angulo: 0 }, { x: 0, y: 0 }, 0.75, 1);
    assert.deepEqual(esfera, { tipo: 'circulo', x: 0, y: 0, r: 2.25 });
    // tudo que o desenho cobre por inteiro é contado, e o que está logo fora, não
    const medida = { forma: 'esfera', metros: 1.5, angulo: 0 };
    assert.deepEqual(
        tokensNaArea(
            medida,
            { x: 0, y: 0 },
            [
                { id: 1, x: 1.5, y: 0, raio: 0.75 },
                { id: 2, x: 2.12, y: 2.12 * 0, raio: 0.75 },
                { id: 3, x: 3.1, y: 0, raio: 0.75 },
            ],
            1,
        ),
        [1, 2],
    );
    const linha = desenhoDaArea({ forma: 'linha', metros: 9, angulo: 0 }, { x: 0, y: 0 }, 0.75, 1);
    assert.equal(linha.tipo, 'poligono');
    assert.deepEqual(linha.pontos.slice(0, 2), [-0.75, -1.5]); // começa atrás da origem e tem 1,5 m de meia largura (0,75 + 0,75)
    const cone = desenhoDaArea({ forma: 'cone', metros: 18, angulo: 0 }, { x: 0, y: 0 }, 0.75, 1);
    assert.equal(cone.tipo, 'setor');
    assert.ok(cone.x < 0 && cone.r > 18.75); // o vértice recua e o raio cresce
    // um token encostado na borda lateral do cone desenhado é contado
    const lateral = 15 * Math.tan(Math.atan(0.5)) + 0.75 / Math.cos(Math.atan(0.5)) - 0.01;
    assert.deepEqual(
        tokensNaArea(
            { forma: 'cone', metros: 18, angulo: 0 },
            { x: 0, y: 0 },
            [
                { id: 1, x: 15, y: lateral, raio: 0.75 },
                { id: 2, x: 15, y: lateral + 0.1, raio: 0.75 },
            ],
            1,
        ),
        [1],
    );
});
