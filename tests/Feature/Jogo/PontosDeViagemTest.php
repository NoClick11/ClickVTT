<?php

namespace Tests\Feature\Jogo;

use App\Models\Objeto;
use App\Models\Sistema;
use App\Models\User;
use App\Sistemas\OnePiece\FichaOnePiece;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PontosDeViagemTest extends TestCase
{
    use RefreshDatabase;

    public function test_ligar_vale_nos_dois_sentidos_e_o_token_chega_na_frente(): void
    {
        $mesa = User::factory()->create()->mesas()->create([
            'nome' => 'T', 'slug' => 't-'.uniqid(), 'sistema_id' => Sistema::where('slug', 'one-piece')->value('id'), 'tema_entrada' => 'padrao',
        ]);
        $mestre = $mesa->jogadores()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);
        $a = $mesa->paginas()->create(['nome' => 'A', 'ordem' => 1]);
        $b = $mesa->paginas()->create(['nome' => 'B', 'ordem' => 2]);
        $aria = $mesa->personagens()->create(['nome' => 'Aria', 'cor' => '#0ea5e9', 'ficha' => FichaOnePiece::padrao()]);
        $como = fn () => $this->withSession(['acesso_mesas' => [$mesa->id => [$mestre->id => true]]])->withHeader('X-Jogador', (string) $mestre->id);

        $novo = fn ($pagina, $x) => $como()->postJson(route('jogo.objetos.store', [$mesa->id, $pagina->id]), [
            'camada' => 'jogadores', 'tipo' => 'viagem', 'x' => $x, 'y' => 0, 'largura' => 70, 'altura' => 70, 'dados' => ['cor' => '#6366f1'],
        ])->assertCreated()->json('id');
        $pa = $novo($a, 0);
        $pb = $novo($b, 500);
        $token = $como()->postJson(route('jogo.objetos.store', [$mesa->id, $a->id]), [
            'camada' => 'jogadores', 'tipo' => 'token', 'x' => 80, 'y' => 0, 'largura' => 70, 'altura' => 70, 'personagem_id' => $aria->id,
        ])->assertCreated()->json('id');

        $como()->patchJson(route('jogo.objetos.update', [$mesa->id, $pa]), ['dados' => ['destino_objeto_id' => $pb]])
            ->assertOk()->assertJsonPath('dados.destino_pagina_id', $b->id);
        $como()->getJson(route('jogo.objetos.pontos-viagem', $mesa->id))->assertOk()->assertJsonPath('pontos.1.ligado_a', $pa);

        // mesmo mapa é recusado
        $outro = $novo($a, 300);
        $como()->patchJson(route('jogo.objetos.update', [$mesa->id, $outro]), ['dados' => ['destino_objeto_id' => $pa]])->assertStatus(422);

        $r = $como()->postJson(route('jogo.objetos.viajar', [$mesa->id, $pa]), ['personagem_id' => $aria->id])->assertOk();
        $r->assertJsonPath('destino_pagina_id', $b->id);
        $t = Objeto::find($token);
        $this->assertTrue($r->json('token_movido'));
        $this->assertSame($b->id, $t->pagina_id);
        // o ponto B está em (500,0): o token fica embaixo dele, não em cima
        $this->assertSame(500.0, (float) $t->x);
        $this->assertGreaterThan(0.0, (float) $t->y);

        // desligar limpa o outro lado
        $como()->patchJson(route('jogo.objetos.update', [$mesa->id, $pa]), ['dados' => ['destino_objeto_id' => null]])->assertOk();
        $this->assertNull(Objeto::find($pb)->dados['destino_objeto_id']);
    }
}
