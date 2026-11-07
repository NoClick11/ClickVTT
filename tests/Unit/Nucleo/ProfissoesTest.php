<?php

namespace Tests\Unit\Nucleo;

use App\Sistemas\OnePiece\FichaOnePiece;
use App\Sistemas\OnePiece\Profissoes;
use PHPUnit\Framework\TestCase;

class ProfissoesTest extends TestCase
{
    public function test_o_catalogo_tem_20_profissoes_com_pericias_e_ferramenta_validas(): void
    {
        $this->assertCount(20, Profissoes::catalogo()['profissoes']);
        foreach (Profissoes::catalogo()['profissoes'] as $p) {
            $this->assertGreaterThanOrEqual(6, count($p['pericias']), $p['id']);
            foreach ($p['pericias'] as $pericia) {
                $this->assertArrayHasKey($pericia, FichaOnePiece::PERICIAS, $p['id']);
                $this->assertNotSame('oficio', $pericia);
            }
            $this->assertNotSame('', $p['ferramenta']);
        }
        $this->assertNull(Profissoes::profissao('inventada'));
    }

    public function test_oficio_e_a_vigesima_pericia_com_base_sabedoria(): void
    {
        $this->assertCount(20, FichaOnePiece::PERICIAS);
        $this->assertSame('sab', FichaOnePiece::PERICIAS['oficio']);
    }

    public function test_avanco_disponivel_pelos_niveis_5_10_15_e_20(): void
    {
        $f = fn (int $nivel, array $usados = []) => ['nivel' => $nivel, 'profissoes' => ['usados' => $usados]];
        $this->assertNull(Profissoes::avancoDisponivel($f(4)));
        $this->assertSame(5, Profissoes::avancoDisponivel($f(5)));
        $this->assertSame(10, Profissoes::avancoDisponivel($f(12, [5])));
        $this->assertNull(Profissoes::avancoDisponivel($f(9, [5])));
    }
}
