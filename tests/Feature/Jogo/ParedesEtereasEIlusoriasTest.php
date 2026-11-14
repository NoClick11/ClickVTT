<?php

namespace Tests\Feature\Jogo;

use App\Models\Objeto;
use App\Models\Sistema;
use App\Models\User;
use App\Nucleo\Cena\Paredes;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Parede etérea: barra o movimento mas não a visão nem a luz. Parede ilusória: barra a visão e a luz mas não o movimento. */
class ParedesEtereasEIlusoriasTest extends TestCase
{
    use RefreshDatabase;

    private function parede($pagina, string $tipo, array $extra = []): Objeto
    {
        return $pagina->objetos()->create([
            'camada' => 'iluminacao', 'tipo' => 'parede', 'x' => 100, 'y' => 0, 'largura' => 1, 'altura' => 200,
            'dados' => ['pontos' => [100, 0, 100, 200], 'tipo' => $tipo, ...$extra],
        ]);
    }

    private function pagina()
    {
        $mesa = User::factory()->create()->mesas()->create([
            'nome' => 'T', 'slug' => 't-'.uniqid(), 'sistema_id' => Sistema::where('slug', 'one-piece')->value('id'), 'tema_entrada' => 'padrao',
        ]);

        return $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1]);
    }

    public function test_etereo_barra_so_o_movimento(): void
    {
        $pagina = $this->pagina();
        $p = $this->parede($pagina, 'etereo');
        $this->assertTrue(Paredes::bloqueia($p, 'movimento'));
        $this->assertFalse(Paredes::bloqueia($p, 'visao'));
        $this->assertFalse(Paredes::bloqueia($p, 'luz'));
        $this->assertFalse(Paredes::caminhoLivre($pagina, 0, 100, 200, 100)); // o corpo não passa
    }

    public function test_ilusoria_barra_so_a_visao_e_a_luz(): void
    {
        $pagina = $this->pagina();
        $p = $this->parede($pagina, 'ilusoria');
        $this->assertFalse(Paredes::bloqueia($p, 'movimento'));
        $this->assertTrue(Paredes::bloqueia($p, 'visao'));
        $this->assertTrue(Paredes::bloqueia($p, 'luz'));
        $this->assertTrue(Paredes::caminhoLivre($pagina, 0, 100, 200, 100)); // o corpo atravessa
    }

    public function test_nao_abrem_e_a_configuracao_do_mestre_ainda_vale(): void
    {
        $pagina = $this->pagina();
        // "aberta" só vale para porta e janela: as novas continuam barrando o que barram
        $p = $this->parede($pagina, 'etereo', ['aberta' => true]);
        $this->assertTrue(Paredes::bloqueia($p, 'movimento'));
        // o mestre pode ajustar o canal por parede
        $q = $this->parede($pagina, 'ilusoria', ['bloqueio' => ['movimento' => true]]);
        $this->assertTrue(Paredes::bloqueia($q, 'movimento'));
        $this->assertTrue(Paredes::bloqueia($q, 'visao'));
    }
}
