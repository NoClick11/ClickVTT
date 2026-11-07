<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
use App\Sistemas\OnePiece\FichaOnePiece;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Ataques com arma: o 1º gasta a Ação; o Ataque Extra e os extras do turno dão mais ataques sem outra Ação. */
class AtaquesPorAcaoTest extends TestCase
{
    use RefreshDatabase;

    private function cenario(array $efeitos): object
    {
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        $mesa = User::factory()->create()->mesas()->create([
            'nome' => 'T', 'slug' => 't-'.uniqid(), 'sistema_id' => Sistema::where('slug', 'one-piece')->value('id'), 'tema_entrada' => 'padrao',
        ]);
        $mestre = $mesa->jogadores()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);
        $ana = $mesa->jogadores()->create(['nome' => 'Ana', 'papel' => 'jogador', 'cor' => '#2563eb']);
        $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1]);
        $p = $mesa->personagens()->create(['nome' => 'Atirador', 'cor' => '#0ea5e9']);
        $p->jogadores()->attach($ana);
        $arma = $mesa->itens()->create([
            'nome' => 'Mosquete', 'peso' => 4, 'equipavel' => true,
            'dados' => ['arma' => ['dano' => '1d12', 'atributo' => 'des', 'tipoDano' => 'Perfurante', 'proficiente' => true, 'distancia' => true]],
        ]);
        $f = FichaOnePiece::padrao();
        $f['inventario'] = [['secao' => 'Equipamento', 'itens' => [['item_id' => $arma->id, 'qtd' => 1, 'equipado' => true, 'sintonizado' => false]]]];
        $f['caracteristicas'] = [['nome' => 'Ataque Extra', 'origem' => 'Atirador', 'tipo' => 'passiva', 'descricao' => '', 'efeitos' => $efeitos]];
        $p->ficha = $f;
        $p->save();
        $item = ['id' => 'a', 'nome' => 'Atirador', 'cor' => '#000', 'personagem_id' => $p->id, 'objeto_id' => null, 'disposicao' => 'aliado', 'iniciativa' => 10, 'acoes' => [], 'movimento' => ['usado' => 0.0, 'bonus' => 0.0]];
        $outro = [...$item, 'id' => 'b', 'nome' => 'Outro', 'personagem_id' => null];
        $mesa->combate = ['ativo' => true, 'fase' => 'em_curso', 'rodada' => 1, 'atual' => 'a', 'itens' => [$item, $outro]];
        $mesa->save();

        return (object) compact('mesa', 'mestre', 'ana', 'p', 'arma');
    }

    private function como(Jogador $j)
    {
        return $this->withSession(['acesso_mesas' => [$j->mesa_id => [$j->id => true]]])->withHeader('X-Jogador', (string) $j->id);
    }

    private function atacar($c)
    {
        return $this->como($c->ana)->postJson(route('jogo.rolagens.store', $c->mesa->id), [
            'expressao' => "1d20+@arma.{$c->arma->id}.ataque", 'rotulo' => 'Mosquete', 'visibilidade' => 'todos', 'personagem_id' => $c->p->id,
            'acao' => ['categoria' => 'padrao'],
        ]);
    }

    public function test_sem_ataque_extra_so_um_ataque_por_turno(): void
    {
        $c = $this->cenario([]);
        $this->atacar($c)->assertCreated();
        $this->atacar($c)->assertStatus(422)->assertJsonValidationErrors('acao');
        $item = $c->mesa->fresh()->combate['itens'][0];
        $this->assertSame(1, $item['acoes']['padrao']);
        $this->assertSame(1, $item['acoes']['ataques']);
    }

    public function test_ataque_extra_da_dois_e_os_a_distancia_somam_so_em_arma_a_distancia(): void
    {
        $c = $this->cenario([['alvo' => 'ataques.acao', 'modo' => 'soma', 'valor' => 1]]);
        $this->atacar($c)->assertCreated();
        $this->atacar($c)->assertCreated();
        $this->assertSame(1, $c->mesa->fresh()->combate['itens'][0]['acoes']['padrao']); // uma só Ação gasta
        $this->assertSame(2, $c->mesa->fresh()->combate['itens'][0]['acoes']['ataques']);
        $this->atacar($c)->assertStatus(422);

        // Engatilhado: +2 à distância (o mosquete é à distância): 2 + 2 = 4
        $d = $this->cenario([
            ['alvo' => 'ataques.acao', 'modo' => 'soma', 'valor' => 1],
            ['alvo' => 'ataques.distancia', 'modo' => 'soma', 'valor' => 2],
        ]);
        foreach (range(1, 4) as $i) {
            $this->atacar($d)->assertCreated();
        }
        $this->atacar($d)->assertStatus(422);
    }

    public function test_ataques_extras_do_turno_somam_ao_limite_e_so_no_turno_de_quem_ataca(): void
    {
        $c = $this->cenario([]);
        $extras = fn ($j, int $n) => $this->como($j)->postJson(route('jogo.combate.ataques-extras', $c->mesa->id), ['personagem_id' => $c->p->id, 'n' => $n]);
        $this->atacar($c)->assertCreated();
        $this->atacar($c)->assertStatus(422);
        $extras($c->ana, 2)->assertOk();
        $this->atacar($c)->assertCreated();
        $this->atacar($c)->assertCreated();
        $this->atacar($c)->assertStatus(422);
        $extras($c->ana, -1)->assertOk(); // desfaz um
        $this->assertSame(1, $c->mesa->fresh()->combate['itens'][0]['acoes']['extras']);
        $extras($c->ana, -5)->assertOk(); // nunca abaixo de 0
        $this->assertArrayNotHasKey('extras', $c->mesa->fresh()->combate['itens'][0]['acoes']);

        // fora do turno dele, o jogador não ganha extras; o mestre pode
        $m = $c->mesa->fresh();
        $combate = $m->combate;
        $combate['atual'] = 'b';
        $m->combate = $combate;
        $m->save();
        $extras($c->ana, 1)->assertStatus(422);
        $extras($c->mestre, 1)->assertOk();
    }

    public function test_o_mestre_nao_tem_limite_de_ataques(): void
    {
        $c = $this->cenario([]);
        foreach (range(1, 4) as $i) {
            $this->como($c->mestre)->postJson(route('jogo.rolagens.store', $c->mesa->id), [
                'expressao' => "1d20+@arma.{$c->arma->id}.ataque", 'visibilidade' => 'todos', 'personagem_id' => $c->p->id, 'acao' => ['categoria' => 'padrao'],
            ])->assertCreated();
        }
    }
}
