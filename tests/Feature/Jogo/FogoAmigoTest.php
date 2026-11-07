<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Sem fogo amigo: jogador não machuca jogador nem NPC machuca NPC (em combate vale a disposição de cada um). */
class FogoAmigoTest extends TestCase
{
    use RefreshDatabase;

    private function cenario(): object
    {
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        $mesa = User::factory()->create()->mesas()->create([
            'nome' => 'T', 'slug' => 't-'.uniqid(), 'sistema_id' => Sistema::where('slug', 'one-piece')->value('id'), 'tema_entrada' => 'padrao',
        ]);
        $mestre = $mesa->jogadores()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);
        $ana = $mesa->jogadores()->create(['nome' => 'Ana', 'papel' => 'jogador', 'cor' => '#2563eb']);
        $bia = $mesa->jogadores()->create(['nome' => 'Bia', 'papel' => 'jogador', 'cor' => '#16a34a']);
        $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1]);
        $aria = $mesa->personagens()->create(['nome' => 'Aria', 'cor' => '#0ea5e9']);
        $aria->jogadores()->attach($ana);
        $bruno = $mesa->personagens()->create(['nome' => 'Bruno', 'cor' => '#ef4444']);
        $bruno->jogadores()->attach($bia);
        $orc = $mesa->personagens()->create(['nome' => 'Orc', 'cor' => '#555555']);
        $goblin = $mesa->personagens()->create(['nome' => 'Goblin', 'cor' => '#777777']);

        return (object) compact('mesa', 'mestre', 'ana', 'bia', 'aria', 'bruno', 'orc', 'goblin');
    }

    private function como(Jogador $j)
    {
        return $this->withSession(['acesso_mesas' => [$j->mesa_id => [$j->id => true]]])->withHeader('X-Jogador', (string) $j->id);
    }

    private function atacar($c, $quem, $de, $contra)
    {
        return $this->como($quem)->postJson(route('jogo.rolagens.store', $c->mesa->id), [
            'expressao' => '1d20+@ataque', 'visibilidade' => 'todos', 'personagem_id' => $de->id, 'alvo_personagem_id' => $contra->id,
        ]);
    }

    public function test_jogador_contra_jogador_e_npc_contra_npc_sao_recusados_e_o_resto_vale(): void
    {
        $c = $this->cenario();
        $this->atacar($c, $c->ana, $c->aria, $c->bruno)->assertStatus(422)->assertJsonValidationErrors('alvo_personagem_id'); // PC → PC
        $this->atacar($c, $c->mestre, $c->orc, $c->goblin)->assertStatus(422);                                                   // NPC → NPC
        $this->atacar($c, $c->ana, $c->aria, $c->orc)->assertCreated();                                                          // PC → NPC
        $this->atacar($c, $c->mestre, $c->orc, $c->aria)->assertCreated();                                                       // NPC → PC
        $this->atacar($c, $c->ana, $c->aria, $c->aria)->assertCreated();                                                         // a si mesmo não é "outro": fora da regra
    }

    public function test_aplicar_o_dano_do_chat_no_aliado_e_recusado(): void
    {
        $c = $this->cenario();
        $m = $this->como($c->ana)->postJson(route('jogo.rolagens.store', $c->mesa->id), [
            'expressao' => '5', 'visibilidade' => 'todos', 'personagem_id' => $c->aria->id, 'dano' => ['tipo' => 'cortante'],
        ])->assertCreated()->json();
        $this->como($c->ana)->postJson(route('jogo.personagens.dano', [$c->mesa->id, $c->bruno->id]), ['mensagem_id' => $m['id']])->assertStatus(422);
        $this->como($c->ana)->postJson(route('jogo.personagens.dano', [$c->mesa->id, $c->orc->id]), ['mensagem_id' => $m['id']])->assertOk();
    }

    public function test_em_combate_vale_a_disposicao_o_npc_aliado_dos_jogadores_nao_apanha_deles(): void
    {
        $c = $this->cenario();
        $item = fn ($id, $p, $disp) => ['id' => $id, 'nome' => $p->nome, 'cor' => '#000', 'personagem_id' => $p->id, 'objeto_id' => null, 'disposicao' => $disp, 'iniciativa' => 10, 'acoes' => [], 'movimento' => ['usado' => 0.0, 'bonus' => 0.0]];
        $c->mesa->combate = ['ativo' => true, 'fase' => 'em_curso', 'rodada' => 1, 'atual' => 'a', 'itens' => [$item('a', $c->aria, 'jogadores'), $item('b', $c->orc, 'aliado'), $item('c', $c->goblin, 'inimigo')]];
        $c->mesa->save();
        $this->atacar($c, $c->mestre, $c->aria, $c->orc)->assertStatus(422);     // o Orc é aliado dos jogadores
        $this->atacar($c, $c->mestre, $c->orc, $c->goblin)->assertCreated();      // aliado → inimigo vale
        $this->atacar($c, $c->mestre, $c->goblin, $c->aria)->assertCreated();     // inimigo → jogador vale
    }

    public function test_salvaguarda_em_area_recusa_aliados_entre_os_alvos(): void
    {
        $c = $this->cenario();
        $abrir = fn (array $alvos) => $this->como($c->ana)->postJson(route('jogo.tecnicas.salvaguarda.abrir', $c->mesa->id), [
            'personagem_id' => $c->aria->id, 'nome' => 'Explosão', 'atributo' => 'des', 'alvos' => $alvos, 'dano' => ['expressao' => '5', 'tipo' => 'fogo'],
        ]);
        $abrir([$c->orc->id, $c->bruno->id])->assertStatus(422)->assertJsonValidationErrors('alvos');
        $abrir([$c->orc->id, $c->goblin->id])->assertCreated();
    }
}
