<?php

namespace Tests\Unit\Nucleo;

use App\Sistemas\OnePiece\Akuma;
use PHPUnit\Framework\TestCase;

/** Akuma no Mi no servidor: os mesmos casos do TS (`tests/paridade/akuma.test.mjs`) rodam aqui. */
class AkumaTest extends TestCase
{
    public function test_as_regras_do_perfil_batem_com_o_ts(): void
    {
        $casos = json_decode(file_get_contents(__DIR__.'/../../paridade/akuma-problemas.json'), true);
        $this->assertGreaterThan(20, count($casos));
        foreach ($casos as $c) {
            $p = Akuma::problemas($c['ficha']);
            if ($c['contem'] === null) {
                $this->assertSame([], $p, $c['nome']);
            } else {
                $this->assertNotEmpty(array_filter($p, fn ($x) => str_contains($x, $c['contem'])), $c['nome'].' '.json_encode($p, JSON_UNESCAPED_UNICODE));
            }
        }
    }

    public function test_manifestacoes_por_tipo_de_usuario(): void
    {
        $this->assertSame(1, Akuma::manifestacoesDoFruto('paramecia', '', 'simples', false));
        $this->assertSame(3, Akuma::manifestacoesDoFruto('logia', '', 'avancado', true));
        $this->assertSame(0, Akuma::manifestacoesDoFruto('zoan', 'comum', 'simples', false));
        $this->assertSame(2, Akuma::manifestacoesDoFruto('zoan', 'mitica', 'simples', true));
        $a = array_replace(Akuma::padrao(), ['tipo' => 'logia', 'usuario' => 'avancado', 'mpEspeciais' => ['orbes']]);
        $this->assertSame(1, Akuma::manifestacoesCriaveis($a));
        $z = array_replace(Akuma::padrao(), ['tipo' => 'zoan', 'zoan' => 'comum', 'aspecto' => 'mp']);
        $this->assertSame(1, Akuma::manifestacoesCriaveis($z));
    }

    public function test_limites_de_tracos_e_points_da_mitica(): void
    {
        $this->assertSame(['comuns' => 3, 'especificos' => 3, 'ancestrais' => 0, 'extra' => 0, 'troca' => 0], Akuma::limitesDeTracos('comum', true, false));
        $this->assertSame(5, Akuma::limitesDeTracos('ancestral', false, false)['especificos']);
        $this->assertSame(3, Akuma::limitesDeTracos('ancestral', false, false)['troca']);
        $this->assertSame(1, Akuma::limitesDeTracos('mitica', false, true)['extra']);
        $this->assertSame(0, Akuma::pointsExtrasDaMitica(20, false));
        $this->assertSame(1, Akuma::pointsExtrasDaMitica(16, true));
        $this->assertSame(2, Akuma::pointsExtrasDaMitica(20, true));
    }
}
