<?php

namespace Tests\Unit;

use App\Sistemas\OnePiece\Treinamentos;
use PHPUnit\Framework\TestCase;

/** Pontos de Treinamento que vêm do estilo: Esforço Heroico (Herói) e Akuma no Chikara (Usuário Ínsito). Espelha `ptCulturais` do TS. */
class PtDoEstiloTest extends TestCase
{
    private function ficha(string $nome, int $nivel, array $extra = []): array
    {
        return ['nivel' => $nivel, 'atributos' => ['sab' => 10], 'caracteristicas' => [['nome' => $nome]], ...$extra];
    }

    public function test_esforco_heroico_da_5_pt_no_1o_nivel_e_2_por_nivel_par(): void
    {
        $this->assertSame(5, Treinamentos::ptCulturais($this->ficha('Jornada do Herói: Esforço Heroico', 1)));
        $this->assertSame(7, Treinamentos::ptCulturais($this->ficha('Jornada do Herói: Esforço Heroico', 2)));
        $this->assertSame(15, Treinamentos::ptCulturais($this->ficha('Jornada do Herói: Esforço Heroico', 10)));
        $this->assertSame(0, Treinamentos::ptCulturais($this->ficha('Outra', 10)));
    }

    public function test_akuma_no_chikara_soma_2_por_nivel_par_mais_a_categoria_do_fruto(): void
    {
        $f = fn (int $n, string $cat) => $this->ficha('Akuma no Chikara', $n, ['akuma' => ['categoria' => $cat]]);
        $this->assertSame(3, Treinamentos::ptCulturais($f(1, 's')));
        $this->assertSame(4, Treinamentos::ptCulturais($f(1, 'a')));
        $this->assertSame(6, Treinamentos::ptCulturais($f(1, 'b')));
        $this->assertSame(6, Treinamentos::ptCulturais($f(1, 'c')));
        $this->assertSame(6 + 6, Treinamentos::ptCulturais($f(6, 'c')));
        $this->assertSame(0, Treinamentos::ptCulturais($f(1, ''))); // sem categoria definida
        $this->assertSame(4, Treinamentos::ptCulturais($this->ficha('Akuma no Chikara', 4))); // sem fruto: só os níveis pares
    }
}
