<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Objeto;
use App\Models\Sistema;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Só o mestre exclui um personagem: a ficha, os tokens e o lugar dele no combate somem. */
class ExcluirPersonagemTest extends TestCase
{
    use RefreshDatabase;

    private function como(Jogador $j)
    {
        return $this->withSession(['acesso_mesas' => [$j->mesa_id => [$j->id => true]]])->withHeader('X-Jogador', (string) $j->id);
    }

    public function test_so_o_mestre_exclui_e_leva_tokens_e_combate_junto(): void
    {
        $mesa = User::factory()->create()->mesas()->create([
            'nome' => 'T', 'slug' => 't-'.uniqid(), 'sistema_id' => Sistema::where('slug', 'one-piece')->value('id'), 'tema_entrada' => 'padrao',
        ]);
        $mestre = $mesa->jogadores()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);
        $ana = $mesa->jogadores()->create(['nome' => 'Ana', 'papel' => 'jogador', 'cor' => '#2563eb']);
        $pagina = $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1]);
        $aria = $mesa->personagens()->create(['nome' => 'Aria', 'cor' => '#0ea5e9']);
        $aria->jogadores()->attach($ana);
        $bruto = $mesa->personagens()->create(['nome' => 'Bruto', 'cor' => '#ef4444']);
        $token = fn ($p) => $pagina->objetos()->create(['camada' => 'jogadores', 'tipo' => 'token', 'personagem_id' => $p->id, 'nome' => $p->nome, 'x' => 0, 'y' => 0, 'largura' => 70, 'altura' => 70, 'z' => 1]);
        $token($aria);
        $token($bruto);
        $item = fn ($id, $p) => ['id' => $id, 'nome' => $p->nome, 'cor' => '#000', 'personagem_id' => $p->id, 'objeto_id' => null, 'disposicao' => 'aliado', 'iniciativa' => 10, 'acoes' => [], 'movimento' => ['usado' => 0.0, 'bonus' => 0.0]];
        $mesa->combate = ['ativo' => true, 'fase' => 'em_curso', 'rodada' => 1, 'atual' => 'a', 'itens' => [$item('a', $aria), $item('b', $bruto)]];
        $mesa->save();

        $rota = fn ($p) => route('jogo.personagens.excluir', [$mesa->id, $p->id]);
        $this->como($ana)->deleteJson($rota($aria))->assertForbidden(); // jogador, nem o dono, exclui
        $this->assertNotNull($aria->fresh());

        $this->como($mestre)->deleteJson($rota($aria))->assertOk();
        $this->assertNull($aria->fresh());
        $this->assertSame(0, Objeto::where('personagem_id', $aria->id)->count());
        $this->assertSame(1, Objeto::where('personagem_id', $bruto->id)->count()); // o dos outros fica
        $c = $mesa->fresh()->combate;
        $this->assertSame(['b'], array_column($c['itens'], 'id'));
        $this->assertSame('b', $c['atual']); // era o turno da Aria: passa para o primeiro da fila

        $outra = User::factory()->create()->mesas()->create(['nome' => 'O', 'slug' => 'o-'.uniqid(), 'sistema_id' => $mesa->sistema_id, 'tema_entrada' => 'padrao']);
        $estranho = $outra->personagens()->create(['nome' => 'X', 'cor' => '#000']);
        $this->como($mestre)->deleteJson($rota($estranho))->assertNotFound(); // de outra mesa
    }
}
