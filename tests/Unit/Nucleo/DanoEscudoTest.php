<?php

namespace Tests\Unit\Nucleo;

use App\Nucleo\Combate\Dano;
use App\Sistemas\OnePiece\OnePiece;
use PHPUnit\Framework\TestCase;

class DanoEscudoTest extends TestCase
{
    public function test_escudo_sem_resistencia_absorve_ponto_a_ponto_e_passa_o_resto(): void
    {
        $this->assertSame(['temp' => 5, 'atual' => 50, 'escudo' => 0], Dano::noPvComEscudo(['atual' => 50, 'temp' => 5, 'escudo' => 8], 8, false));
        $this->assertSame(['temp' => 0, 'atual' => 47, 'escudo' => 0], Dano::noPvComEscudo(['atual' => 50, 'temp' => 5, 'escudo' => 3], 11, false));
    }

    public function test_escudo_com_resistencia_perde_metade_do_dano_e_cada_ponto_absorve_dois(): void
    {
        $this->assertSame(['temp' => 0, 'atual' => 50, 'escudo' => 15], Dano::noPvComEscudo(['atual' => 50, 'temp' => 0, 'escudo' => 20], 10, true));
        // 20 pontos absorvem 40; sobram 10 para os PV temporários e os PV
        $this->assertSame(['temp' => 0, 'atual' => 45, 'escudo' => 0], Dano::noPvComEscudo(['atual' => 50, 'temp' => 5, 'escudo' => 20], 50, true));
        $this->assertSame(['temp' => 0, 'atual' => 50, 'escudo' => 0], Dano::noPvComEscudo(['atual' => 50, 'temp' => 0, 'escudo' => 0], 0, true));
    }

    public function test_so_cortante_perfurante_e_contundente_resistem_e_o_corpo_armadurado_dominado_amplia(): void
    {
        $s = new OnePiece;
        $ficha = ['haki' => ['talentos' => [['id' => 'corpo-armadurado', 'formas' => 2]]], 'caracteristicas' => []];
        $this->assertTrue($s->escudoResiste($ficha, 'Cortante'));
        $this->assertFalse($s->escudoResiste($ficha, 'fogo'));
        $ficha['caracteristicas'] = [['nome' => 'Corpo Armadurado ☆', 'ativa' => true]];
        $this->assertTrue($s->escudoResiste($ficha, 'fogo'));
        $this->assertFalse($s->escudoResiste($ficha, 'Verdadeiro'));
        $this->assertFalse($s->escudoResiste(['haki' => ['talentos' => []], 'caracteristicas' => [['nome' => 'Corpo Armadurado', 'ativa' => true]]], 'fogo'));
    }
}
