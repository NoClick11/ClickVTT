<?php

namespace Tests\Feature\Jogo;

use App\Models\Loot;
use App\Models\Sistema;
use App\Models\User;
use App\Sistemas\OnePiece\Itens;
use App\Sistemas\OnePiece\Tesouros;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BauDoTesouroTest extends TestCase
{
    use RefreshDatabase;

    public function test_tabela_cobre_1_a_100_e_itens_existem_no_catalogo(): void
    {
        $ids = array_column(Itens::catalogo()['itens'], 'id');
        for ($d = 1; $d <= 100; $d++) {
            $r = Tesouros::resolver($d);
            foreach ($r['itens'] as $i) {
                $this->assertContains($i['ref'], $ids, "d100={$d}");
            }
        }
        $this->assertSame(0, Tesouros::resolver(3)['dinheiro']);
        $this->assertSame(1000000000, Tesouros::resolver(97)['dinheiro']);
    }

    public function test_bau_travado_so_abre_para_o_jogador_e_sorteia_uma_vez(): void
    {
        $mesa = User::factory()->create()->mesas()->create([
            'nome' => 'T', 'slug' => 't-'.uniqid(), 'sistema_id' => Sistema::where('slug', 'one-piece')->value('id'), 'tema_entrada' => 'padrao',
        ]);
        $mestre = $mesa->jogadores()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);
        $ana = $mesa->jogadores()->create(['nome' => 'Ana', 'papel' => 'jogador', 'cor' => '#2563eb']);
        $bia = $mesa->jogadores()->create(['nome' => 'Bia', 'papel' => 'jogador', 'cor' => '#16a34a']);
        $pagina = $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1]);
        $como = fn ($j) => $this->withSession(['acesso_mesas' => [$j->mesa_id => [$j->id => true]]])->withHeader('X-Jogador', (string) $j->id);

        $id = $como($mestre)->postJson(route('jogo.loot.criar', [$mesa->id, $pagina->id]), ['camada' => 'jogadores', 'x' => 0, 'y' => 0])->json('objeto.id');
        $como($mestre)->patchJson(route('jogo.loot.update', [$mesa->id, $id]), ['tesouro' => true, 'jogador_id' => $ana->id])->assertOk()->assertJsonPath('tesouro', true);

        $como($bia)->getJson(route('jogo.loot.mostrar', [$mesa->id, $id]))->assertForbidden();
        $como($bia)->postJson(route('jogo.loot.sortear', [$mesa->id, $id]))->assertForbidden();
        $como($ana)->postJson(route('jogo.loot.sortear', [$mesa->id, $id]))->assertOk()->assertJsonStructure(['sorteio' => ['d100', 'texto']]);
        $como($ana)->postJson(route('jogo.loot.sortear', [$mesa->id, $id]))->assertStatus(409);
        $como($mestre)->postJson(route('jogo.loot.sortear', [$mesa->id, $id]))->assertOk();
        $this->assertNotNull(Loot::where('objeto_id', $id)->first()->sorteio);
    }
}
