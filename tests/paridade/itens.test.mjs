// Catálogo de itens do One Piece (cap. 8): conferência com o livro, JSON do servidor, busca, preço e a conversão para a mesa.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CATALOGO_DE_ITENS, CATEGORIAS, RARIDADES, itemDoCatalogo, itensDaCategoria } from '../../resources/js/app/sistemas/onepiece/itens/index.ts';
import { buscarNoCatalogo, dadosDoSistema, itemParaAMesa, pesoFormatado, precoDeCompra, precoDeVenda, precoFormatado } from '../../resources/js/app/sistemas/onepiece/itens/regras.ts';

const catalogo = JSON.parse(readFileSync(new URL('../../app/Sistemas/OnePiece/dados/itens.json', import.meta.url), 'utf8'));

test('itens: o JSON do servidor é igual ao catálogo do TS', () => {
    assert.deepEqual(catalogo.itens, JSON.parse(JSON.stringify(CATALOGO_DE_ITENS)));
    assert.deepEqual(catalogo.categorias, CATEGORIAS);
    assert.deepEqual(catalogo.raridades, RARIDADES);
});

test('itens: ids únicos, categorias válidas, preços e pesos coerentes', () => {
    const ids = CATALOGO_DE_ITENS.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length);
    const cats = new Set(CATEGORIAS.map((c) => c.id));
    for (const i of CATALOGO_DE_ITENS) {
        assert.ok(cats.has(i.categoria), i.id);
        assert.ok(RARIDADES.some((r) => r.id === i.raridade), i.id);
        assert.ok(i.preco === null ? !!i.precoTexto || i.id === 'vida-miseravel' || i.id === 'municao-para-estilingue' : i.preco >= 0, i.id);
        assert.ok(i.peso >= 0, i.id);
        assert.ok(i.descricao.length > 5, i.id);
    }
    for (const c of CATEGORIAS) assert.ok(itensDaCategoria(c.id).length > 0, `categoria vazia: ${c.id}`);
});

test('itens: valores do livro (preço, peso, raridade)', () => {
    const v = (id, preco, peso, raridade) => {
        const i = itemDoCatalogo(id);
        assert.ok(i, id);
        assert.equal(i.preco, preco, `${id} preço`);
        assert.equal(i.peso, peso, `${id} peso`);
        assert.equal(i.raridade, raridade, `${id} raridade`);
    };
    v('livro-de-profissao', 500000, 3, 'raro');
    v('kit-medico', 15000, 2, 'incomum');
    v('kit-de-venenos', 80000, 1.5, 'mercado-negro');
    v('algemas-de-kairoseki', 2000000, 3, 'mercado-negro');
    v('rede-de-kairoseki', 3000000, 6, 'mercado-negro');
    v('mochila-grande', 20000, 2.5, 'incomum');
    v('asa-delta', 260000, 10, 'raro');
    v('den-den-mushi-preto', 120000, 0.1, 'mercado-negro');
    v('log-pose', 50000, 0.2, 'comum');
    v('vivre-card', 2000000, 0, 'raro');
    v('nucleo-de-energia', 500000, 3, 'raro');
    v('frasco-de-acido', 20000, 0.3, 'raro');
    v('katana', 70000, 1.2, 'comum');
    v('espada-montante', 150000, 6, 'comum');
    v('canhao', 350000, 12, 'comum');
    v('metralhadora', 380000, 5, 'comum');
    v('municao-de-kairoseki', 1000000, 0.1, 'mercado-negro');
    v('arco', 22500, 0.5, 'comum');
    v('cavalo-de-montaria', 2000000, 0, 'comum');
    v('sela-militar', 2000, 15, 'comum');
    v('hospedagem-aristocratica', 40000, 0, 'comum');
    v('vida-rico', 70000, 0, 'comum');
});

test('itens: armas — dano, propriedades e expertise do livro', () => {
    const a = (id) => itemDoCatalogo(id).arma;
    assert.equal(a('adaga').dano, '1d4');
    assert.deepEqual(a('adaga').distancia, [6, 15]);
    assert.ok(a('adaga').propriedades.includes('Acuidade') && a('adaga').propriedades.includes('Arremesso'));
    assert.equal(a('espada-montante').dano, '2d6');
    assert.equal(a('machado-grande').dano, '1d12');
    assert.equal(a('lanca').dano, '1d10');
    assert.ok(a('katana').expertise.includes('maximizados'));
    assert.equal(a('bastao').marcial, true);
    assert.equal(a('pistola').porMunicao, true);
    assert.equal(a('escopeta').cone, 3);
    assert.equal(itemDoCatalogo('escudo-de-ferro').dados.armadura.base, 1);
    const marciais = itensDaCategoria('armas-marciais').map((i) => i.id);
    assert.deepEqual(marciais, ['bastao', 'kanabo', 'luva-de-ferro', 'nunchaku', 'par-de-tonfas']);
    assert.equal(itensDaCategoria('armas-cortantes').length, 11);
    assert.equal(itensDaCategoria('armas-de-fogo').length, 5);
    assert.equal(itensDaCategoria('municao').length, 8);
    assert.equal(itensDaCategoria('armas-especiais').length, 12);
});

test('itens: formatação de preço e peso e busca', () => {
    assert.equal(precoFormatado(itemDoCatalogo('livro-de-profissao')), '฿ 500.000');
    assert.equal(precoFormatado(itemDoCatalogo('chapa-de-aco')), '฿ 8.000/unidade');
    assert.equal(precoFormatado(itemDoCatalogo('corrente-de-elos')), '฿ 1.200/metro');
    assert.equal(precoFormatado(itemDoCatalogo('kit-de-falsificacao')), '20% do valor do item original');
    assert.equal(precoFormatado(itemDoCatalogo('instrumento-musical')), 'Entre ฿ 10.000 e ฿ 15.000');
    assert.equal(pesoFormatado(itemDoCatalogo('mochila-media')), '1,5 kg');
    assert.equal(pesoFormatado(itemDoCatalogo('sake-fino')), '0,8 l');
    assert.equal(pesoFormatado(itemDoCatalogo('vivre-card')), '—');
    const nomes = (f) => buscarNoCatalogo(f).map((i) => i.id);
    assert.ok(nomes({ texto: 'kunai' }).includes('adaga')); // apelido
    assert.ok(nomes({ texto: 'ALGEMAS' }).includes('algemas-de-kairoseki'));
    assert.ok(nomes({ texto: 'bússola' }).includes('log-pose')); // sem acento/maiúsculas na descrição
    assert.ok(buscarNoCatalogo({ raridade: 'mercado-negro' }).every((i) => i.raridade === 'mercado-negro'));
    assert.ok(buscarNoCatalogo({ grupo: 'Armas' }).every((i) => i.categoria.startsWith('armas') || i.categoria === 'municao'));
    assert.ok(buscarNoCatalogo({ soItens: true }).every((i) => i.tipo === 'item'));
});

test('itens: compra, venda (metade em bom estado) e Mercado Negro até 100 vezes', () => {
    const katana = itemDoCatalogo('katana');
    assert.equal(precoDeCompra(katana), 70000);
    assert.equal(precoDeCompra(katana, 5), 70000); // só o Mercado Negro varia
    assert.equal(precoDeVenda(katana), 35000);
    assert.equal(precoDeVenda(katana, false), 0);
    assert.equal(precoDeCompra(itemDoCatalogo('kit-de-venenos'), 3), 240000);
    assert.equal(precoDeCompra(itemDoCatalogo('kit-de-venenos'), 1000), 8000000); // limite de 100x
    assert.equal(precoDeCompra(itemDoCatalogo('kit-de-falsificacao')), null);
    assert.equal(precoDeVenda(itemDoCatalogo('hospedagem-pobre')), null); // serviço
});

test('itens: conversão para o item da mesa (arma, escudo, vínculo com o catálogo)', () => {
    const katana = itemParaAMesa(itemDoCatalogo('katana'));
    assert.deepEqual(katana.dados.arma, { dano: '1d6', atributo: 'acuidade', tipoDano: 'Cortante' });
    assert.deepEqual(katana.dados.catalogo, { id: 'katana' });
    assert.equal(katana.peso, 1.2);
    assert.equal(katana.equipavel, true);
    assert.ok(katana.descricao.includes('Expertise') && katana.descricao.includes('Raridade: Comum'));
    assert.equal(dadosDoSistema(itemDoCatalogo('machado')).arma.atributo, 'for');
    assert.equal(dadosDoSistema(itemDoCatalogo('shuriken')).arma.atributo, 'acuidade');
    assert.equal(dadosDoSistema(itemDoCatalogo('bastao')).arma, undefined); // marcial: dano vem do desarmado
    assert.equal(dadosDoSistema(itemDoCatalogo('pistola')).arma, undefined); // dano pela munição
    assert.equal(dadosDoSistema(itemDoCatalogo('flecha')).arma, undefined); // munição não é arma
    assert.deepEqual(dadosDoSistema(itemDoCatalogo('escudo-de-ferro')).armadura, { tipo: 'escudo', base: 1 });
    assert.ok(itemParaAMesa(itemDoCatalogo('dinamite')).descricao.length <= 2000);
    for (const i of CATALOGO_DE_ITENS) assert.ok(itemParaAMesa(i).descricao.length <= 2000, i.id);
});
