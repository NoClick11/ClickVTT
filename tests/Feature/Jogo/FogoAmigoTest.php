<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Sem fogo amigo: jogador só acerta NPC (não aliado) e NPC só acerta jogador; o mestre pode ligar o fogo amigo. */
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

    public function test_jogador_so_acerta_npc_e_npc_so_acerta_jogador(): void
    {
        $c = $this->cenario();
        $this->atacar($c, $c->ana, $c->aria, $c->bruno)->assertStatus(422)->assertJsonValidationErrors('alvo_personagem_id'); // PC → PC
        $this->atacar($c, $c->mestre, $c->orc, $c->goblin)->assertStatus(422);                                                   // NPC → NPC
        $this->atacar($c, $c->ana, $c->aria, $c->orc)->assertCreated();                                                          // PC → NPC
        $this->atacar($c, $c->mestre, $c->orc, $c->aria)->assertCreated();                                                       // NPC → PC
        $this->atacar($c, $c->ana, $c->aria, $c->aria)->assertCreated();                                                         // a si mesmo não é "outro"
    }

    public function test_npc_aliado_nao_e_atingido_pelos_jogadores_e_so_o_mestre_marca(): void
    {
        $c = $this->cenario();
        $marcar = fn ($quem, bool $v) => $this->como($quem)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $c->orc->id]), ['campos' => ['aliado' => $v]]);
        $marcar($c->ana, true)->assertForbidden(); // jogador não marca (nem o dono de outro personagem)
        $marcar($c->mestre, true)->assertOk();
        $this->atacar($c, $c->ana, $c->aria, $c->orc)->assertStatus(422); // o Orc agora é aliado
        $this->atacar($c, $c->ana, $c->aria, $c->goblin)->assertCreated(); // o Goblin segue inimigo
        $this->atacar($c, $c->mestre, $c->goblin, $c->orc)->assertStatus(422); // NPC → NPC segue proibido (aliado ou não)
        $this->assertTrue($c->orc->fresh()->paraFront()['aliado']); // público: a tela filtra a área dos jogadores por isto
        $marcar($c->mestre, false)->assertOk();
        $this->atacar($c, $c->ana, $c->aria, $c->orc)->assertCreated();
    }

    public function test_o_mestre_liga_o_fogo_amigo_e_tudo_passa_a_valer(): void
    {
        $c = $this->cenario();
        $rota = route('jogo.fogo-amigo', $c->mesa->id);
        $this->como($c->ana)->patchJson($rota, ['ligado' => true])->assertForbidden(); // só o mestre
        $this->assertFalse((bool) $c->mesa->fresh()->fogo_amigo);

        $this->como($c->mestre)->patchJson($rota, ['ligado' => true])->assertOk()->assertJson(['fogo_amigo' => true]);
        $this->atacar($c, $c->ana, $c->aria, $c->bruno)->assertCreated();       // PC → PC
        $this->atacar($c, $c->mestre, $c->orc, $c->goblin)->assertCreated();    // NPC → NPC
        $this->como($c->mestre)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $c->orc->id]), ['campos' => ['aliado' => true]])->assertOk();
        $this->atacar($c, $c->ana, $c->aria, $c->orc)->assertCreated();         // até o NPC aliado

        $this->como($c->mestre)->patchJson($rota, ['ligado' => false])->assertOk();
        $this->atacar($c, $c->ana, $c->aria, $c->bruno)->assertStatus(422);
    }

    public function test_aplicar_o_dano_do_chat_segue_a_mesma_regra(): void
    {
        $c = $this->cenario();
        $m = $this->como($c->ana)->postJson(route('jogo.rolagens.store', $c->mesa->id), [
            'expressao' => '5', 'visibilidade' => 'todos', 'personagem_id' => $c->aria->id, 'dano' => ['tipo' => 'cortante'],
        ])->assertCreated()->json();
        $this->como($c->ana)->postJson(route('jogo.personagens.dano', [$c->mesa->id, $c->bruno->id]), ['mensagem_id' => $m['id']])->assertStatus(422);
        $this->como($c->ana)->postJson(route('jogo.personagens.dano', [$c->mesa->id, $c->orc->id]), ['mensagem_id' => $m['id']])->assertOk();
    }

    public function test_salvaguarda_em_area_recusa_quem_nao_pode_ser_atingido(): void
    {
        $c = $this->cenario();
        $abrir = fn (array $alvos) => $this->como($c->ana)->postJson(route('jogo.tecnicas.salvaguarda.abrir', $c->mesa->id), [
            'personagem_id' => $c->aria->id, 'nome' => 'Explosão', 'atributo' => 'des', 'alvos' => $alvos, 'dano' => ['expressao' => '5', 'tipo' => 'fogo'],
        ]);
        $abrir([$c->orc->id, $c->bruno->id])->assertStatus(422)->assertJsonValidationErrors('alvos'); // Bruno é jogador
        $abrir([$c->orc->id, $c->goblin->id])->assertCreated();
    }

    public function test_camadas_oculto_nao_e_visto_pelos_jogadores_e_o_que_ele_faz_so_o_mestre_ve(): void
    {
        $c = $this->cenario();
        $pagina = $c->mesa->paginas()->first();
        $token = fn ($p, $camada, $x) => $pagina->objetos()->create(['camada' => $camada, 'tipo' => 'token', 'personagem_id' => $p->id, 'nome' => $p->nome, 'x' => $x, 'y' => 0, 'largura' => 70, 'altura' => 70, 'z' => 1]);
        $token($c->aria, 'jogadores', 0);
        $token($c->orc, 'mestre', 70);        // NPC escondido na camada do Mestre
        $token($c->goblin, 'jogadores', 140); // NPC à vista
        $item = fn ($id, $p, $disp, $ini) => ['id' => $id, 'nome' => $p->nome, 'cor' => '#000', 'personagem_id' => $p->id, 'objeto_id' => null, 'disposicao' => $disp, 'iniciativa' => $ini, 'acoes' => [], 'movimento' => ['usado' => 0.0, 'bonus' => 0.0]];
        $c->mesa->combate = ['ativo' => true, 'fase' => 'em_curso', 'rodada' => 1, 'atual' => 'a', 'itens' => [$item('a', $c->aria, 'jogadores', 20), $item('b', $c->orc, 'inimigo', 15), $item('c', $c->goblin, 'inimigo', 10)]];
        $c->mesa->save();
        $ativar = fn ($quem, $de) => $this->como($quem)->postJson(route('jogo.combate.tecnicas-ativas.ativar', $c->mesa->id), [
            'personagem_id' => $de->id, 'nome' => 'Quick Draw', 'rodadas' => 5, 'alcance' => 30, 'dano' => ['expressao' => '1d4'],
        ])->assertOk();
        $turno = fn () => $this->como($c->mestre)->postJson(route('jogo.combate.comando', $c->mesa->id), ['comando' => 'turno', 'sentido' => 'proximo'])->assertOk();

        // a Aria (à vista) ativa: o Orc escondido não é "criatura que ela veja"; o Goblin à vista é
        $ativar($c->ana, $c->aria);
        $turno(); // vez do Orc (oculto)
        $this->assertSame(0, $c->mesa->mensagens()->where('tipo', 'gatilho')->count());
        $turno(); // vez do Goblin
        $this->assertSame(1, $c->mesa->mensagens()->where('tipo', 'gatilho')->count());
        $this->assertSame('todos', $c->mesa->mensagens()->where('tipo', 'gatilho')->first()->visibilidade);

        // Salvaguarda em área dos jogadores: alvo escondido é recusado (o mestre pode)
        $abrir = fn ($quem, array $alvos) => $this->como($quem)->postJson(route('jogo.tecnicas.salvaguarda.abrir', $c->mesa->id), [
            'personagem_id' => $c->aria->id, 'nome' => 'Explosão', 'atributo' => 'des', 'alvos' => $alvos, 'dano' => ['expressao' => '5', 'tipo' => 'fogo'],
        ]);
        $abrir($c->ana, [$c->orc->id])->assertStatus(422)->assertJsonValidationErrors('alvos');
        $abrir($c->mestre, [$c->orc->id])->assertCreated();
    }

    public function test_personagem_oculto_com_tecnica_ativa_so_aparece_para_o_mestre(): void
    {
        $c = $this->cenario();
        $pagina = $c->mesa->paginas()->first();
        $token = fn ($p, $camada, $x) => $pagina->objetos()->create(['camada' => $camada, 'tipo' => 'token', 'personagem_id' => $p->id, 'nome' => $p->nome, 'x' => $x, 'y' => 0, 'largura' => 70, 'altura' => 70, 'z' => 1]);
        $token($c->aria, 'jogadores', 0);
        $token($c->orc, 'mestre', 70); // o Orc escondido ativa a Técnica
        $item = fn ($id, $p, $disp, $ini) => ['id' => $id, 'nome' => $p->nome, 'cor' => '#000', 'personagem_id' => $p->id, 'objeto_id' => null, 'disposicao' => $disp, 'iniciativa' => $ini, 'acoes' => [], 'movimento' => ['usado' => 0.0, 'bonus' => 0.0]];
        $c->mesa->combate = ['ativo' => true, 'fase' => 'em_curso', 'rodada' => 1, 'atual' => 'b', 'itens' => [$item('a', $c->aria, 'jogadores', 10), $item('b', $c->orc, 'inimigo', 20)]];
        $c->mesa->save();
        $this->como($c->mestre)->postJson(route('jogo.combate.tecnicas-ativas.ativar', $c->mesa->id), [
            'personagem_id' => $c->orc->id, 'nome' => 'Quick Draw', 'rodadas' => 5, 'alcance' => 30, 'dano' => ['expressao' => '1d4'],
        ])->assertOk();
        $this->como($c->mestre)->postJson(route('jogo.combate.comando', $c->mesa->id), ['comando' => 'turno', 'sentido' => 'proximo'])->assertOk(); // vez da Aria
        $gatilho = $c->mesa->mensagens()->where('tipo', 'gatilho')->first();
        $this->assertNotNull($gatilho, 'um personagem oculto pode atacar quem está ao alcance');
        $this->assertSame('mestre', $gatilho->visibilidade);
        $this->assertSame('mestre', $c->mesa->mensagens()->where('texto', 'like', '%ativa Quick Draw%')->first()->visibilidade);
        // a Ana (jogadora) não recebe esses cards
        $this->assertNull($gatilho->para($c->ana));
        $this->assertNotNull($gatilho->para($c->mestre));
    }
}
