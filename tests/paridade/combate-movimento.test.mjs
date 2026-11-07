// Medida de deslocamento: os mesmos casos de tests/paridade/movimento.json rodam no PHP (MovimentoTest).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fatorParaMetros, limitar, restanteDoTurno, totalDoTurno } from '../../resources/js/app/nucleo/combate/movimento.ts';

const casos = JSON.parse(readFileSync(new URL('./movimento.json', import.meta.url), 'utf8'));
for (const c of casos) {
    test(c.nome, () => {
        const r = limitar(c.de[0], c.de[1], c.para[0], c.para[1], c.restante, c.escala);
        assert.equal(r.travou, c.esperado.travou);
        for (const k of ['x', 'y', 'metros']) assert.ok(Math.abs(r[k] - c.esperado[k]) < 0.001, `${k}: esperado ${c.esperado[k]}, veio ${r[k]}`);
    });
}

test('unidades do mapa em metros', () => {
    assert.deepEqual(['m', 'ft', 'pés', 'km', 'cm', 'quadrados', null].map(fatorParaMetros), [1, 0.3048, 0.3048, 1000, 0.01, 1, 1]);
});

test('deslocamento do turno: base + bônus − usado, sem base não mede', () => {
    const item = (base, bonus, usado) => ({ movimento: { base, bonus, usado } });
    assert.equal(totalDoTurno(item(9, 9, 0)), 18);
    assert.equal(restanteDoTurno(item(9, 0, 4.5)), 4.5);
    assert.equal(restanteDoTurno(item(9, 0, 12)), 0);
    assert.equal(restanteDoTurno(item(null, 0, 3)), null);
    assert.equal(totalDoTurno(item(null, 9, 0)), null);
});
