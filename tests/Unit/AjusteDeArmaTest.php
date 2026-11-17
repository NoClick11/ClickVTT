<?php

namespace Tests\Unit;

use App\Sistemas\OnePiece\Regras;
use PHPUnit\Framework\TestCase;

/** O ajuste da arma vale só na ficha: o item da mesa nunca muda (espelha `itensComAjustes` do TS). */
class AjusteDeArmaTest extends TestCase
{
    public function test_ajuste_substitui_so_nos_campos_dados_e_nao_altera_os_itens_originais(): void
    {
        $itens = [1 => ['dados' => ['arma' => ['dano' => '1d8', 'atributo' => 'for', 'tipoDano' => 'Cortante']]]];
        $ficha = ['inventario' => [['secao' => 'A', 'itens' => [['item_id' => 1, 'arma' => ['dano' => '2d6', 'bonusDano' => 3, 'tipoDano' => null, 'danoExtra' => [['dados' => '1d4']]]]]]]];
        $r = Regras::comAjustes($ficha, $itens);
        $this->assertSame('2d6', $r[1]['dados']['arma']['dano']);
        $this->assertSame(3, $r[1]['dados']['arma']['bonusDano']);
        $this->assertSame('Cortante', $r[1]['dados']['arma']['tipoDano']); // nulo = original
        $this->assertSame([['dados' => '1d4']], $r[1]['dados']['arma']['danoExtra']);
        $this->assertSame('1d8', $itens[1]['dados']['arma']['dano']);
    }

    public function test_arma_por_municao_ignora_o_dado_do_ajuste_e_ficha_sem_ajuste_nao_muda_nada(): void
    {
        $itens = [1 => ['dados' => ['arma' => ['municao' => true, 'atributo' => 'des']]]];
        $ficha = ['inventario' => [['secao' => 'A', 'itens' => [['item_id' => 1, 'arma' => ['dano' => '9d12', 'bonusDano' => 1]]]]]];
        $r = Regras::comAjustes($ficha, $itens);
        $this->assertArrayNotHasKey('dano', $r[1]['dados']['arma']);
        $this->assertSame(1, $r[1]['dados']['arma']['bonusDano']);
        $this->assertSame($itens, Regras::comAjustes(['inventario' => [['secao' => 'A', 'itens' => [['item_id' => 1]]]]], $itens));
    }

    public function test_dado_extra_de_outro_tipo_rola_a_parte_e_o_do_mesmo_tipo_ou_sem_tipo_entra_na_rolagem_da_arma(): void
    {
        $arma = ['dano' => '1d8', 'atributo' => 'for', 'tipoDano' => 'Cortante', 'danoExtra' => [['dados' => '1d6', 'tipo' => 'Fogo'], ['dados' => '1d4', 'tipo' => 'cortante'], ['dados' => '1d10']]];

        $this->assertSame([['dados' => '1d6', 'tipo' => 'Fogo'], ['dados' => '1d4', 'tipo' => null], ['dados' => '1d10', 'tipo' => null]], Regras::danosExtrasDaArma($arma));
        $this->assertSame(['1d8', '1d4', '1d10'], Regras::dadosDeDano([], [1 => ['dados' => ['arma' => $arma]]], 1));
    }
}
