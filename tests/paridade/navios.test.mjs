import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DADOS_DOS_NAVIOS, MODELOS } from '../../resources/js/app/sistemas/onepiece/navios/dados.ts';
import {
    calcularNavio,
    consertoDoNavio,
    custoDaObra,
    danoNoNavio,
    efetivoDoNavio,
    navioDoModelo,
    problemaDaObra,
    problemaDaTripulacao,
} from '../../resources/js/app/sistemas/onepiece/navios/regras.ts';

const ler = (caminho) => JSON.parse(readFileSync(new URL(caminho, import.meta.url), 'utf8'));
const catalogo = ler('../../app/Sistemas/OnePiece/dados/navios.json');
const { casos, tripulacoes } = ler('./navios-casos.json');
const json = (v) => JSON.parse(JSON.stringify(v));

test('navios: o catálogo do PHP (navios.json) confere com os dados do TS', () => {
    assert.deepEqual(catalogo, json(DADOS_DOS_NAVIOS));
});

test('navios: os modelos batem com as fichas do livro (14.6)', () => {
    // [CR, BR, PV, nós, metros por rodada]. O Navio Médio dá 14 nós pela tabela (2 compostos − 10); o livro lista 12.
    const livro = {
        pequeno: [10, 5, 150, 10, 7.5],
        medio: [12, 10, 300, 14, 10.5],
        grande: [15, 15, 500, 12, 9],
        enorme: [15, 15, 750, 24, 18],
        colossal: [16, 15, 1000, 16, 12],
        'marinha-padrao': [17, 15, 500, 20, 15],
        'marinha-batedor': [15, 15, 300, 30, 22.5],
        'marinha-prisao': [17, 15, 750, 26, 19.5],
        'marinha-batalha': [17, 15, 1000, 24, 18],
    };
    let i = 0;
    for (const m of MODELOS) {
        const c = calcularNavio(
            navioDoModelo(m.id, () => `u${i++}`),
            99999,
        );
        assert.deepEqual([c.cr, c.br, c.pvMax, c.velocidade, c.metrosPorRodada], livro[m.id], m.id);
    }
});

test('navios: as regras do TS devolvem o que está nos casos (os mesmos que o PHP confere)', () => {
    for (const c of casos) {
        assert.deepEqual(json(calcularNavio(c.navio, c.pv)), c.calculo, `${c.nome}: cálculo`);
        assert.deepEqual(json(efetivoDoNavio(c.navio)), c.efetivo, `${c.nome}: efetivo`);
        assert.deepEqual(
            [0, 7, 40].map((d) => danoNoNavio(c.navio, d)),
            c.dano,
            `${c.nome}: dano`,
        );
        assert.deepEqual(json(consertoDoNavio(c.navio, c.pv, 'carpinteiro')), c.conserto.carpinteiro, `${c.nome}: conserto do carpinteiro`);
        assert.deepEqual(json(consertoDoNavio(c.navio, c.pv, 'estaleiro')), c.conserto.estaleiro, `${c.nome}: conserto em estaleiro`);
        for (const o of c.obras) {
            assert.equal(problemaDaObra(c.navio, o.grupo, o.tipo), o.problema, `${c.nome}: ${o.grupo}/${o.tipo}`);
            assert.deepEqual(custoDaObra(c.navio, o.grupo, o.tipo, 'comprar'), o.comprar, `${c.nome}: comprar ${o.grupo}/${o.tipo}`);
            assert.deepEqual(custoDaObra(c.navio, o.grupo, o.tipo, 'construir'), o.construir, `${c.nome}: construir ${o.grupo}/${o.tipo}`);
        }
    }
    for (const t of tripulacoes) assert.equal(problemaDaTripulacao(t.lista), t.problema);
});
