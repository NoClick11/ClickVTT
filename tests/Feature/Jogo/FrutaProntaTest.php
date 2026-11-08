<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Fruta pronta entregue pelo mestre: a ficha aceita a fruta, as Técnicas e as características dela (marcadas `fruta`). */
class FrutaProntaTest extends TestCase
{
    use RefreshDatabase;

    private function cenario(): object
    {
        $mesa = User::factory()->create()->mesas()->create([
            'nome' => 'T', 'slug' => 't-'.uniqid(), 'sistema_id' => Sistema::where('slug', 'one-piece')->value('id'), 'tema_entrada' => 'padrao',
        ]);
        $mestre = $mesa->jogadores()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);
        $ana = $mesa->jogadores()->create(['nome' => 'Ana', 'papel' => 'jogador', 'cor' => '#2563eb']);
        $aria = $mesa->personagens()->create(['nome' => 'Aria', 'cor' => '#0ea5e9']);
        $aria->jogadores()->attach($ana);

        return (object) compact('mesa', 'mestre', 'ana', 'aria');
    }

    private function como(Jogador $j)
    {
        return $this->withSession(['acesso_mesas' => [$j->mesa_id => [$j->id => true]]])->withHeader('X-Jogador', (string) $j->id);
    }

    public function test_o_mestre_entrega_a_fruta_com_tecnicas_e_caracteristicas_e_a_ficha_guarda(): void
    {
        $c = $this->cenario();
        $tecnica = fn (string $nome, string $origem, int $custo) => ['nome' => $nome, 'origem' => $origem, 'custo' => $custo, 'alcance' => 'Toque', 'efeito' => '2d10 Cortante', 'rolagem' => '2d10',
            'descricao' => 'Cordas de Cinco Cores.', 'tipoDano' => 'cortante', 'acao' => 'poderosa', 'teste' => ['tipo' => 'ataque'], 'builder' => 'fruta'];
        $r = $this->como($c->mestre)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $c->aria->id]), ['campos' => [
            'akuma.tipo' => 'paramecia', 'akuma.usuario' => 'avancado', 'akuma.propriedades' => ['criacao', 'manipulacao'], 'akuma.fruta' => 'ito-ito-no-mi',
            'akuma.lista' => [$tecnica('Goshikito', 'Ito-Ito no Mi: 1º Grau', 2)],
            'caracteristicas' => [[
                'nome' => 'Estágio Desperto', 'origem' => 'Akuma no Mi: Ito-Ito no Mi', 'tipo' => 'ativa', 'ativa' => false, 'interruptor' => true, 'builder' => 'fruta',
                'usos' => ['atual' => 3, 'max' => 3], 'descricao' => '', 'efeitos' => [['alvo' => 'pp.max', 'modo' => 'soma', 'valor' => 10]],
            ]],
        ]]);
        $r->assertOk();
        $ficha = $c->aria->fresh()->ficha;
        $this->assertSame('ito-ito-no-mi', $ficha['akuma']['fruta']);
        $this->assertSame('fruta', $ficha['akuma']['lista'][0]['builder']);
        $this->assertSame('fruta', $ficha['caracteristicas'][0]['builder']);
    }
}
