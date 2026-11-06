// Dado de vida e teste contra a morte: o total rolado vira os campos a salvar.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { camposDoDadoDeVida, camposDoTesteContraMorte } from '../../resources/js/app/sistemas/dnd5e/regras.ts';

const ficha = (extra = {}) => ({
    pv: { atual: 10, max: 30, temp: 0 },
    dadosVida: { restantes: 3, tipo: 'd8' },
    morte: { sucessos: 0, falhas: 0 },
    ...extra,
});

test('dado de vida cura o total e gasta um dado', () => {
    assert.deepEqual(camposDoDadoDeVida(ficha(), 7, 30), { 'dadosVida.restantes': 2, 'pv.atual': 17 });
});
test('dado de vida não passa do máximo efetivo nem cura negativo', () => {
    assert.equal(camposDoDadoDeVida(ficha(), 50, 30)['pv.atual'], 30);
    assert.equal(camposDoDadoDeVida(ficha(), -2, 30)['pv.atual'], 10);
});
test('sem dados de vida nada muda', () => {
    assert.deepEqual(camposDoDadoDeVida(ficha({ dadosVida: { restantes: 0, tipo: 'd8' } }), 5, 30), {});
});
test('teste contra a morte: sucesso, falha, 1 e 20', () => {
    const f = ficha({ pv: { atual: 0, max: 30, temp: 0 }, morte: { sucessos: 2, falhas: 2 } });
    assert.deepEqual(camposDoTesteContraMorte(f, 10), { 'morte.sucessos': 3 });
    assert.deepEqual(camposDoTesteContraMorte(f, 9), { 'morte.falhas': 3 });
    assert.deepEqual(camposDoTesteContraMorte(f, 1), { 'morte.falhas': 3 });
    assert.deepEqual(camposDoTesteContraMorte(f, 20), { 'pv.atual': 1, 'morte.sucessos': 0, 'morte.falhas': 0 });
    assert.deepEqual(camposDoTesteContraMorte(ficha(), 1), { 'morte.falhas': 2 });
});

test('usos por proficiência: o máximo acompanha o bônus e o descanso o restaura', async () => {
    const { usosMax, camposDoDescanso, comBuffAlternado, bonusProficiencia } = await import('../../resources/js/app/sistemas/dnd5e/regras.ts');
    const c = { nome: 'Fúria', origem: 'Bárbaro', tipo: 'ativa', usos: { atual: 0, max: 2, porProf: true }, descanso: 'curto' };
    assert.equal(usosMax(c, 4), 4);
    assert.equal(usosMax({ ...c, usos: { atual: 1, max: 3 } }, 4), 3, 'fixo ignora a proficiência');
    assert.equal(comBuffAlternado(c, 4), null, 'sem usos restantes não liga');
    const f = ficha({ nivel: 9, ajustes: {}, exaustao: 0, magias: { espacos: [] }, caracteristicas: [c] });
    assert.equal(bonusProficiencia(f), 4);
    assert.deepEqual(camposDoDescanso(f, 'curto').caracteristicas[0].usos, { atual: 4, max: 4, porProf: true });
    const longa = { ...c, descanso: 'longo' };
    assert.deepEqual(camposDoDescanso({ ...f, caracteristicas: [longa] }, 'curto'), {}, 'só-longo não volta no curto');
    assert.equal(camposDoDescanso({ ...f, caracteristicas: [longa] }, 'longo').caracteristicas[0].usos.atual, 4);
});
