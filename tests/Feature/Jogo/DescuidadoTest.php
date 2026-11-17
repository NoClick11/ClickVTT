<?php

namespace Tests\Feature\Jogo;

use App\Models\Sistema;
use App\Models\User;
use App\Nucleo\Combate\Duracoes;
use App\Nucleo\Rolagem\Rolador;
use App\Sistemas\OnePiece\FichaOnePiece;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Descuidado (NPC): quem o ataca rola com vantagem enquanto a marca está ligada; ela desliga no início do turno dele. */
class DescuidadoTest extends TestCase
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
        $aria->forceFill(['ficha' => FichaOnePiece::padrao()])->save();
        $aria->jogadores()->attach($ana);
        $npc = $mesa->personagens()->create(['nome' => 'Gideon', 'cor' => '#555555']);
        $npc->forceFill(['ficha' => [...FichaOnePiece::padrao(), 'npc' => ['nome' => 'Gideon', 'descuidado' => false]]])->save();

        return (object) compact('mesa', 'mestre', 'ana', 'aria', 'npc');
    }

    private function atacar($c, string $expressao)
    {
        $this->app->instance(Rolador::class, new Rolador(fn (int $faces) => 5));

        return $this->withSession(['acesso_mesas' => [$c->mesa->id => [$c->ana->id => true]]])->withHeader('X-Jogador', (string) $c->ana->id)
            ->postJson(route('jogo.rolagens.store', $c->mesa->id), ['expressao' => $expressao, 'visibilidade' => 'todos', 'personagem_id' => $c->aria->id, 'alvo_personagem_id' => $c->npc->id])
            ->assertCreated()->json('dados');
    }

    private function descuidado($c, bool $ligado): void
    {
        $f = $c->npc->ficha;
        $f['npc']['descuidado'] = $ligado;
        $c->npc->forceFill(['ficha' => $f])->save();
    }

    public function test_ataque_contra_npc_descuidado_rola_com_vantagem_e_desvantagem_se_anula(): void
    {
        $c = $this->cenario();
        $this->assertSame('1d20+@ataque', $this->atacar($c, '1d20+@ataque')['expressao']);

        $this->descuidado($c, true);
        $r = $this->atacar($c, '1d20+@ataque');
        $this->assertStringStartsWith('2d20kh1', $r['expressao']);
        $this->assertTrue($r['sistema']['descuidado']);
        $this->assertStringStartsWith('1d20', $this->atacar($c, '2d20kl1+@ataque')['expressao']); // desvantagem + vantagem
        $this->assertStringStartsWith('2d20kh1', $this->atacar($c, '2d20kh1+@ataque')['expressao']); // já tinha vantagem: não soma
    }

    public function test_o_descuidado_do_npc_desliga_no_inicio_do_turno_dele(): void
    {
        $c = $this->cenario();
        $this->descuidado($c, true);
        Duracoes::iniciarTurno($c->mesa, $c->npc->id);
        $this->assertFalse($c->npc->fresh()->ficha['npc']['descuidado']);
    }
}
