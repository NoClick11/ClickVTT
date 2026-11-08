// Dano extra das Técnicas e dos ataques desarmados: bônus armado (Fire Lash, Strike), Diable Jambe/Ifrit/Hell Memories e Domínio Fatal.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BLACK_LEG, AVENTUREIRO } from '../../resources/js/app/sistemas/onepiece/construtor/dados/estilos.ts';
import { caracteristicaDe } from '../../resources/js/app/sistemas/onepiece/construtor/regras.ts';
import { extrasDeDano, maximizar, montarDanoDaTecnica } from '../../resources/js/app/sistemas/onepiece/tecnicaBonus.ts';

const car = (estilo, id, nivel, extra = {}) => ({ ...caracteristicaDe({ traco: estilo.tracos.find((t) => t.id === id), origem: estilo.nome, builder: 'estilo' }, nivel), ...extra });
const ficha = (nivel, caracteristicas = [], extra = {}) => ({ nivel, caracteristicas, haki: { ativo: false }, ...extra });
const tecnica = (extra = {}) => ({ nome: 'T', origem: 'Estilo: 3º Grau', custo: 6, alcance: '', efeito: '', descricao: '', rolagem: '6d6', tipoDano: 'contundente', ...extra });

test('Diable Jambe: o extra de Fogo do desarmado sobe com o nível e o Ifrit Jambe troca por 1d12 e soma +5', () => {
    const diable = (n, ligada = true) => car(BLACK_LEG, 'diable-jambe', n, { ativa: ligada });
    const dados = (f) => extrasDeDano(f, 'desarmado').map((e) => e.expressao);
    assert.deepEqual(dados(ficha(3, [diable(3)])), ['1d4']);
    assert.deepEqual(dados(ficha(7, [diable(7)])), ['1d6']);
    assert.deepEqual(dados(ficha(11, [diable(11)])), ['1d8']);
    assert.deepEqual(dados(ficha(3, [diable(3, false)])), []); // desligada
    const ifrit = car(BLACK_LEG, 'ifrit-jambe', 15, { ativa: true });
    assert.deepEqual(dados(ficha(15, [diable(15), ifrit])), ['1d12', '5']);
    assert.deepEqual(dados(ficha(15, [diable(15)])), ['1d8']); // Ifrit desligado
    assert.ok(extrasDeDano(ficha(11, [diable(11)]), 'desarmado').every((e) => e.tipo === 'Fogo'));
});

test('Diable Jambe nas Técnicas: metade do grau em dados de Fogo (mín. 1); Hell Memories, o grau inteiro', () => {
    const diable = (n) => car(BLACK_LEG, 'diable-jambe', n, { ativa: true });
    assert.deepEqual(extrasDeDano(ficha(6, [diable(6)]), 'tecnica', 3, 6).map((e) => e.expressao), ['1d6']); // ⌊3/2⌋ = 1
    assert.deepEqual(extrasDeDano(ficha(16, [diable(16)]), 'tecnica', 6, 8).map((e) => e.expressao), ['3d8']);
    assert.deepEqual(extrasDeDano(ficha(3, [diable(3)]), 'tecnica', 1, 10).map((e) => e.expressao), ['1d10']); // mínimo de 1 dado
    assert.deepEqual(extrasDeDano(ficha(19, [diable(19)]), 'tecnica', 6, 8).map((e) => e.expressao), ['6d8']); // Hell Memories
});

test('Fire Lash: até o grau em dados de Fogo e cada dado que não coube baixa 1 PP; só em Técnica instantânea', () => {
    const f = ficha(3, [], { bonusTecnica: { dados: 5, tipo: 'Fogo', limitarAoGrau: true, reduzCusto: true, instantanea: true, turnos: 1 } });
    const t = tecnica({ custo: 4, rolagem: '4d8', tipoDano: 'perfurante' });
    const r = montarDanoDaTecnica(f, t, 2, '4d8');
    assert.deepEqual(r.extras, [{ expressao: '2d8', tipo: 'Fogo' }]); // grau 2: só 2 dados
    assert.equal(r.custo, 1); // 4 − (5 − 2)
    assert.equal(r.consumiuBonus, true);
    const duradoura = montarDanoDaTecnica(f, tecnica({ descricao: 'Duração: até 1 minuto.' }), 5, '3d8');
    assert.equal(duradoura.consumiuBonus, false); // não é instantânea: o bônus fica armado
    assert.equal(duradoura.custo, 6);
});

test('Strike: +5 dados só em Técnica contundente (soma ao dano principal); em outro tipo fica armado', () => {
    const f = ficha(12, [], { bonusTecnica: { dados: 5, soTipo: 'contundente', turnos: 1 } });
    const r = montarDanoDaTecnica(f, tecnica({ rolagem: '6d6' }), 3, '6d6');
    assert.equal(r.expressao, '6d6+5d6');
    assert.deepEqual(r.extras, []);
    assert.equal(r.consumiuBonus, true);
    const fogo = montarDanoDaTecnica(f, tecnica({ tipoDano: 'fogo' }), 3, '6d6');
    assert.equal(fogo.expressao, '6d6');
    assert.equal(fogo.consumiuBonus, false);
    assert.equal(montarDanoDaTecnica(ficha(12, [], { bonusTecnica: { dados: 0, turnos: 1 } }), tecnica(), 3, '6d6').consumiuBonus, false); // já usado
});

test('Domínio Fatal: Técnica instantânea de chicote ou pistola dá sempre o dano máximo', () => {
    assert.equal(maximizar('4d8+2d6+3'), '32+12+3');
    const f = ficha(19, [car(AVENTUREIRO, 'explorador-destemido', 19)]);
    const chicote = tecnica({ descricao: 'Chicoteada. Requisito: chicote. Ataque combinado: possível.', rolagem: '8d10' });
    assert.equal(montarDanoDaTecnica(f, chicote, 4, '8d10').expressao, '80');
    const sem = tecnica({ descricao: 'Requisito: arma favorita.' });
    assert.equal(montarDanoDaTecnica(f, sem, 4, '8d10').expressao, '8d10');
    assert.equal(montarDanoDaTecnica(ficha(18, []), chicote, 4, '8d10').expressao, '8d10'); // sem a característica
    const duradoura = tecnica({ descricao: 'Requisito: chicote. Duração: até 1 minuto.' });
    assert.equal(montarDanoDaTecnica(f, duradoura, 5, '3d8').expressao, '3d8');
});
