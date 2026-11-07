// Armas Meito/Kokuto/Yoto, Expertise e melhorias de Pontos de Forja: regras puras e o efeito na ficha (arma equipada).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CATALOGO_DE_ITENS } from '../../resources/js/app/sistemas/onepiece/itens/index.ts';
import * as f from '../../resources/js/app/sistemas/onepiece/itens/forja.ts';
import { analisar, armasAtivas, dadosDeDano } from '../../resources/js/app/sistemas/onepiece/regras.ts';

const cat = JSON.parse(readFileSync(new URL('../../app/Sistemas/OnePiece/dados/forja.json', import.meta.url), 'utf8'));

test('forja: o JSON do servidor é igual ao do TS', () => {
    assert.deepEqual(cat.meito, f.MEITO);
    assert.deepEqual(cat.yoto, f.YOTO);
    assert.deepEqual(cat.expertises, f.EXPERTISES);
    assert.deepEqual(cat.custo, f.CUSTO_DE_MELHORIA);
    assert.deepEqual(cat.passosDoFio, f.PASSOS_DO_FIO);
});

test('forja: toda Expertise do catálogo de armas existe e as 30 armas têm uma', () => {
    const ids = new Set(f.EXPERTISES.map((e) => e.id));
    const armas = CATALOGO_DE_ITENS.filter((i) => i.arma?.expertise);
    assert.equal(armas.length, 30);
    for (const a of armas) assert.ok(ids.has(a.arma.expertiseId), a.id);
    assert.equal(f.MEITO.length, 4);
    assert.equal(f.YOTO.length, 5);
});

test('forja: Meito — dado mínimo, acerto, margem crítica e dados de Técnica do livro', () => {
    assert.deepEqual(f.MEITO.map((m) => [m.pf, m.danoMinimo, m.bonusAtaque, m.margem, m.dadosDeTecnica]), [
        [2, '1d6', 0, 20, 1],
        [4, '1d8', 1, 20, 2],
        [6, '1d10', 2, 19, 3],
        [10, '1d12', 3, 18, 4],
    ]);
    assert.equal(f.danoComForja('1d4', { meito: 'wazamono' }), '1d6'); // adaga vira 1d6
    assert.equal(f.danoComForja('1d8', { meito: 'wazamono' }), '1d8'); // já era maior
    assert.equal(f.danoComForja('2d6', { meito: 'ryo-wazamono' }), '2d6'); // montante (média maior que 1d8): não diminui
    assert.equal(f.danoComForja('1d6', { meito: 'saijo-o-wazamono' }), '1d12');
});

test('forja: Fio sobe o dano um passo (1 → 1d4 → 1d6 → 1d8 → 1d10 → 1d12 → 2d6 → 3d6)', () => {
    assert.equal(f.danoComForja('1d6', { fio: 1 }), '1d8');
    assert.equal(f.danoComForja('1d6', { fio: 4 }), '2d6');
    assert.equal(f.danoComForja('1d6', { fio: 9 }), '3d6');
    assert.equal(f.danoComForja('1d4', { meito: 'ryo-wazamono', fio: 2 }), '1d12'); // 1d4 → 1d8 (mínimo) → 1d10 → 1d12
    assert.equal(f.danoComForja('3d10', { fio: 2 }), '3d10'); // fora da sequência
});

test('forja: custo em PF das melhorias (Meito pela diferença, Expertise 1, Supremacia 2, Densidade 1, Dureza 1, Balanço 2, Fio 2 por passo)', () => {
    assert.equal(f.custoEmPF(null, { meito: 'wazamono' }).total, 2);
    assert.equal(f.custoEmPF({ meito: 'wazamono' }, { meito: 'ryo-wazamono' }).total, 2);
    assert.equal(f.custoEmPF({}, { meito: 'saijo-o-wazamono' }).total, 10);
    assert.equal(f.custoEmPF({ expertise: ['katana'] }, { expertise: ['sangramento'] }).total, 1); // troca
    assert.equal(f.custoEmPF({ expertise: ['sangramento'] }, { expertise: ['sangramento', 'caido'] }).total, 2); // Supremacia
    assert.equal(f.custoEmPF({}, { expertise: ['caido'] }).total, 1); // arma sem expertise
    assert.equal(f.custoEmPF({}, { densidade: 'cortante', dureza: true, balanco: true, fio: 2 }).total, 1 + 1 + 2 + 4);
    assert.equal(f.custoEmPF({ meito: 'o-wazamono' }, { meito: 'wazamono' }), null); // não se rebaixa
    assert.equal(f.custoEmPF({ fio: 2 }, { fio: 1 }), null);
    assert.equal(f.custoEmDinheiro(70000), 20000); // 20% = 14.000 < 20.000
    assert.equal(f.custoEmDinheiro(150000), 30000);
});

test('forja: validação (Meito só cortante, Kokuto/Yoto só em Meito, Balanço exige Densidade, até 2 Expertises)', () => {
    assert.deepEqual(f.problemasDaForja({ meito: 'wazamono', yoto: 'azar-mortal', expertise: ['caido', 'sangramento'], densidade: 'cortante', balanco: true, fio: 3 }), []);
    assert.ok(f.problemasDaForja({ meito: 'wazamono' }, false).some((x) => x.includes('cortantes')));
    assert.ok(f.problemasDaForja({ kokuto: true }).some((x) => x.includes('Kokuto')));
    assert.ok(f.problemasDaForja({ yoto: 'azar-mortal' }).some((x) => x.includes('Yoto')));
    assert.ok(f.problemasDaForja({ balanco: true }).some((x) => x.includes('Densidade')));
    assert.ok(f.problemasDaForja({ expertise: ['caido', 'sangramento', 'impedido'] }).some((x) => x.includes('No máximo')));
    assert.ok(f.problemasDaForja({ fio: 99 }).some((x) => x.includes('Fio')));
});

const ficha = (arma, extra = {}) => ({
    nivel: 5,
    atributos: { for: 14, des: 16, con: 10, sab: 10, pre: 10, von: 10 },
    salvaguardas: [],
    pericias: {},
    ferramentas: [],
    inventario: [{ secao: 'Equipamento', itens: [{ item_id: 1, qtd: 1, equipado: true, sintonizado: false }] }],
    caracteristicas: [],
    condicoes: [],
    pv: { atual: 10, max: 10, temp: 0 },
    pp: { atual: 0, porNivel: 4 },
    tecnicas: { atributo: 'von', lista: [] },
    ajustes: {},
    ...extra,
});
const itens = (arma) => ({ 1: { nome: 'Lâmina', peso: 1, equipavel: true, dados: { arma } } });

test('forja: com a arma equipada o acerto, a margem crítica e o dano mudam sozinhos (e voltam ao desequipar)', () => {
    const arma = { dano: '1d4', atributo: 'acuidade', tipoDano: 'Cortante', proficiente: true, forja: { meito: 'o-wazamono', fio: 1, expertise: ['maximizar'], yoto: 'azar-mortal', densidade: 'cortante' } };
    const i = itens(arma);
    const v = analisar(ficha(), i).valores;
    // acuidade usa DES +3; proficiência +3 (nível 5); Ô Wazamono +2
    assert.equal(v['arma.1.ataque'], 3 + 3 + 2);
    assert.equal(v['arma.1.margem'], 19);
    // 1d4 → mínimo 1d10 → Fio +1 = 1d12
    assert.equal(dadosDeDano(ficha(), i, 1, v)[0], '1d12');
    const a = armasAtivas(ficha(), i, v)[0];
    assert.deepEqual(a.etiquetas, ['Ô Wazamono', 'Yoto: Azar Mortal', 'Ignora resistência (cortante)', 'Fio +1']);
    assert.deepEqual(a.expertise, ['maximizar']);
    // sem proficiência não há Expertise
    assert.deepEqual(armasAtivas(ficha(), itens({ ...arma, proficiente: false }), analisar(ficha(), itens({ ...arma, proficiente: false })).valores)[0].expertise, []);
    // bônus maior vence: arma que já tinha +3
    assert.equal(analisar(ficha(), itens({ ...arma, bonusAtaque: 3 })).valores['arma.1.ataque'], 3 + 3 + 3);
    // desequipada: não conta
    const des = ficha();
    des.inventario[0].itens[0].equipado = false;
    assert.equal(analisar(des, i).valores['arma.1.ataque'], undefined);
    // arma à distância não recebe o bônus Meito corpo a corpo
    assert.equal(analisar(ficha(), itens({ ...arma, distancia: true, atributo: 'des' })).valores['arma.1.ataque'], 3 + 3);
    assert.equal(analisar(ficha(), itens({ ...arma, distancia: true, atributo: 'des' })).valores['arma.1.margem'], 20);
});
