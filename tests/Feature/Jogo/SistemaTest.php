<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SistemaTest extends TestCase
{
    use RefreshDatabase;

    private function sistemaDaMesa(string $slug): array
    {
        $mesa = User::factory()->create()->mesas()->create([
            'nome' => 'T', 'slug' => 't-'.uniqid(), 'sistema_id' => Sistema::where('slug', $slug)->value('id'), 'tema_entrada' => 'padrao',
        ]);
        $mestre = $mesa->jogadores()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);

        return $this->como($mestre)->get(route('jogo', [$mesa->slug, $mestre->id]))->viewData('page')['props']['sistema'];
    }

    private function como(Jogador $p): static
    {
        return $this->withSession(['acesso_mesas' => [$p->mesa_id => [$p->id => true]]]);
    }

    public function test_jogo_recebe_o_sistema_da_mesa_com_modulo(): void
    {
        $this->assertSame(['slug' => 'dnd-5e', 'nome' => 'D&D 5e', 'modulo' => true], $this->sistemaDaMesa('dnd-5e'));
    }

    public function test_sistema_sem_modulo_e_sinalizado(): void
    {
        $this->assertSame(['slug' => 'one-piece', 'nome' => 'One Piece', 'modulo' => false], $this->sistemaDaMesa('one-piece'));
    }
}
