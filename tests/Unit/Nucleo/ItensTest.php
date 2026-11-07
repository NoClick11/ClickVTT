<?php

namespace Tests\Unit\Nucleo;

use App\Sistemas\OnePiece\Itens;
use PHPUnit\Framework\TestCase;

/** Catálogo de itens no servidor: preços de compra e venda (a loja nunca confia no cliente). */
class ItensTest extends TestCase
{
    public function test_o_catalogo_carrega_com_ids_unicos(): void
    {
        $ids = array_column(Itens::catalogo()['itens'], 'id');
        $this->assertGreaterThan(140, count($ids));
        $this->assertSame(count($ids), count(array_unique($ids)));
        $this->assertNull(Itens::item('inventado'));
        $this->assertSame(70000, Itens::item('katana')['preco']);
    }

    public function test_compra_venda_e_mercado_negro(): void
    {
        $katana = Itens::item('katana');
        $this->assertSame(70000, Itens::precoDeCompra($katana));
        $this->assertSame(70000, Itens::precoDeCompra($katana, 5));
        $this->assertSame(35000, Itens::precoDeVenda($katana));
        $this->assertSame(0, Itens::precoDeVenda($katana, false));
        $veneno = Itens::item('kit-de-venenos');
        $this->assertSame(240000, Itens::precoDeCompra($veneno, 3));
        $this->assertSame(8000000, Itens::precoDeCompra($veneno, 1000));
        $this->assertNull(Itens::precoDeCompra(Itens::item('kit-de-falsificacao')));
        $this->assertNull(Itens::precoDeVenda(Itens::item('hospedagem-pobre')));
    }
}
